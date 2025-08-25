package api

import (
	"fmt"
	"strconv"
	"strings"

	"purdue_schedule/internal/data"
)

// SVGSchedule represents a schedule rendered as SVG
type SVGSchedule struct {
	Width     int
	Height    int
	Content   string
	TimeRange TimeRange
	Events    []SVGEvent
}

// TimeRange represents the time span of the schedule
type TimeRange struct {
	StartHour int
	EndHour   int
}

// SVGEvent represents a course event in the schedule
type SVGEvent struct {
	ID          string
	Title       string
	Instructor  string
	Location    string
	Type        string
	Day         int // 0=Monday, 1=Tuesday, etc.
	StartMinute int // Minutes from midnight
	EndMinute   int
	Color       string
	X           float64
	Y           float64
	Width       float64
	Height      float64
}

// Color palettes for departments (matching frontend exactly)
var departmentColors = map[string][]string{
	"CS":   {"#CFB991", "#B8A47E", "#A1906B", "#8A7B58", "#736645"},
	"MA":   {"#2C2C2C", "#404040", "#545454", "#686868", "#7C7C7C"},
	"PHYS": {"#8B4513", "#A0522D", "#CD853F", "#DEB887", "#F4A460"},
	"ECE":  {"#4169E1", "#6495ED", "#87CEEB", "#B0C4DE", "#E6F3FF"}, // Fixed to match frontend
	"ME":   {"#DC143C", "#F08080", "#FA8072", "#FFA07A", "#FFB6C1"},
	"CHEM": {"#228B22", "#32CD32", "#90EE90", "#98FB98", "#F0FFF0"},
	"AAE":  {"#4B0082", "#8A2BE2", "#9370DB", "#BA55D3", "#DDA0DD"},
	"BIOL": {"#FF8C00", "#FFA500", "#FFB347", "#FFCC99", "#FFE4B5"},
}

// GenerateSVGSchedule creates an SVG representation of the schedule
func GenerateSVGSchedule(sections []data.SectionInfo, courseBySection map[string]data.CourseSummary, width, height int) (*SVGSchedule, error) {
	// Calculate time range
	timeRange := calculateTimeRange(sections)

	// Convert sections to SVG events
	events := convertToSVGEvents(sections, courseBySection, timeRange, width, height)

	// Generate SVG content
	svgContent := generateSVGContent(events, timeRange, width, height)

	return &SVGSchedule{
		Width:     width,
		Height:    height,
		Content:   svgContent,
		TimeRange: timeRange,
		Events:    events,
	}, nil
}

// calculateTimeRange determines the optimal time range for the schedule
func calculateTimeRange(sections []data.SectionInfo) TimeRange {
	if len(sections) == 0 {
		return TimeRange{StartHour: 8, EndHour: 17} // Default 8 AM - 5 PM
	}

	minHour := 23
	maxHour := 0

	for _, section := range sections {
		for _, meeting := range section.Meetings {
			if meeting.Start == "" {
				continue
			}

			startHour, _ := parseTimeSimple(meeting.Start)
			if startHour >= 0 {
				if startHour < minHour {
					minHour = startHour
				}

				endHour := startHour + (meeting.DurationMin / 60)
				if meeting.DurationMin%60 > 0 {
					endHour++
				}
				if endHour > maxHour {
					maxHour = endHour
				}
			}
		}
	}

	// Add 30 minutes buffer, ensure minimum 4-hour range
	startHour := minHour - 1
	if startHour < 0 {
		startHour = 0
	}

	endHour := maxHour + 1
	if endHour > 23 {
		endHour = 23
	}

	// Ensure minimum 4-hour range
	if endHour-startHour < 4 {
		endHour = startHour + 4
		if endHour > 23 {
			endHour = 23
			startHour = 19
		}
	}

	return TimeRange{StartHour: startHour, EndHour: endHour}
}

