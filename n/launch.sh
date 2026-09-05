#!/bin/bash

# n - AI Assistant Launcher

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    n - AI Assistant                      ║"
echo "║              Launching System...                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd "$BACKEND_DIR"
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

echo "Starting n server..."
python server.py
