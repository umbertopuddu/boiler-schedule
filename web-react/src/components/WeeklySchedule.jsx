import { useState, useMemo } from 'react';
import { X, MapPin, User, Clock, ChevronLeft, ChevronRight, Palette } from 'lucide-react';

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

// All available colors for custom selection
const CUSTOM_COLORS = [
  { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-900' },
  { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-900' },
  { bg: 'bg-amber-100', border: 'border-amber-500', text: 'text-amber-900' },
  { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-900' },
  { bg: 'bg-lime-100', border: 'border-lime-500', text: 'text-lime-900' },
  { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-900' },
  { bg: 'bg-emerald-100', border: 'border-emerald-500', text: 'text-emerald-900' },
  { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-900' },
  { bg: 'bg-cyan-100', border: 'border-cyan-500', text: 'text-cyan-900' },
  { bg: 'bg-sky-100', border: 'border-sky-500', text: 'text-sky-900' },
  { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-900' },
  { bg: 'bg-indigo-100', border: 'border-indigo-500', text: 'text-indigo-900' },
  { bg: 'bg-violet-100', border: 'border-violet-500', text: 'text-violet-900' },
  { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-900' },
  { bg: 'bg-fuchsia-100', border: 'border-fuchsia-500', text: 'text-fuchsia-900' },
  { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-900' },
  { bg: 'bg-rose-100', border: 'border-rose-500', text: 'text-rose-900' },
  { bg: 'bg-purdue-gold/20', border: 'border-purdue-gold', text: 'text-black' },
  { bg: 'bg-black', border: 'border-purdue-gold', text: 'text-purdue-gold' },
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
  const gridHeight = Math.max(400, timeSlots.length * 60); // Dynamic height based on time range

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b-2 border-purdue-gold bg-black">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-purdue-gold">Weekly Schedule</h2>
          <div className="flex items-center space-x-2 text-sm text-purdue-gold/80">
            <Clock className="h-4 w-4" />
            <span>{sections.length} courses</span>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px] relative">
          {/* Day Headers */}
          <div className="grid grid-cols-[80px_repeat(5,1fr)] border-b-2 border-gray-300 bg-gray-50 sticky top-0 z-10">
            <div className="p-3 text-xs font-medium text-gray-500"></div>
            {DAYS.map(day => (
              <div key={day} className="p-3 text-center border-l border-gray-200">
                <div className="text-sm font-semibold text-gray-900">{day}</div>
                <div className="text-xs text-gray-500">{day.substring(0, 3)}</div>
              </div>
            ))}
          </div>

          {/* Time Grid */}
          <div className="relative" style={{ height: `${gridHeight}px` }}>
            {/* Time Labels and Grid Lines */}
            {timeSlots.map((time, index) => {
              const isHour = time % 60 === 0;
              return (
                <div
                  key={time}
                  className="absolute w-full flex"
                  style={{ top: `${((time - minTime) / totalMinutes) * 100}%` }}
                >
                  <div className="w-[80px] pr-2 text-right">
                    <span className={`text-xs ${isHour ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                      {formatTime(time)}
                    </span>
                  </div>
                  <div className={`flex-1 ${isHour ? 'border-t border-gray-300' : 'border-t border-gray-100'}`}></div>
                </div>
              );
            })}

            {/* Vertical Day Dividers */}
            {[0, 1, 2, 3, 4].map(dayIndex => (
              <div
                key={dayIndex}
                className="absolute top-0 bottom-0 border-l border-gray-200"
                style={{ left: `${80 + ((dayIndex + 1) * ((100 - 80/8) / 5))}px` }}
              />
            ))}

            {/* Course Blocks */}
            {events.map((event, index) => {
              const top = ((event.startMin - minTime) / totalMinutes) * gridHeight;
              const height = ((event.endMin - event.startMin) / totalMinutes) * gridHeight;
              const width = `calc((100% - 80px) / 5 - 4px)`;
              const left = `calc(80px + ${event.dayIndex} * (100% - 80px) / 5 + 2px)`;
              const color = getColorForSection(event.section);

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
                  <div className={`text-xs font-bold ${color.text}`}>
                    {event.section.course?.subjectAbbr} {event.section.course?.number}
                  </div>
                  <div className={`text-xs ${color.text} opacity-90`}>
                    {event.section.type} - {event.section.crn}
                  </div>
                  {height > 50 && (
                    <>
                      <div className={`text-xs mt-1 ${color.text} opacity-80`}>
                        {event.meeting.buildingCode} {event.meeting.roomNumber}
                      </div>
                      {height > 70 && event.meeting.instructors?.length > 0 && (
                        <div className={`text-xs mt-1 ${color.text} opacity-80 truncate`}>
                          {event.meeting.instructors[0]}
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Color Picker Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowColorPicker(showColorPicker === event.section.id ? null : event.section.id);
                    }}
                    className="absolute top-1 right-7 p-1 rounded-full bg-white/80 hover:bg-white transition-colors"
                  >
                    <Palette className="h-3 w-3 text-gray-600" />
                  </button>
                  
                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSection(event.section.id);
                    }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-white/80 hover:bg-white transition-colors"
                  >
                    <X className="h-3 w-3 text-gray-600" />
                  </button>

                  {/* Color Picker Dropdown */}
                  {showColorPicker === event.section.id && (
                    <div 
                      className="absolute top-8 right-0 bg-white rounded-lg shadow-xl border border-gray-200 p-2 z-30"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid grid-cols-4 gap-1">
                        {CUSTOM_COLORS.map((color, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCustomColor(event.section.id, color)}
                            className={`w-8 h-8 rounded border-2 ${color.bg} ${color.border} hover:scale-110 transition-transform`}
                          />
                        ))}
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