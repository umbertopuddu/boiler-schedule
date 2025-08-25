import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import CourseSearch from './components/CourseSearch';
import DepartmentList from './components/DepartmentList';
import WeeklySchedule from './components/WeeklySchedule';
import FullCalendarSchedule from './components/FullCalendarSchedule';
import CourseDetails from './components/CourseDetails';
import SelectedCourses from './components/SelectedCourses';
import ScheduleControls from './components/ScheduleControls';
import StudentInfoModal from './components/StudentInfoModal';
import { Calendar, BookOpen, Clock, Users, Train } from 'lucide-react';
import axios from 'axios';

// Configure axios - in development, Vite proxy handles /api routes
// In production, requests go to same origin
axios.defaults.baseURL = '';

function App() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseSections, setCourseSections] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [scheduleView, setScheduleView] = useState('week'); // week, list
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const [mobileView, setMobileView] = useState('search'); // search, schedule (for mobile only)
  const [selectedCampuses, setSelectedCampuses] = useState(['eb70e97b-3583-4ac9-86e5-468ad3869de8']); // West Lafayette Campus by default
  const [campuses, setCampuses] = useState([]);

  // Helper function to get clean campus names
  const getCleanCampusName = (campusName) => {
    if (!campusName) return 'Unknown';
    
    // Handle specific campus name mappings
    const cleanName = campusName
      .replace('Indianapolis and W Lafayette Campus', 'Indianapolis')
      .replace('West Lafayette Campus', 'West Lafayette')
      .replace('SW ', '')
      .replace(' Campus', '')
      .replace('Continuing Ed', 'Cont. Ed')
      .replace('Manufacturing', 'Mfg')
      .replace('International Airport', 'Airport');
    
    return cleanName;
  };

  // Search for courses across selected campuses
  const searchCourses = async (query) => {
    setLoading(true);
    try {
      // Search all selected campuses and merge results
      const searchPromises = selectedCampuses.map(async (campusId) => {
        const params = new URLSearchParams({ q: query, campus: campusId });
        const response = await axios.get(`/api/search?${params.toString()}`);
        return (response.data || []).map(course => ({ ...course, campusId }));
      });
      
      const results = await Promise.all(searchPromises);
      const mergedResults = results.flat();
      
      // Remove duplicates (same course on multiple campuses)
      const uniqueCourses = mergedResults.reduce((acc, course) => {
        const existing = acc.find(c => c.id === course.id);
        if (existing) {
          // Add campus to existing course if not already there
          if (!existing.campuses) existing.campuses = [existing.campusId];
          if (!existing.campuses.includes(course.campusId)) {
            existing.campuses.push(course.campusId);
          }
        } else {
          course.campuses = [course.campusId];
          acc.push(course);
        }
        return acc;
      }, []);
      
      setCourses(uniqueCourses);
    } catch (error) {
      console.error('Error searching courses:', error);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  // Load sections for a selected course across all selected campuses
  const loadCourseSections = async (course) => {
    setSelectedCourse(course);
    setLoading(true);
    try {
      // Load sections from all selected campuses
      const sectionPromises = selectedCampuses.map(async (campusId) => {
        const params = new URLSearchParams({ campus: campusId });
        const response = await axios.get(`/api/course/${course.id}/sections?${params.toString()}`);
        return (response.data || []).map(section => ({ ...section, campusId }));
      });
      
      const results = await Promise.all(sectionPromises);
      const allSections = results.flat();
      setCourseSections(allSections);
    } catch (error) {
      console.error('Error loading sections:', error);
      setCourseSections([]);
    } finally {
      setLoading(false);
    }
  };

  // Add a section to the schedule
  const addSection = (section) => {
    // Check for time conflicts
    const hasConflict = selectedSections.some(existing =>
      checkTimeConflict(existing, section)
    );

    if (hasConflict) {
      alert('This section conflicts with an existing course in your schedule.');
      return;
    }

    setSelectedSections(prev => [...prev, { ...section, course: selectedCourse }]);
  };

  // Remove a section from the schedule
  const removeSection = (sectionId) => {
    setSelectedSections(prev => prev.filter(s => s.id !== sectionId));
  };

  // Replace a section atomically
  const replaceSection = (oldSectionId, newSection, courseForNew) => {
    setSelectedSections(prev => {
      const withoutOld = prev.filter(s => s.id !== oldSectionId);
      // Check for conflicts against the remaining sections
      const conflict = withoutOld.some(existing => checkTimeConflict(existing, newSection));
      if (conflict) {
        alert('The replacement section conflicts with another course in your schedule.');
        return prev;
      }
      return [...withoutOld, { ...newSection, course: courseForNew }];
    });
  };

  // Check for time conflicts between two sections
  const checkTimeConflict = (section1, section2) => {
    for (const meeting1 of section1.meetings || []) {
      for (const meeting2 of section2.meetings || []) {
        const days1 = meeting1.days || [];
        const days2 = meeting2.days || [];
        
        // Check if they share any days
        const sharedDays = days1.filter(day => days2.includes(day));
        if (sharedDays.length === 0) continue;

        // Parse times
        const start1 = parseTime(meeting1.start);
        const end1 = start1 + meeting1.durationMin;
        const start2 = parseTime(meeting2.start);
        const end2 = start2 + meeting2.durationMin;

        // Check for time overlap
        if (start1 < end2 && start2 < end1) {
          return true;
        }
      }
    }
    return false;
  };

  // Parse time string to minutes
  const parseTime = (timeStr) => {
    if (!timeStr || timeStr.length < 5) return 0;
    const hours = parseInt(timeStr.substring(0, 2));
    const minutes = parseInt(timeStr.substring(3, 5));
    return hours * 60 + minutes;
  };

  // Handle student info submission and PDF generation
  const handleStudentInfoSubmit = (info) => {
    setStudentInfo(info);
    setShowStudentModal(false);
    
    // Generate PDF with student info
    const sectionIds = selectedSections.map(s => s.id).join(',');
    const params = new URLSearchParams({
      sections: sectionIds,
      studentName: info.name,
      studentEmail: info.email,
      studentId: info.studentId,
      major: info.major,
      year: info.year
    });
    
    window.open(`/api/schedule/pdf?${params.toString()}`, '_blank');
  };

  // Load campuses and initial courses
  useEffect(() => {
    const loadCampuses = async () => {
      try {
        const response = await axios.get('/api/campuses');
        const allCampuses = response.data || [];
        
        // Filter to only show main campuses (West Lafayette and Indianapolis only)
        const filteredCampuses = allCampuses.filter(campus => {
          const name = campus.name.toLowerCase();
          return (
            (name.includes('west lafayette') && !name.includes('continuing ed')) ||
            (name.includes('indianapolis') && !name.includes('airport') && !name.includes('continuing ed'))
          );
        });
        
        // Sort: West Lafayette first, then Indianapolis
        const sortedCampuses = filteredCampuses.sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          
          if (aName.includes('west lafayette')) return -1;
          if (bName.includes('west lafayette')) return 1;
          return 0; // Indianapolis comes after
        });
        
        setCampuses(sortedCampuses);
      } catch (error) {
        console.error('Error loading campuses:', error);
      }
    };
    loadCampuses();
    searchCourses('');
  }, []);

  // Auto-search when query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCourses(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCampuses]);

  // Auto-reload sections when campuses change and a course is selected
  useEffect(() => {
    if (selectedCourse) {
      loadCourseSections(selectedCourse);
    }
  }, [selectedCampuses]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-purdue-gold/5">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-black shadow-lg border-b-4 border-purdue-gold">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="bg-black p-1 sm:p-2 rounded-lg">
                <img 
                  src="/logo.png" 
                  alt="BoilerSchedule Logo" 
                  className="h-6 w-6 sm:h-8 sm:w-8 object-contain"
                />
              </div>
              <div>
                <a 
                  href="mailto:upuddu@purdue.edu"
                  className="hover:text-purdue-gold-light transition-colors"
                >
                  <h1 className="text-lg sm:text-2xl font-black text-purdue-gold hover:opacity-80 tracking-tight">
                    BoilerSchedule
                  </h1>
                </a>
                <p className="hidden sm:block text-xs text-purdue-gold/70">Purdue Course Scheduler</p>
              </div>
            </div>
            <div className="flex items-center text-sm text-purdue-gold/80">
              <Clock className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Fall 2025</span>
              <span className="sm:hidden">F25</span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Tabs */}
      <div className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex">
          <button
            onClick={() => setMobileView('search')}
            className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              mobileView === 'search'
                ? 'border-purdue-gold text-purdue-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <BookOpen className="h-4 w-4" />
              <span>Search Courses</span>
            </div>
          </button>
          <button
            onClick={() => setMobileView('schedule')}
            className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors relative ${
              mobileView === 'schedule'
                ? 'border-purdue-gold text-purdue-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Schedule</span>
              {selectedSections.length > 0 && (
                <span className="absolute top-2 right-2 bg-purdue-gold text-black text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {selectedSections.length}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        {/* Campus Selector */}
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-lg p-4 border-2 border-purdue-gold/20">
            <div className="flex flex-col gap-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <span className="w-2 h-2 bg-purdue-gold rounded-full mr-2"></span>
                Campuses:
              </label>
              <div className="flex flex-wrap gap-2">
                {campuses.map((campus) => {
                  const isSelected = selectedCampuses.includes(campus.id);
                  const isMainCampus = ['west lafayette', 'indianapolis', 'northwest'].some(p => 
                    campus.name.toLowerCase().includes(p)
                  );
                  
                  return (
                    <button
                      key={campus.id}
                      onClick={() => {
                        if (isSelected) {
                          // Don't allow removing all campuses
                          if (selectedCampuses.length > 1) {
                            setSelectedCampuses(selectedCampuses.filter(id => id !== campus.id));
                          }
                        } else {
                          setSelectedCampuses([...selectedCampuses, campus.id]);
                        }
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                        isSelected
                          ? 'bg-purdue-gold text-black border-purdue-gold shadow-md'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-purdue-gold/50 hover:bg-purdue-gold/5'
                      } ${isMainCampus ? 'ring-2 ring-purdue-gold/20' : ''}`}
                      title={campus.name}
                    >
                      {getCleanCampusName(campus.name)}
                      {isSelected && <span className="ml-1">✓</span>}
                    </button>
                  );
                })}
              </div>
              {selectedCampuses.length > 1 && (
                <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded-lg">
                  <span className="font-medium">Multi-campus mode:</span> Courses from {selectedCampuses.length} campuses will be shown with location indicators.
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Search and Course Details */}
          <div className="lg:col-span-1 space-y-6">
            <CourseSearch
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              courses={courses}
              onSelectCourse={loadCourseSections}
              loading={loading}
              selectedCampuses={selectedCampuses}
              campuses={campuses}
              getCleanCampusName={getCleanCampusName}
            />

            <DepartmentList
              onDepartmentClick={(dept) => {
                setSearchQuery(dept);
                searchCourses(dept);
              }}
              selectedCampuses={selectedCampuses}
              campuses={campuses}
            />
            
            {selectedCourse && (
              <CourseDetails
                course={selectedCourse}
                sections={courseSections}
                onAddSection={addSection}
                onRemoveSection={removeSection}
                onReplaceSection={replaceSection}
                selectedSections={selectedSections}
                campuses={campuses}
                getCleanCampusName={getCleanCampusName}
              />
            )}
          </div>

          {/* Right Content - Schedule View */}
          <div className="lg:col-span-2 space-y-6">
            <ScheduleControls
              view={scheduleView}
              onViewChange={setScheduleView}
              totalCredits={calculateTotalCredits(selectedSections)}
            />
            
            {scheduleView === 'week' ? (
              <FullCalendarSchedule
                selectedSections={selectedSections}
                onRemoveSection={removeSection}
                onAddSection={addSection}
                onReplaceSection={replaceSection}
                studentInfo={studentInfo}
                campuses={campuses}
                getCleanCampusName={getCleanCampusName}
                selectedCampuses={selectedCampuses}
              />
            ) : (
              <SelectedCourses
                sections={selectedSections}
                onRemoveSection={removeSection}
              />
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden">
          {mobileView === 'search' ? (
            <div className="space-y-4">
              <CourseSearch
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                courses={courses}
                onSelectCourse={loadCourseSections}
                loading={loading}
                selectedCampuses={selectedCampuses}
                campuses={campuses}
                getCleanCampusName={getCleanCampusName}
              />

              <DepartmentList
                onDepartmentClick={(dept) => {
                  setSearchQuery(dept);
                  searchCourses(dept);
                }}
                selectedCampuses={selectedCampuses}
                campuses={campuses}
              />
              
              {selectedCourse && (
                <CourseDetails
                  course={selectedCourse}
                  sections={courseSections}
                  onAddSection={(section) => {
                    addSection(section);
                    // Auto-switch to schedule view after adding
                    setMobileView('schedule');
                  }}
                  onRemoveSection={removeSection}
                  onReplaceSection={replaceSection}
                  selectedSections={selectedSections}
                  campuses={campuses}
                  getCleanCampusName={getCleanCampusName}
                />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <ScheduleControls
                view={scheduleView}
                onViewChange={setScheduleView}
                totalCredits={calculateTotalCredits(selectedSections)}
              />
              
              {scheduleView === 'week' ? (
                <FullCalendarSchedule
                  selectedSections={selectedSections}
                  onRemoveSection={removeSection}
                  onAddSection={addSection}
                  onReplaceSection={replaceSection}
                  studentInfo={studentInfo}
                  isMobile={true}
                  campuses={campuses}
                  getCleanCampusName={getCleanCampusName}
                  selectedCampuses={selectedCampuses}
                />
              ) : (
                <SelectedCourses
                  sections={selectedSections}
                  onRemoveSection={removeSection}
                />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black border-t-4 border-purdue-gold mt-8 sm:mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-purdue-gold" />
                  <span className="text-xs sm:text-sm text-purdue-gold">
                    {selectedSections.length} courses selected
                  </span>
                </div>
                <span className="hidden sm:inline text-purdue-gold/60 text-sm">•</span>
                <span className="text-xs sm:text-sm text-purdue-gold/80">
                  Boiler Up! 🚂
                </span>
              </div>
              <div className="text-xs sm:text-sm text-purdue-gold/60">
                © 2025 BoilerSchedule
              </div>
            </div>
            <div className="border-t border-purdue-gold/30 pt-3 sm:pt-4">
              <p className="text-xs text-purdue-gold/60 text-center px-4">
                BoilerSchedule is not affiliated with Purdue University. Made by{' '}
                <a 
                  href="https://github.com/umbertopuddu" 
                  className="text-purdue-gold hover:text-purdue-gold-light transition-colors underline"
                >
                  Umberto Puddu
                </a>.
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Student Info Modal */}
      <StudentInfoModal
        isOpen={showStudentModal}
        onClose={() => setShowStudentModal(false)}
        onSubmit={handleStudentInfoSubmit}
        currentInfo={studentInfo}
      />
    </div>
  );
}

// Calculate total credits
function calculateTotalCredits(sections) {
  // For now, estimate 3 credits per course (can be enhanced with actual credit data)
  return sections.length * 3;
}

export default App;