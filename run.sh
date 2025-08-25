#!/bin/bash

# Script to run BoilerSchedule

echo "🚂 Starting BoilerSchedule..."
echo "   Purdue Course Scheduler"
echo ""

# Ensure the correct Go toolchain (required by this project)
export GOTOOLCHAIN=${GOTOOLCHAIN:-go1.24.0}

# Helper: kill anything on a port
kill_port() {
    local PORT="$1"
    if lsof -ti :"$PORT" >/dev/null 2>&1; then
        echo "Killing processes on port $PORT..."
        lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
    fi
}

# Helper: kill previous dev servers
kill_previous() {
    echo "Cleaning up previous servers (ports 8080, 3000)..."
    kill_port 8080
    kill_port 3000
    # Fallback: kill common processes by command
    pkill -f "go run cmd/server/main.go" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
}

# Check if we're in development or production mode
if [ "$1" == "dev" ]; then
    echo "Starting in DEVELOPMENT mode..."
    echo ""
    kill_previous
    
    # Start backend
    echo "Starting backend server on http://localhost:8080..."
    go run cmd/server/main.go &
    BACKEND_PID=$!
    
    # Wait a bit for backend to start
    sleep 2
    
    # Start frontend dev server
    echo "Starting frontend dev server on http://localhost:3000..."
    cd web-react
    npm run dev &
    FRONTEND_PID=$!
    
    echo ""
    echo "✅ Development servers started!"
    echo "   Backend API: http://localhost:8080"
    echo "   Frontend: http://localhost:3000"
    echo ""
    echo "🚂 Boiler Up! Ready to build your schedule."
    echo "Press Ctrl+C to stop both servers..."
    
    # Wait for Ctrl+C
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; kill_previous; exit" INT
    wait
    
else
    echo "Starting in PRODUCTION mode..."
    echo ""
    kill_previous
    
    # Build React app if needed
    echo "Building React app..."
    cd web-react
    npm install
    npm run build
    cd ..
    
    # Start server
    echo "Starting BoilerSchedule on http://localhost:8080..."
    echo "🚂 Boiler Up!"
    go run cmd/server/main.go -static web-react/dist
fi