package data

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// LoadStore streams the big JSON file and builds an in-memory index
func LoadStore(path string) (*Store, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	dec := json.NewDecoder(f)
	// The file is a JSON array
	t, err := dec.Token()
	if err != nil {
		return nil, err
	}
	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return nil, fmt.Errorf("expected JSON array at top level")
	}

	store := &Store{
		courses:           make([]CourseSummary, 0, 10000),
		courseToSections:  make(map[string][]SectionInfo, 10000),
		sectionById:       make(map[string]SectionInfo, 50000),
		courseBySectionId: make(map[string]CourseSummary, 50000),
		subjectAbbrById:   make(map[string]string, 0),
	}

	for dec.More() {
		var rc rawCourse
		if err := dec.Decode(&rc); err != nil {
			if err == io.EOF {
				break
			}
			return nil, err
		}

		// Summarize course
		cs := CourseSummary{
			Id:        rc.Id,
			Number:    rc.Number,
			Title:     rc.Title,
			SubjectId: rc.SubjectId,
		}
		store.courses = append(store.courses, cs)

		// Aggregate sections
		var allSections []SectionInfo
		for _, cls := range rc.Classes {
			for _, sec := range cls.Sections {
				s := SectionInfo{
					Id:        sec.Id,
					Crn:       sec.Crn,
					Type:      sec.Type,
					StartDate: sec.StartDate,
					EndDate:   sec.EndDate,
				}
				// Meetings
				for _, m := range sec.Meetings {
					mi := MeetingInfo{
						Days:         parseDays(m.DaysOfWeek),
						Start:        normalizeStart(m.StartTime),
						DurationMin:  parseISODurationMinutes(m.Duration),
						BuildingCode: "",
						RoomNumber:   "",
						Instructors:  make([]string, 0, len(m.Instructors)),
						Type:         m.Type,
					}
					if m.Room != nil && m.Room.Building != nil {
						mi.BuildingCode = m.Room.Building.ShortCode
						mi.RoomNumber = m.Room.Number
					}
					for _, p := range m.Instructors {
						if strings.TrimSpace(p.Name) != "" {
							mi.Instructors = append(mi.Instructors, p.Name)
						}
					}
					s.Meetings = append(s.Meetings, mi)
				}
				allSections = append(allSections, s)
				store.sectionById[s.Id] = s
				store.courseBySectionId[s.Id] = cs
			}
		}
		// Sort sections by CRN for stable UI dropdown
		sort.Slice(allSections, func(i, j int) bool { return allSections[i].Crn < allSections[j].Crn })
		store.courseToSections[rc.Id] = allSections
	}

	// Drain closing bracket
	_, _ = dec.Token()

	// Sort courses by title for default browsing
	sort.Slice(store.courses, func(i, j int) bool {
		if store.courses[i].Title == store.courses[j].Title {
			return store.courses[i].Number < store.courses[j].Number
		}
		return store.courses[i].Title < store.courses[j].Title
	})

	return store, nil
}

func parseDays(s string) []string {
	s = strings.TrimSpace(s)
	if s == "" || strings.EqualFold(s, "None") {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func normalizeStart(ptr *string) string {
	if ptr == nil {
		return ""
	}
	// Expect HH:MM:SS.ffffff
	s := *ptr
	if len(s) < 5 {
		return ""
	}
	// HH:MM
	return s[:5]
}

var isoDurRe = regexp.MustCompile(`^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$`)

func parseISODurationMinutes(d string) int {
	if d == "" {
		return 0
	}
	m := isoDurRe.FindStringSubmatch(d)
	if m == nil {
		return 0
	}
	hours := 0
	minutes := 0
	if m[1] != "" {
		hours, _ = strconv.Atoi(m[1])
	}
	if m[2] != "" {
		minutes, _ = strconv.Atoi(m[2])
	}
	return hours*60 + minutes
}
