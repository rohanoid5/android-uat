#!/bin/bash

# M1 Mac Optimized Setup Script for Android Emulator Web Dashboard
# This script sets up everything needed for M1 Macs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Check if running on M1 Mac
print_header "Checking System Compatibility"
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS only"
    exit 1
fi

ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" ]]; then
    print_warning "This script is optimized for M1/M2 Macs (ARM64)"
    print_info "Detected architecture: $ARCH"
    print_info "For Intel Macs, use the regular setup.sh script"
    echo ""
fi

print_status "Running on macOS ARM64 (M1/M2 compatible)"

# Check Homebrew
print_header "Checking Prerequisites"
if ! command -v brew &> /dev/null; then
    print_error "Homebrew not found!"
    echo ""
    echo "Install Homebrew first:"
    echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    exit 1
fi
print_status "Homebrew found"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_status "Node.js found: $NODE_VERSION"
else
    print_info "Installing Node.js via Homebrew..."
    brew install node
    print_status "Node.js installed"
fi

# Check Java
print_header "Checking Java Installation"
JAVA_VERSION=$(java -version 2>&1 | grep "version" | awk '{print $3}' | sed 's/"//g' | cut -d'.' -f1 2>/dev/null || echo "0")
if [ "$JAVA_VERSION" -lt 17 ] 2>/dev/null; then
    print_info "Installing Java 17+ for Android SDK compatibility..."
    if ! ./install_java.sh; then
        print_error "Failed to install Java 17"
        exit 1
    fi
else
    print_status "Java $JAVA_VERSION is compatible"
fi

# Detect the correct JAVA_HOME for the current system
DETECTED_JAVA_HOME=""
if [ -d "/Library/Java/JavaVirtualMachines" ]; then
    # Find the most recent Java installation
    JAVA_DIRS=$(ls -1 /Library/Java/JavaVirtualMachines/ | grep -E "jdk-[0-9]+" | sort -V | tail -1)
    if [ ! -z "$JAVA_DIRS" ]; then
        DETECTED_JAVA_HOME="/Library/Java/JavaVirtualMachines/$JAVA_DIRS/Contents/Home"
        print_status "Detected Java at: $DETECTED_JAVA_HOME"
    fi
fi

# Fallback to java_home utility if available
if [ -z "$DETECTED_JAVA_HOME" ] && command -v /usr/libexec/java_home &> /dev/null; then
    DETECTED_JAVA_HOME=$(/usr/libexec/java_home 2>/dev/null)
    if [ ! -z "$DETECTED_JAVA_HOME" ]; then
        print_status "Detected Java via java_home: $DETECTED_JAVA_HOME"
    fi
fi

if [ -z "$DETECTED_JAVA_HOME" ]; then
    print_warning "Could not auto-detect Java installation. Using default path."
    DETECTED_JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home"
fi

# Install Android SDK
print_header "Setting Up Android SDK for M1"
if [ ! -d "$HOME/Android/Sdk" ]; then
    print_info "Installing Android SDK..."
    if ! ./install_android_sdk.sh; then
        print_error "Failed to install Android SDK"
        exit 1
    fi
else
    print_status "Android SDK already installed"
fi

# Install project dependencies
print_header "Installing Project Dependencies"
if npm run install:all; then
    print_status "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Create optimized emulator for M1
print_header "Creating M1-Optimized Emulator"
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

AVD_NAME="M1WebControllerEmulator"

# Check if optimized emulator already exists
if "$ANDROID_HOME/emulator/emulator" -list-avds | grep -q "$AVD_NAME"; then
    print_status "M1-optimized emulator already exists: $AVD_NAME"
