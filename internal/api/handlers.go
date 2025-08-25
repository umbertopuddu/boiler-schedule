package api

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"purdue_schedule/internal/data"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/gorilla/mux"
	"github.com/jung-kurt/gofpdf"
)

type Handler struct {
	store *data.Store
}

func NewHandler(store *data.Store) *Handler {
	return &Handler{store: store}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// GET /api/search?q=
func (h *Handler) HandleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	campus := r.URL.Query().Get("campus")
	if strings.TrimSpace(campus) != "" {
		res := h.store.SearchCoursesByCampus(q, 50, campus)
		writeJSON(w, http.StatusOK, res)
		return
	}
	res := h.store.SearchCourses(q, 50)
	writeJSON(w, http.StatusOK, res)
}

// GET /api/departments
func (h *Handler) HandleDepartments(w http.ResponseWriter, r *http.Request) {
	campus := r.URL.Query().Get("campus")
	if strings.TrimSpace(campus) != "" {
		departments := h.store.GetAllDepartmentsByCampus(campus)
		writeJSON(w, http.StatusOK, departments)
		return
	}
	departments := h.store.GetAllDepartments()
	writeJSON(w, http.StatusOK, departments)
}

// GET /api/course/{id}/sections
func (h *Handler) HandleCourseSections(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	campus := r.URL.Query().Get("campus")
	var secs []data.SectionInfo
	if strings.TrimSpace(campus) != "" {
		secs = h.store.SectionsByCourseCampus(id, campus)
	} else {
		secs = h.store.SectionsByCourse(id)
	}
	if secs == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "course not found"})
		return
	}
	writeJSON(w, http.StatusOK, secs)
}

// OPTIONS handler for CORS preflight
func (h *Handler) HandleOptions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.WriteHeader(http.StatusOK)
}

// GET /api/campuses
func (h *Handler) HandleCampuses(w http.ResponseWriter, r *http.Request) {
	_ = h.store.MaybeFetchCampuses()
	writeJSON(w, http.StatusOK, h.store.GetCampuses())
}

// PDFSectionInfo represents section information for PDF generation
type PDFSectionInfo struct {
	Course   string       `json:"course"`
	Title    string       `json:"title"`
	CRN      string       `json:"crn"`
	Type     string       `json:"type"`
	Meetings []PDFMeeting `json:"meetings"`
}

// PDFMeeting represents meeting information for PDF
type PDFMeeting struct {
	Days        []string `json:"days"`
	Start       string   `json:"start"`
	End         string   `json:"end"`
	Location    string   `json:"location"`
	Instructors []string `json:"instructors"`
}

// ImagePDFRequest represents the request body for PDF generation from image
type ImagePDFRequest struct {
	ImageData   string           `json:"imageData"`
	StudentInfo StudentInfo      `json:"studentInfo"`
	Sections    []PDFSectionInfo `json:"sections"`
}

