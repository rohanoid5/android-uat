#!/bin/bash

# Set non-interactive mode to prevent prompts
export DEBIAN_FRONTEND=noninteractive
export DISPLAY=:99

# Start virtual display for Android emulator GUI
echo "🖥️  Starting virtual display for Android emulator..."

# Start Xvfb (X Virtual Frame Buffer) on display :99 with proper input support
Xvfb :99 -screen 0 1080x2340x24 -nolisten tcp -noreset -extension RANDR -extension GLX +extension MIT-SHM &
XVFB_PID=$!

# Wait a moment for Xvfb to start
sleep 3

# Start a simple window manager (fluxbox) with input focus support
DISPLAY=:99 fluxbox &
FLUXBOX_PID=$!

# Wait for window manager to initialize
sleep 2

# Start VNC server with enhanced input support
x11vnc -display :99 -nopw -listen 0.0.0.0 -xkb -rfbport 5900 -shared -forever -quiet \
       -cursor arrow -cursorpos &
VNC_PID=$!

echo "✅ Virtual display started on :99 (1080x2340)"
echo "🌐 VNC server accessible on port 5900"
echo "🎯 Input system configured for emulator compatibility"
echo "🚀 Starting application..."

# Set the display for our application
export DISPLAY=:99

# Additional environment variables for better input handling and VM detection
export QT_X11_NO_MITSHM=1
export ANDROID_EMULATOR_USE_SYSTEM_LIBS=1
export LIBGL_ALWAYS_SOFTWARE=1
export DOCKER_ENV=true
export VM_ENV=true

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
