import { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';

function DepartmentList({ onDepartmentClick }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      if (response.ok) {
        const data = await response.json();
        // Sort departments alphabetically by abbreviation
        const sorted = data.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
        setDepartments(sorted);
      }
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
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <GraduationCap className="h-5 w-5 mr-2 text-purdue-gold-dark" />
        Departments
      </h2>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-64 overflow-y-auto">
        {departments.map((dept) => (
          <button
            key={dept.abbreviation}
            onClick={() => handleDepartmentClick(dept.abbreviation)}
            className="px-3 py-2 text-sm font-medium bg-black text-purdue-gold rounded-lg hover:bg-purdue-black-soft transition-colors text-center"
            title={dept.name}
          >
            {dept.abbreviation}
          </button>
        ))}
      </div>
      
      {departments.length === 0 && (
        <div className="text-center text-gray-500 py-4">
          <p>No departments found</p>
        </div>
      )}
    </div>
  );
}

export default DepartmentList;
