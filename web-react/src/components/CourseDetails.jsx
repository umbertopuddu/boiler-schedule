import { useState } from 'react';
import { Plus, Users, Clock, MapPin, Calendar, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

function CourseDetails({ course, sections, onAddSection, onRemoveSection, onReplaceSection, selectedSections, campuses, getCleanCampusName })
{
  const [openDropdowns, setOpenDropdowns] = useState({});
  const [selectedSectionsByType, setSelectedSectionsByType] = useState({});

  // Toggle dropdown for section type
  const toggleDropdown = (sectionType) => {
    setOpenDropdowns(prev => {
      const newState = {};
      // Close all other dropdowns
      Object.keys(prev).forEach(key => {
        newState[key] = false;
      });
      // Toggle the clicked one
      newState[sectionType] = !prev[sectionType];
      console.log('Dropdown state:', newState);
      return newState;
    });
  };

  // Select a section from dropdown
  const selectSection = (sectionType, section) => {
    setSelectedSectionsByType(prev => ({
      ...prev,
      [sectionType]: section
    }));
    setOpenDropdowns(prev => ({
      ...prev,
      [sectionType]: false
    }));
  };

  // Check if section is already selected
  const isSectionSelected = (sectionId) => {
    return selectedSections.some(s => s.id === sectionId);
  };

  // Check if there's already a section of this type for this course
  const getExistingSectionOfType = (sectionType) => {
    return selectedSections.find(s => 
      s.course?.id === course.id && s.type === sectionType
    );
  };

  // Handle adding section with conflict resolution
  const handleAddSection = (section, sectionType) => {
    const existingSection = getExistingSectionOfType(sectionType);
    
    if (existingSection) {
      // Show confirmation dialog for replacement
      const shouldReplace = window.confirm(
        `You already have a ${sectionType} section (CRN: ${existingSection.crn}) for this course. Do you want to replace it with CRN: ${section.crn}?`
      );
      
      if (shouldReplace) {
        // Use atomic replace if available, otherwise fallback to remove+add
        if (onReplaceSection) {
          onReplaceSection(existingSection.id, section, course);
        } else {
          // Fallback to sequential operations
          onRemoveSection(existingSection.id);
          onAddSection({ ...section, course });
        }
        // Clear the selection for this type
        setSelectedSectionsByType(prev => ({
          ...prev,
          [sectionType]: null
        }));
      }
    } else {
      // No conflict, add normally
      onAddSection({ ...section, course });
      // Clear the selection for this type
      setSelectedSectionsByType(prev => ({
        ...prev,
        [sectionType]: null
      }));
    }
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
            {sections.length}/{sections.length}
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

      {/* Section Type Dropdowns */}
      <div className="space-y-4">
        {Object.entries(groupedSections).map(([type, typeSections]) => {
          const selectedSection = selectedSectionsByType[type];
          const isDropdownOpen = openDropdowns[type];
          const existingSection = getExistingSectionOfType(type);
          const hasSelectedSection = selectedSection && !isSectionSelected(selectedSection.id);

          return (
            <div key={type} className={`border border-gray-200 rounded-lg ${isDropdownOpen ? 'relative z-50' : ''}`}>
              {/* Section Type Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {type} ({typeSections.length} available)
                  </h3>
                  {existingSection ? (
                    <span className="text-xs text-green-600 font-medium">
                      Added: CRN {existingSection.crn}
                    </span>
                  ) : selectedSection && (
                    <span className="text-xs text-purdue-gold font-medium">
                      Selected: CRN {selectedSection.crn}
                    </span>
                  )}
                </div>
              </div>

              {/* Custom Dropdown */}
              <div className={`relative border-2 border-purdue-gold/30 rounded-lg ${isDropdownOpen ? 'z-50' : 'z-20'}`}>
                <button
                  onClick={() => toggleDropdown(type)}
                  className="w-full px-4 py-3 text-left bg-white hover:bg-gray-50 transition-colors flex items-center justify-between rounded-t-[10px]"
                >
                  <div className="flex-1">
                    {selectedSection ? (
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          CRN: {selectedSection.crn}
                        </div>
                        {selectedSection.meetings?.[0] && (
                          <div className="text-sm text-gray-600">
                            {formatMeetingTime(selectedSection.meetings[0])}
                          </div>
                        )}
                        {selectedSection.meetings?.[0]?.instructors?.[0] && (
                          <div className="text-sm text-gray-500">
                            {selectedSection.meetings[0].instructors[0]}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">Select a {type} section...</span>
                    )}
                  </div>
                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Options */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-purdue-gold/30 rounded-lg shadow-xl overflow-y-auto" style={{ zIndex: 1000, maxHeight: '120px' }}>
                    {typeSections.map(section => {
                      const isSelected = isSectionSelected(section.id);
                      const primaryMeeting = section.meetings?.[0];

                      return (
                        <div
                          key={section.id}
                          onClick={() => !isSelected && selectSection(type, section)}
                          className={`px-4 py-2 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors min-h-[80px] flex items-center ${
                            isSelected 
                              ? 'bg-green-50 cursor-not-allowed' 
                              : 'hover:bg-purdue-gold/10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-gray-900">
                                  CRN: {section.crn}
                                </span>
                                {/* Campus indicator */}
                                {section.campusId && campuses && (
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    {getCleanCampusName ? 
                                      getCleanCampusName(campuses.find(c => c.id === section.campusId)?.name) : 
                                      (campuses.find(c => c.id === section.campusId)?.name.split(' ')[0] || 'Unknown')
                                    }
                                  </span>
                                )}
                                {isSelected && (
                                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                                    Added
                                  </span>
                                )}
                              </div>
                              
                              {primaryMeeting && (
                                <div className="mt-1 space-y-1">
                                  <div className="flex items-center text-sm text-gray-600">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {formatMeetingTime(primaryMeeting)}
                                  </div>
                                  {primaryMeeting.instructors?.[0] && (
                                    <div className="flex items-center text-sm text-gray-500">
                                      <Users className="h-3 w-3 mr-1" />
                                      {primaryMeeting.instructors[0]}
                                    </div>
                                  )}
                                  {primaryMeeting.buildingCode && (
                                    <div className="flex items-center text-sm text-gray-500">
                                      <MapPin className="h-3 w-3 mr-1" />
                                      {primaryMeeting.buildingCode} {primaryMeeting.roomNumber}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Existing Section Display */}
              {existingSection && !selectedSection && (
                <div className="px-4 py-3 bg-green-50 border-t border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-green-800 font-medium">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span>CRN: {existingSection.crn} Added</span>
                    </div>
                    <button
                      onClick={() => onRemoveSection(existingSection.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {/* Add Button for New Selection */}
              {selectedSection && hasSelectedSection && !existingSection && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <button
                    onClick={() => handleAddSection(selectedSection, type)}
                    className="w-full px-4 py-2 bg-purdue-gold text-black rounded-lg hover:bg-purdue-gold/90 transition-colors flex items-center justify-center space-x-2 font-semibold"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add {type} Section</span>
                  </button>
                </div>
              )}

              {/* Replace Button for Existing Section */}
              {selectedSection && hasSelectedSection && existingSection && (
                <div className="px-4 py-3 bg-orange-50 border-t border-orange-200">
                  <button
                    onClick={() => handleAddSection(selectedSection, type)}
                    className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center space-x-2 font-semibold"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Replace Section</span>
                  </button>
                </div>
              )}

              {selectedSection && isSectionSelected(selectedSection.id) && (
                <div className="px-4 py-3 bg-green-50 border-t border-green-200">
                  <div className="flex items-center justify-center space-x-2 text-green-800 font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span>Section Added to Schedule</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

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
