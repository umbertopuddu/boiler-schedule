import { Trash2, Clock, MapPin, Users, AlertTriangle, Calendar } from 'lucide-react';

function SelectedCourses({ sections, onRemoveSection })
{
  // Check for time conflicts
  const findConflicts = () =>
  {
    const conflicts = [];
    
    for (let i = 0; i < sections.length; i++)
    {
      for (let j = i + 1; j < sections.length; j++)
      {
        const section1 = sections[i];
        const section2 = sections[j];
        
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
              conflicts.push({
                section1: section1.id,
                section2: section2.id,
                days: sharedDays,
                time1: meeting1.start,
                time2: meeting2.start
              });
            }
          }
        }
      }
    }
    
    return conflicts;
  };

  const parseTime = (timeStr) =>
  {
    if (!timeStr || timeStr.length < 5) return 0;
    const hours = parseInt(timeStr.substring(0, 2));
    const minutes = parseInt(timeStr.substring(3, 5));
    return hours * 60 + minutes;
  };

  const conflicts = findConflicts();
  const hasConflicts = conflicts.length > 0;

  // Get sections with conflicts
  const sectionsWithConflicts = new Set();
  conflicts.forEach(conflict =>
  {
    sectionsWithConflicts.add(conflict.section1);
    sectionsWithConflicts.add(conflict.section2);
  });

  // Calculate total weekly hours
  const totalWeeklyHours = sections.reduce((total, section) =>
  {
    return total + section.meetings?.reduce((sectionTotal, meeting) =>
    {
      const days = meeting.days?.length || 0;
      const hours = (meeting.durationMin || 0) / 60;
      return sectionTotal + (days * hours);
    }, 0) || 0;
  }, 0);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Selected Courses</h2>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            {totalWeeklyHours.toFixed(1)} hrs/week
          </span>
          {hasConflicts && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {conflicts.length} conflict(s)
            </span>
          )}
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-16 w-16 text-purdue-gold/30 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No courses selected yet</p>
          <p className="text-gray-400 text-sm mt-2">
            Search for courses and add sections to build your schedule
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map(section => {
            const hasConflict = sectionsWithConflicts.has(section.id);
            
            return (
              <div
                key={section.id}
                className={`border rounded-lg p-4 transition-all ${
                  hasConflict
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-semibold text-gray-900">
                        {section.course?.subjectAbbr} {section.course?.number}
                      </h3>
                      <span className="px-2 py-1 bg-black text-purdue-gold rounded text-xs font-medium">
                        {section.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        CRN: {section.crn}
                      </span>
                      {hasConflict && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                          <AlertTriangle className="h-3 w-3 inline mr-1" />
                          Conflict
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mt-1">
                      {section.course?.title}
                    </p>

                    <div className="mt-3 space-y-2">
                      {section.meetings?.map((meeting, idx) => (
                        <div key={idx} className="flex flex-wrap gap-4 text-sm text-gray-700">
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1 text-gray-400" />
                            <span>
                              {(meeting.days || []).join(', ')} • {meeting.start} ({meeting.durationMin} min)
                            </span>
                          </div>
                          {meeting.buildingCode && (
                            <div className="flex items-center">
                              <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                              <span>{meeting.buildingCode} {meeting.roomNumber}</span>
                            </div>
                          )}
                          {meeting.instructors?.length > 0 && (
                            <div className="flex items-center">
                              <Users className="h-3 w-3 mr-1 text-gray-400" />
                              <span>{meeting.instructors.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveSection(section.id)}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove from schedule"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Conflict Details */}
      {hasConflicts && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-semibold text-red-800 mb-2">
            Schedule Conflicts Detected
          </h3>
          <ul className="space-y-1 text-sm text-red-700">
            {conflicts.map((conflict, idx) => {
              const section1 = sections.find(s => s.id === conflict.section1);
              const section2 = sections.find(s => s.id === conflict.section2);
              
              return (
                <li key={idx}>
                  {section1?.course?.subjectAbbr} {section1?.course?.number} conflicts with{' '}
                  {section2?.course?.subjectAbbr} {section2?.course?.number} on {conflict.days.join(', ')}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SelectedCourses;
