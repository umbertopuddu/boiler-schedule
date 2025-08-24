import { useState, useMemo } from 'react';
import { X, MapPin, User, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

// Department color palettes - different shades of the same color for each department
const DEPARTMENT_COLORS = {
  'ECE': [
    { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-900' },
    { bg: 'bg-blue-200', border: 'border-blue-600', text: 'text-blue-900' },
    { bg: 'bg-blue-300', border: 'border-blue-700', text: 'text-blue-900' },
  ],
  'CS': [
    { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-900' },
    { bg: 'bg-green-200', border: 'border-green-600', text: 'text-green-900' },
    { bg: 'bg-green-300', border: 'border-green-700', text: 'text-green-900' },
  ],
  'MA': [
    { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-900' },
    { bg: 'bg-purple-200', border: 'border-purple-600', text: 'text-purple-900' },
    { bg: 'bg-purple-300', border: 'border-purple-700', text: 'text-purple-900' },
  ],
  'PHYS': [
    { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-900' },
    { bg: 'bg-red-200', border: 'border-red-600', text: 'text-red-900' },
    { bg: 'bg-red-300', border: 'border-red-700', text: 'text-red-900' },
  ],
  'CHEM': [
    { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-900' },
    { bg: 'bg-orange-200', border: 'border-orange-600', text: 'text-orange-900' },
    { bg: 'bg-orange-300', border: 'border-orange-700', text: 'text-orange-900' },
  ],
  'ENGL': [
    { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-900' },
    { bg: 'bg-pink-200', border: 'border-pink-600', text: 'text-pink-900' },
    { bg: 'bg-pink-300', border: 'border-pink-700', text: 'text-pink-900' },
  ],
  'DEFAULT': [
    { bg: 'bg-gray-100', border: 'border-gray-500', text: 'text-gray-900' },
    { bg: 'bg-gray-200', border: 'border-gray-600', text: 'text-gray-900' },
    { bg: 'bg-gray-300', border: 'border-gray-700', text: 'text-gray-900' },
  ]
};

// RGB Color wheel colors
const RGB_COLORS = [
  { bg: 'bg-red-200', border: 'border-red-500', text: 'text-red-900', rgb: '#FEE2E2' },
  { bg: 'bg-orange-200', border: 'border-orange-500', text: 'text-orange-900', rgb: '#FED7AA' },
  { bg: 'bg-amber-200', border: 'border-amber-500', text: 'text-amber-900', rgb: '#FDE68A' },
  { bg: 'bg-yellow-200', border: 'border-yellow-500', text: 'text-yellow-900', rgb: '#FEF08A' },
  { bg: 'bg-lime-200', border: 'border-lime-500', text: 'text-lime-900', rgb: '#D9F99D' },
  { bg: 'bg-green-200', border: 'border-green-500', text: 'text-green-900', rgb: '#BBF7D0' },
  { bg: 'bg-emerald-200', border: 'border-emerald-500', text: 'text-emerald-900', rgb: '#A7F3D0' },
  { bg: 'bg-teal-200', border: 'border-teal-500', text: 'text-teal-900', rgb: '#99F6E4' },
  { bg: 'bg-cyan-200', border: 'border-cyan-500', text: 'text-cyan-900', rgb: '#A5F3FC' },
  { bg: 'bg-sky-200', border: 'border-sky-500', text: 'text-sky-900', rgb: '#BAE6FD' },
  { bg: 'bg-blue-200', border: 'border-blue-500', text: 'text-blue-900', rgb: '#DBEAFE' },
  { bg: 'bg-indigo-200', border: 'border-indigo-500', text: 'text-indigo-900', rgb: '#C7D2FE' },
  { bg: 'bg-violet-200', border: 'border-violet-500', text: 'text-violet-900', rgb: '#DDD6FE' },
  { bg: 'bg-purple-200', border: 'border-purple-500', text: 'text-purple-900', rgb: '#E9D5FF' },
  { bg: 'bg-fuchsia-200', border: 'border-fuchsia-500', text: 'text-fuchsia-900', rgb: '#F5D0FE' },
  { bg: 'bg-pink-200', border: 'border-pink-500', text: 'text-pink-900', rgb: '#FBCFE8' },
  { bg: 'bg-rose-200', border: 'border-rose-500', text: 'text-rose-900', rgb: '#FECDD3' },
  { bg: 'bg-purdue-gold/30', border: 'border-purdue-gold', text: 'text-black', rgb: '#CFB991' },
  { bg: 'bg-black', border: 'border-purdue-gold', text: 'text-purdue-gold', rgb: '#000000' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function WeeklySchedule({ sections, onRemoveSection })
{
  const [hoveredSection, setHoveredSection] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [customColors, setCustomColors] = useState({});
  const [showColorPicker, setShowColorPicker] = useState(null);

  // Parse time string to minutes
  const parseTime = (timeStr) =>
  {
    if (!timeStr || timeStr.length < 5) return 0;
    const hours = parseInt(timeStr.substring(0, 2));
    const minutes = parseInt(timeStr.substring(3, 5));
    return hours * 60 + minutes;
  };

  // Format time for display
  const formatTime = (minutes) =>
  {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
  };

  // Get color for a section
  const getColorForSection = (section) =>
  {
    // Check if there's a custom color set
    if (customColors[section.id])
    {
      return customColors[section.id];
    }

    // Get department from subject abbreviation
    const dept = section.course?.subjectAbbr || 'DEFAULT';
    const deptColors = DEPARTMENT_COLORS[dept] || DEPARTMENT_COLORS['DEFAULT'];
    
    // Count how many courses from same department
    const sameDeptSections = sections.filter(s => 
      s.course?.subjectAbbr === dept
    );
    const index = sameDeptSections.findIndex(s => s.id === section.id);
    
    return deptColors[index % deptColors.length];
  };

  // Set custom color for a section
  const setCustomColor = (sectionId, color) =>
  {
    setCustomColors(prev => ({
      ...prev,
      [sectionId]: color
    }));
    setShowColorPicker(null);
  };

  // Calculate schedule bounds and events
  const { minTime, maxTime, events } = useMemo(() =>
  {
    let min = 24 * 60;
    let max = 0;
    const evts = [];

    sections.forEach((section) =>
    {
      section.meetings?.forEach(meeting =>
      {
        if (!meeting.start || !meeting.durationMin) return;
        
        const startMin = parseTime(meeting.start);
        const endMin = startMin + meeting.durationMin;
        
        if (startMin < min) min = startMin;
        if (endMin > max) max = endMin;

        meeting.days?.forEach(day =>
        {
          const dayIndex = DAYS.indexOf(day);
          if (dayIndex === -1) return;

          evts.push({
            section,
            meeting,
            dayIndex,
            startMin,
            endMin,
          });
        });
      });
    });

    // If no events, default to 8 AM - 5 PM
    if (min === 24 * 60)
    {
      min = 8 * 60;
      max = 17 * 60;
    }
    else
    {
      // Add 30 minutes padding before and after
      min = Math.max(0, min - 30);
      max = Math.min(24 * 60, max + 30);
      
      // Round to nearest 30 minutes
      min = Math.floor(min / 30) * 30;
      max = Math.ceil(max / 30) * 30;
    }

    return { minTime: min, maxTime: max, events: evts };
  }, [sections]);

  // Generate time slots (every 30 minutes)
  const timeSlots = [];
  for (let time = minTime; time <= maxTime; time += 30)
  {
    timeSlots.push(time);
  }

  const totalMinutes = maxTime - minTime;
  const slotHeight = 60; // Fixed height per 30-minute slot
  const gridHeight = timeSlots.length * slotHeight;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header with Preview Label */}
      <div className="px-6 py-4 border-b-2 border-purdue-gold bg-black">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-purdue-gold">Schedule Preview</h2>
            <p className="text-xs text-purdue-gold/70">This is how your PDF will look</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-purdue-gold/80">
            <Clock className="h-4 w-4" />
            <span>{sections.length} courses</span>
          </div>
        </div>
      </div>

      {/* Schedule Grid - Landscape Layout */}
      <div>
        <div className="w-full">
          {/* Day Headers - Landscape */}
          <div className="grid grid-cols-[100px_repeat(5,1fr)] border-b-2 border-gray-300 bg-gray-50 sticky top-0 z-10 w-full">
            <div className="p-3 text-xs font-medium text-gray-500"></div>
            {DAYS.map(day => (
              <div key={day} className="p-3 text-center border-l border-gray-200">
                <div className="text-sm font-semibold text-gray-900">{day}</div>
                <div className="text-xs text-gray-500">{day.substring(0, 3)}</div>
              </div>
            ))}
          </div>

          {/* Time Grid Container */}
          <div className="relative w-full" style={{ height: `${gridHeight}px` }}>
            {/* Time Labels and Grid Lines */}
            {timeSlots.map((time, index) => {
              const isHour = time % 60 === 0;
              const topPosition = index * slotHeight;
              
              return (
                <div
                  key={time}
                  className="absolute left-0 right-0 flex"
                  style={{ top: `${topPosition}px` }}
                >
                  <div className="w-[100px] pr-3 text-right flex items-center justify-end h-[60px]">
                    <span className={`text-xs ${isHour ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                      {formatTime(time)}
                    </span>
                  </div>
                  <div className={`flex-1 ${isHour ? 'border-t-2 border-gray-300' : 'border-t border-gray-100'}`}></div>
                </div>
              );
            })}

            {/* Vertical Day Dividers */}
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-gray-200"
                style={{ left: `calc(100px + ${i} * (100% - 100px) / 5)` }}
              />
            ))}

            {/* Course Blocks */}
            {events.map((event, index) => {
              const startSlot = Math.floor((event.startMin - minTime) / 30);
              const durationSlots = Math.ceil((event.endMin - event.startMin) / 30);
              
              const top = startSlot * slotHeight + 2;
              const height = (durationSlots * slotHeight) - 4;
              const width = `calc((100% - 100px) / 5 - 8px)`;
              const left = `calc(100px + ${event.dayIndex} * (100% - 100px) / 5 + 4px)`;
              const color = getColorForSection(event.section);

              // Get primary instructor
              const primaryInstructor = event.meeting.instructors?.[0] || 'TBA';

              return (
                <div
                  key={`${event.section.id}-${index}`}
                  className={`absolute p-2 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg hover:z-20 ${color.bg} ${color.border}`}
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    width: width,
                    left: left,
                  }}
                  onMouseEnter={() => setHoveredSection(event)}
                  onMouseLeave={() => setHoveredSection(null)}
                  onClick={() => setSelectedSection(event)}
                >
                  {/* Type badge (LEC/REC/STU) */}
                  {event.section.type && (
                    <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/90 border border-gray-300 shadow-sm">
                      {(event.section.type || '').slice(0,3).toUpperCase()}
                    </div>
                  )}
                  <div className={`text-xs font-bold ${color.text} leading-tight`}>
                    {event.section.course?.subjectAbbr} {event.section.course?.number}
                  </div>
                  <div className={`text-xs ${color.text} opacity-90 leading-tight mt-1`}>
                    {primaryInstructor}
                  </div>
                  {height > 70 && (
                    <div className={`text-xs mt-1 ${color.text} opacity-80 leading-tight`}>
                      {event.meeting.buildingCode} {event.meeting.roomNumber}
                    </div>
                  )}
                  
                  {/* Color Picker Button - RGB Circle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowColorPicker(showColorPicker === event.section.id ? null : event.section.id);
                    }}
                    className="absolute top-1 right-7 p-1 rounded-full bg-white/90 hover:bg-white transition-colors shadow-sm"
                  >
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400"></div>
                  </button>
                  
                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSection(event.section.id);
                    }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-white/90 hover:bg-white transition-colors shadow-sm"
                  >
                    <X className="h-3 w-3 text-gray-600" />
                  </button>

                  {/* Color Picker Dropdown - Circular Layout */}
                  {showColorPicker === event.section.id && (
                    <div 
                      className="absolute top-8 right-0 bg-white rounded-full shadow-xl border border-gray-200 p-3 z-30"
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '120px', height: '120px' }}
                    >
                      <div className="relative w-full h-full">
                        {RGB_COLORS.map((color, idx) => {
                          const angle = (idx * 360) / RGB_COLORS.length;
                          const radius = 40;
                          const x = Math.cos((angle * Math.PI) / 180) * radius + 54;
                          const y = Math.sin((angle * Math.PI) / 180) * radius + 54;
                          
                          return (
                            <button
                              key={idx}
                              onClick={() => setCustomColor(event.section.id, color)}
                              className={`absolute w-4 h-4 rounded-full border-2 hover:scale-125 transition-transform ${color.bg} ${color.border}`}
                              style={{
                                left: `${x - 8}px`,
                                top: `${y - 8}px`,
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-3">
          {sections.map((section) => {
            const color = getColorForSection(section);
            return (
              <div key={section.id} className="flex items-center space-x-2">
                <div
                  className={`w-3 h-3 rounded-full ${color.bg} ${color.border} border-2`}
                />
                <span className="text-xs text-gray-700">
                  {section.course?.subjectAbbr} {section.course?.number}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section Detail Modal */}
      {selectedSection && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedSection(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedSection.section.course?.subjectAbbr} {selectedSection.section.course?.number}
                </h3>
                <p className="text-sm text-gray-600">{selectedSection.section.course?.title}</p>
              </div>
              <button
                onClick={() => setSelectedSection(null)}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center text-sm">
                <Clock className="h-4 w-4 mr-2 text-gray-400" />
                <span>
                  {selectedSection.meeting.days?.join(', ')} • {selectedSection.meeting.start} ({selectedSection.meeting.durationMin} min)
                </span>
              </div>
              <div className="flex items-center text-sm">
                <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                <span>{selectedSection.meeting.buildingCode} {selectedSection.meeting.roomNumber}</span>
              </div>
              {selectedSection.meeting.instructors?.length > 0 && (
                <div className="flex items-center text-sm">
                  <User className="h-4 w-4 mr-2 text-gray-400" />
                  <span>{selectedSection.meeting.instructors.join(', ')}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => {
                  onRemoveSection(selectedSection.section.id);
                  setSelectedSection(null);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                Remove from Schedule
              </button>
              <button
                onClick={() => setSelectedSection(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WeeklySchedule;