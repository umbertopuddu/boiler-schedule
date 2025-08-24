#!/bin/bash

# Script to run BoilerSchedule

echo "🚂 Starting BoilerSchedule..."
echo "   Purdue Course Scheduler"
echo ""

# Check if we're in development or production mode
if [ "$1" == "dev" ]; then
    echo "Starting in DEVELOPMENT mode..."
    echo ""
    
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
    trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
    wait
    
else
    echo "Starting in PRODUCTION mode..."
    echo ""
    
    # Build React app if needed
    if [ ! -d "web-react/dist" ]; then
        echo "Building React app..."
        cd web-react
        npm install
        npm run build
        cd ..
    fi
    
    # Start server
    echo "Starting BoilerSchedule on http://localhost:8080..."
    echo "🚂 Boiler Up!"
    go run cmd/server/main.go -static web-react/dist
fi