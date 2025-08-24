# BoilerSchedule - Purdue Course Scheduler

A modern, Coursicle-like course scheduler for Purdue University built with React and Tailwind CSS.

## 🚂 Features

- **Visual Weekly Schedule**: Beautiful grid view with Purdue colors
- **Smart Course Search**: Autocomplete search with instant results
- **Section Management**: Browse and add course sections with details
- **Conflict Detection**: Automatic detection of scheduling conflicts
- **Multiple Views**: Switch between weekly grid and list views
- **PDF Export**: Export your schedule for printing or sharing
- **Purdue Themed**: Official Purdue colors (Old Gold & Black)

## 🎨 Design

BoilerSchedule uses Purdue's official colors:
- **Old Gold**: #CFB991
- **Black**: #000000
- **Cool Gray**: #6B7177

## 📦 Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## 🚀 Running the Application

### Development Mode (React only)
```bash
npm run dev
```
Visit http://localhost:3000

### With Backend API
First, start the Go backend server:
```bash
# From project root
go run cmd/server/main.go
```

Then start the React dev server:
```bash
# From web-react directory
npm run dev
```

### Production Build
```bash
npm run build
```

## 🛠️ Tech Stack

- **React** - UI framework
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Axios** - HTTP client
- **Lucide Icons** - Icons
- **React Hot Toast** - Notifications

## 📁 Project Structure

```
web-react/
├── src/
│   ├── components/
│   │   ├── CourseSearch.jsx      # Course search with autocomplete
│   │   ├── WeeklySchedule.jsx    # Visual weekly grid
│   │   ├── CourseDetails.jsx     # Section details panel
│   │   ├── SelectedCourses.jsx   # List view with conflicts
│   │   └── ScheduleControls.jsx  # View controls
│   ├── App.jsx                   # Main application
│   └── index.css                 # Tailwind styles
├── dist/                         # Production build
└── vite.config.js               # Vite configuration
```

## 🎓 Boiler Up!

Built with pride for Purdue University students.