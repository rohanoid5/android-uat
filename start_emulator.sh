#!/bin/bash

# Android Emulator Startup Script
# This script starts the emulator for web control

# Set Android SDK path
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

AVD_NAME="WebControllerEmulator"

echo "🚀 Starting Android Emulator: $AVD_NAME"
echo "📱 Emulator will be available for web control once started"
echo ""

# Check if emulator is already running
if pgrep -f "emulator.*$AVD_NAME" > /dev/null; then
    echo "⚠️  Emulator is already running"
    echo "   Use 'adb devices' to see connected devices"
    exit 1
fi

# Start emulator with optimized settings
echo "Starting emulator in background..."
nohup emulator -avd "$AVD_NAME" \
    -no-audio \
    -no-snapshot-save \
    -no-snapshot-load \
    -camera-back webcam0 \
    -camera-front webcam0 \
    -gpu auto \
    -memory 2048 \
    > emulator.log 2>&1 &

EMULATOR_PID=$!
echo "✓ Emulator started with PID: $EMULATOR_PID"
echo "📋 Log file: emulator.log"
echo ""
echo "⏳ Waiting for emulator to boot (this may take 2-3 minutes)..."

# Wait for emulator to be ready
timeout=300  # 5 minutes timeout
counter=0
while [ $counter -lt $timeout ]; do
    if adb shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
        echo "✅ Emulator is ready!"
        echo "🌐 You can now control it from http://localhost:3000"
        echo ""
        echo "📱 Device info:"
        adb shell getprop ro.product.model
        adb shell getprop ro.build.version.release
        exit 0
    fi
    
    if [ $((counter % 10)) -eq 0 ]; then
        echo "   Still booting... ($counter/$timeout seconds)"
    fi
    
    sleep 1
    ((counter++))
done

echo "❌ Timeout waiting for emulator to boot"
echo "   Check emulator.log for details"
exit 1
