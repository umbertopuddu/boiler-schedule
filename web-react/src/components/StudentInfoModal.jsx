import { useState } from 'react';
import { User, X } from 'lucide-react';

function StudentInfoModal({ isOpen, onClose, onSubmit, currentInfo })
{
  const [studentInfo, setStudentInfo] = useState({
    name: currentInfo?.name || '',
    email: currentInfo?.email || '',
    studentId: currentInfo?.studentId || '',
    major: currentInfo?.major || '',
    year: currentInfo?.year || 'Freshman'
  });

  const handleSubmit = (e) =>
  {
    e.preventDefault();
    onSubmit(studentInfo);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-slide-up">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2">
            <User className="h-5 w-5 text-purdue-gold" />
            <h3 className="text-lg font-semibold text-gray-900">Student Information</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={studentInfo.name}
              onChange={(e) => setStudentInfo(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purdue-gold focus:border-purdue-gold"
              placeholder="Purdue Pete"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="email"
              value={studentInfo.email}
              onChange={(e) => setStudentInfo(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purdue-gold focus:border-purdue-gold"
              placeholder="pete@purdue.edu"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Major <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={studentInfo.major}
              onChange={(e) => setStudentInfo(prev => ({ ...prev, major: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purdue-gold focus:border-purdue-gold"
              placeholder="Computer Science"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year <span className="text-gray-400">(optional)</span>
            </label>
            <select
              value={studentInfo.year}
              onChange={(e) => setStudentInfo(prev => ({ ...prev, year: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purdue-gold focus:border-purdue-gold"
            >
              <option value="">Select Year</option>
              <option value="Freshman">Freshman</option>
              <option value="Sophomore">Sophomore</option>
              <option value="Junior">Junior</option>
              <option value="Senior">Senior</option>
              <option value="Graduate">Graduate</option>
            </select>
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-purdue-gold text-black rounded-lg hover:bg-purdue-gold-dark transition-colors font-semibold"
            >
              Save & Generate PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StudentInfoModal;
