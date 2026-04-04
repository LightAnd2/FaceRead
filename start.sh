#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting Flask backend on :5001..."
cd "$ROOT/backend"
venv/bin/python app.py &
FLASK_PID=$!

echo "Starting React frontend..."
cd "$ROOT/frontend"
/usr/local/bin/node node_modules/.bin/vite &
VITE_PID=$!

trap "kill $FLASK_PID $VITE_PID 2>/dev/null; exit" INT TERM EXIT

echo ""
echo "  Frontend → http://localhost:3000"
echo "  Backend  → http://localhost:5001"
echo ""
echo "Press Ctrl+C to stop both."
wait