// POST /api/schedule/pdf-from-image
func (h *Handler) HandlePDFFromImage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req ImagePDFRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Decode base64 image
	imageData := req.ImageData
	if strings.HasPrefix(imageData, "data:image/png;base64,") {
		imageData = strings.TrimPrefix(imageData, "data:image/png;base64,")
	}

	imgBytes, err := base64.StdEncoding.DecodeString(imageData)
	if err != nil {
		http.Error(w, "Failed to decode image", http.StatusBadRequest)
		return
	}

	// Decode PNG to get dimensions
	img, _, err := image.Decode(bytes.NewReader(imgBytes))
	if err != nil {
		http.Error(w, "Failed to decode PNG image", http.StatusBadRequest)
		return
	}

	// Create PDF in landscape mode
	pdf := gofpdf.New("L", "mm", "Letter", "")

	// PAGE 1: Header and Schedule
	pdf.AddPage()

	// Add Purdue-style header with black background
	pdf.SetFillColor(0, 0, 0)      // Black background
	pdf.Rect(0, 0, 279.4, 30, "F") // Full width black header

	pdf.SetTextColor(218, 165, 32) // Purdue gold text
	pdf.SetFont("Arial", "B", 18)
	pdf.SetXY(15, 8)
	pdf.Cell(0, 8, "BoilerSchedule")
	pdf.Ln(6)
	pdf.SetXY(15, 16)
	pdf.SetFont("Arial", "", 12)
	pdf.Cell(0, 6, "Purdue University Course Schedule - Fall 2025")

	// Student info on the right side of header
	if req.StudentInfo.Name != "" {
		pdf.SetXY(180, 8)
		pdf.SetFont("Arial", "", 11)
		pdf.Cell(0, 5, fmt.Sprintf("Student: %s", req.StudentInfo.Name))

		if req.StudentInfo.Major != "" || req.StudentInfo.Year != "" {
			pdf.SetXY(180, 13)
			info := ""
			if req.StudentInfo.Major != "" {
				info = req.StudentInfo.Major
			}
			if req.StudentInfo.Year != "" {
				if info != "" {
					info += " | " + req.StudentInfo.Year
				} else {
					info = req.StudentInfo.Year
				}
			}
			pdf.Cell(0, 5, info)
		}

		if req.StudentInfo.Email != "" {
			pdf.SetXY(180, 18)
			pdf.Cell(0, 5, req.StudentInfo.Email)
		}
	}

	// Reset text color for rest of document
	pdf.SetTextColor(0, 0, 0)

	// Save image to temp file for PDF embedding
	tempFile := "/tmp/schedule.png"
	if err := savePNGToFile(imgBytes, tempFile); err != nil {
		http.Error(w, "Failed to process image", http.StatusInternalServerError)
		return
	}

	// Calculate image dimensions to fit the rest of page 1
	pageW, pageH := pdf.GetPageSize()
	margin := 15.0
	maxW := pageW - 2*margin
	maxH := pageH - 70 // Leave room for header (30) and footer (40)

	imgW := float64(img.Bounds().Dx())
	imgH := float64(img.Bounds().Dy())

	// Scale to fit
	scaleW := maxW / imgW * 72 // Convert to PDF units
	scaleH := maxH / imgH * 72
	scale := scaleW
	if scaleH < scaleW {
		scale = scaleH
	}

	finalW := imgW * scale / 72
	finalH := imgH * scale / 72

	// Center the image
	x := (pageW - finalW) / 2
	y := 40.0 // Start after header

	// Add the schedule image
	pdf.Image(tempFile, x, y, finalW, finalH, false, "PNG", 0, "")

	// Add footer to page 1
	pdf.SetY(-20)
	pdf.SetFont("Arial", "I", 9)
	pdf.SetTextColor(100, 100, 100)
	pdf.Cell(0, 6, "Made by Umberto Puddu (upuddu@purdue.edu)")
	pdf.Ln(4)
	pdf.Cell(0, 6, "Not affiliated with Purdue University")

	// PAGE 2: Course Details and Summary
	pdf.AddPage()

	// Header for page 2
	pdf.SetFillColor(0, 0, 0)
	pdf.Rect(0, 0, 279.4, 25, "F")
	pdf.SetTextColor(218, 165, 32)
	pdf.SetFont("Arial", "B", 16)
	pdf.SetXY(15, 8)
	pdf.Cell(0, 8, "Course Details & Summary")
	pdf.SetTextColor(0, 0, 0)

	pdf.SetY(35)

	// Calculate totals
	totalCredits := 0
	totalHours := 0
	for _, section := range req.Sections {
		// Assume 3 credits per course if not specified
		totalCredits += 3

		// Calculate weekly hours for this section
		for _, meeting := range section.Meetings {
			if meeting.Start != "" && meeting.End != "" {
				// Parse time and calculate duration
				startHour, startMin := parseTime(meeting.Start)
				endHour, endMin := parseTime(meeting.End)
				if startHour >= 0 && endHour >= 0 {
					duration := (endHour*60 + endMin) - (startHour*60 + startMin)
					if duration > 0 {
						totalHours += (duration / 60) * len(meeting.Days) // Hours per week
					}
				}
			}
		}
	}

	// Summary section
	pdf.SetFont("Arial", "B", 14)
	pdf.Cell(0, 8, "Summary")
	pdf.Ln(10)

	pdf.SetFont("Arial", "", 12)
	pdf.Cell(0, 6, fmt.Sprintf("Total Courses: %d", len(req.Sections)))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Total Credits: %d", totalCredits))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Total Weekly Hours: %d", totalHours))
	pdf.Ln(12)

	// Course details
	pdf.SetFont("Arial", "B", 14)
	pdf.Cell(0, 8, "Course Details")
	pdf.Ln(10)

	for i, section := range req.Sections {
		pdf.SetFont("Arial", "B", 12)
		pdf.Cell(0, 6, fmt.Sprintf("%d. %s - %s", i+1, section.Course, section.Title))
		pdf.Ln(8)

		pdf.SetFont("Arial", "", 10)
		pdf.Cell(0, 5, fmt.Sprintf("   CRN: %s | Type: %s", section.CRN, section.Type))
		pdf.Ln(5)

		for _, meeting := range section.Meetings {
			if len(meeting.Days) > 0 {
				days := ""
				for _, day := range meeting.Days {
					days += day + " "
				}
				pdf.Cell(0, 5, fmt.Sprintf("   Schedule: %s %s - %s", days, meeting.Start, meeting.End))
				pdf.Ln(5)
			}

			if len(meeting.Instructors) > 0 {
				for _, instructor := range meeting.Instructors {
					pdf.Cell(0, 5, fmt.Sprintf("   Instructor: %s", instructor))
					pdf.Ln(5)
					// Add email if available (this would need to be passed from frontend)
					// pdf.Cell(0, 5, fmt.Sprintf("   Email: %s@purdue.edu", strings.ToLower(strings.ReplaceAll(instructor, " ", ""))))
					// pdf.Ln(5)
				}
			}

			if meeting.Location != "" {
				pdf.Cell(0, 5, fmt.Sprintf("   Location: %s", meeting.Location))
				pdf.Ln(5)
			}
		}
		pdf.Ln(3)

		// Check if we need a new page
		if pdf.GetY() > 180 {
			pdf.AddPage()
			pdf.SetY(15)
		}
	}

	// Output PDF
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		http.Error(w, "Failed to generate PDF", http.StatusInternalServerError)
		return
	}

	// Send PDF response
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename=BoilerSchedule.pdf")
	w.Write(buf.Bytes())
}

