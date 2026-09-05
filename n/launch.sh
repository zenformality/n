#!/bin/bash

# n - AI Assistant Launcher
# Starts both backend and frontend servers

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    n - AI Assistant                      ║"
echo "║              Launching System...                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if backend dependencies are installed
cd "$BACKEND_DIR"
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Start backend server in background
echo "Starting backend server..."
python server.py &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Wait for backend to start
sleep 2

# Start frontend server
echo "Starting frontend server..."
cd "$FRONTEND_DIR"
python3 -m http.server 8080 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                     n is online!                         ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Backend:  http://localhost:8000                         ║"
echo "║  Frontend: http://localhost:8080                         ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Press Ctrl+C to stop all services                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down n..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "Goodbye."
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT

# Wait indefinitely
wait
