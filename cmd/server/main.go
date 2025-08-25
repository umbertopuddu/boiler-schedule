package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"purdue_schedule/internal/api"
	"purdue_schedule/internal/data"

	"github.com/gorilla/mux"
)

func main() {
	var jsonPath string
	var addr string
	var staticDir string

	flag.StringVar(&jsonPath, "data", "purdue_courses_fall_2025.json", "Path to courses JSON file")
	flag.StringVar(&addr, "addr", ":8080", "HTTP listen address")
	flag.StringVar(&staticDir, "static", "web", "Static assets directory to serve")
	flag.Parse()

	absJSON, err := filepath.Abs(jsonPath)
	if err != nil {
		log.Fatalf("failed to resolve data path: %v", err)
	}
	if _, err := os.Stat(absJSON); err != nil {
		log.Fatalf("data file not found: %s", absJSON)
	}

	log.Printf("loading data from %s", absJSON)
	start := time.Now()
	store, err := data.LoadStore(absJSON)
	if err != nil {
		log.Fatalf("failed to load data: %v", err)
	}
	log.Printf("loaded %d courses in %s", store.CourseCount(), time.Since(start))

	// Fetch subject mapping to enrich schedules with subject abbreviations
	if err := store.MaybeFetchSubjects(); err != nil {
		log.Printf("warning: failed to fetch subject names: %v", err)
	}

	r := mux.NewRouter()

	apiRouter := r.PathPrefix("/api").Subrouter()
	apiRouter.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}).Methods(http.MethodGet)

	handler := api.NewHandler(store)
	apiRouter.HandleFunc("/search", handler.HandleSearch).Methods(http.MethodGet, http.MethodOptions)
	apiRouter.HandleFunc("/departments", handler.HandleDepartments).Methods(http.MethodGet, http.MethodOptions)
	apiRouter.HandleFunc("/campuses", handler.HandleCampuses).Methods(http.MethodGet, http.MethodOptions)
	apiRouter.HandleFunc("/course/{id}/sections", handler.HandleCourseSections).Methods(http.MethodGet, http.MethodOptions)
	apiRouter.HandleFunc("/schedule/pdf", handler.HandleSchedulePDF).Methods(http.MethodGet, http.MethodOptions)
	apiRouter.HandleFunc("/schedule/html", handler.HandleScheduleHTML).Methods(http.MethodGet, http.MethodOptions)
	apiRouter.HandleFunc("/schedule/svg", handler.HandleScheduleSVG).Methods(http.MethodGet, http.MethodOptions)
	apiRouter.HandleFunc("/schedule/pdf-from-image", handler.HandlePDFFromImage).Methods(http.MethodPost, http.MethodOptions)
	apiRouter.Methods(http.MethodOptions).HandlerFunc(handler.HandleOptions)

	// Serve static files
	absStatic, _ := filepath.Abs(staticDir)
	r.PathPrefix("/").Handler(http.FileServer(http.Dir(absStatic)))

	log.Printf("serving on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		fmt.Println(err)
		log.Fatal(err)
	}
}
