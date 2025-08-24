import { useRef, useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Printer, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import axios from 'axios';

// Purdue colors for departments
const DEPARTMENT_COLORS = {
  'CS': '#4A90E2',
  'MA': '#E94B3C',
  'PHYS': '#6B5B95',
  'CHEM': '#88B04B',
  'ECE': '#F7786B',
  'ME': '#C94C4C',
  'AAE': '#92A8D1',
  'CE': '#955251',
  'IE': '#B565A7',
  'BME': '#009B77',
  'ENGL': '#DD4124',
  'HIST': '#45B8AC',
  'POL': '#5B5EA6',
  'PSY': '#9B2335',
  'SOC': '#DFCFBE',
  'STAT': '#BC243C',
  'BIOL': '#C3447A',
  'ECON': '#98B4D4',
  // Default color for other departments
  'default': '#6C757D'
};

function FullCalendarSchedule({ selectedSections, onRemoveSection, studentInfo }) {
  const calendarRef = useRef(null);
  const scheduleRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  // Convert sections to FullCalendar events
  useEffect(() => {
    const calendarEvents = [];
    
    selectedSections.forEach((section, sectionIndex) => {
      const dept = section.course?.subjectAbbr || 'default';
      const color = DEPARTMENT_COLORS[dept] || DEPARTMENT_COLORS.default;
      
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
          'Sunday': 0,
          'Monday': 1,
          'Tuesday': 2,
          'Wednesday': 3,
          'Thursday': 4,
          'Friday': 5,
          'Saturday': 6
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
              type: section.type
            }
          });
        });
      });
    });
    
    setEvents(calendarEvents);
  }, [selectedSections]);

  // Custom event content
  const renderEventContent = (eventInfo) => {
    const props = eventInfo.event.extendedProps;
    
    return (
      <div className="p-1 text-xs overflow-hidden h-full flex flex-col">
        {/* Type badge */}
        {props.type && (
          <div className="absolute top-0.5 right-0.5 px-1 py-0.5 bg-white/90 rounded text-[8px] font-bold">
            {props.type.slice(0, 3).toUpperCase()}
          </div>
        )}
        <div className="font-bold truncate">{eventInfo.event.title}</div>
        <div className="text-[10px] opacity-90 truncate">{props.instructor}</div>
        {eventInfo.view.type === 'timeGridWeek' && (
          <div className="text-[10px] opacity-80 truncate">{props.location}</div>
        )}
      </div>
    );
  };

  // Handle event click to remove
  const handleEventClick = (clickInfo) => {
    const sectionId = clickInfo.event.extendedProps.section.id;
    if (window.confirm(`Remove ${clickInfo.event.title} from schedule?`)) {
      onRemoveSection(sectionId);
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Export to PDF using html2canvas
  const handleExportPDF = async () => {
    if (!scheduleRef.current || selectedSections.length === 0) {
      alert('Please add courses to your schedule first');
      return;
    }

    setIsExporting(true);
    
    try {
      // Capture the schedule as canvas
      const canvas = await html2canvas(scheduleRef.current, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: scheduleRef.current.scrollWidth,
        windowHeight: scheduleRef.current.scrollHeight
      });

      // Convert canvas to base64
      const imageData = canvas.toDataURL('image/png');
      
      // Send to backend to convert to PDF
      const response = await axios.post('/api/schedule/pdf-from-image', {
        imageData: imageData,
        studentInfo: studentInfo || {},
        sections: selectedSections.map(s => ({
          course: `${s.course?.subjectAbbr} ${s.course?.number}`,
          title: s.course?.title,
          crn: s.crn,
          type: s.type,
          meetings: s.meetings
        }))
      }, {
        responseType: 'blob'
      });

      // Download the PDF
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BoilerSchedule_${studentInfo?.name || 'Schedule'}.pdf`.replace(/\s+/g, '_');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Weekly Schedule</h2>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center px-3 py-2 bg-purdue-gold text-black rounded-lg hover:bg-purdue-gold-dark transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>
      
      <div ref={scheduleRef} className="fullcalendar-wrapper">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={false}
          weekends={false}
          allDaySlot={false}
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          height="auto"
          expandRows={true}
          events={events}
          eventContent={renderEventContent}
          eventClick={handleEventClick}
          dayHeaderFormat={{ weekday: 'long' }}
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
      <style jsx global>{`
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
        
        /* Regular styles for better display */
        .fc-event {
          cursor: pointer;
          border: none !important;
        }
        
        .fc-event:hover {
          filter: brightness(0.9);
        }
        
        .fc-timegrid-event {
          border-radius: 4px;
          padding: 2px;
        }
        
        .fc-col-header-cell {
          background-color: #f3f4f6;
          font-weight: 600;
        }
        
        .fc-timegrid-slot-label {
          font-size: 0.875rem;
        }
        
        /* Ensure events don't overlap */
        .fc-timegrid-event-harness {
          margin-right: 2px;
        }
        
        /* Remove default FullCalendar borders */
        .fc .fc-timegrid-col {
          border-right: 1px solid #e5e7eb;
        }
        
        .fc .fc-timegrid-slot {
          border-bottom: 1px solid #f3f4f6;
        }
        
        .fc .fc-timegrid-slot.fc-timegrid-slot-minor {
          border-bottom-style: dotted;
        }
      `}</style>
    </div>
  );
}

export default FullCalendarSchedule;
