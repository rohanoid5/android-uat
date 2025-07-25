#!/bin/bash

# Android SDK and Emulator Setup Script for macOS
# This script will install Android SDK, create an emulator, and set up the environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS only"
    exit 1
fi

# Check and install Java 17+ if needed
print_header "Checking Java Installation"

JAVA_VERSION=$(java -version 2>&1 | grep "version" | awk '{print $3}' | sed 's/"//g' | cut -d'.' -f1)
REQUIRED_JAVA_VERSION=17

if [ -z "$JAVA_VERSION" ] || [ "$JAVA_VERSION" -lt "$REQUIRED_JAVA_VERSION" ]; then
    print_warning "Java $REQUIRED_JAVA_VERSION or higher is required"
    print_info "Current Java version: ${JAVA_VERSION:-"Not installed"}"
    
    # Check if Homebrew is installed
    if command -v brew &> /dev/null; then
        print_info "Installing OpenJDK 17 via Homebrew..."
        brew install openjdk@17
        
        # Create symlink for system Java
        sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk 2>/dev/null || \
        sudo ln -sfn /usr/local/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
        
        # Update JAVA_HOME for this session
        if [[ $(uname -m) == "arm64" ]]; then
            export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
        else
            export JAVA_HOME="/usr/local/opt/openjdk@17"
        fi
        export PATH="$JAVA_HOME/bin:$PATH"
        
        print_status "Java 17 installed successfully"
    else
        print_error "Homebrew not found. Please install Homebrew first:"
        echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        echo ""
        echo "Or manually install Java 17+ from: https://adoptium.net/"
        exit 1
    fi
else
    print_status "Java $JAVA_VERSION is installed and compatible"
fi

print_header "Android SDK & Emulator Setup"
echo "This script will:"
echo "1. Install Android Command Line Tools"
echo "2. Set up Android SDK"
echo "3. Install required system images"
echo "4. Create an Android Virtual Device (AVD)"
echo "5. Configure environment variables"
echo ""

# Set up directories
ANDROID_HOME="$HOME/Android/Sdk"
CMDLINE_TOOLS_DIR="$ANDROID_HOME/cmdline-tools"
LATEST_DIR="$CMDLINE_TOOLS_DIR/latest"

print_info "Android SDK will be installed to: $ANDROID_HOME"
echo ""

# Create directories
print_status "Creating Android SDK directories..."
mkdir -p "$ANDROID_HOME"
mkdir -p "$CMDLINE_TOOLS_DIR"

# Download and install Command Line Tools
print_header "Step 1: Installing Android Command Line Tools"

CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip"
CMDLINE_TOOLS_ZIP="/tmp/commandlinetools.zip"

if [ ! -d "$LATEST_DIR" ]; then
    print_info "Downloading Android Command Line Tools..."
    curl -L -o "$CMDLINE_TOOLS_ZIP" "$CMDLINE_TOOLS_URL"
    
    print_info "Extracting Command Line Tools..."
    unzip -q "$CMDLINE_TOOLS_ZIP" -d "$CMDLINE_TOOLS_DIR"
    mv "$CMDLINE_TOOLS_DIR/cmdline-tools" "$LATEST_DIR"
    
    rm "$CMDLINE_TOOLS_ZIP"
    print_status "Command Line Tools installed successfully"
else
    print_status "Command Line Tools already installed"
fi

# Set up environment variables for this session
export ANDROID_HOME="$ANDROID_HOME"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$LATEST_DIR/bin:$PATH"

print_header "Step 2: Installing SDK Components"

# Accept licenses
print_info "Accepting SDK licenses..."
yes | sdkmanager --licenses >/dev/null 2>&1 || true

# Install required SDK packages
print_info "Installing platform tools..."
sdkmanager "platform-tools"

print_info "Installing build tools..."
sdkmanager "build-tools;34.0.0"

print_info "Installing Android 14 (API 34) platform..."
sdkmanager "platforms;android-34"

print_info "Installing Android 13 (API 33) platform..."
sdkmanager "platforms;android-33"

print_info "Installing emulator..."
sdkmanager "emulator"

print_header "Step 3: Installing System Images"

# Install system images for different architectures
if [[ $(uname -m) == "arm64" ]]; then
    print_info "Detected Apple Silicon Mac - installing ARM64 system images..."
    sdkmanager "system-images;android-34;google_apis;arm64-v8a"
    sdkmanager "system-images;android-33;google_apis;arm64-v8a"
    SYSTEM_IMAGE="system-images;android-34;google_apis;arm64-v8a"
    ARCH="arm64-v8a"
else
    print_info "Detected Intel Mac - installing x86_64 system images..."
    sdkmanager "system-images;android-34;google_apis;x86_64"
    sdkmanager "system-images;android-33;google_apis;x86_64"
    SYSTEM_IMAGE="system-images;android-34;google_apis;x86_64"
    ARCH="x86_64"
fi

print_status "System images installed successfully"

print_header "Step 4: Creating Android Virtual Device"

AVD_NAME="WebControllerEmulator"
AVD_DIR="$HOME/.android/avd"

# Create AVD directory if it doesn't exist
mkdir -p "$AVD_DIR"

# Check if AVD already exists
if [ -d "$AVD_DIR/${AVD_NAME}.avd" ]; then
    print_warning "AVD '$AVD_NAME' already exists. Deleting and recreating..."
    avdmanager delete avd -n "$AVD_NAME"
fi

print_info "Creating AVD: $AVD_NAME"
echo "no" | avdmanager create avd \
    -n "$AVD_NAME" \
    -k "$SYSTEM_IMAGE" \
    -d "pixel_4" \
    --force

