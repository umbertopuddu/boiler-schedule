import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Save, Share2, X, RefreshCw } from 'lucide-react';
import axios from 'axios';

const SVGSchedule = forwardRef(({ 
  selectedSections, 
  onRemoveSection, 
  onAddSection, 
  onReplaceSection, 
  studentInfo, 
  isMobile = false, 
  campuses = [], 
  getCleanCampusName, 
  selectedCampuses = [] 
}, ref) => {
  const [svgContent, setSvgContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sectionPopup, setSectionPopup] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerSection, setColorPickerSection] = useState(null);
  const [customColors, setCustomColors] = useState({}); // Store custom colors for sections
  const svgRef = useRef(null);

  // Expose export function to parent component
  useImperativeHandle(ref, () => ({
    exportPDF: handleExportPDF
  }));

  // Load SVG content when sections change
  useEffect(() => {
    if (selectedSections.length === 0) {
      setSvgContent('');
      return;
    }

    loadSVGSchedule();
  }, [selectedSections]);

  const loadSVGSchedule = async () => {
    setIsLoading(true);
    try {
      const sectionIds = selectedSections.map(s => s.id).join(',');
      const width = isMobile ? 600 : 1000;
      const height = isMobile ? 400 : 700;
      
      const response = await axios.get(`/api/schedule/svg?sections=${sectionIds}&width=${width}&height=${height}`);
      setSvgContent(response.data);
    } catch (error) {
      console.error('Error loading SVG schedule:', error);
      setSvgContent('');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle SVG click events for course management
  const handleSVGClick = async (event) => {
    const eventId = event.target.getAttribute('data-event-id');
    if (!eventId) return;

    // Find the section that corresponds to this event
    const section = selectedSections.find(s => eventId.includes(s.id));
    if (!section) return;

    const course = section.course;
    
    // Get click position for popup placement
    const rect = event.target.getBoundingClientRect();
    const svgRect = svgRef.current.getBoundingClientRect();
    
    // Fetch available sections for replacement from all selected campuses
    try {
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
          x: rect.left - svgRect.left + rect.width / 2,
          y: rect.top - svgRect.top + rect.height / 2
        }
      });
    } catch (error) {
      console.error('Error fetching sections:', error);
      setSectionPopup({
        section,
        course,
        availableSections: [],
        position: {
          x: rect.left - svgRect.left + rect.width / 2,
          y: rect.top - svgRect.top + rect.height / 2
        }
      });
    }
  };

  // Handle section replacement
  const handleReplaceSection = (newSection) => {
    if (onReplaceSection) {
      onReplaceSection(sectionPopup.section, newSection);
    }
    setSectionPopup(null);
  };

  // Handle section removal
  const handleRemoveSection = () => {
    if (onRemoveSection) {
      onRemoveSection(sectionPopup.section);
    }
    setSectionPopup(null);
  };

  // Close popup when clicking outside
  const handleClosePopup = () => {
    setSectionPopup(null);
    setShowColorPicker(false);
  };

  // Handle color picker
  const handleColorChange = (color) => {
    if (colorPickerSection) {
      setCustomColors(prev => ({
        ...prev,
        [colorPickerSection.id]: color
      }));
      // Reload SVG with new colors (would need backend support)
      loadSVGSchedule();
    }
    setShowColorPicker(false);
    setColorPickerSection(null);
  };

  // Share functionality
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
          handleFallbackShare();
        }
      }
    } else {
      handleFallbackShare();
    }
  };

  const handleFallbackShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Website URL copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert(`Share this URL: ${window.location.href}`);
    }
  };

  // Export to PDF using SVG-to-PDF backend
  const handleExportPDF = async () => {
    console.log('Export PDF button clicked');
    
    if (selectedSections.length === 0) {
      alert('Please add courses to your schedule first');
      return;
    }

    setIsExporting(true);
    
    try {
      // Use the SVG-based PDF generation
      const sectionIds = selectedSections.map(s => s.id).join(',');
      const params = new URLSearchParams({
        sections: sectionIds,
        studentName: studentInfo?.name || '',
        studentEmail: studentInfo?.email || '',
        studentId: studentInfo?.studentId || '',
        major: studentInfo?.major || '',
        year: studentInfo?.year || '',
        format: 'svg' // Tell backend to use SVG rendering
      });

      const response = await axios.get(`/api/schedule/pdf?${params.toString()}`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BoilerSchedule_${(studentInfo?.name || 'Schedule').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('PDF export completed successfully');
      
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
      {/* Header */}
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
      
      {/* SVG Schedule Container */}
      <div 
        ref={svgRef} 
        className="svg-schedule-wrapper rounded-lg lg:rounded-xl overflow-hidden border border-purdue-gold/30 relative"
        onClick={handleSVGClick}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <RefreshCw className="h-8 w-8 animate-spin text-purdue-gold" />
            <span className="ml-2 text-purdue-gray">Loading schedule...</span>
          </div>
        ) : selectedSections.length === 0 ? (
          <div className="flex items-center justify-center h-96 text-center">
            <div>
              <div className="text-4xl mb-4">📅</div>
              <h3 className="text-lg font-medium text-purdue-black mb-2">No courses selected</h3>
              <p className="text-purdue-gray">Add courses to see your schedule here</p>
            </div>
          </div>
        ) : svgContent ? (
          <div dangerouslySetInnerHTML={{ __html: svgContent }} />
        ) : (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-lg font-medium text-purdue-black mb-2">Failed to load schedule</h3>
              <p className="text-purdue-gray">Please try again</p>
            </div>
          </div>
        )}
      </div>

      {/* Section Management Popup */}
      {sectionPopup && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={handleClosePopup}
          ></div>
          
          {/* Popup */}
          <div 
            className="absolute bg-white rounded-xl shadow-xl border-2 border-purdue-gold/30 p-4 z-50 min-w-64"
            style={{
              left: `${sectionPopup.position.x}px`,
              top: `${sectionPopup.position.y}px`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {/* Close button */}
            <button
              onClick={handleClosePopup}
              className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Section info */}
            <div className="mb-4 pr-6">
              <div>
                <h3 className="font-bold text-gray-900">
                  {sectionPopup.course?.subjectAbbr} {sectionPopup.course?.number}
                </h3>
                <p className="text-sm text-gray-600">{sectionPopup.course?.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  CRN: {sectionPopup.section.crn} • {sectionPopup.section.type}
                </p>
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
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setColorPickerSection(sectionPopup.section);
                  setShowColorPicker(true);
                }}
                className="flex-1 px-3 py-2 bg-purdue-gold text-black rounded-lg hover:bg-purdue-gold/90 transition-colors text-sm font-medium"
              >
                Change Color
              </button>
              <button
                onClick={handleRemoveSection}
                className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        </>
      )}

      {/* Color Picker (simplified for now) */}
      {showColorPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Choose Color</h3>
            <div className="grid grid-cols-6 gap-2 mb-4">
              {['#CFB991', '#8B4513', '#4169E1', '#DC143C', '#228B22', '#4B0082', '#FF8C00', '#FF1493', '#00CED1', '#32CD32', '#FF4500', '#9932CC'].map(color => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-500"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button
              onClick={() => setShowColorPicker(false)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default SVGSchedule;
