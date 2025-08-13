#!/bin/bash

# Android UAT System Setup Script for Ubuntu 22.04 LTS (Docker Version)
# This script will install all dependencies needed for the Android emulator web dashboard

set -e  # Exit on any error

echo "🚀 Starting Android UAT System setup for Ubuntu 22.04 (Docker)..."
echo "======================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Skip Ubuntu version check in Docker
print_step "Running in Docker environment, skipping version check..."

# Add i386 architecture BEFORE updating packages
print_step "Adding i386 architecture..."
dpkg --add-architecture i386

# Update system packages
print_step "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install essential build tools with corrected 32-bit packages
print_step "Installing essential build tools..."
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    unzip \
    lib32z1 \
    xvfb \
    libgl1-mesa-dev \
    libegl1-mesa \
    libgles2-mesa \
    mesa-utils \
    qemu-kvm \
    qemu-system-x86 \
    qemu-user \
    qemu-utils \
    libvirt-daemon-system \
    libvirt-clients \
    bridge-utils \
    cpu-checker \
    libxcb-cursor0 \
    libxcb-cursor-dev \
    libxcb1-dev \
    libxcb-xinerama0 \
    libxcb-randr0 \
    libxcb-render0 \
    libxcb-shape0 \
    libxcb-sync1 \
    libxcb-xfixes0 \
    libxcb-icccm4 \
    libxcb-image0 \
    libxcb-keysyms1 \
    libxcb-render-util0 \
    libxcb-util1 \
    qt5-gtk-platformtheme \
    qtbase5-dev

# Try individual 32-bit packages that might be available
apt-get install -y libc6:i386 || print_warning "libc6:i386 not available"
apt-get install -y libncurses5:i386 || print_warning "libncurses5:i386 not available" 
apt-get install -y libstdc++6:i386 || print_warning "libstdc++6:i386 not available"
apt-get install -y libbz2-1.0:i386 || apt-get install -y libbz2-dev:i386 || print_warning "libbz2 32-bit not available"

# Node.js should already be installed in the base image, so skip this step
print_step "Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    print_status "Node.js version: $NODE_VERSION"
    print_status "npm version: $NPM_VERSION"
else
    print_step "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install Java 17 (required for modern Android SDK)
print_step "Installing OpenJDK 17..."
apt-get install -y openjdk-17-jdk

# Set JAVA_HOME for current session and future sessions
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
echo "export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64" >> /root/.bashrc

print_status "Java version: $(java -version 2>&1 | head -n 1)"

# Configure KVM for Android Emulator
print_step "Configuring KVM for Android Emulator..."
# Check if we're running in a container that supports KVM
if [ -e /dev/kvm ]; then
    print_status "KVM device found, configuring permissions..."
    # Add current user to kvm group (will be root in container)
    usermod -aG kvm root
    # Set permissions for KVM device
    chmod 666 /dev/kvm
    print_status "KVM configured successfully"
else
    print_warning "KVM device not found. Hardware acceleration may not be available."
    print_warning "Make sure to run Docker with --device /dev/kvm:/dev/kvm"
fi

# Install Android SDK
print_step "Installing Android SDK..."
ANDROID_HOME="/opt/android-sdk"
mkdir -p "$ANDROID_HOME"

# Download Android command line tools
CMDTOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-10406996_latest.zip"
CMDTOOLS_ZIP="/tmp/commandlinetools.zip"

print_status "Downloading Android command line tools..."
wget -O "$CMDTOOLS_ZIP" "$CMDTOOLS_URL"

