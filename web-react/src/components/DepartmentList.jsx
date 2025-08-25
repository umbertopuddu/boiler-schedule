import { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';

function DepartmentList({ onDepartmentClick, selectedCampuses, campuses }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchDepartments();
  }, [selectedCampuses]);

  const fetchDepartments = async () => {
    try {
      // Fetch departments from all selected campuses and merge
      const departmentPromises = selectedCampuses.map(async (campusId) => {
        const params = new URLSearchParams({ campus: campusId });
        const response = await fetch(`/api/departments?${params.toString()}`);
        if (response.ok) {
          return await response.json();
        }
        return [];
      });
      
      const results = await Promise.all(departmentPromises);
      const allDepartments = results.flat();
      
      // Remove duplicates and sort
      const uniqueDepartments = allDepartments.reduce((acc, dept) => {
        if (!acc.find(d => d.abbreviation === dept.abbreviation)) {
          acc.push(dept);
        }
        return acc;
      }, []);
      
      const sorted = uniqueDepartments.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
      setDepartments(sorted);
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentClick = (abbreviation) => {
    onDepartmentClick(abbreviation);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <GraduationCap className="h-5 w-5 mr-2 text-purdue-gold-dark" />
          Departments
        </h2>
        <div className="text-center text-gray-500">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purdue-gold"></div>
          <p className="mt-2">Loading departments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center">
        <GraduationCap className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-purdue-gold-dark" />
        Departments
      </h2>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-1.5 sm:gap-2 max-h-48 sm:max-h-64 overflow-y-auto">
        {departments.map((dept) => (
          <button
            key={dept.abbreviation}
            onClick={() => handleDepartmentClick(dept.abbreviation)}
            className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-black text-purdue-gold rounded-md sm:rounded-lg hover:bg-purdue-black-soft transition-colors text-center"
            title={dept.name}
          >
            {dept.abbreviation}
          </button>
        ))}
      </div>
      
      {departments.length === 0 && (
        <div className="text-center text-gray-500 py-4">
          <p className="text-sm">No departments found</p>
        </div>
      )}
    </div>
  );
}

export default DepartmentList;
