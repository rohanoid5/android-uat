#!/bin/bash

# Fix Java Home Script for M1 Macs
# This script fixes the JAVA_HOME in shell configuration files

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

print_header "Fixing Java Home Configuration"

# Detect the correct JAVA_HOME
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
    print_error "Could not detect Java installation"
    exit 1
fi

# Check if Java path exists
if [ ! -d "$DETECTED_JAVA_HOME" ]; then
    print_error "Java path does not exist: $DETECTED_JAVA_HOME"
    exit 1
fi

print_info "Current Java installation: $DETECTED_JAVA_HOME"

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

print_info "Using shell profile: $SHELL_PROFILE"

# Backup the current profile
cp "$SHELL_PROFILE" "${SHELL_PROFILE}.backup.$(date +%Y%m%d_%H%M%S)"
print_status "Backed up shell profile"

# Remove old Java configurations
sed -i '' '/export JAVA_HOME.*openjdk/d' "$SHELL_PROFILE" 2>/dev/null || true
sed -i '' '/JAVA_HOME.*homebrew/d' "$SHELL_PROFILE" 2>/dev/null || true

# Add correct Java configuration
echo "" >> "$SHELL_PROFILE"
echo "# Java Environment - Auto-detected $(date)" >> "$SHELL_PROFILE"
echo "export JAVA_HOME=\"$DETECTED_JAVA_HOME\"" >> "$SHELL_PROFILE"
echo "export PATH=\"\$JAVA_HOME/bin:\$PATH\"" >> "$SHELL_PROFILE"

print_status "Updated $SHELL_PROFILE with correct JAVA_HOME"

# Test the configuration
export JAVA_HOME="$DETECTED_JAVA_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

JAVA_TEST_VERSION=$(java -version 2>&1 | head -n1)
print_status "Java test: $JAVA_TEST_VERSION"

print_header "Java Home Fix Complete!"

echo "🎉 Java configuration has been fixed!"
echo ""
echo "📋 What was changed:"
echo "   • Removed old JAVA_HOME configurations"
echo "   • Set JAVA_HOME to: $DETECTED_JAVA_HOME"
echo "   • Updated PATH to include Java bin directory"
echo "   • Created backup of your shell profile"
echo ""
echo "🔄 To apply changes immediately:"
echo "   source $SHELL_PROFILE"
echo ""
echo "✅ Or restart your terminal"

echo ""
print_status "Java Home fix completed successfully!"
