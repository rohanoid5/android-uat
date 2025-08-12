#!/bin/bash

# Quick Java 17 Installation Script for macOS
# This fixes the Java version issue for Android SDK

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

echo "🔧 Java 17 Installation for Android SDK Compatibility"
echo "=================================================="

# Check current Java version
JAVA_VERSION=$(java -version 2>&1 | grep "version" | awk '{print $3}' | sed 's/"//g' | cut -d'.' -f1 2>/dev/null || echo "0")

echo "Current Java version: ${JAVA_VERSION:-"Not installed"}"
echo "Required: Java 17 or higher"
echo ""

if [ "$JAVA_VERSION" -ge 17 ] 2>/dev/null; then
    print_status "Java $JAVA_VERSION is already compatible!"
    exit 0
fi

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    print_error "Homebrew not found!"
    echo ""
    echo "Please install Homebrew first:"
    echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo ""
    echo "Or install Java 17 manually from: https://adoptium.net/"
    exit 1
fi

print_info "Installing OpenJDK 17 via Homebrew..."
brew install openjdk@17

print_info "Creating system Java symlink..."
if [[ $(uname -m) == "arm64" ]]; then
    # Apple Silicon Mac
    sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
    JAVA_HOME="/opt/homebrew/opt/openjdk@17"
else
    # Intel Mac
    sudo ln -sfn /usr/local/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
    JAVA_HOME="/usr/local/opt/openjdk@17"
fi

print_info "Setting up environment variables..."

# Determine shell profile
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

# Add Java environment variables if not already present
if ! grep -q "JAVA_HOME.*openjdk@17" "$SHELL_PROFILE"; then
    echo "" >> "$SHELL_PROFILE"
    echo "# Java 17 Environment Variables" >> "$SHELL_PROFILE"
    echo "export JAVA_HOME=\"$JAVA_HOME\"" >> "$SHELL_PROFILE"
    echo "export PATH=\"\$JAVA_HOME/bin:\$PATH\"" >> "$SHELL_PROFILE"
    print_status "Added Java environment variables to $SHELL_PROFILE"
else
    print_status "Java environment variables already configured"
fi

# Set for current session
export JAVA_HOME="$JAVA_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

print_status "Java 17 installation completed!"
echo ""
echo "🔄 Please restart your terminal or run:"
echo "   source $SHELL_PROFILE"
echo ""
echo "🧪 Test the installation:"
echo "   java -version"
echo ""
echo "✅ You can now run the Android SDK installation script:"
echo "   ./install_android_sdk.sh"
