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

// GET /api/schedule/pdf?sections=sec1,sec2,...
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
			courseBySection[s.Id] = c
		}
	}

	pdfBytes, err := buildSchedulePDF(sections, courseBySection)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to create pdf: %v", err), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename=Schedule.pdf")
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

func buildSchedulePDF(sections []data.SectionInfo, courseBySection map[string]data.CourseSummary) ([]byte, error) {
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

	// Prepare PDF
	pdf := gofpdf.New("P", "mm", "Letter", "")
	pdf.AddPage()
	pdf.SetFont("Helvetica", "", 12)

	pageW, pageH := pdf.GetPageSize()
	margin := 10.0
	contentX := margin
	contentY := margin + 10
	contentW := pageW - 2*margin
	contentH := pageH - 2*margin - 10

	// Title
	pdf.SetFont("Helvetica", "B", 16)
	pdf.CellFormat(0, 8, "Weekly Schedule", "", 1, "CM", false, 0, "")
	pdf.Ln(2)
	pdf.SetFont("Helvetica", "", 11)

	// Draw day columns (Mon-Fri)
	days := []string{"Mon", "Tue", "Wed", "Thu", "Fri"}
	cols := 5

	// Time markers on left
	timeAxisW := 12.0
	gridX := contentX + timeAxisW
	gridW := contentW - timeAxisW
	colWGrid := gridW / float64(cols)

	// Time labels and horizontal grid lines every hour
	pdf.SetDrawColor(200, 200, 200)
	pdf.SetTextColor(40, 40, 40)
	for hour := minStart; hour <= maxEnd; hour += 60 {
		y := contentY + (float64(hour-minStart)/float64(totalMinutes))*contentH
		pdf.Line(gridX, y, gridX+gridW, y)
		// label
		pdf.SetXY(contentX, y-2)
		label := fmt.Sprintf("%02d:00", hour/60)
		pdf.CellFormat(timeAxisW-1, 4, label, "", 0, "RT", false, 0, "")
	}

	// Day headers and vertical grid lines
	for i := 0; i < cols; i++ {
		x := gridX + float64(i)*colWGrid
		pdf.SetXY(x, contentY-6)
		pdf.CellFormat(colWGrid, 6, days[i], "", 0, "CM", false, 0, "")
		pdf.Line(x, contentY, x, contentY+contentH)
	}
	pdf.Line(gridX+gridW, contentY, gridX+gridW, contentY+contentH)

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
			// geometry
			x0 := gridX + float64(day)*colWGrid
			y0 := contentY + (float64(p.e.StartMin-minStart)/float64(totalMinutes))*contentH
			y1 := contentY + (float64(p.e.EndMin-minStart)/float64(totalMinutes))*contentH
			// width is divided by number of columns in this cluster
			width := colWGrid / float64(maxInt(1, p.span))
			x := x0 + width*float64(p.col)
			height := y1 - y0

			// style
			pdf.SetFillColor(230, 244, 255)
			pdf.Rect(x+1, y0+1, width-2, height-2, "F")
			pdf.SetDrawColor(80, 140, 200)
			pdf.Rect(x+1, y0+1, width-2, height-2, "D")

			// text
			pdf.SetFont("Helvetica", "B", 9)
			courseLabel := ""
			if p.e.Course != nil {
				courseLabel = fmt.Sprintf("%s %s", p.e.Course.SubjectAbbr, p.e.Course.Number)
			}
			label := strings.TrimSpace(fmt.Sprintf("%s  %s  %s", courseLabel, p.e.Section.Crn, p.e.Section.Type))
			pdf.SetXY(x+2, y0+2)
			pdf.CellFormat(width-4, 4, label, "", 0, "LM", false, 0, "")

			pdf.SetFont("Helvetica", "", 8)
			// Instructor line
			line2 := fmt.Sprintf("%s", strings.Join(p.e.Meeting.Instructors, ", "))
			pdf.SetXY(x+2, y0+6)
			pdf.CellFormat(width-4, 3.5, line2, "", 0, "LM", false, 0, "")

			where := fmt.Sprintf("%s %s", p.e.Meeting.BuildingCode, p.e.Meeting.RoomNumber)
			pdf.SetXY(x+2, y0+9.5)
			pdf.CellFormat(width-4, 3.5, where, "", 0, "LM", false, 0, "")
		}
	}

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