// convertToSVGEvents converts course sections to SVG events with positioning
func convertToSVGEvents(sections []data.SectionInfo, courseBySection map[string]data.CourseSummary, timeRange TimeRange, width, height int) []SVGEvent {
	var events []SVGEvent

	// Layout constants
	headerHeight := 60.0
	timeColumnWidth := 80.0
	dayWidth := (float64(width) - timeColumnWidth) / 5.0 // 5 weekdays
	hourHeight := (float64(height) - headerHeight) / float64(timeRange.EndHour-timeRange.StartHour)

	// Department color tracking
	deptColorIndex := make(map[string]int)

	dayMap := map[string]int{
		"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4,
		"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4,
		"M": 0, "T": 1, "W": 2, "R": 3, "F": 4,
	}

	for _, section := range sections {
		course, hasCourse := courseBySection[section.Id]

		// Get department and color
		dept := "DEFAULT"
		if hasCourse && course.SubjectAbbr != "" {
			dept = course.SubjectAbbr
		}

		colors, hasColors := departmentColors[dept]
		if !hasColors {
			colors = []string{"#CFB991"} // Default Purdue gold
		}

		colorIndex := deptColorIndex[dept] % len(colors)
		deptColorIndex[dept]++
		color := colors[colorIndex]

		// Debug: Force all courses to use Royal Blue to test
		color = "#4169E1"

		// Process each meeting
		for _, meeting := range section.Meetings {
			if meeting.Start == "" || len(meeting.Days) == 0 {
				continue
			}

			startHour, startMin := parseTimeSimple(meeting.Start)
			if startHour < 0 {
				continue
			}

			startMinute := startHour*60 + startMin
			endMinute := startMinute + meeting.DurationMin

			// Calculate position
			relativeStartHour := float64(startHour-timeRange.StartHour) + float64(startMin)/60.0
			duration := float64(meeting.DurationMin) / 60.0

			y := headerHeight + (relativeStartHour * hourHeight)
			eventHeight := duration * hourHeight

			for _, dayStr := range meeting.Days {
				dayIndex, hasDay := dayMap[dayStr]
				if !hasDay {
					continue
				}

				x := timeColumnWidth + (float64(dayIndex) * dayWidth)
				eventWidth := dayWidth - 4 // Small margin

				// Create course title
				title := fmt.Sprintf("%s %s", course.SubjectAbbr, course.Number)
				if !hasCourse {
					title = "Unknown Course"
				}

				instructor := "TBA"
				if len(meeting.Instructors) > 0 {
					instructor = meeting.Instructors[0]
				}

				location := ""
				if meeting.BuildingCode != "" && meeting.RoomNumber != "" {
					location = fmt.Sprintf("%s %s", meeting.BuildingCode, meeting.RoomNumber)
				}

				events = append(events, SVGEvent{
					ID:          fmt.Sprintf("%s-%s-%d", section.Id, dayStr, len(events)),
					Title:       title,
					Instructor:  instructor,
					Location:    location,
					Type:        section.Type,
					Day:         dayIndex,
					StartMinute: startMinute,
					EndMinute:   endMinute,
					Color:       color,
					X:           x,
					Y:           y,
					Width:       eventWidth,
					Height:      eventHeight,
				})
			}
		}
	}

	return events
}

// generateSVGContent creates the complete SVG markup
func generateSVGContent(events []SVGEvent, timeRange TimeRange, width, height int) string {
	var svg strings.Builder

	// SVG header
	svg.WriteString(fmt.Sprintf(`<svg width="%d" height="%d" viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg">`, width, height, width, height))
	svg.WriteString(`<defs><style>.schedule-text{font-family:Arial,sans-serif;font-size:12px;fill:#000;}.schedule-small{font-size:10px;}.schedule-tiny{font-size:8px;}.schedule-header{font-weight:bold;font-size:14px;}</style></defs>`)

	// Background
	svg.WriteString(fmt.Sprintf(`<rect width="%d" height="%d" fill="#ffffff" stroke="none"/>`, width, height))

	// Layout constants
	headerHeight := 60.0
	timeColumnWidth := 80.0
	dayWidth := (float64(width) - timeColumnWidth) / 5.0
	hourHeight := (float64(height) - headerHeight) / float64(timeRange.EndHour-timeRange.StartHour)

	// Draw grid
	drawGrid(&svg, timeRange, width, height, headerHeight, timeColumnWidth, dayWidth, hourHeight)

	// Draw events
	for _, event := range events {
		drawEvent(&svg, event)
	}

	svg.WriteString("</svg>")
	return svg.String()
}

