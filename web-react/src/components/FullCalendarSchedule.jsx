import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Save, Share2, X, RefreshCw } from 'lucide-react';
import axios from 'axios';

// Purdue-themed color palettes for departments (base color + shades)
const DEPARTMENT_COLORS = {
  'CS': {
    base: '#CFB991', // Purdue Gold
    shades: ['#CFB991', '#B8A47E', '#A1906B', '#8A7B58', '#736645']
  },
  'MA': {
    base: '#000000', // Purdue Black variations
    shades: ['#2C2C2C', '#404040', '#545454', '#686868', '#7C7C7C']
  },
  'PHYS': {
    base: '#8B4513', // Brown family
    shades: ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#F4A460']
  },
  'ECE': {
    base: '#4169E1', // Blue family  
    shades: ['#4169E1', '#6495ED', '#87CEEB', '#B0C4DE', '#E6F3FF']
  },
  'ME': {
    base: '#DC143C', // Red family
    shades: ['#DC143C', '#F08080', '#FA8072', '#FFA07A', '#FFB6C1']
  },
  'CHEM': {
    base: '#228B22', // Green family
    shades: ['#228B22', '#32CD32', '#90EE90', '#98FB98', '#F0FFF0']
  },
  'AAE': {
    base: '#4B0082', // Purple family
    shades: ['#4B0082', '#8A2BE2', '#9370DB', '#BA55D3', '#DDA0DD']
  },
  'BIOL': {
    base: '#FF8C00', // Orange family
    shades: ['#FF8C00', '#FFA500', '#FFB347', '#FFCC99', '#FFE4B5']
  },
  'default': {
    base: '#5B6870', // Purdue Gray
    shades: ['#5B6870', '#6B7880', '#7B8890', '#8B98A0', '#9BA8B0']
  }
};

// RGB color picker options
const RGB_COLORS = [
  '#CFB991', '#000000', '#8B4513', '#4169E1', '#DC143C', '#228B22',
  '#4B0082', '#FF8C00', '#FF1493', '#00CED1', '#32CD32', '#FF4500',
  '#9932CC', '#FF6347', '#4682B4', '#D2691E', '#8FBC8F', '#B22222'
];

