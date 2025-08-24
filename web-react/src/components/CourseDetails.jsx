import { useState } from 'react';
import { Plus, Users, Clock, MapPin, Calendar, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

function CourseDetails({ course, sections, onAddSection, selectedSections })
{
  const [expandedSections, setExpandedSections] = useState({});

  // Toggle section expansion
  const toggleSection = (sectionId) =>
  {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Check if section is already selected
  const isSectionSelected = (sectionId) =>
  {
    return selectedSections.some(s => s.id === sectionId);
  };

  // Group sections by type
  const groupedSections = sections.reduce((acc, section) =>
  {
    const type = section.type || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(section);
    return acc;
  }, {});

  // Format meeting time
  const formatMeetingTime = (meeting) =>
  {
    if (!meeting.start || !meeting.durationMin) return 'TBA';
    const days = (meeting.days || []).join(', ');
    return `${days} • ${meeting.start} (${meeting.durationMin} min)`;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      {/* Course Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {course.subjectAbbr} {course.number}
            </h2>
            <p className="text-gray-600 mt-1">{course.title}</p>
          </div>
          <span className="px-3 py-1 bg-purdue-gold/20 text-black rounded-full text-sm font-medium">
            {sections.length} sections
          </span>
        </div>

        {/* Course Info */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
            <span>Fall 2025</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Users className="h-4 w-4 mr-2 text-gray-400" />
            <span>Multiple instructors</span>
          </div>
        </div>
      </div>

      {/* Sections by Type */}
      <div className="space-y-4">
        {Object.entries(groupedSections).map(([type, typeSections]) => (
          <div key={type} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700">
                {type} ({typeSections.length})
              </h3>
            </div>

            <div className="divide-y divide-gray-100">
              {typeSections.map(section => {
                const isSelected = isSectionSelected(section.id);
                const isExpanded = expandedSections[section.id];
                const primaryMeeting = section.meetings?.[0];

                return (
                  <div
                    key={section.id}
                    className={`${isSelected ? 'bg-green-50' : 'bg-white'} transition-colors`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-700">
                              CRN: {section.crn}
                            </span>
                            {isSelected && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                                Added
                              </span>
                            )}
                          </div>

                          {/* Primary Meeting Info */}
                          {primaryMeeting && (
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center text-sm text-gray-700">
                                <Clock className="h-4 w-4 mr-2 text-gray-400" />
                                <span>{formatMeetingTime(primaryMeeting)}</span>
                              </div>
                              {primaryMeeting.instructors?.length > 0 && (
                                <div className="flex items-center text-sm text-gray-700">
                                  <Users className="h-4 w-4 mr-2 text-gray-400" />
                                  <span>{primaryMeeting.instructors.join(', ')}</span>
                                </div>
                              )}
                              {primaryMeeting.buildingCode && (
                                <div className="flex items-center text-sm text-gray-700">
                                  <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                                  <span>{primaryMeeting.buildingCode} {primaryMeeting.roomNumber}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Additional Meetings */}
                          {section.meetings?.length > 1 && (
                            <button
                              onClick={() => toggleSection(section.id)}
                              className="mt-2 flex items-center text-sm text-purdue-gold-dark hover:text-black"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-1" />
                                  Hide additional meetings
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                  Show {section.meetings.length - 1} additional meeting(s)
                                </>
                              )}
                            </button>
                          )}

                          {isExpanded && section.meetings?.slice(1).map((meeting, idx) => (
                            <div key={idx} className="mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
                              <div className="text-xs font-semibold text-gray-500">
                                Additional Meeting {idx + 1}
                              </div>
                              <div className="flex items-center text-sm text-gray-700">
                                <Clock className="h-3 w-3 mr-2 text-gray-400" />
                                <span>{formatMeetingTime(meeting)}</span>
                              </div>
                              {meeting.buildingCode && (
                                <div className="flex items-center text-sm text-gray-700">
                                  <MapPin className="h-3 w-3 mr-2 text-gray-400" />
                                  <span>{meeting.buildingCode} {meeting.roomNumber}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="ml-4">
                          {!isSelected ? (
                            <button
                              onClick={() => onAddSection({ ...section, course })}
                              className="px-3 py-2 bg-purdue-gold text-black rounded-lg hover:bg-purdue-gold-dark transition-colors flex items-center space-x-1 font-semibold"
                            >
                              <Plus className="h-4 w-4" />
                              <span>Add</span>
                            </button>
                          ) : (
                            <button
                              disabled
                              className="px-3 py-2 bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed"
                            >
                              Added
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {sections.length === 0 && (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No sections available</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CourseDetails;