// Helper function to save PNG bytes to file
func savePNGToFile(data []byte, filename string) error {
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		return err
	}

	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	return png.Encode(file, img)
}

// Helper function to parse time strings like "9:00 AM" or "14:30"
func parseTime(timeStr string) (hour, minute int) {
	timeStr = strings.TrimSpace(timeStr)
	if timeStr == "" {
		return -1, -1
	}

	// Handle AM/PM format
	if strings.Contains(timeStr, "AM") || strings.Contains(timeStr, "PM") {
		isPM := strings.Contains(timeStr, "PM")
		timeStr = strings.ReplaceAll(timeStr, " AM", "")
		timeStr = strings.ReplaceAll(timeStr, " PM", "")

		parts := strings.Split(timeStr, ":")
		if len(parts) != 2 {
			return -1, -1
		}

		h, err1 := strconv.Atoi(parts[0])
		m, err2 := strconv.Atoi(parts[1])
		if err1 != nil || err2 != nil {
			return -1, -1
		}

		if isPM && h != 12 {
			h += 12
		} else if !isPM && h == 12 {
			h = 0
		}

		return h, m
	}

	// Handle 24-hour format
	parts := strings.Split(timeStr, ":")
	if len(parts) != 2 {
		return -1, -1
	}

	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return -1, -1
	}

	return h, m
}

// StudentInfo represents student information for PDF generation
type StudentInfo struct {
	Name      string
	Email     string
	StudentID string
	Major     string
	Year      string
}