else
    print_info "Creating M1-optimized emulator..."
    
    # Install ARM64 system image for M1
    sdkmanager "system-images;android-34;google_apis;arm64-v8a"
    
    # Create AVD with M1 optimizations
    echo "no" | avdmanager create avd \
        -n "$AVD_NAME" \
        -k "system-images;android-34;google_apis;arm64-v8a" \
        -d "pixel_5" \
        --force
    
    # Configure AVD for M1 performance
    AVD_CONFIG="$HOME/.android/avd/${AVD_NAME}.avd/config.ini"
    if [ -f "$AVD_CONFIG" ]; then
        echo "hw.gpu.enabled=yes" >> "$AVD_CONFIG"
        echo "hw.gpu.mode=auto" >> "$AVD_CONFIG"
        echo "hw.ramSize=4096" >> "$AVD_CONFIG"
        echo "vm.heapSize=512" >> "$AVD_CONFIG"
        echo "hw.keyboard=yes" >> "$AVD_CONFIG"
        echo "hw.camera.back=emulated" >> "$AVD_CONFIG"
        echo "hw.camera.front=emulated" >> "$AVD_CONFIG"
        echo "hw.gps=yes" >> "$AVD_CONFIG"
        echo "hw.audioInput=yes" >> "$AVD_CONFIG"
        echo "hw.audioOutput=yes" >> "$AVD_CONFIG"
        echo "disk.dataPartition.size=8G" >> "$AVD_CONFIG"
    fi
    
    print_status "M1-optimized emulator created: $AVD_NAME"
fi

# Create M1-optimized startup script
print_header "Creating M1-Optimized Scripts"
cat > "./start_m1_emulator.sh" << 'EOF'
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
EOF

chmod +x "./start_m1_emulator.sh"
print_status "Created M1-optimized startup script: ./start_m1_emulator.sh"

# Create environment files with M1 optimizations
print_header "Configuring Environment"

# Backend .env with auto-detected Java path
cat > backend/.env << EOF
PORT=3001
NODE_ENV=development
ANDROID_SDK_ROOT=$HOME/Android/Sdk
ANDROID_HOME=$HOME/Android/Sdk
JAVA_HOME=$DETECTED_JAVA_HOME
# M1 Optimizations
M1_OPTIMIZED=true
DEFAULT_EMULATOR=M1WebControllerEmulator
# Full paths to avoid PATH issues
ADB_PATH=$HOME/Android/Sdk/platform-tools/adb
EMULATOR_PATH=$HOME/Android/Sdk/emulator/emulator
AVDMANAGER_PATH=$HOME/Android/Sdk/cmdline-tools/latest/bin/avdmanager
EOF
print_status "Created optimized backend/.env with Java path: $DETECTED_JAVA_HOME"

# Frontend .env
cat > frontend/.env << EOF
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
VITE_M1_OPTIMIZED=true
EOF
print_status "Created optimized frontend/.env"

print_header "M1 Setup Complete!"

echo "🎉 M1-optimized Android Emulator Web Dashboard setup completed!"
echo ""
echo "📋 What was configured for M1:"
echo "   • Android SDK with ARM64 system images"
echo "   • M1-optimized emulator: $AVD_NAME"
echo "   • Performance-tuned emulator settings"
echo "   • 4GB RAM allocation for smooth performance"
echo "   • GPU acceleration enabled"
echo "   • Correct Java environment: $DETECTED_JAVA_HOME"
echo ""
echo "🔧 If you encounter Java issues later:"
echo "   • Run: ./fix_java_home.sh"
echo "   • This will auto-detect and fix JAVA_HOME in your shell config"
echo ""
echo "🚀 Quick start for M1:"
echo "   1. Start M1-optimized emulator: ./start_m1_emulator.sh"
echo "   2. Start the web dashboard: npm run dev"
echo "   3. Open http://localhost:3000 in your browser"
echo ""
echo "💡 M1-specific commands:"
echo "   • Start M1 emulator: ./start_m1_emulator.sh"
echo "   • Stop emulator: ./stop_emulator.sh"
echo "   • Check devices: adb devices"
echo ""
echo "⚡ M1 Performance tips:"
echo "   • The M1 emulator should boot much faster (~1-2 minutes)"
echo "   • Better graphics performance with ARM64 system images"
echo "   • Lower power consumption compared to x86 emulation"

print_status "Your M1 Mac is ready for Android development!"
