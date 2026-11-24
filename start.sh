#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/backend"

echo "============================================"
echo " India Disaster and Weather Tracker - Setup"
echo "============================================"

if ! command -v python3 &> /dev/null; then
    echo "Python 3 was not found. Please install Python 3.9+ and try again."
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing/updating dependencies (first run only takes a minute)..."
pip install --quiet --disable-pip-version-check -r requirements.txt

echo ""
echo "Starting server at http://localhost:8000"
echo "Press CTRL+C to stop the server."
echo ""

( sleep 2 && (open http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000 2>/dev/null || true) ) &
uvicorn app:app --host 0.0.0.0 --port 8000
