import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import CourseSearch from './components/CourseSearch';
import WeeklySchedule from './components/WeeklySchedule';
import CourseDetails from './components/CourseDetails';
import SelectedCourses from './components/SelectedCourses';
import ScheduleControls from './components/ScheduleControls';
import { Calendar, BookOpen, Clock, Users, Train } from 'lucide-react';
import axios from 'axios';

// Configure axios - in development, Vite proxy handles /api routes
// In production, requests go to same origin
axios.defaults.baseURL = '';

function App()
{
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseSections, setCourseSections] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [scheduleView, setScheduleView] = useState('week'); // week, list

  // Search for courses
  const searchCourses = async (query) =>
  {
    setLoading(true);
    try
    {
      const response = await axios.get(`/api/search?q=${encodeURIComponent(query)}`);
      setCourses(response.data || []);
    }
    catch (error)
    {
      console.error('Error searching courses:', error);
      setCourses([]);
    }
    finally
    {
      setLoading(false);
    }
  };

  // Load sections for a selected course
  const loadCourseSections = async (course) =>
  {
    setSelectedCourse(course);
    setLoading(true);
    try
    {
      const response = await axios.get(`/api/course/${course.id}/sections`);
      setCourseSections(response.data || []);
    }
    catch (error)
    {
      console.error('Error loading sections:', error);
      setCourseSections([]);
    }
    finally
    {
      setLoading(false);
    }
  };

  // Add a section to the schedule
  const addSection = (section) =>
  {
    // Check for time conflicts
    const hasConflict = selectedSections.some(existing =>
      checkTimeConflict(existing, section)
    );

    if (hasConflict)
    {
      alert('This section conflicts with an existing course in your schedule.');
      return;
    }

    setSelectedSections([...selectedSections, { ...section, course: selectedCourse }]);
  };

  // Remove a section from the schedule
  const removeSection = (sectionId) =>
  {
    setSelectedSections(selectedSections.filter(s => s.id !== sectionId));
  };

  // Check for time conflicts between two sections
  const checkTimeConflict = (section1, section2) =>
  {
    for (const meeting1 of section1.meetings || [])
    {
      for (const meeting2 of section2.meetings || [])
      {
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
        if (start1 < end2 && start2 < end1)
        {
          return true;
        }
      }
    }
    return false;
  };

  // Parse time string to minutes
  const parseTime = (timeStr) =>
  {
    if (!timeStr || timeStr.length < 5) return 0;
    const hours = parseInt(timeStr.substring(0, 2));
    const minutes = parseInt(timeStr.substring(3, 5));
    return hours * 60 + minutes;
  };

  // Export schedule as PDF
  const exportSchedule = () =>
  {
    if (selectedSections.length === 0)
    {
      alert('Please add at least one course to your schedule.');
      return;
    }
    const sectionIds = selectedSections.map(s => s.id).join(',');
    window.open(`/api/schedule/pdf?sections=${encodeURIComponent(sectionIds)}`, '_blank');
  };

  // Load initial courses
  useEffect(() =>
  {
    searchCourses('');
  }, []);

  // Auto-search when query changes
  useEffect(() =>
  {
    const timer = setTimeout(() =>
    {
      searchCourses(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-purdue-gold/5">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-black shadow-lg border-b-4 border-purdue-gold">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Train className="h-8 w-8 text-purdue-gold" />
              <div>
                <h1 className="text-2xl font-bold text-purdue-gold">
                  BoilerSchedule
                </h1>
                <p className="text-xs text-purdue-gold/70">Purdue Course Scheduler</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-purdue-gold/80">
                <Clock className="h-4 w-4 mr-1" />
                <span>Fall 2025</span>
              </div>
              <button
                onClick={exportSchedule}
                className="px-4 py-2 bg-purdue-gold text-black rounded-lg hover:bg-purdue-gold-dark transition-colors flex items-center space-x-2 font-semibold shadow-md hover:shadow-lg"
              >
                <BookOpen className="h-4 w-4" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Search and Course Details */}
          <div className="lg:col-span-1 space-y-6">
            <CourseSearch
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              courses={courses}
              onSelectCourse={loadCourseSections}
              loading={loading}
            />
            
            {selectedCourse && (
              <CourseDetails
                course={selectedCourse}
                sections={courseSections}
                onAddSection={addSection}
                selectedSections={selectedSections}
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
              <WeeklySchedule
                sections={selectedSections}
                onRemoveSection={removeSection}
              />
            ) : (
              <SelectedCourses
                sections={selectedSections}
                onRemoveSection={removeSection}
              />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black border-t-4 border-purdue-gold mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-purdue-gold" />
                <span className="text-sm text-purdue-gold">
                  {selectedSections.length} courses selected
                </span>
              </div>
              <span className="text-purdue-gold/60 text-sm">•</span>
              <span className="text-sm text-purdue-gold/80">
                Boiler Up! 🚂
              </span>
            </div>
            <div className="text-sm text-purdue-gold/60">
              © 2025 BoilerSchedule
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Calculate total credits
function calculateTotalCredits(sections)
{
  // For now, estimate 3 credits per course (can be enhanced with actual credit data)
  return sections.length * 3;
}

export default App;