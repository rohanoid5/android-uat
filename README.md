# Android Emulator Web Dashboard

A comprehensive web-based system for controlling Android emulators through a modern React dashboard built with Vite.

## Features

- 🚀 **Emulator Management**: Create, start, stop, and manage multiple Android emulators
- 🖥️ **Live Screen Sharing**: Real-time screen capture and display via WebSocket
- 👆 **Interactive Controls**: Click/tap to interact with emulator screen
- 📱 **Hardware Controls**: Home, back, volume, power buttons
- 📦 **App Management**: Install APKs, launch apps, uninstall applications
- ⚡ **Modern UI**: Built with React, Vite, and Tailwind CSS
- 🔄 **Real-time Updates**: Live status updates via WebSocket connection

## Tech Stack

### Backend

- Node.js with Express
- Socket.IO for real-time communication
- ADB (Android Debug Bridge) integration
- File upload handling for APK installation

### Frontend

- React 18 with Vite
- Tailwind CSS for styling
- Socket.IO client for real-time updates
- Heroicons for UI icons

## Prerequisites

1. **Node.js** (v16 or higher)
2. **Android SDK** with ADB
3. **Android Emulator** (part of Android Studio)

### Android SDK Setup

1. Install Android Studio or Android SDK Tools
2. Ensure `adb` is in your PATH:
   ```bash
   export PATH="$HOME/Android/Sdk/platform-tools:$PATH"  # Linux/macOS
   ```
3. Verify ADB installation:
   ```bash
   adb version
   ```

## Installation

### For M1/M2 Macs (Apple Silicon) - Recommended

1. **Quick M1-optimized setup:**

   ```bash
   git clone <repository-url>
   cd android-uat-system
   ./setup_m1.sh
   ```

   This script will:
   - Install Java 17 if needed
   - Install Android SDK with ARM64 system images
   - Create an M1-optimized emulator
   - Install all project dependencies
   - Configure optimal settings for Apple Silicon

### For Intel Macs or Manual Setup

1. **Clone and install dependencies:**

   ```bash
   git clone <repository-url>
   cd android-uat-system
   npm run install:all
   ```

2. **Verify Android SDK setup:**

   ```bash
   # Check available emulators
   emulator -list-avds

   # If no emulators exist, create one
   avdmanager create avd -n "TestDevice" -k "system-images;android-30;google_apis;x86_64"
   ```

## Development

### M1/M2 Macs (Recommended)

Start with the M1-optimized emulator:

```bash
# Start M1-optimized emulator
./start_m1_emulator.sh

# In another terminal, start the development servers
npm run dev
```

### Intel Macs or Standard Setup

Start the development servers:

```bash
npm run dev
```

This will start:

- Backend server on http://localhost:3001
- Frontend Vite dev server on http://localhost:3000

## Usage

### 1. Access the Dashboard

Open http://localhost:3000 in your browser

### 2. Create/Manage Emulators

- Click "Create Emulator" to set up a new Android Virtual Device
- Start emulators from the list view
- Monitor emulator status in real-time

### 3. Control Emulator

- Click "Open Dashboard" for running emulators
- Use the live screen view to interact by clicking/tapping
- Access hardware controls (home, back, volume, etc.)
- Type text using the input field

### 4. Manage Apps

- Navigate to the "App Manager" tab
- Install APK files by clicking "Install APK"
- Launch installed applications
- Uninstall user apps (system apps cannot be removed)

## API Endpoints

### Emulators

- `GET /api/emulators` - List all emulators
- `POST /api/emulators` - Create new emulator
- `POST /api/emulators/:id/start` - Start emulator
- `POST /api/emulators/:id/stop` - Stop emulator

### Apps

- `GET /api/emulators/:id/apps` - List installed apps
- `POST /api/emulators/:id/apps/install` - Install APK
- `POST /api/emulators/:id/apps/:package/launch` - Launch app
- `DELETE /api/emulators/:id/apps/:package` - Uninstall app

### Controls

- Socket events for real-time screen capture
- Touch/click events for emulator interaction
- Hardware button commands

## WebSocket Events

### Client → Server

- `start-screen-capture` - Begin screen streaming
- `stop-screen-capture` - End screen streaming
- `emulator-tap` - Send tap/click coordinates
- `emulator-command` - Send hardware commands

### Server → Client

- `emulator-status-changed` - Emulator state updates
- `screen-capture` - Screen image data
- `app-installed` - App installation complete

## Project Structure

```
android-uat-system/
├── backend/
│   ├── server.js                 # Main Express server
│   ├── controllers/
│   │   └── EmulatorController.js # Emulator management logic
│   └── services/
│       └── ScreenCaptureService.js # Screen capture functionality
├── frontend/
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── context/             # React context
│   │   └── App.jsx              # Main application
│   ├── vite.config.js           # Vite configuration
│   └── tailwind.config.js       # Tailwind CSS config
└── package.json                 # Root package.json
```

## Troubleshooting

### Common Issues

1. **ADB not found:**

   ```bash
   # Add Android SDK to PATH
   export PATH="$HOME/Android/Sdk/platform-tools:$PATH"
   ```

2. **Java issues on M1 Macs:**

   ```bash
   # Auto-fix Java configuration
   npm run fix:java
   
   # Or run the script directly
   ./fix_java_home.sh
   ```

3. **Emulator won't start:**

   ```bash
   # Check available system images
   sdkmanager --list | grep system-images

   # Install required system image (M1 Macs)
   sdkmanager "system-images;android-34;google_apis;arm64-v8a"
   
   # Install required system image (Intel Macs)
   sdkmanager "system-images;android-34;google_apis;x86_64"
   ```

4. **Screen capture not working:**

   - Ensure emulator is fully booted
   - Check ADB connection: `adb devices`
   - Restart the emulator if needed

5. **WebSocket connection issues:**
   - Check if backend server is running on port 3001
   - Verify no firewall blocking connections
   - Check browser console for connection errors

6. **"Create Emulator" fails with Java errors:**
   
   This is common on M1 Macs with incorrect JAVA_HOME:
   ```bash
   # Quick fix
   npm run fix:java
   
   # Manual check
   echo $JAVA_HOME
   java -version
   ```

### Performance Tips

- Use x86_64 emulators for better performance
- Enable hardware acceleration (HAXM/KVM)
- Allocate sufficient RAM to emulators
- Close unused emulators to free resources

## Development Commands

```bash
# Install all dependencies
npm run install:all

# Start development environment
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Setup scripts
npm run setup:m1       # M1/M2 Mac setup
npm run setup:intel    # Intel Mac setup
npm run fix:java       # Fix Java configuration issues

# Emulator management
npm run emulator:m1    # Start M1-optimized emulator
npm run emulator:start # Start regular emulator
npm run emulator:stop  # Stop emulator

# Backend only
npm run server

# Frontend only (Vite dev server)
npm run client
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