print_status "Extracting command line tools..."
unzip -q "$CMDTOOLS_ZIP" -d "$ANDROID_HOME"
mv "$ANDROID_HOME/cmdline-tools" "$ANDROID_HOME/cmdline-tools-temp"
mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
mv "$ANDROID_HOME/cmdline-tools-temp"/* "$ANDROID_HOME/cmdline-tools/latest/"
rmdir "$ANDROID_HOME/cmdline-tools-temp"
rm "$CMDTOOLS_ZIP"

# Set Android environment variables
export ANDROID_HOME="/opt/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

# Add to bashrc
echo "export ANDROID_HOME=\"/opt/android-sdk\"" >> /root/.bashrc
echo "export ANDROID_SDK_ROOT=\"\$ANDROID_HOME\"" >> /root/.bashrc
echo "export PATH=\"\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/emulator\"" >> /root/.bashrc

# Accept Android SDK licenses
print_step "Accepting Android SDK licenses..."
yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses || true

# Install Android SDK components
print_step "Installing Android SDK components..."
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
    "platform-tools" \
    "platforms;android-33" \
    "platforms;android-34" \
    "build-tools;33.0.2" \
    "build-tools;34.0.0" \
    "system-images;android-33;google_apis;x86_64" \
    "system-images;android-34;google_apis;x86_64" \
    "emulator"

# Install FFmpeg for video processing
print_step "Installing FFmpeg..."
apt-get install -y ffmpeg

# Skip KVM setup in Docker (not available in containers)
print_step "Skipping KVM setup (Docker environment)..."
print_warning "Hardware acceleration not available in Docker containers."

# Create AVD (Android Virtual Device)
print_step "Creating default Android Virtual Device..."
if command -v avdmanager &> /dev/null; then
    # Check if AVD already exists
    if ! avdmanager list avd | grep -q "AppDebugV1"; then
        echo "no" | avdmanager create avd \
            -n "AppDebugV1" \
            -k "system-images;android-33;google_apis;x86_64" \
            -d "pixel_4" \
            --force
        print_status "Created AVD: AppDebugV1"
    else
        print_status "AVD 'AppDebugV1' already exists"
    fi
fi

# Create start/stop scripts for Docker
print_step "Creating emulator control scripts..."

# Create start emulator script
cat > /usr/src/backend/start_emulator_docker.sh << 'EOF'
#!/bin/bash
# Start Android Emulator in Docker

export ANDROID_HOME="/opt/android-sdk"
export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools"

echo "🚀 Starting Android Emulator in Docker..."

# Check if emulator is already running
if pgrep -f "emulator.*AppDebugV1" > /dev/null; then
    echo "⚠️ Emulator AppDebugV1 is already running"
    exit 1
fi

# Start emulator in background (software rendering for Docker)
nohup "$ANDROID_HOME/emulator/emulator" \
    -avd AppDebugV1 \
    -no-window \
    -no-audio \
    -gpu swiftshader_indirect \
    -skin 1080x2340 \
    -memory 4096 \
    -partition-size 8192 \
    -no-snapshot \
    -wipe-data \
    > /usr/src/backend/emulator.log 2>&1 &

echo "📱 Emulator starting... Check emulator.log for details"
echo "⏳ Wait about 60 seconds for emulator to fully boot"
echo "🔍 Use 'adb devices' to check when ready"
EOF

chmod +x /usr/src/backend/start_emulator_docker.sh

# Create stop emulator script
cat > /usr/src/backend/stop_emulator_docker.sh << 'EOF'
#!/bin/bash
# Stop Android Emulator in Docker

echo "🛑 Stopping Android Emulator..."

# Kill emulator processes
pkill -f "emulator.*AppDebugV1" || echo "No emulator process found"

# Kill any remaining emulator processes
pkill -f "qemu-system" || true

echo "✅ Emulator stopped"
EOF

chmod +x /usr/src/backend/stop_emulator_docker.sh

# Final verification
print_step "Verifying installation..."

# Check Java
if command -v java &> /dev/null; then
    print_status "✅ Java: $(java -version 2>&1 | head -n 1)"
else
    print_error "❌ Java not found"
fi

# Check Node.js
if command -v node &> /dev/null; then
    print_status "✅ Node.js: $(node --version)"
else
    print_error "❌ Node.js not found"
fi

# Check Android SDK
if [[ -f "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
    print_status "✅ Android SDK installed at: $ANDROID_HOME"
else
    print_error "❌ Android SDK not found"
fi

# Check ADB
if command -v adb &> /dev/null; then
    print_status "✅ ADB: $(adb --version | head -n 1)"
else
    print_error "❌ ADB not found"
fi

# Check FFmpeg
if command -v ffmpeg &> /dev/null; then
    print_status "✅ FFmpeg: $(ffmpeg -version | head -n 1 | cut -d' ' -f3)"
else
    print_error "❌ FFmpeg not found"
fi

# Set proper permissions for Android SDK
chmod -R 755 "$ANDROID_HOME"

echo ""
echo "======================================================"
echo -e "${GREEN}🎉 Android UAT System setup completed for Docker!${NC}"
echo "======================================================"
echo ""
print_status "Docker-specific notes:"
echo "• Emulator will run in headless mode (no GUI)"
echo "• Hardware acceleration not available in containers"
echo "• Use software rendering for emulation"
echo ""
print_status "Available commands:"
echo "  • Start emulator: ./start_emulator_docker.sh"
echo "  • Stop emulator:  ./stop_emulator_docker.sh"
echo "  • Check devices:  adb devices"
echo ""