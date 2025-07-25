#!/bin/bash

# Android Emulator Web Dashboard Setup Script
# This script helps set up the development environment

echo "🚀 Setting up Android Emulator Web Dashboard..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check Node.js installation
echo "📦 Checking prerequisites..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_status "Node.js found: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js (v16 or higher)"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_status "npm found: $NPM_VERSION"
else
    print_error "npm not found. Please install npm"
    exit 1
fi

# Check ADB
if command -v adb &> /dev/null; then
    ADB_VERSION=$(adb version | head -n1)
    print_status "ADB found: $ADB_VERSION"
else
    print_warning "ADB not found. Please install Android SDK and add ADB to PATH"
    echo "   Export PATH with: export PATH=\"\$HOME/Android/Sdk/platform-tools:\$PATH\""
fi

# Install dependencies
echo "📚 Installing dependencies..."
if npm run install:all; then
    print_status "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Check for Android emulators
echo "🤖 Checking Android emulators..."
if command -v emulator &> /dev/null; then
    EMULATORS=$(emulator -list-avds 2>/dev/null || echo "")
    if [ -z "$EMULATORS" ]; then
        print_warning "No Android emulators found"
        echo "   Create one with: avdmanager create avd -n \"TestDevice\" -k \"system-images;android-30;google_apis;x86_64\""
    else
        print_status "Found emulators:"
        echo "$EMULATORS" | sed 's/^/     /'
    fi
else
    print_warning "Emulator command not found. Please install Android Studio or SDK"
fi

# Create .env files if they don't exist
echo "⚙️  Setting up configuration..."

# Backend .env
if [ ! -f "backend/.env" ]; then
    cat > backend/.env << EOF
PORT=3001
NODE_ENV=development
ANDROID_SDK_ROOT=\$HOME/Android/Sdk
EOF
    print_status "Created backend/.env"
else
    print_status "Backend .env already exists"
fi

# Frontend .env
if [ ! -f "frontend/.env" ]; then
    cat > frontend/.env << EOF
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
EOF
    print_status "Created frontend/.env"
else
    print_status "Frontend .env already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Start the development servers: npm run dev"
echo "   2. Open http://localhost:3000 in your browser"
echo "   3. Create and start an Android emulator if you haven't already"
echo ""
echo "💡 Useful commands:"
echo "   npm run dev     - Start both backend and frontend"
echo "   npm run server  - Start only backend"
echo "   npm run client  - Start only frontend (Vite)"
echo "   npm run build   - Build for production"
echo ""
echo "🔧 Troubleshooting:"
echo "   - If ADB is not found, add Android SDK to PATH"
echo "   - Ensure emulators are created before starting the dashboard"
echo "   - Check README.md for detailed setup instructions"