const FullCalendarSchedule = forwardRef(({ selectedSections, onRemoveSection, onAddSection, onReplaceSection, studentInfo, isMobile = false, campuses = [], getCleanCampusName, selectedCampuses = [] }, ref) => {
  const calendarRef = useRef(null);
  const scheduleRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [customColors, setCustomColors] = useState({}); // Store custom colors for sections
  const [timeRange, setTimeRange] = useState({ min: '08:00:00', max: '13:00:00' }); // Default 8am-1pm
  const [sectionPopup, setSectionPopup] = useState(null); // Store popup state for section management

  // Expose export function to parent component
  useImperativeHandle(ref, () => ({
    exportPDF: handleExportPDF
  }));

  // Debug logging
  useEffect(() => {
    console.log('FullCalendarSchedule mounted');
    console.log('Selected sections:', selectedSections);
    console.log('Student info:', studentInfo);
  }, [selectedSections, studentInfo]);

  // Calculate dynamic time range based on courses
  useEffect(() => {
    if (selectedSections.length === 0) {
      setTimeRange({ min: '08:00:00', max: '13:00:00' }); // Default 8am-1pm (5 hours)
      return;
    }

    let minTime = 24 * 60; // minutes from midnight
    let maxTime = 0;

    selectedSections.forEach(section => {
      section.meetings?.forEach(meeting => {
        if (!meeting.start || !meeting.durationMin) return;
        
        const [hours, minutes] = meeting.start.split(':').map(Number);
        const startMin = hours * 60 + minutes;
        const endMin = startMin + meeting.durationMin;
        
        if (startMin < minTime) minTime = startMin;
        if (endMin > maxTime) maxTime = endMin;
      });
    });

    // Add 30-minute padding
    minTime = Math.max(0, minTime - 30);
    maxTime = Math.min(24 * 60, maxTime + 30);

    // Ensure minimum 4-hour range
    const currentRange = maxTime - minTime;
    const minRangeMinutes = 4 * 60; // 4 hours in minutes
    
    if (currentRange < minRangeMinutes) {
      const additionalTime = minRangeMinutes - currentRange;
      const halfAdditional = Math.floor(additionalTime / 2);
      
      minTime = Math.max(0, minTime - halfAdditional);
      maxTime = Math.min(24 * 60, maxTime + (additionalTime - halfAdditional));
      
      // If we hit the boundary, adjust the other side
      if (minTime === 0) {
        maxTime = Math.min(24 * 60, minRangeMinutes);
      } else if (maxTime === 24 * 60) {
        minTime = Math.max(0, 24 * 60 - minRangeMinutes);
      }
    }

    // Convert back to time strings
    const minHour = Math.floor(minTime / 60);
    const minMin = minTime % 60;
    const maxHour = Math.floor(maxTime / 60);
    const maxMinute = maxTime % 60;

    setTimeRange({
      min: `${minHour.toString().padStart(2, '0')}:${minMin.toString().padStart(2, '0')}:00`,
      max: `${maxHour.toString().padStart(2, '0')}:${maxMinute.toString().padStart(2, '0')}:00`
    });
  }, [selectedSections]);

  // Convert sections to FullCalendar events with smart color assignment
  useEffect(() => {
    const calendarEvents = [];
    const departmentCounts = {}; // Track how many courses per department
    
    selectedSections.forEach((section, sectionIndex) => {
      const dept = section.course?.subjectAbbr || 'default';
      const sectionId = section.id;
      
      // Use custom color if set, otherwise assign smart color
      let color;
      if (customColors[sectionId]) {
        color = customColors[sectionId];
      } else {
        // Smart color assignment: same department gets different shades
        const deptColors = DEPARTMENT_COLORS[dept] || DEPARTMENT_COLORS.default;
        const deptIndex = departmentCounts[dept] || 0;
        departmentCounts[dept] = deptIndex + 1;
        
        color = deptColors.shades[deptIndex % deptColors.shades.length];
      }
      
      section.meetings?.forEach((meeting, meetingIndex) => {
        if (!meeting.days || meeting.days.length === 0 || !meeting.start) return;
        
        // Parse time
        const [hours, minutes] = meeting.start.split(':').map(Number);
        const startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
        
        // Calculate end time
        const endHours = Math.floor((hours * 60 + minutes + meeting.durationMin) / 60);
        const endMinutes = (hours * 60 + minutes + meeting.durationMin) % 60;
        const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00`;
        
        // Map days to FullCalendar format (0=Sunday, 1=Monday, etc.)
        const dayMap = {
          'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
          'Thursday': 4, 'Friday': 5, 'Saturday': 6
        };
        
        meeting.days.forEach(day => {
          const dayOfWeek = dayMap[day];
          if (dayOfWeek === undefined) return;
          
          // Create recurring event for this day of week
          calendarEvents.push({
            id: `${section.id}-${meetingIndex}-${day}`,
            title: `${section.course?.subjectAbbr} ${section.course?.number}`,
            daysOfWeek: [dayOfWeek],
            startTime: startTime,
            endTime: endTime,
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
              section: section,
              meeting: meeting,
              instructor: meeting.instructors?.[0] || 'TBA',
              location: `${meeting.buildingCode} ${meeting.roomNumber}`,
              type: section.type,
              sectionId: sectionId
            }
          });
        });
      });
    });
    
    setEvents(calendarEvents);
  }, [selectedSections, customColors]);

  // State for replacement sections
  const [availableSections, setAvailableSections] = useState([]);

  // Custom event content (simplified, no color picker)
  const renderEventContent = (eventInfo) => {
    const props = eventInfo.event.extendedProps;
    
    return (
      <div className="p-2 text-sm overflow-hidden h-full flex flex-col justify-center relative cursor-pointer">
        {/* Type badge */}
        {props.type && (
          <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-purdue-black text-purdue-gold rounded text-[9px] font-bold border border-purdue-gold shadow-sm z-10">
            {props.type.slice(0, 3).toUpperCase()}
          </div>
        )}
        
        <div className="font-bold text-white text-sm leading-tight mb-1 pr-12">{eventInfo.event.title}</div>
        <div className="text-xs opacity-90 text-white leading-tight truncate">{props.instructor}</div>
        {eventInfo.view.type === 'timeGridWeek' && props.location && (
          <div className="text-xs opacity-80 text-white leading-tight truncate">{props.location}</div>
        )}
        {/* Campus indicator for multi-campus schedules */}
        {props.section?.campusId && campuses.length > 0 && (
          <div className="text-xs opacity-75 text-white leading-tight truncate">
            {getCleanCampusName ? 
              getCleanCampusName(campuses.find(c => c.id === props.section.campusId)?.name) : 
              (campuses.find(c => c.id === props.section.campusId)?.name.split(' ')[0] || 'Campus')
            }
          </div>
        )}
      </div>
    );
  };

  // Handle event click to show section management popup
  const handleEventClick = async (clickInfo) => {
    const section = clickInfo.event.extendedProps.section;
    const course = section.course;
    
    // Get the click position for popup placement
    const rect = clickInfo.el.getBoundingClientRect();
    
    // Fetch available sections for replacement from all selected campuses
    try {
      // Load sections from all selected campuses (same logic as in App.jsx)
      const sectionPromises = selectedCampuses.map(async (campusId) => {
        const params = new URLSearchParams({ campus: campusId });
        const response = await axios.get(`/api/course/${course.id}/sections?${params.toString()}`);
        return (response.data || []).map(s => ({ ...s, campusId }));
      });
      
      const results = await Promise.all(sectionPromises);
      const allSections = results.flat();
      
      // Filter for same type and exclude current section
      const availableForType = allSections.filter(s => 
        s.type === section.type && s.id !== section.id
      );
      
      setSectionPopup({
        section,
        course,
        availableSections: availableForType,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        }
      });
    } catch (error) {
      console.error('Error fetching sections:', error);
      setSectionPopup({
        section,
        course,
        availableSections: [],
        position: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        }
      });
    }
  };

  // Close popup when clicking outside
  const handleClosePopup = () => {
    setSectionPopup(null);
  };

  // Handle section replacement
  const handleReplaceSection = (newSection) => {
    if (sectionPopup && onReplaceSection) {
      onReplaceSection(sectionPopup.section.id, newSection, sectionPopup.course);
      handleClosePopup();
    }
  };

  // Handle color change
  const handleColorChange = (color) => {
    if (sectionPopup) {
      setCustomColors(prev => ({
        ...prev,
        [sectionPopup.section.id]: color
      }));
    }
  };

  // Get available sections for replacement (this would need to be passed from parent or fetched)
  const getAvailableSections = async (courseId, sectionType) => {
    try {
      const response = await axios.get(`/api/course/${courseId}/sections`);
      const allSections = response.data || [];
      return allSections.filter(s => s.type === sectionType);
    } catch (error) {
      console.error('Error fetching sections:', error);
      return [];
    }
  };

  // Share website using native OS share API
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BoilerSchedule - Purdue Course Scheduler',
          text: 'Check out this awesome Purdue course scheduler!',
          url: window.location.href
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error);
          // Fallback to clipboard
          handleFallbackShare();
        }
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      handleFallbackShare();
    }
  };

  // Fallback share method
  const handleFallbackShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Website URL copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert(`Share this URL: ${window.location.href}`);
    }
  };

  // Export to PDF using SVG-based backend generation
  const handleExportPDF = async () => {
    console.log('Export PDF button clicked (SVG-based)');
    
    if (selectedSections.length === 0) {
      alert('Please add courses to your schedule first');
      return;
    }

    setIsExporting(true);
    
    try {
      const sectionIds = selectedSections.map(s => s.id).join(',');
      const studentName = studentInfo?.name || '';
      const studentEmail = studentInfo?.email || '';
      const studentId = studentInfo?.studentId || '';
      const major = studentInfo?.major || '';
      const year = studentInfo?.year || '';

      const params = new URLSearchParams({
        sections: sectionIds,
        studentName: studentName,
        studentEmail: studentEmail,
        studentId: studentId,
        major: major,
        year: year,
        format: 'svg',
      });

      // Open PDF in new window/tab for download
      window.open(`/api/schedule/pdf?${params.toString()}`, '_blank');

      console.log('PDF export initiated successfully (SVG-based)');
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      alert(`Failed to export PDF: ${error.message}. Check console for details.`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl lg:rounded-2xl shadow-lg lg:shadow-xl border lg:border-2 border-purdue-gold/20 p-4 lg:p-6">
      {/* Purdue-branded header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 lg:mb-6 pb-3 lg:pb-4 border-b lg:border-b-2 border-purdue-gold/30 space-y-3 sm:space-y-0">
        <div className="flex items-center">
          <div className="w-2 lg:w-3 h-6 lg:h-8 bg-purdue-gold rounded-full mr-2 lg:mr-3"></div>
          <div>
            <h2 className="text-lg lg:text-xl font-bold text-purdue-black">Schedule Preview</h2>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleShare}
            className="flex items-center justify-center w-10 h-10 bg-purdue-gray/10 text-purdue-gray rounded-lg lg:rounded-xl hover:bg-purdue-gray/20 transition-colors border border-purdue-gray/20"
            title="Share"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center justify-center w-10 h-10 bg-purdue-gold text-purdue-black rounded-lg lg:rounded-xl hover:bg-purdue-gold/90 transition-colors disabled:opacity-50 shadow-md lg:shadow-lg"
            title={isExporting ? 'Exporting...' : 'Save/Export PDF'}
          >
            <Save className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      <div ref={scheduleRef} className="fullcalendar-wrapper rounded-lg lg:rounded-xl overflow-hidden border border-purdue-gold/30">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
          headerToolbar={isMobile ? {
            left: 'prev,next',
            center: 'title',
            right: 'today'
          } : false}
          weekends={false}
          allDaySlot={false}
          slotMinTime={timeRange.min}
          slotMaxTime={timeRange.max}
          slotDuration="00:15:00"
          slotLabelInterval="01:00:00"
          height={isMobile ? "400px" : "600px"}
          expandRows={true}
          contentHeight={isMobile ? "400px" : "600px"}
          events={events}
          eventContent={renderEventContent}
          eventClick={handleEventClick}
          dayHeaderFormat={{ weekday: isMobile ? 'short' : 'long' }}
          slotLabelFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short'
          }}
          eventOverlap={false}
          eventDisplay="block"
          displayEventTime={false}
        />
      </div>
      
      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          
          .fullcalendar-wrapper,
          .fullcalendar-wrapper * {
            visibility: visible;
          }
          
          .fullcalendar-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          
          /* Ensure colors print */
          .fc-event {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
          
          /* Hide interactive elements */
          .fc-event-resizer,
          .fc-event-main:hover {
            display: none !important;
          }
          
          /* Optimize for print */
          .fc {
            font-size: 10pt;
          }
          
          .fc-timegrid-slot {
            height: 30px !important;
          }
          
          /* Page setup */
          @page {
            size: landscape;
            margin: 0.5in;
          }
        }
        
        /* Purdue-branded calendar styles */
        .fc-event {
          cursor: pointer;
          border: 2px solid rgba(255, 255, 255, 0.3) !important;
          border-radius: 8px !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: all 0.2s ease;
        }
        
        .fc-event:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
          border-color: rgba(255, 255, 255, 0.6) !important;
        }
        
        .fc-timegrid-event {
          border-radius: 8px;
          padding: 6px;
          margin: 1px;
          min-height: 60px !important;
          font-size: 13px !important;
        }
        
        .fc-timegrid-event .fc-event-main {
          padding: 0 !important;
        }
        
        .fc-timegrid-event .fc-event-main-frame {
          height: 100% !important;
        }
        
        /* Purdue-themed header */
        .fc-col-header-cell {
          background: linear-gradient(135deg, #CFB991 0%, #B8A47E 100%) !important;
          color: #000 !important;
          font-weight: 700 !important;
          border: 1px solid #A1906B !important;
          padding: 12px 8px !important;
          text-align: center;
        }
        
        .fc-col-header-cell-cushion {
          color: #000 !important;
          font-size: 0.95rem;
          letter-spacing: 0.5px;
        }
        
        /* Time labels with Purdue styling */
        .fc-timegrid-slot-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: #5B6870;
          background-color: #f8f9fa;
          border-right: 2px solid #CFB991 !important;
        }
        
        .fc-timegrid-slot-label-cushion {
          padding: 4px 8px;
        }
        
        /* Grid styling with larger slots */
        .fc .fc-timegrid-col {
          border-right: 1px solid #e5e7eb;
          background-color: #fefefe;
        }
        
        .fc .fc-timegrid-slot {
          border-bottom: 1px solid #f1f3f4;
          min-height: 25px !important;
          height: 25px !important;
        }
        
        .fc .fc-timegrid-slot.fc-timegrid-slot-minor {
          border-bottom: 1px dotted #e5e7eb;
          min-height: 25px !important;
          height: 25px !important;
        }
        
        /* Hour lines stronger */
        .fc .fc-timegrid-slot:not(.fc-timegrid-slot-minor) {
          border-bottom: 1px solid #CFB991 !important;
        }
        
        /* Ensure events don't overlap and have proper spacing */
        .fc-timegrid-event-harness {
          margin-right: 2px;
        }
        
        /* Calendar container styling */
        .fullcalendar-wrapper {
          background: #ffffff;
          border-radius: 12px;
          overflow: hidden;
        }
        
        /* Remove FullCalendar's default styling that conflicts */
        .fc-theme-standard .fc-scrollgrid {
          border: none;
        }
        
        .fc-theme-standard td, .fc-theme-standard th {
          border-color: #e5e7eb;
        }
        
        /* Mobile-specific styles */
        @media (max-width: 768px) {
          .fc-timegrid-event {
            min-height: 40px !important;
            font-size: 11px !important;
            padding: 3px !important;
          }
          
          .fc-timegrid-slot-label {
            font-size: 0.75rem;
            padding: 2px 4px;
          }
          
          .fc-col-header-cell {
            padding: 8px 4px !important;
            font-size: 0.85rem;
          }
          
          .fc .fc-timegrid-slot {
            min-height: 20px !important;
            height: 20px !important;
          }
          
          .fc .fc-timegrid-slot.fc-timegrid-slot-minor {
            min-height: 20px !important;
            height: 20px !important;
          }
          
          /* Smaller event content on mobile */
          .fc-event .text-sm {
            font-size: 11px !important;
          }
          
          .fc-event .text-xs {
            font-size: 9px !important;
          }
          
          /* Day view navigation */
          .fc-toolbar {
            padding: 8px 4px;
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
            margin-bottom: 8px;
          }
          
          .fc-toolbar-title {
            font-size: 1rem !important;
            font-weight: 600;
          }
          
          .fc-button {
            padding: 4px 8px !important;
            font-size: 0.75rem !important;
          }
          
          .fc-button-primary {
            background-color: #CFB991 !important;
            border-color: #CFB991 !important;
            color: #000 !important;
          }
          
          .fc-button-primary:hover {
            background-color: #B8A47E !important;
            border-color: #B8A47E !important;
          }
          
          .fc-button-primary:disabled {
            background-color: #e5e7eb !important;
            border-color: #e5e7eb !important;
          }
        }
      `}</style>

      {/* Section Management Popup */}
      {sectionPopup && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={handleClosePopup}
          />
          
          {/* Popup */}
          <div 
            className="fixed bg-white rounded-xl shadow-2xl border-2 border-purdue-gold/30 p-4 z-50 min-w-96 max-w-md"
            style={{
              left: `${Math.min(sectionPopup.position.x - 200, window.innerWidth - 400)}px`,
              top: `${Math.min(sectionPopup.position.y - 150, window.innerHeight - 300)}px`,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900">
                  {sectionPopup.course?.subjectAbbr} {sectionPopup.course?.number}
                </h3>
                <p className="text-sm text-gray-600">
                  {sectionPopup.section.type} - CRN: {sectionPopup.section.crn}
                </p>
              </div>
              <button
                onClick={handleClosePopup}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Section Details */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              {sectionPopup.section.meetings?.[0] && (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center text-gray-700">
                    <span className="font-medium">Time:</span>
                    <span className="ml-2">
                      {sectionPopup.section.meetings[0].days?.join(', ')} • {sectionPopup.section.meetings[0].start}
                    </span>
                  </div>
                  {sectionPopup.section.meetings[0].instructors?.[0] && (
                    <div className="flex items-center text-gray-700">
                      <span className="font-medium">Instructor:</span>
                      <span className="ml-2">{sectionPopup.section.meetings[0].instructors[0]}</span>
                    </div>
                  )}
                  {sectionPopup.section.meetings[0].buildingCode && (
                    <div className="flex items-center text-gray-700">
                      <span className="font-medium">Location:</span>
                      <span className="ml-2">
                        {sectionPopup.section.meetings[0].buildingCode} {sectionPopup.section.meetings[0].roomNumber}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Color Picker */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Change Color:</h4>
              <div className="flex flex-wrap gap-2">
                {RGB_COLORS.map(color => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform shadow-sm"
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                  />
                ))}
              </div>
            </div>

            {/* Replacement Options */}
            {sectionPopup.availableSections && sectionPopup.availableSections.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Replace with:</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {sectionPopup.availableSections.map(section => (
                    <button
                      key={section.id}
                      onClick={() => handleReplaceSection(section)}
                      className="w-full text-left p-2 bg-gray-50 hover:bg-purdue-gold/10 rounded-lg transition-colors text-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">CRN: {section.crn}</div>
                        {/* Campus indicator for multi-campus alternatives */}
                        {section.campusId && campuses.length > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {getCleanCampusName ? 
                              getCleanCampusName(campuses.find(c => c.id === section.campusId)?.name) : 
                              (campuses.find(c => c.id === section.campusId)?.name.split(' ')[0] || 'Unknown')
                            }
                          </span>
                        )}
                      </div>
                      {section.meetings?.[0] && (
                        <div className="text-gray-600">
                          {section.meetings[0].days?.join(', ')} • {section.meetings[0].start}
                          {section.meetings[0].instructors?.[0] && ` • ${section.meetings[0].instructors[0]}`}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onRemoveSection(sectionPopup.section.id);
                  handleClosePopup();
                }}
                className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center space-x-2 font-medium"
              >
                <X className="h-4 w-4" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export default FullCalendarSchedule;