// drawGrid creates the schedule grid (time slots and day columns)
func drawGrid(svg *strings.Builder, timeRange TimeRange, width, height int, headerHeight, timeColumnWidth, dayWidth, hourHeight float64) {
	days := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}

	// Draw day headers
	for i, day := range days {
		x := timeColumnWidth + (float64(i) * dayWidth)
		svg.WriteString(fmt.Sprintf(`<rect x="%.1f" y="0" width="%.1f" height="%.1f" fill="#f8f9fa" stroke="#e9ecef" stroke-width="1"/>`, x, dayWidth, headerHeight))
		svg.WriteString(fmt.Sprintf(`<text x="%.1f" y="35" text-anchor="middle" class="schedule-text schedule-header">%s</text>`, x+dayWidth/2, day))
	}

	// Draw time column background
	svg.WriteString(fmt.Sprintf(`<rect x="0" y="0" width="%.1f" height="%d" fill="#f8f9fa" stroke="#e9ecef" stroke-width="1"/>`, timeColumnWidth, height))

	// Draw time labels and horizontal lines
	for hour := timeRange.StartHour; hour <= timeRange.EndHour; hour++ {
		y := headerHeight + (float64(hour-timeRange.StartHour) * hourHeight)

		// Time label
		timeLabel := formatHour(hour)
		svg.WriteString(fmt.Sprintf(`<text x="%.1f" y="%.1f" text-anchor="middle" class="schedule-text">%s</text>`, timeColumnWidth/2, y+5, timeLabel))

		// Horizontal grid line
		svg.WriteString(fmt.Sprintf(`<line x1="%.1f" y1="%.1f" x2="%d" y2="%.1f" stroke="#e9ecef" stroke-width="1"/>`, timeColumnWidth, y, width, y))
	}

	// Draw vertical lines between days
	for i := 0; i <= 5; i++ {
		x := timeColumnWidth + (float64(i) * dayWidth)
		svg.WriteString(fmt.Sprintf(`<line x1="%.1f" y1="0" x2="%.1f" y2="%d" stroke="#e9ecef" stroke-width="1"/>`, x, x, height))
	}

	// Draw header bottom line
	svg.WriteString(fmt.Sprintf(`<line x1="0" y1="%.1f" x2="%d" y2="%.1f" stroke="#CFB991" stroke-width="2"/>`, headerHeight, width, headerHeight))
}

// drawEvent renders a single course event
func drawEvent(svg *strings.Builder, event SVGEvent) {
	// Event rectangle with rounded corners
	svg.WriteString(fmt.Sprintf(`<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" stroke="#ffffff" stroke-width="2" rx="4" ry="4" opacity="0.9" data-event-id="%s"/>`,
		event.X+2, event.Y+1, event.Width-4, event.Height-2, event.Color, event.ID))

	// Type badge (top-right corner)
	badgeX := event.X + event.Width - 25
	badgeY := event.Y + 8
	svg.WriteString(fmt.Sprintf(`<rect x="%.1f" y="%.1f" width="20" height="12" fill="#000000" stroke="none" rx="2" ry="2"/>`, badgeX, badgeY))
	svg.WriteString(fmt.Sprintf(`<text x="%.1f" y="%.1f" text-anchor="middle" class="schedule-text schedule-tiny" fill="#CFB991">%s</text>`, badgeX+10, badgeY+9, strings.ToUpper(event.Type[:min(3, len(event.Type))])))

	// Course title
	titleY := event.Y + 20
	svg.WriteString(fmt.Sprintf(`<text x="%.1f" y="%.1f" class="schedule-text" fill="#ffffff" font-weight="bold">%s</text>`, event.X+6, titleY, event.Title))

	// Instructor (if space allows)
	if event.Height > 40 {
		instructorY := titleY + 16
		svg.WriteString(fmt.Sprintf(`<text x="%.1f" y="%.1f" class="schedule-text schedule-small" fill="#ffffff" opacity="0.9">%s</text>`, event.X+6, instructorY, event.Instructor))
	}

	// Location (if space allows)
	if event.Height > 60 && event.Location != "" {
		locationY := titleY + 32
		svg.WriteString(fmt.Sprintf(`<text x="%.1f" y="%.1f" class="schedule-text schedule-tiny" fill="#ffffff" opacity="0.8">%s</text>`, event.X+6, locationY, event.Location))
	}
}

// Helper functions
func formatHour(hour int) string {
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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// parseTimeSimple parses time strings like "09:00" or "14:30" and returns hour, minute
func parseTimeSimple(timeStr string) (int, int) {
	parts := strings.Split(strings.TrimSpace(timeStr), ":")
	if len(parts) != 2 {
		return -1, -1
	}

	hour, err1 := strconv.Atoi(parts[0])
	minute, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return -1, -1
	}

	return hour, minute
}
