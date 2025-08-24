# 🚂 BoilerSchedule

A modern, Coursicle-like course scheduler for Purdue University built with React, Tailwind CSS, and Go.

![Purdue Colors](https://img.shields.io/badge/Purdue-Old%20Gold%20%26%20Black-CFB991?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Tailwind](https://img.shields.io/badge/Tailwind-3.0-38B2AC?style=for-the-badge&logo=tailwind-css)

## ✨ Features

- **📅 Visual Weekly Schedule**: Beautiful grid view with Purdue's signature colors
- **🔍 Smart Course Search**: Real-time search with autocomplete
- **📚 Section Management**: Browse and add course sections with detailed information
- **⚠️ Conflict Detection**: Automatic detection and highlighting of schedule conflicts
- **👁️ Multiple Views**: Switch between weekly grid and list views
- **📄 PDF Export**: Export your schedule for printing or sharing
- **🎨 Purdue Themed**: Uses official Purdue colors (Old Gold #CFB991 & Black)

## 🚀 Quick Start

### Option 1: Full Application (Recommended)
```bash
# Run both backend and frontend
./run.sh
```
Open http://localhost:8080

### Option 2: Development Mode
```bash
# Start backend and frontend with hot reload
./run.sh dev
```
- Backend API: http://localhost:8080
- React app: http://localhost:3000

## 📦 Installation

### Prerequisites
- Go 1.19+
- Node.js 16+
- npm or yarn

### Setup
```bash
# Install Go dependencies
go mod download

# Install React dependencies
cd web-react
npm install

# Build React app
npm run build
```

## 🎨 Design System

BoilerSchedule uses Purdue University's official colors:

| Color | Hex | Usage |
|-------|-----|-------|
| **Old Gold** | #CFB991 | Primary accent, highlights |
| **Black** | #000000 | Headers, primary text |
| **Cool Gray** | #6B7177 | Secondary elements |
| **White** | #FFFFFF | Backgrounds |

## 🏗️ Architecture

```
purdue_schedule/
├── cmd/server/          # Go server entry point
├── internal/
│   ├── api/            # API handlers
│   └── data/           # Data models and loaders
├── web-react/          # React frontend
│   ├── src/
│   │   ├── components/ # React components
│   │   └── App.jsx     # Main application
│   └── dist/           # Production build
└── purdue_courses_fall_2025.json  # Course data
```

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **Tailwind CSS 3** - Styling
- **Vite** - Build tool & dev server
- **Axios** - HTTP client
- **Lucide React** - Icons

### Backend
- **Go** - Server language
- **Gorilla Mux** - HTTP router
- **gofpdf** - PDF generation

## 📱 Features in Detail

### Course Search
- Real-time search as you type
- Quick subject filters (CS, MA, PHYS, etc.)
- Keyboard navigation support

### Schedule Builder
- Drag-and-drop ready interface
- Visual time conflict detection
- Color-coded course blocks
- Multiple meeting times support

### Export Options
- PDF export for printing
- Shareable schedule links (coming soon)
- iCal export (coming soon)

## 🚦 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/search?q={query}` | Search for courses |
| `GET /api/course/{id}/sections` | Get sections for a course |
| `GET /api/schedule/pdf?sections={ids}` | Generate PDF schedule |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

## 🏈 Boiler Up!

Built with pride for Purdue University students. Hail Purdue! 🚂

---

*BoilerSchedule is not affiliated with Purdue University. This is a student project.*