// GET /api/schedule/pdf?sections=sec1,sec2,...&studentName=...&studentEmail=...
func (h *Handler) HandleSchedulePDF(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Get the host from the request to build the URL for the HTML version
	host := r.Host
	if host == "" {
		host = "localhost:8080"
	}

	// Build the URL for the HTML version with all query parameters
	htmlURL := fmt.Sprintf("http://%s/api/schedule/html?%s", host, r.URL.RawQuery)

	// Generate PDF using headless Chrome
	pdfBytes, err := generatePDFFromHTML(htmlURL)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to create pdf: %v", err), http.StatusInternalServerError)
		return
	}

	// Extract student name for filename
	studentName := r.URL.Query().Get("studentName")
	filename := "BoilerSchedule.pdf"
	if studentName != "" {
		// Sanitize filename
		safeName := strings.ReplaceAll(studentName, " ", "_")
		filename = fmt.Sprintf("BoilerSchedule_%s.pdf", safeName)
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	_, _ = w.Write(pdfBytes)
}

// GET /api/schedule/html?sections=sec1,sec2,...&studentName=...&studentEmail=...
func (h *Handler) HandleScheduleHTML(w http.ResponseWriter, r *http.Request) {
	raw := r.URL.Query().Get("sections")
	if strings.TrimSpace(raw) == "" {
		http.Error(w, "sections query param required", http.StatusBadRequest)
		return
	}
	ids := strings.Split(raw, ",")
	sections := h.store.SectionsByIds(ids)
	if len(sections) == 0 {
		http.Error(w, "no valid sections found", http.StatusBadRequest)
		return
	}

	// Build course mapping for label enrichment
	courseBySection := make(map[string]data.CourseSummary, len(sections))
	for _, s := range sections {
		if c, ok := h.store.CourseBySectionId(s.Id); ok {
			// Ensure subject abbreviation is present; fall back to store map
			if c.SubjectAbbr == "" {
				c.SubjectAbbr = h.store.SubjectAbbr(c.SubjectId)
			}
			courseBySection[s.Id] = c
		}
	}

	// Extract student information
	studentInfo := StudentInfo{
		Name:      r.URL.Query().Get("studentName"),
		Email:     r.URL.Query().Get("studentEmail"),
		StudentID: r.URL.Query().Get("studentId"),
		Major:     r.URL.Query().Get("major"),
		Year:      r.URL.Query().Get("year"),
	}

	htmlContent := generateScheduleHTML(sections, courseBySection, studentInfo)

	w.Header().Set("Content-Type", "text/html")
	_, _ = w.Write([]byte(htmlContent))
}

// generatePDFFromHTML uses ChromeDP to convert HTML to PDF
func generatePDFFromHTML(url string) ([]byte, error) {
	// Create context
	ctx, cancel := chromedp.NewContext(context.Background())
	defer cancel()

	// Set timeout
	ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var pdfBytes []byte

	// Navigate to the URL and generate PDF
	err := chromedp.Run(ctx,
		chromedp.Navigate(url),
		chromedp.WaitReady("body"),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pdfBytes, _, err = page.PrintToPDF().
				WithPaperWidth(11).   // Letter width in inches
				WithPaperHeight(8.5). // Letter height in inches (landscape)
				WithLandscape(true).
				WithPrintBackground(true).
				WithMarginTop(0.4).
				WithMarginBottom(0.4).
				WithMarginLeft(0.4).
				WithMarginRight(0.4).
				Do(ctx)
			return err
		}),
	)

	if err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %v", err)
	}

	return pdfBytes, nil
}

type event struct {
	Section  data.SectionInfo
	Course   *data.CourseSummary // optional enrichment
	DayIdx   int
	StartMin int
	EndMin   int
	Meeting  data.MeetingInfo
}