# Configure AVD for better performance
AVD_CONFIG="$AVD_DIR/${AVD_NAME}.avd/config.ini"
if [ -f "$AVD_CONFIG" ]; then
    print_info "Optimizing AVD configuration..."
    
    # Add performance optimizations
    echo "hw.gpu.enabled=yes" >> "$AVD_CONFIG"
    echo "hw.gpu.mode=auto" >> "$AVD_CONFIG"
    echo "hw.ramSize=2048" >> "$AVD_CONFIG"
    echo "vm.heapSize=256" >> "$AVD_CONFIG"
    echo "hw.keyboard=yes" >> "$AVD_CONFIG"
    echo "hw.camera.back=emulated" >> "$AVD_CONFIG"
    echo "hw.camera.front=emulated" >> "$AVD_CONFIG"
    echo "hw.gps=yes" >> "$AVD_CONFIG"
    echo "hw.audioInput=yes" >> "$AVD_CONFIG"
    echo "hw.audioOutput=yes" >> "$AVD_CONFIG"
fi

print_status "AVD '$AVD_NAME' created successfully"

print_header "Step 5: Setting up Environment Variables"

# Create or update shell profile
SHELL_PROFILE=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_PROFILE="$HOME/.zshrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_PROFILE="$HOME/.bash_profile"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_PROFILE="$HOME/.bashrc"
else
    SHELL_PROFILE="$HOME/.zshrc"
    touch "$SHELL_PROFILE"
fi

# Check if Android environment variables are already set
if ! grep -q "ANDROID_HOME" "$SHELL_PROFILE"; then
    print_info "Adding Android environment variables to $SHELL_PROFILE"
    
    echo "" >> "$SHELL_PROFILE"
    echo "# Java Environment Variables" >> "$SHELL_PROFILE"
    if [[ $(uname -m) == "arm64" ]]; then
        echo "export JAVA_HOME=\"/opt/homebrew/opt/openjdk@17\"" >> "$SHELL_PROFILE"
    else
        echo "export JAVA_HOME=\"/usr/local/opt/openjdk@17\"" >> "$SHELL_PROFILE"
    fi
    echo "" >> "$SHELL_PROFILE"
    echo "# Android SDK Environment Variables" >> "$SHELL_PROFILE"
    echo "export ANDROID_HOME=\"$ANDROID_HOME\"" >> "$SHELL_PROFILE"
    echo "export ANDROID_SDK_ROOT=\"\$ANDROID_HOME\"" >> "$SHELL_PROFILE"
    echo "export PATH=\"\$JAVA_HOME/bin:\$ANDROID_HOME/emulator:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/cmdline-tools/latest/bin:\$PATH\"" >> "$SHELL_PROFILE"
    
    print_status "Environment variables added to $SHELL_PROFILE"
else
    print_status "Environment variables already configured"
fi

print_header "Step 6: Creating Startup Scripts"

# Create emulator startup script
EMULATOR_SCRIPT="./start_emulator.sh"
cat > "$EMULATOR_SCRIPT" << 'EOF'
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
EOF

chmod +x "$EMULATOR_SCRIPT"
print_status "Created emulator startup script: $EMULATOR_SCRIPT"

# Create stop script
STOP_SCRIPT="./stop_emulator.sh"
cat > "$STOP_SCRIPT" << 'EOF'
#!/bin/bash

echo "🛑 Stopping Android Emulator..."

# Kill emulator processes
pkill -f "emulator.*WebControllerEmulator" || true

# Wait a moment and force kill if necessary
sleep 2
pkill -9 -f "emulator.*WebControllerEmulator" || true

echo "✓ Emulator stopped"
EOF

chmod +x "$STOP_SCRIPT"
print_status "Created emulator stop script: $STOP_SCRIPT"

print_header "Installation Complete!"

echo "🎉 Android SDK and Emulator setup completed successfully!"
echo ""
echo "📋 What was installed:"
echo "   • Android SDK in: $ANDROID_HOME"
echo "   • Android Virtual Device: $AVD_NAME"
echo "   • Platform tools (ADB, etc.)"
echo "   • System images for $ARCH"
echo ""
echo "🚀 Next steps:"
echo "   1. Restart your terminal or run: source $SHELL_PROFILE"
echo "   2. Start the emulator: ./start_emulator.sh"
echo "   3. Start the web dashboard: npm run dev"
echo "   4. Open http://localhost:3000 in your browser"
echo ""
echo "💡 Useful commands:"
echo "   • Start emulator: ./start_emulator.sh"
echo "   • Stop emulator: ./stop_emulator.sh"
echo "   • Check devices: adb devices"
echo "   • List AVDs: avdmanager list avd"
echo ""
echo "🔧 Troubleshooting:"
echo "   • If emulator won't start, check: emulator.log"
echo "   • For performance issues, enable hardware acceleration"
echo "   • Ensure adequate disk space (10GB+) and RAM (8GB+)"

# Test installation
print_header "Testing Installation"
echo "Testing ADB..."
if "$ANDROID_HOME/platform-tools/adb" version > /dev/null 2>&1; then
    print_status "ADB is working correctly"
else
    print_warning "ADB test failed - you may need to restart your terminal"
fi

echo "Testing Emulator..."
if "$ANDROID_HOME/emulator/emulator" -list-avds | grep -q "$AVD_NAME"; then
    print_status "Emulator AVD is configured correctly"
else
    print_warning "Could not find AVD - there may have been an issue during creation"
fi

echo ""
print_status "Setup script completed!"
echo "🎯 Ready to start controlling Android from your web browser!"
