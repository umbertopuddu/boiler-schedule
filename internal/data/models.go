package data

import (
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"time"
)

// Raw structures mirror only fields we need from JSON file
type rawCourse struct {
	Id        string     `json:"Id"`
	Number    string     `json:"Number"`
	SubjectId string     `json:"SubjectId"`
	Title     string     `json:"Title"`
	Classes   []rawClass `json:"Classes"`
}

type rawClass struct {
	Id       string       `json:"Id"`
	CourseId string       `json:"CourseId"`
	TermId   string       `json:"TermId"`
	CampusId string       `json:"CampusId"`
	Sections []rawSection `json:"Sections"`
}

type rawSection struct {
	Id        string       `json:"Id"`
	Crn       string       `json:"Crn"`
	ClassId   string       `json:"ClassId"`
	Type      string       `json:"Type"`
	StartDate string       `json:"StartDate"`
	EndDate   string       `json:"EndDate"`
	Meetings  []rawMeeting `json:"Meetings"`
}

type rawMeeting struct {
	Id          string      `json:"Id"`
	SectionId   string      `json:"SectionId"`
	Type        string      `json:"Type"`
	StartDate   string      `json:"StartDate"`
	EndDate     string      `json:"EndDate"`
	DaysOfWeek  string      `json:"DaysOfWeek"`
	StartTime   *string     `json:"StartTime"`
	Duration    string      `json:"Duration"`
	Room        *rawRoom    `json:"Room"`
	Instructors []rawPerson `json:"Instructors"`
}

type rawRoom struct {
	Id       string   `json:"Id"`
	Number   string   `json:"Number"`
	Building *rawBldg `json:"Building"`
}

type rawBldg struct {
	Id        string `json:"Id"`
	CampusId  string `json:"CampusId"`
	Name      string `json:"Name"`
	ShortCode string `json:"ShortCode"`
}

type rawPerson struct {
	Id    string `json:"Id"`
	Name  string `json:"Name"`
	Email string `json:"Email"`
}

// Public API models and store
type CourseSummary struct {
	Id          string `json:"id"`
	Number      string `json:"number"`
	Title       string `json:"title"`
	SubjectId   string `json:"subjectId"`
	SubjectAbbr string `json:"subjectAbbr"`
}

type MeetingInfo struct {
	Days         []string `json:"days"`
	Start        string   `json:"start"` // HH:MM
	DurationMin  int      `json:"durationMin"`
	BuildingCode string   `json:"buildingCode"`
	RoomNumber   string   `json:"roomNumber"`
	Instructors  []string `json:"instructors"`
	Type         string   `json:"type"`
}

type SectionInfo struct {
	Id        string        `json:"id"`
	Crn       string        `json:"crn"`
	Type      string        `json:"type"`
	StartDate string        `json:"startDate"`
	EndDate   string        `json:"endDate"`
	Meetings  []MeetingInfo `json:"meetings"`
}

type Store struct {
	courses []CourseSummary
	// Map courseId -> sections
	courseToSections map[string][]SectionInfo
	// Map sectionId -> section (for schedule)
	sectionById map[string]SectionInfo
	// Map sectionId -> parent course summary
	courseBySectionId map[string]CourseSummary
	// SubjectId -> Abbreviation
	subjectAbbrById map[string]string
}

func (s *Store) CourseCount() int {
	return len(s.courses)
}

func (s *Store) SearchCourses(q string, limit int) []CourseSummary {
	if q == "" {
		if limit > 0 && len(s.courses) > limit {
			return s.courses[:limit]
		}
		return s.courses
	}
	q = strings.ToLower(strings.TrimSpace(q))
	results := make([]CourseSummary, 0, 32)

	// Check if query is in format "SUBJ NUMBER" (e.g., "ECE 20001")
	parts := strings.Fields(q)

	for _, c := range s.courses {
		match := false

		// Try to match "SUBJ NUMBER" format
		if len(parts) >= 2 {
			subjectMatch := strings.EqualFold(c.SubjectAbbr, parts[0])
			numberMatch := strings.Contains(strings.ToLower(c.Number), strings.ToLower(parts[1]))
			if subjectMatch && numberMatch {
				match = true
			}
		}

		// Also check individual components
		if !match {
			fullCourse := strings.ToLower(c.SubjectAbbr + " " + c.Number)
			if strings.Contains(fullCourse, q) ||
				strings.Contains(strings.ToLower(c.Title), q) ||
				strings.Contains(strings.ToLower(c.Number), q) ||
				strings.Contains(strings.ToLower(c.SubjectAbbr), q) {
				match = true
			}
		}

		if match {
			results = append(results, c)
			if limit > 0 && len(results) >= limit {
				break
			}
		}
	}
	return results
}

func (s *Store) SectionsByCourse(courseId string) []SectionInfo {
	return s.courseToSections[courseId]
}

func (s *Store) SectionsByIds(ids []string) []SectionInfo {
	out := make([]SectionInfo, 0, len(ids))
	for _, id := range ids {
		if sec, ok := s.sectionById[id]; ok {
			out = append(out, sec)
		}
	}
	return out
}

func (s *Store) CourseBySectionId(id string) (CourseSummary, bool) {
	c, ok := s.courseBySectionId[id]
	return c, ok
}

// SubjectAbbr returns the subject abbreviation for the given subject id if known.
func (s *Store) SubjectAbbr(subjectId string) string {
	if s == nil || s.subjectAbbrById == nil {
		return ""
	}
	return s.subjectAbbrById[subjectId]
}

// Subject payloads for enrichment
type subjectResp struct {
	Value []subject `json:"value"`
}

type subject struct {
	Id           string `json:"Id"`
	Abbreviation string `json:"Abbreviation"`
	Name         string `json:"Name"`
}

// MaybeFetchSubjects populates subject abbreviations via Purdue API if empty.
func (s *Store) MaybeFetchSubjects() error {
	if len(s.subjectAbbrById) > 0 {
		return nil
	}
	client := &http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest(http.MethodGet, "https://api.purdue.io/odata/Subjects", nil)
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var sr subjectResp
	if err := json.NewDecoder(resp.Body).Decode(&sr); err != nil {
		return err
	}
	s.subjectAbbrById = make(map[string]string, len(sr.Value))
	for _, v := range sr.Value {
		s.subjectAbbrById[v.Id] = v.Abbreviation
	}
	// Backfill course summaries
	for i := range s.courses {
		s.courses[i].SubjectAbbr = s.subjectAbbrById[s.courses[i].SubjectId]
	}
	return nil
}

// Department represents a department/subject
type Department struct {
	Abbreviation string `json:"abbreviation"`
	Name         string `json:"name"`
}

// GetAllDepartments returns all unique departments sorted alphabetically
func (s *Store) GetAllDepartments() []Department {
	if s == nil {
		return []Department{}
	}

	deptMap := make(map[string]string) // abbr -> name

	// Extract departments from courses
	for _, course := range s.courses {
		if course.SubjectAbbr != "" {
			// Use subject abbreviation as department
			deptMap[course.SubjectAbbr] = course.SubjectAbbr // For now, use abbr as name too
		}
	}

	// Convert map to sorted slice
	departments := make([]Department, 0, len(deptMap))
	for abbr, name := range deptMap {
		departments = append(departments, Department{
			Abbreviation: abbr,
			Name:         name,
		})
	}

	// Sort alphabetically by abbreviation
	sort.Slice(departments, func(i, j int) bool {
		return departments[i].Abbreviation < departments[j].Abbreviation
	})

	return departments
}
