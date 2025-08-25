package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"purdue_schedule/internal/data"

	"github.com/jung-kurt/gofpdf"
)

// generateSVGBasedPDF creates a PDF using SVG-generated schedule data
// This function requires access to the store, so it should be called from a handler method
func generateSVGBasedPDF(w http.ResponseWriter, r *http.Request) error {
	// This is a placeholder - the actual implementation should be in the handler
	// where we have access to the store
	return fmt.Errorf("generateSVGBasedPDF should be called from handler with store access")
}

// generateSVGBasedPDFWithStore creates a PDF using SVG-generated schedule data with store access
func generateSVGBasedPDFWithStore(w http.ResponseWriter, r *http.Request, store *data.Store) error {
	// Parse request parameters
	sectionIds := strings.Split(r.URL.Query().Get("sections"), ",")
	studentName := r.URL.Query().Get("studentName")

	if len(sectionIds) == 0 || sectionIds[0] == "" {
		return fmt.Errorf("no sections provided")
	}

	// Get sections and courses using store methods
	sections := store.SectionsByIds(sectionIds)
	courseBySection := make(map[string]data.CourseSummary)

	for _, section := range sections {
		if course, ok := store.CourseBySectionId(section.Id); ok {
			courseBySection[section.Id] = course
		}
	}

	// Generate SVG schedule data
	svgSchedule, err := GenerateSVGSchedule(sections, courseBySection, 800, 600)
	if err != nil {
		return fmt.Errorf("failed to generate SVG: %v", err)
	}

	// Create PDF in landscape mode
	pdf := gofpdf.New("L", "mm", "A4", "")

	// First page - Schedule
	pdf.AddPage()

	// Black header bar like the website
	pdf.SetFillColor(0, 0, 0)    // Black background
	pdf.Rect(0, 0, 297, 35, "F") // Full width black header

	// BoilerSchedule title in white
	pdf.SetFont("Arial", "B", 24)
	pdf.SetTextColor(255, 255, 255) // White text
	pdf.SetXY(15, 8)
	pdf.Cell(0, 10, "BoilerSchedule")

	// Subtitle
	pdf.SetFont("Arial", "", 12)
	pdf.SetXY(15, 20)
	pdf.Cell(0, 6, "Purdue University Course Schedule - Fall 2025")

	// Student info on the right side of header
	if studentName != "" {
		pdf.SetFont("Arial", "B", 14)
		pdf.SetXY(200, 8)
		pdf.Cell(0, 6, fmt.Sprintf("Student: %s", studentName))

		// Additional student details if provided
		pdf.SetFont("Arial", "", 10)
		pdf.SetXY(200, 16)
		pdf.Cell(0, 4, "Computer Engineering | Freshman")
		pdf.SetXY(200, 22)
		pdf.Cell(0, 4, "upuddu@purdue.edu")
	}

	// Draw the schedule grid manually using the SVG data
	drawPDFSchedule(pdf, svgSchedule)

	// Footer
	pdf.SetY(-15)
	pdf.SetFont("Arial", "I", 8)
	pdf.SetTextColor(100, 100, 100)
	pdf.CellFormat(0, 10, "Made by Umberto Puddu (upuddu@purdue.edu) - Produced by BoilerSchedule", "", 0, "C", false, 0, "")

	// Output PDF
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename=BoilerSchedule.pdf")
	return pdf.Output(w)
}

