package api

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"purdue_schedule/internal/data"

	"github.com/gorilla/mux"
	gofpdf "github.com/phpdave11/gofpdf"
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
	res := h.store.SearchCourses(q, 50)
	writeJSON(w, http.StatusOK, res)
}

// GET /api/course/{id}/sections
func (h *Handler) HandleCourseSections(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	secs := h.store.SectionsByCourse(id)
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

	pdfBytes, err := buildEnhancedSchedulePDF(sections, courseBySection, studentInfo)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to create pdf: %v", err), http.StatusInternalServerError)
		return
	}

	filename := "BoilerSchedule.pdf"
	if studentInfo.Name != "" {
		// Sanitize filename
		safeName := strings.ReplaceAll(studentInfo.Name, " ", "_")
		filename = fmt.Sprintf("BoilerSchedule_%s.pdf", safeName)
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	_, _ = w.Write(pdfBytes)
}

type event struct {
	Section  data.SectionInfo
	Course   *data.CourseSummary // optional enrichment
	DayIdx   int
	StartMin int
	EndMin   int
	Meeting  data.MeetingInfo
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

var dayToIdx = map[string]int{
	"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6,
}

func formatTimeForPDF(minutes int) string {
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

func buildEnhancedSchedulePDF(sections []data.SectionInfo, courseBySection map[string]data.CourseSummary, studentInfo StudentInfo) ([]byte, error) {
	// Build events per day
	evts := make([]event, 0, 32)
	for _, s := range sections {
		for _, m := range s.Meetings {
			if len(m.Days) == 0 || m.Start == "" || m.DurationMin == 0 {
				continue
			}
			start, ok := parseTimeToMinutes(m.Start)
			if !ok {
				continue
			}
			for _, d := range m.Days {
				idx, ok := dayToIdx[d]
				if !ok || idx > 4 { // Mon-Fri only
					continue
				}
				e := event{
					Section:  s,
					DayIdx:   idx,
					StartMin: start,
					EndMin:   start + m.DurationMin,
					Meeting:  m,
				}
				if c, ok := courseBySection[s.Id]; ok {
					cc := c // copy to get addressable
					e.Course = &cc
				}
				evts = append(evts, e)
			}
		}
	}

	if len(evts) == 0 {
		return nil, fmt.Errorf("no meetings to render")
	}

	// Determine overall time range
	minStart := 24 * 60
	maxEnd := 0
	for _, e := range evts {
		if e.StartMin < minStart {
			minStart = e.StartMin
		}
		if e.EndMin > maxEnd {
			maxEnd = e.EndMin
		}
	}
	// Snap to hour boundaries and enforce reasonable range
	minStart = (minStart / 60) * 60
	if minStart > 8*60 {
		minStart = 8 * 60
	}
	if maxEnd < 18*60 {
		maxEnd = 18 * 60
	} else {
		maxEnd = int(math.Ceil(float64(maxEnd)/60.0)) * 60
	}
	totalMinutes := maxEnd - minStart

	// Prepare PDF in landscape orientation
	pdf := gofpdf.New("L", "mm", "Letter", "")
	pdf.AddPage()
	pdf.SetFont("Helvetica", "", 12)

	pageW, pageH := pdf.GetPageSize()
	margin := 20.0
	contentX := margin
	contentY := margin + 25
	contentW := pageW - 2*margin
	contentH := pageH - 2*margin - 35

	// Beautiful header with Purdue branding
	pdf.SetFillColor(0, 0, 0) // Black background
	pdf.Rect(0, 0, pageW, 30, "F")

	pdf.SetTextColor(207, 185, 145) // Purdue Gold
	pdf.SetFont("Helvetica", "B", 24)
	pdf.SetXY(margin, 8)
	pdf.CellFormat(0, 10, "BoilerSchedule", "", 1, "L", false, 0, "")

	pdf.SetFont("Helvetica", "", 12)
	pdf.SetXY(margin, 18)
	pdf.CellFormat(0, 6, "Purdue University Course Schedule - Fall 2025", "", 0, "L", false, 0, "")

	// Student info on the right side of header
	if studentInfo.Name != "" {
		pdf.SetFont("Helvetica", "B", 12)
		pdf.SetXY(pageW-150, 8)
		pdf.CellFormat(0, 6, fmt.Sprintf("Student: %s", studentInfo.Name), "", 1, "L", false, 0, "")

		pdf.SetFont("Helvetica", "", 10)
		if studentInfo.Major != "" || studentInfo.Year != "" {
			infoLine := ""
			if studentInfo.Major != "" {
				infoLine = studentInfo.Major
			}
			if studentInfo.Year != "" {
				if infoLine != "" {
					infoLine += " | " + studentInfo.Year
				} else {
					infoLine = studentInfo.Year
				}
			}
			pdf.SetXY(pageW-150, 15)
			pdf.CellFormat(0, 5, infoLine, "", 1, "L", false, 0, "")
		}

		if studentInfo.Email != "" {
			pdf.SetXY(pageW-150, 21)
			pdf.CellFormat(0, 5, studentInfo.Email, "", 1, "L", false, 0, "")
		}
	}

	// Reset text color and position
	pdf.SetTextColor(0, 0, 0)
	pdf.SetY(contentY)

	// Draw day columns (Mon-Fri) with better spacing for landscape
	days := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}
	cols := 5

	// Time markers on left with more space for landscape
	timeAxisW := 60.0
	gridX := contentX + timeAxisW
	gridW := contentW - timeAxisW
	colWGrid := gridW / float64(cols)

	// Beautiful grid with better styling
	pdf.SetDrawColor(180, 180, 180)
	pdf.SetLineWidth(0.5)

	// Day headers with background
	pdf.SetFillColor(240, 240, 240)
	headerY := contentY
	pdf.Rect(gridX, headerY-8, gridW, 15, "F")

	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(0, 0, 0)
	for i := 0; i < cols; i++ {
		x := gridX + float64(i)*colWGrid
		pdf.SetXY(x, headerY-5)
		pdf.CellFormat(colWGrid, 8, days[i], "", 0, "CM", false, 0, "")
		// Vertical grid lines
		pdf.Line(x, headerY-8, x, contentY+contentH)
	}
	pdf.Line(gridX+gridW, headerY-8, gridX+gridW, contentY+contentH)

	// Horizontal grid lines every hour with time labels
	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(60, 60, 60)
	for hour := minStart; hour <= maxEnd; hour += 60 {
		y := contentY + (float64(hour-minStart)/float64(totalMinutes))*contentH

		// Stronger line for hours
		pdf.SetDrawColor(150, 150, 150)
		pdf.SetLineWidth(0.8)
		pdf.Line(gridX, y, gridX+gridW, y)

		// Time label with better formatting
		pdf.SetXY(contentX, y-3)
		timeLabel := formatTimeForPDF(hour)
		pdf.CellFormat(timeAxisW-5, 6, timeLabel, "", 0, "RM", false, 0, "")

		// Half-hour lines (lighter)
		if hour+30 <= maxEnd {
			halfY := contentY + (float64(hour+30-minStart)/float64(totalMinutes))*contentH
			pdf.SetDrawColor(200, 200, 200)
			pdf.SetLineWidth(0.3)
			pdf.Line(gridX, halfY, gridX+gridW, halfY)
		}
	}

	// Events per day and layout into columns to avoid overlap
	type placed struct {
		e    event
		col  int
		span int // number of parallel columns in cluster
	}

	for day := 0; day < cols; day++ {
		// Collect day events
		dayEvts := make([]event, 0)
		for _, e := range evts {
			if e.DayIdx == day {
				dayEvts = append(dayEvts, e)
			}
		}
		if len(dayEvts) == 0 {
			continue
		}
		sort.Slice(dayEvts, func(i, j int) bool {
			if dayEvts[i].StartMin == dayEvts[j].StartMin {
				return dayEvts[i].EndMin < dayEvts[j].EndMin
			}
			return dayEvts[i].StartMin < dayEvts[j].StartMin
		})

		// Greedy interval partitioning
		columns := make([][]event, 0)
		for _, e := range dayEvts {
			placedCol := -1
			for colIdx := range columns {
				last := columns[colIdx][len(columns[colIdx])-1]
				if last.EndMin <= e.StartMin { // no overlap
					placedCol = colIdx
					break
				}
			}
			if placedCol == -1 {
				columns = append(columns, []event{e})
			} else {
				columns[placedCol] = append(columns[placedCol], e)
			}
		}

		// Build a lookup to know how many columns overlap for each event time window
		placedEvents := make([]placed, 0, len(dayEvts))
		// Flatten columns to placed with column index
		for colIdx, colEvents := range columns {
			for _, e := range colEvents {
				// Determine span as number of columns overlapping with e
				span := 1
				for otherIdx, otherCol := range columns {
					if otherIdx == colIdx {
						continue
					}
					for _, oe := range otherCol {
						if intervalsOverlap(e.StartMin, e.EndMin, oe.StartMin, oe.EndMin) {
							span = int(math.Max(float64(span), float64(countOverlaps(columns, e))))
							break
						}
					}
				}
				placedEvents = append(placedEvents, placed{e: e, col: colIdx, span: span})
			}
		}

		// Draw events
		for _, p := range placedEvents {
			// geometry - ensure blocks stay within column boundaries
			x0 := gridX + float64(day)*colWGrid
			y0 := contentY + (float64(p.e.StartMin-minStart)/float64(totalMinutes))*contentH
			y1 := contentY + (float64(p.e.EndMin-minStart)/float64(totalMinutes))*contentH
			// width is divided by number of columns in this cluster, with proper margins
			width := (colWGrid / float64(maxInt(1, p.span))) - 6 // 6mm total margin
			x := x0 + (width+6)*float64(p.col) + 3               // 3mm left margin
			height := y1 - y0

			// Beautiful course block styling
			pdf.SetFillColor(230, 244, 255)
			pdf.Rect(x, y0+2, width, height-4, "F")
			pdf.SetDrawColor(80, 140, 200)
			pdf.SetLineWidth(1.5)
			pdf.Rect(x, y0+2, width, height-4, "D")

			// Type badge (LEC/REC/STU...) in the top-right corner
			badge := ""
			if p.e.Section.Type != "" {
				// Take first 3 letters uppercase
				badge = strings.ToUpper(p.e.Section.Type)
				if len(badge) > 3 {
					badge = badge[:3]
				}
			}
			if badge != "" {
				pdf.SetFillColor(255, 255, 255)
				pdf.SetDrawColor(80, 140, 200)
				pdf.Rect(x+width-14, y0+2, 12, 6, "FD")
				pdf.SetFont("Helvetica", "B", 7)
				pdf.SetXY(x+width-14, y0+2.5)
				pdf.CellFormat(12, 5, badge, "", 0, "CM", false, 0, "")
			}

			// Course text with better formatting - ensure full course code shows
			pdf.SetTextColor(0, 0, 0)
			pdf.SetFont("Helvetica", "B", 10)
			courseLabel := ""
			if p.e.Course != nil {
				courseLabel = fmt.Sprintf("%s %s", p.e.Course.SubjectAbbr, p.e.Course.Number)
			}
			pdf.SetXY(x+2, y0+4)
			pdf.CellFormat(width-4, 5, courseLabel, "", 0, "LM", false, 0, "")

			// Instructor line (primary instructor only)
			pdf.SetFont("Helvetica", "", 9)
			instructor := "TBA"
			if len(p.e.Meeting.Instructors) > 0 {
				instructor = p.e.Meeting.Instructors[0]
				// Truncate long names for better fit
				if len(instructor) > 15 {
					instructor = instructor[:12] + "..."
				}
			}
			pdf.SetXY(x+2, y0+10)
			pdf.CellFormat(width-4, 4, instructor, "", 0, "LM", false, 0, "")

			// Location
			if height > 20 {
				where := fmt.Sprintf("%s %s", p.e.Meeting.BuildingCode, p.e.Meeting.RoomNumber)
				pdf.SetXY(x+2, y0+15)
				pdf.CellFormat(width-4, 4, where, "", 0, "LM", false, 0, "")
			}
		}
	}

	// Beautiful footer on first page
	pdf.SetY(-15)
	pdf.SetFillColor(240, 240, 240)
	pdf.Rect(0, pageH-15, pageW, 15, "F")
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(100, 100, 100)
	pdf.SetXY(margin, pageH-10)
	pdf.CellFormat(0, 4, "Generated by BoilerSchedule - Made by Umberto Puddu (upuddu@purdue.edu)", "", 0, "L", false, 0, "")
	pdf.SetXY(margin, pageH-10)
	pdf.CellFormat(0, 4, "Not affiliated with Purdue University", "", 0, "R", false, 0, "")

	// Second page with course details
	pdf.AddPage()

	// Beautiful header for second page
	pdf.SetFillColor(0, 0, 0) // Black background
	pdf.Rect(0, 0, pageW, 25, "F")

	pdf.SetTextColor(207, 185, 145) // Purdue Gold
	pdf.SetFont("Helvetica", "B", 20)
	pdf.SetXY(margin, 8)
	pdf.CellFormat(0, 8, "Course Details & Summary", "", 1, "L", false, 0, "")

	// Reset text color and position
	pdf.SetTextColor(0, 0, 0)
	pdf.SetY(35)

	// Calculate totals
	totalCredits := len(sections) * 3 // Estimate 3 credits per course
	totalWeeklyHours := 0
	courseMap := make(map[string]bool) // To avoid duplicates

	for _, s := range sections {
		for _, m := range s.Meetings {
			if !courseMap[s.Id] {
				totalWeeklyHours += m.DurationMin * len(m.Days) / 60
				courseMap[s.Id] = true
				break // Only count first meeting per section
			}
		}
	}

	// Beautiful summary section
	pdf.SetFillColor(245, 245, 245)
	pdf.Rect(margin, pdf.GetY(), contentW, 25, "F")

	pdf.SetFont("Helvetica", "B", 14)
	pdf.SetXY(margin+5, pdf.GetY()+5)
	pdf.CellFormat(0, 6, "Schedule Summary", "", 1, "L", false, 0, "")

	pdf.SetFont("Helvetica", "", 11)
	pdf.SetXY(margin+10, pdf.GetY()+2)
	pdf.CellFormat(60, 5, fmt.Sprintf("Total Courses: %d", len(sections)), "", 0, "L", false, 0, "")
	pdf.CellFormat(80, 5, fmt.Sprintf("Estimated Credits: %d", totalCredits), "", 0, "L", false, 0, "")
	pdf.CellFormat(0, 5, fmt.Sprintf("Weekly Hours: %d", totalWeeklyHours), "", 1, "L", false, 0, "")

	pdf.SetY(pdf.GetY() + 15)

	// Course list with better layout for landscape
	pdf.SetFont("Helvetica", "B", 14)
	pdf.CellFormat(0, 8, "Course List", "", 1, "L", false, 0, "")
	pdf.Ln(3)

	// Table headers with better spacing for landscape
	pdf.SetFillColor(230, 230, 230)
	pdf.SetFont("Helvetica", "B", 10)
	pdf.CellFormat(50, 8, "Course", "1", 0, "C", true, 0, "")
	pdf.CellFormat(120, 8, "Title", "1", 0, "C", true, 0, "")
	pdf.CellFormat(30, 8, "CRN", "1", 0, "C", true, 0, "")
	pdf.CellFormat(40, 8, "Type", "1", 0, "C", true, 0, "")
	pdf.CellFormat(80, 8, "Instructor", "1", 0, "C", true, 0, "")
	pdf.CellFormat(60, 8, "Schedule", "1", 1, "C", true, 0, "")

	// Course rows with better formatting
	pdf.SetFont("Helvetica", "", 9)
	for i, s := range sections {
		course := courseBySection[s.Id]
		courseCode := fmt.Sprintf("%s %s", course.SubjectAbbr, course.Number)

		// Truncate long titles appropriately for landscape
		title := course.Title
		if len(title) > 45 {
			title = title[:42] + "..."
		}

		instructor := "TBA"
		if len(s.Meetings) > 0 && len(s.Meetings[0].Instructors) > 0 {
			instructor = s.Meetings[0].Instructors[0]
			if len(instructor) > 25 {
				instructor = instructor[:22] + "..."
			}
		}

		// Schedule info
		scheduleInfo := "TBA"
		if len(s.Meetings) > 0 && len(s.Meetings[0].Days) > 0 {
			days := strings.Join(s.Meetings[0].Days, ",")
			if len(days) > 8 {
				days = days[:8] + "..."
			}
			scheduleInfo = fmt.Sprintf("%s %s", days, s.Meetings[0].Start)
		}

		// Alternate row colors
		if i%2 == 0 {
			pdf.SetFillColor(248, 248, 248)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}

		pdf.CellFormat(50, 6, courseCode, "1", 0, "C", true, 0, "")
		pdf.CellFormat(120, 6, title, "1", 0, "L", true, 0, "")
		pdf.CellFormat(30, 6, s.Crn, "1", 0, "C", true, 0, "")
		pdf.CellFormat(40, 6, s.Type, "1", 0, "C", true, 0, "")
		pdf.CellFormat(80, 6, instructor, "1", 0, "L", true, 0, "")
		pdf.CellFormat(60, 6, scheduleInfo, "1", 1, "C", true, 0, "")
	}

	pdf.Ln(5)

	// Detailed course information
	pdf.SetFont("Helvetica", "B", 12)
	pdf.CellFormat(0, 6, "Detailed Course Information", "", 1, "L", false, 0, "")
	pdf.Ln(2)

	for _, s := range sections {
		course := courseBySection[s.Id]

		// Course header
		pdf.SetFont("Helvetica", "B", 10)
		courseHeader := fmt.Sprintf("%s %s - %s", course.SubjectAbbr, course.Number, course.Title)
		pdf.CellFormat(0, 5, courseHeader, "", 1, "L", false, 0, "")

		pdf.SetFont("Helvetica", "", 9)
		pdf.CellFormat(0, 4, fmt.Sprintf("CRN: %s | Type: %s", s.Crn, s.Type), "", 1, "L", false, 0, "")

		// Meeting information
		for i, m := range s.Meetings {
			if i > 0 {
				pdf.CellFormat(0, 3, "", "", 1, "L", false, 0, "") // Small spacing
			}

			days := strings.Join(m.Days, ", ")
			timeStr := fmt.Sprintf("%s (%d min)", m.Start, m.DurationMin)
			location := fmt.Sprintf("%s %s", m.BuildingCode, m.RoomNumber)

			pdf.CellFormat(0, 4, fmt.Sprintf("  Schedule: %s | %s | %s", days, timeStr, location), "", 1, "L", false, 0, "")

			// Instructors with emails
			if len(m.Instructors) > 0 {
				instructorList := strings.Join(m.Instructors, ", ")
				pdf.CellFormat(0, 4, fmt.Sprintf("  Instructor(s): %s", instructorList), "", 1, "L", false, 0, "")
			}
		}
		pdf.Ln(2)
	}

	// Beautiful footer on second page
	pdf.SetY(-15)
	pdf.SetFillColor(240, 240, 240)
	pdf.Rect(0, pageH-15, pageW, 15, "F")
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(100, 100, 100)
	pdf.SetXY(margin, pageH-10)
	pdf.CellFormat(0, 4, "Generated by BoilerSchedule - Made by Umberto Puddu (upuddu@purdue.edu)", "", 0, "L", false, 0, "")
	pdf.SetXY(margin, pageH-10)
	pdf.CellFormat(0, 4, "Not affiliated with Purdue University", "", 0, "R", false, 0, "")

	// Output
	var buf strings.Builder
	err := pdf.Output(&buf)
	if err != nil {
		return nil, err
	}
	return []byte(buf.String()), nil
}

func intervalsOverlap(aStart, aEnd, bStart, bEnd int) bool {
	return aStart < bEnd && bStart < aEnd
}

func countOverlaps(columns [][]event, e event) int {
	max := 1
	for _, col := range columns {
		for _, oe := range col {
			if intervalsOverlap(e.StartMin, e.EndMin, oe.StartMin, oe.EndMin) {
				max++
				break
			}
		}
	}
	return max
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
