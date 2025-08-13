#!/bin/bash

# Set non-interactive mode to prevent prompts
export DEBIAN_FRONTEND=noninteractive
export DISPLAY=:99

# Start virtual display for Android emulator GUI
echo "🖥️  Starting virtual display for Android emulator..."

# Start Xvfb (X Virtual Frame Buffer) on display :99
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -noreset &
XVFB_PID=$!

# Wait a moment for Xvfb to start
sleep 2

# Start a simple window manager (fluxbox)
DISPLAY=:99 fluxbox &
FLUXBOX_PID=$!

# Start VNC server to make the display accessible
x11vnc -display :99 -nopw -listen 0.0.0.0 -xkb -rfbport 5900 -shared -forever -quiet &
VNC_PID=$!

echo "✅ Virtual display started on :99"
echo "🌐 VNC server accessible on port 5900"
echo "🚀 Starting application..."

# Set the display for our application
export DISPLAY=:99

# Function to cleanup background processes when container stops
cleanup() {
    echo "🧹 Cleaning up background processes..."
    kill $VNC_PID 2>/dev/null || true
    kill $FLUXBOX_PID 2>/dev/null || true
    kill $XVFB_PID 2>/dev/null || true
}

# Set trap to cleanup on container stop
trap cleanup EXIT TERM INT

# Start the main application with pm2
cd /usr/src/backend
exec pm2-runtime start npm -- run start
