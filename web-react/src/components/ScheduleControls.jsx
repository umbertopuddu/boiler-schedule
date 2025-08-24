import { Calendar, List, Grid3x3, Download, Share2, Save } from 'lucide-react';

function ScheduleControls({ view, onViewChange, totalCredits })
{
  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onViewChange('week')}
              className={`px-3 py-1.5 rounded-md flex items-center space-x-2 transition-all ${
                view === 'week'
                  ? 'bg-purdue-gold text-black shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid3x3 className="h-4 w-4" />
              <span className="text-sm font-medium">Week View</span>
            </button>
            <button
              onClick={() => onViewChange('list')}
              className={`px-3 py-1.5 rounded-md flex items-center space-x-2 transition-all ${
                view === 'list'
                  ? 'bg-purdue-gold text-black shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4" />
              <span className="text-sm font-medium">List View</span>
            </button>
          </div>

          {/* Credits Display */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-purdue-gold/20 rounded-lg">
            <Calendar className="h-4 w-4 text-black" />
            <span className="text-sm font-medium text-black">
              {totalCredits} Credits
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Save schedule"
          >
            <Save className="h-5 w-5" />
          </button>
          <button
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Share schedule"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScheduleControls;