// drawPDFSchedule renders the schedule grid to exactly match the website
func drawPDFSchedule(pdf *gofpdf.Fpdf, svgSchedule *SVGSchedule) {
	// Layout constants to match the website exactly
	startX := 15.0
	startY := 45.0
	timeColumnWidth := 35.0
	dayWidth := 48.0
	hourHeight := 20.0 // Taller to match website proportions
	headerHeight := 15.0

	days := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}

	// Reset colors and prepare for grid
	pdf.SetTextColor(0, 0, 0)
	pdf.SetDrawColor(200, 200, 200) // Light gray borders like website
	pdf.SetLineWidth(0.5)

	// Draw the main schedule container background (white with subtle border)
	scheduleWidth := timeColumnWidth + (dayWidth * 5)
	scheduleHeight := headerHeight + (float64(svgSchedule.TimeRange.EndHour-svgSchedule.TimeRange.StartHour) * hourHeight)

	pdf.SetFillColor(255, 255, 255) // White background
	pdf.SetDrawColor(220, 220, 220) // Light border
	pdf.RoundedRect(startX, startY, scheduleWidth, scheduleHeight, 3, "1234", "FD")

	// Draw day headers with clean styling like the website
	pdf.SetFont("Arial", "B", 12)
	pdf.SetFillColor(240, 240, 240) // Light gray header background
	pdf.SetTextColor(60, 60, 60)    // Dark gray text

	// Time column header (empty)
	pdf.SetXY(startX, startY)
	pdf.SetDrawColor(200, 200, 200)
	pdf.Rect(startX, startY, timeColumnWidth, headerHeight, "D")

	// Day headers
	for i, day := range days {
		x := startX + timeColumnWidth + (float64(i) * dayWidth)
		pdf.SetFillColor(240, 240, 240)
		pdf.Rect(x, startY, dayWidth, headerHeight, "FD")

		pdf.SetXY(x, startY+2)
		pdf.CellFormat(dayWidth, headerHeight-4, day, "", 0, "C", false, 0, "")
	}

	// Draw time grid with clean lines like the website
	pdf.SetFont("Arial", "", 10)
	pdf.SetTextColor(80, 80, 80) // Darker gray for time labels

	currentY := startY + headerHeight

	// Draw each hour row
	for hour := svgSchedule.TimeRange.StartHour; hour < svgSchedule.TimeRange.EndHour; hour++ {
		timeLabel := formatHourPDF(hour)

		// Time label column
		pdf.SetFillColor(250, 250, 250) // Very light gray
		pdf.Rect(startX, currentY, timeColumnWidth, hourHeight, "FD")

		pdf.SetXY(startX+2, currentY+6)
		pdf.CellFormat(timeColumnWidth-4, 8, timeLabel, "", 0, "C", false, 0, "")

		// Day columns with clean grid
		pdf.SetDrawColor(230, 230, 230) // Subtle grid lines
		for i := 0; i < 5; i++ {
			x := startX + timeColumnWidth + (float64(i) * dayWidth)
			pdf.SetFillColor(255, 255, 255) // White background
			pdf.Rect(x, currentY, dayWidth, hourHeight, "FD")
		}

		currentY += hourHeight
	}

	// Draw events with website-style appearance
	for _, event := range svgSchedule.Events {
		// Calculate precise position
		x := startX + timeColumnWidth + (float64(event.Day) * dayWidth) + 3

		// Calculate Y position with better precision
		hourOffset := (float64(event.StartMinute) / 60.0) - float64(svgSchedule.TimeRange.StartHour)
		y := startY + headerHeight + (hourOffset * hourHeight) + 3

		// Calculate height based on duration
		durationHours := float64(event.EndMinute-event.StartMinute) / 60.0
		height := (durationHours * hourHeight) - 6

		if height < 12 {
			height = 12 // Minimum height for readability
		}

		eventWidth := dayWidth - 6

		// Parse color
		r, g, b := hexToRGB(event.Color)
		pdf.SetFillColor(r, g, b)
		pdf.SetDrawColor(r-20, g-20, b-20) // Slightly darker border
		pdf.SetLineWidth(1.0)

		// Draw rounded rectangle for event (matching website style)
		pdf.RoundedRect(x, y, eventWidth, height, 4, "1234", "FD")

		// Add type badge in top-right corner (matching website exactly)
		if event.Type != "" && height > 15 {
			badgeWidth := 16.0
			badgeHeight := 6.0
			badgeX := x + eventWidth - badgeWidth - 2
			badgeY := y + 2

			pdf.SetFillColor(0, 0, 0) // Black background
			pdf.SetDrawColor(0, 0, 0)
			pdf.RoundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2, "1234", "FD")

			pdf.SetTextColor(207, 185, 145) // Gold text
			pdf.SetFont("Arial", "B", 7)
			pdf.SetXY(badgeX, badgeY+1)
			typeText := strings.ToUpper(event.Type)
			if len(typeText) > 3 {
				typeText = typeText[:3]
			}
			pdf.CellFormat(badgeWidth, badgeHeight-2, typeText, "", 0, "C", false, 0, "")
		}

		// Add course title and instructor with proper spacing
		pdf.SetTextColor(255, 255, 255) // White text

		// Course title
		if height > 12 {
			pdf.SetFont("Arial", "B", 10)
			pdf.SetXY(x+3, y+3)
			titleWidth := eventWidth - 6
			if event.Type != "" {
				titleWidth -= 18 // Account for badge space
			}
			pdf.CellFormat(titleWidth, 6, event.Title, "", 0, "L", false, 0, "")

			// Instructor name
			if height > 20 {
				pdf.SetFont("Arial", "", 8)
				pdf.SetXY(x+3, y+10)
				pdf.CellFormat(titleWidth, 5, event.Instructor, "", 0, "L", false, 0, "")

				// Location (if space allows)
				if height > 28 && event.Location != "" {
					pdf.SetFont("Arial", "", 7)
					pdf.SetXY(x+3, y+16)
					pdf.CellFormat(titleWidth, 4, event.Location, "", 0, "L", false, 0, "")
				}
			}
		}
	}
}

// Helper function to convert hex color to RGB
func hexToRGB(hex string) (int, int, int) {
	if len(hex) != 7 || hex[0] != '#' {
		return 207, 185, 145 // Default to Purdue Gold
	}

	r, _ := strconv.ParseInt(hex[1:3], 16, 0)
	g, _ := strconv.ParseInt(hex[3:5], 16, 0)
	b, _ := strconv.ParseInt(hex[5:7], 16, 0)

	return int(r), int(g), int(b)
}

// Helper function to truncate strings
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// formatHourPDF formats hour for display in PDF
func formatHourPDF(hour int) string {
	if hour == 0 {
		return "12 AM"
	} else if hour < 12 {
		return fmt.Sprintf("%d AM", hour)
	} else if hour == 12 {
		return "12 PM"
	} else {
		return fmt.Sprintf("%d PM", hour-12)
	}
}
