#!/bin/bash

# Script to run Android UAT Docker container with KVM support

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if KVM is available
print_info "Checking KVM availability..."

if [ ! -e /dev/kvm ]; then
    print_error "KVM device (/dev/kvm) not found!"
    print_error "Please ensure:"
    print_error "1. Your CPU supports hardware virtualization (Intel VT-x or AMD-V)"
    print_error "2. Virtualization is enabled in BIOS/UEFI"
    print_error "3. KVM is installed: sudo apt-get install qemu-kvm"
    exit 1
fi

# Check KVM permissions
if [ ! -r /dev/kvm ] || [ ! -w /dev/kvm ]; then
    print_warning "KVM permissions issue. You may need to:"
    print_warning "sudo chmod 666 /dev/kvm"
    print_warning "or add your user to the kvm group:"
    print_warning "sudo usermod -aG kvm \$USER"
fi

print_info "KVM device found and accessible"

# Check if Docker image exists
if ! docker image inspect android-uat-app >/dev/null 2>&1; then
    print_error "Docker image 'android-uat-app' not found!"
    print_error "Please build the image first:"
    print_error "docker build -t android-uat-app ."
    exit 1
fi

# Stop and remove existing container if it exists
if docker ps -a --format 'table {{.Names}}' | grep -q '^android-uat-container$'; then
    print_info "Stopping existing container..."
    docker stop android-uat-container >/dev/null 2>&1
    print_info "Removing existing container..."
    docker rm android-uat-container >/dev/null 2>&1
fi

print_info "Starting Android UAT container with KVM and GUI support..."

# Enable X11 forwarding for GUI applications
xhost +local:docker 2>/dev/null || print_warning "Could not enable X11 forwarding. GUI may not work."

# Run Docker container with KVM and X11 support
docker run \
    --name android-uat-container \
    --privileged \
    --device /dev/kvm:/dev/kvm \
    -p 3001:3001 \
    -p 5900:5900 \
    -e DISPLAY=$DISPLAY \
    -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
    -d \
    android-uat-app

if [ $? -eq 0 ]; then
    print_info "Container started successfully!"
    print_info "Application will be available at: http://localhost:3001"
    print_info "Android emulator GUI accessible via VNC on port 5900"
    print_info "You can connect to VNC at: localhost:5900 (no password required)"
    print_info "To check container logs: docker logs android-uat-container"
    print_info "To stop container: docker stop android-uat-container"
else
    print_error "Failed to start container!"
    exit 1
fi
