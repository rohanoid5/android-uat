#!/bin/bash

# M1-Optimized Android Emulator Startup Script

export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

AVD_NAME="M1WebControllerEmulator"

echo "🚀 Starting M1-Optimized Android Emulator: $AVD_NAME"
echo "📱 Optimized for Apple Silicon performance"
echo ""

# Check if emulator is already running
if pgrep -f "emulator.*$AVD_NAME" > /dev/null; then
    echo "⚠️  Emulator is already running"
    echo "   Use 'adb devices' to see connected devices"
    exit 1
fi

echo "Starting M1-optimized emulator..."
nohup emulator -avd "$AVD_NAME" \
    -no-audio \
    -no-snapshot-save \
    -no-snapshot-load \
    -camera-back webcam0 \
    -camera-front webcam0 \
    -gpu auto \
    -memory 4096 \
    -cores 4 \
    -skin 1080x1920 \
    > emulator.log 2>&1 &

EMULATOR_PID=$!
echo "✓ M1-optimized emulator started with PID: $EMULATOR_PID"
echo "📋 Log file: emulator.log"
echo ""
echo "⏳ Waiting for emulator to boot (optimized for M1)..."

# Wait for emulator with shorter timeout for M1
timeout=180  # 3 minutes for M1
counter=0
while [ $counter -lt $timeout ]; do
    if adb shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
        echo "✅ M1-optimized emulator is ready!"
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
