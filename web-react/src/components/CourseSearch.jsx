import { useState, useRef, useEffect } from 'react';
import { Search, X, BookOpen, Hash } from 'lucide-react';

function CourseSearch({ searchQuery, setSearchQuery, courses, onSelectCourse, loading })
{
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Handle clicking outside to close dropdown
  useEffect(() =>
  {
    const handleClickOutside = (event) =>
    {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target))
      {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e) =>
  {
    if (!showDropdown || courses.length === 0) return;

    switch (e.key)
    {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < courses.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : courses.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < courses.length)
        {
          handleSelectCourse(courses[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelectCourse = (course) =>
  {
    onSelectCourse(course);
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const handleInputChange = (e) =>
  {
    setSearchQuery(e.target.value);
    setShowDropdown(true);
    setSelectedIndex(-1);
  };

  const clearSearch = () =>
  {
    setSearchQuery('');
    setShowDropdown(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Search className="h-5 w-5 mr-2 text-purdue-gold-dark" />
        Search Courses
      </h2>
      
      <div className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search by course name, number, or subject..."
            className="w-full px-4 py-3 pl-11 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purdue-gold focus:border-purdue-gold transition-all"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute w-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-auto z-50 animate-fade-in"
          >
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                <p className="mt-2">Searching...</p>
              </div>
            ) : courses.length > 0 ? (
              <ul className="py-2">
                {courses.map((course, index) => (
                  <li
                    key={course.id}
                    onClick={() => handleSelectCourse(course)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      index === selectedIndex
                        ? 'bg-purdue-gold/10 border-l-4 border-purdue-gold'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purdue-gold/20 text-black">
                            {course.subjectAbbr}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {course.number}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-700">
                          {course.title}
                        </p>
                      </div>
                      <BookOpen className="h-4 w-4 text-gray-400 mt-1" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : searchQuery ? (
              <div className="p-8 text-center">
                <Hash className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No courses found</p>
                <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="p-6 text-center">
                <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Start typing to search courses</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        {['CS', 'MA', 'PHYS', 'CHEM', 'ENGL'].map(subject => (
          <button
            key={subject}
            onClick={() => setSearchQuery(subject)}
            className="px-3 py-1 text-xs font-medium bg-black text-purdue-gold rounded-full hover:bg-purdue-black-soft transition-colors"
          >
            {subject}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CourseSearch;