// generateScheduleHTML creates HTML that mimics the React schedule view
func generateScheduleHTML(sections []data.SectionInfo, courseBySection map[string]data.CourseSummary, studentInfo StudentInfo) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BoilerSchedule - %s</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'purdue-gold': '#CFB991',
                        'purdue-black': '#000000',
                        'purdue-gray': '#5B6870'
                    }
                }
            }
        }
    </script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        @media print {
            body { -webkit-print-color-adjust: exact; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body class="bg-gray-50 text-gray-900">
    <!-- Header -->
    <div class="bg-black text-purdue-gold p-6">
        <div class="flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold">BoilerSchedule</h1>
                <p class="text-sm opacity-90">Purdue University Course Schedule - Fall 2025</p>
            </div>
            %s
        </div>
    </div>

    <!-- Schedule Container -->
    <div class="p-6">
        <h2 class="text-xl font-semibold mb-4 text-center">Schedule Preview</h2>
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
            %s
        </div>
    </div>

    <!-- Footer -->
    <div class="bg-gray-100 p-4 text-center text-xs text-gray-600">
        <p>Generated by BoilerSchedule - Made by <a href="mailto:upuddu@purdue.edu" class="text-purdue-gold">Umberto Puddu</a></p>
        <p class="mt-1">Not affiliated with Purdue University</p>
    </div>
</body>
</html>`, studentInfo.Name, generateStudentInfoHTML(studentInfo), generateScheduleGridHTML(sections, courseBySection))
}

func generateStudentInfoHTML(studentInfo StudentInfo) string {
	if studentInfo.Name == "" {
		return ""
	}

	html := fmt.Sprintf(`<div class="text-right">
        <div class="font-semibold">Student: %s</div>`, studentInfo.Name)

	if studentInfo.Major != "" || studentInfo.Year != "" {
		info := ""
		if studentInfo.Major != "" {
			info = studentInfo.Major
		}
		if studentInfo.Year != "" {
			if info != "" {
				info += " | " + studentInfo.Year
			} else {
				info = studentInfo.Year
			}
		}
		html += fmt.Sprintf(`<div class="text-sm opacity-90">%s</div>`, info)
	}

	if studentInfo.Email != "" {
		html += fmt.Sprintf(`<div class="text-sm opacity-90">%s</div>`, studentInfo.Email)
	}

	html += `</div>`
	return html
}

func generateScheduleGridHTML(sections []data.SectionInfo, courseBySection map[string]data.CourseSummary) string {
	// Build events similar to the React component
	events := make([]scheduleEvent, 0)
	for _, s := range sections {
		course := courseBySection[s.Id]
		for _, m := range s.Meetings {
			if len(m.Days) == 0 || m.Start == "" || m.DurationMin == 0 {
				continue
			}
			startMin, ok := parseTimeToMinutes(m.Start)
			if !ok {
				continue
			}

			for _, day := range m.Days {
				dayIndex := getDayIndex(day)
				if dayIndex >= 0 && dayIndex <= 4 { // Mon-Fri only
					events = append(events, scheduleEvent{
						Section:  s,
						Course:   course,
						Meeting:  m,
						DayIndex: dayIndex,
						StartMin: startMin,
						EndMin:   startMin + m.DurationMin,
					})
				}
			}
		}
	}

	if len(events) == 0 {
		return `<div class="p-8 text-center text-gray-500">No classes to display</div>`
	}

	// Calculate time range
	minTime := 24 * 60
	maxTime := 0
	for _, event := range events {
		if event.StartMin < minTime {
			minTime = event.StartMin
		}
		if event.EndMin > maxTime {
			maxTime = event.EndMin
		}
	}

	// Add 30-minute padding
	minTime = ((minTime - 30) / 30) * 30
	maxTime = ((maxTime + 30) / 30) * 30
	if minTime < 0 {
		minTime = 0
	}
	if maxTime > 24*60 {
		maxTime = 24 * 60
	}

	totalMinutes := maxTime - minTime
	days := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}

	html := `<div class="relative bg-white" style="width: 100%; height: 600px;">
        <!-- Time axis -->
        <div class="absolute left-0 top-0 w-16 h-full bg-gray-50 border-r border-gray-200">
            <div class="h-12 border-b border-gray-300"></div>`

	// Time labels
	for t := minTime; t <= maxTime; t += 60 {
		top := float64(t-minTime)/float64(totalMinutes)*552 + 48 // 48px for header, 552px for grid
		html += fmt.Sprintf(`<div class="absolute text-xs text-gray-600 right-2" style="top: %.1fpx; transform: translateY(-50%%);">%s</div>`,
			top, formatTime12Hour(t))
	}

	html += `</div>
        
        <!-- Day columns -->
        <div class="absolute left-16 top-0 right-0 h-full">
            <!-- Day headers -->
            <div class="h-12 bg-gray-100 border-b border-gray-300 flex">`

	for i, day := range days {
		html += fmt.Sprintf(`<div class="flex-1 flex items-center justify-center font-medium text-gray-700 %s">%s</div>`,
			getBorderClass(i < 4), day)
	}

	html += `</div>
            
            <!-- Grid lines -->
            <div class="relative h-full">`

	// Horizontal grid lines
	for t := minTime; t <= maxTime; t += 30 {
		top := float64(t-minTime) / float64(totalMinutes) * 552
		lineClass := "border-gray-200"
		if t%60 == 0 {
			lineClass = "border-gray-300"
		}
		html += fmt.Sprintf(`<div class="absolute w-full border-t %s" style="top: %.1fpx;"></div>`, lineClass, top)
	}

	// Vertical grid lines
	for i := 0; i <= 4; i++ {
		left := float64(i) * 20 // 20% per column
		html += fmt.Sprintf(`<div class="absolute h-full border-l border-gray-200" style="left: %.1f%%;"></div>`, left)
	}

	// Events
	for _, event := range events {
		top := float64(event.StartMin-minTime) / float64(totalMinutes) * 552
		height := float64(event.EndMin-event.StartMin) / float64(totalMinutes) * 552
		left := float64(event.DayIndex)*20 + 0.5 // 20% per column + small margin
		width := 19                              // Slightly less than 20% to fit within column

		// Get primary instructor
		instructor := "TBA"
		if len(event.Meeting.Instructors) > 0 {
			instructor = event.Meeting.Instructors[0]
			if len(instructor) > 15 {
				instructor = instructor[:12] + "..."
			}
		}

		// Type badge
		badge := ""
		if event.Section.Type != "" {
			badge = strings.ToUpper(event.Section.Type)
			if len(badge) > 3 {
				badge = badge[:3]
			}
		}

		html += fmt.Sprintf(`<div class="absolute bg-blue-100 border-2 border-blue-300 rounded-lg p-2 cursor-pointer hover:shadow-lg transition-all" 
                style="top: %.1fpx; height: %.1fpx; left: %.1f%%; width: %.1f%%;">
                %s
                <div class="text-xs font-bold text-blue-900 leading-tight">%s %s</div>
                <div class="text-xs text-blue-800 opacity-90 leading-tight mt-1">%s</div>
            </div>`,
			top, height, left, width,
			generateBadgeHTML(badge),
			event.Course.SubjectAbbr, event.Course.Number,
			instructor)
	}

	html += `</div>
        </div>
    </div>`

	return html
}

func generateBadgeHTML(badge string) string {
	if badge == "" {
		return ""
	}
	return fmt.Sprintf(`<div class="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/90 border border-gray-300 shadow-sm">%s</div>`, badge)
}

func parseTimeToMinutes(s string) (int, bool) {
	if len(s) < 5 {
		return 0, false
	}
	hh, err1 := strconv.Atoi(s[:2])
	mm, err2 := strconv.Atoi(s[3:5])
	if err1 != nil || err2 != nil {
		return 0, false
	}
	return hh*60 + mm, true
}

func getDayIndex(day string) int {
	switch day {
	case "Monday":
		return 0
	case "Tuesday":
		return 1
	case "Wednesday":
		return 2
	case "Thursday":
		return 3
	case "Friday":
		return 4
	default:
		return -1
	}
}

func formatTime12Hour(minutes int) string {
	hours := minutes / 60
	mins := minutes % 60
	period := "AM"
	if hours >= 12 {
		period = "PM"
		if hours > 12 {
			hours -= 12
		}
	}
	if hours == 0 {
		hours = 12
	}
	return fmt.Sprintf("%d:%02d %s", hours, mins, period)
}

func getBorderClass(needsBorder bool) string {
	if needsBorder {
		return "border-r border-gray-200"
	}
	return ""
}

type scheduleEvent struct {
	Section  data.SectionInfo
	Course   data.CourseSummary
	Meeting  data.MeetingInfo
	DayIndex int
	StartMin int
	EndMin   int
}
