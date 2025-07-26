# Android Emulator Web Dashboard - Architecture Documentation

## Overview

The Android Emulator Web Dashboard is a full-stack web application that provides a browser-based interface for managing and controlling Android emulators. It enables users to create, start, stop, delete emulators, and interact with them through real-time screen capture and input controls.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                           │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   React App     │    │   WebSocket     │                    │
│  │   (Frontend)    │◄──►│   Connection    │                    │
│  └─────────────────┘    └─────────────────┘                    │
└─────────────────┬───────────────────────────────────────────────┘
                  │ HTTP/WebSocket
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Node.js Backend                             │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │  Express.js     │    │   Socket.IO     │                    │
│  │  REST API       │    │   WebSocket     │                    │
│  └─────────────────┘    └─────────────────┘                    │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │ EmulatorController   │ ScreenCaptureService                │
│  │                 │    │                 │                    │
│  └─────────────────┘    └─────────────────┘                    │
└─────────────────┬───────────────────────────────────────────────┘
                  │ Shell Commands
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Android SDK                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   avdmanager    │    │      adb        │                    │
│  │   (AVD Mgmt)    │    │   (Debug Brdg)  │                    │
│  └─────────────────┘    └─────────────────┘                    │
│  ┌─────────────────┐                                           │
│  │    emulator     │                                           │
│  │   (Runtime)     │                                           │
│  └─────────────────┘                                           │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Android Emulator                              │
│              (Virtual Device Instance)                         │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **React 18.x** - UI library for building user interfaces
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Heroicons** - SVG icon library
- **Socket.IO Client** - Real-time WebSocket communication
- **Axios** - HTTP client for API requests

### Backend
- **Node.js** - JavaScript runtime environment
- **Express.js** - Web framework for REST API
- **Socket.IO** - Real-time bidirectional event-based communication
- **Child Process** - For executing shell commands
- **fs-extra** - Enhanced file system operations

### Android Infrastructure
- **Android SDK** - Software development kit for Android
- **Android Emulator** - Virtual device runtime
- **ADB (Android Debug Bridge)** - Command-line tool for device communication
- **AVD Manager** - Android Virtual Device management tool

## Core Components

### Backend Architecture

#### 1. EmulatorController
**Purpose**: Manages Android emulator lifecycle and operations

**Key Features**:
- Cross-platform compatibility (Intel/M1 Mac support)
- Automatic architecture detection (x86_64 vs arm64-v8a)
- Emulator creation, starting, stopping, deletion
- Status monitoring and device interaction
- App installation and launching

**Methods**:
```javascript
class EmulatorController {
  // Lifecycle Management
  async createEmulator(name, options)
  async deleteEmulator(name)
  async startEmulator(emulatorName)
  async stopEmulator(emulatorName)
  
  // Status & Information
  async getAvailableEmulators()
  async getEmulatorStatus(emulatorName)
  
  // Device Interaction
  async sendInput(emulatorName, action, coordinates, text)
  async installApp(emulatorName, apkPath)
  async launchApp(emulatorName, packageName)
  async getInstalledApps(emulatorName)
  
  // Utility
  getDefaultArchitecture()
  getEmulatorArgs(emulatorName)
}
```

#### 2. ScreenCaptureService
**Purpose**: Handles real-time screen capture and streaming

**Key Features**:
- Live screenshot capture from running emulators
- Base64 image encoding for web transmission
- WebSocket-based real-time streaming
- Process management and resource cleanup
- Error handling and automatic recovery

**Methods**:
```javascript
class ScreenCaptureService {
  // Capture Management
  startCapture(emulatorName, socket)
  stopCapture(socket)
  stopAllCaptures()
  
  // Screenshot Operations
  async takeScreenshot(emulatorName)
  async checkEmulatorReady(emulatorName)
  
  // Information & Debug
  async getEmulatorInfo(emulatorName)
  getActiveCaptureCount()
  getCaptureInfo()
  getProcessStatus()
}
```

### Frontend Architecture

#### 1. Component Structure
```
src/
├── components/
│   ├── EmulatorList.jsx        # Main emulator management interface
│   ├── EmulatorDashboard.jsx   # Real-time emulator control panel
│   └── [Other UI Components]
├── context/
│   └── EmulatorContext.jsx     # Global state management
└── main.jsx                    # Application entry point
```

#### 2. EmulatorList Component
**Purpose**: Primary interface for emulator management

**Features**:
- Display all available emulators with status
- Create new emulators with auto-architecture detection
- Start/stop emulator instances
- Delete emulators with confirmation
- Navigate to emulator dashboard
- Real-time status updates via WebSocket

#### 3. EmulatorDashboard Component
**Purpose**: Real-time emulator interaction interface

**Features**:
- Live screen capture streaming
- Touch input simulation (tap, swipe)
- Text input and key events
- Device information display
- Screen recording capabilities

#### 4. EmulatorContext
**Purpose**: Global state management using React Context

**State Management**:
```javascript
const EmulatorContext = {
  emulators: [],        // List of available emulators
  loading: false,       // Loading state indicator
  error: null,          // Error state management
  selectedEmulator: null // Currently selected emulator
}
```

## Communication Protocols

### REST API Endpoints

#### Emulator Management
```http
GET    /api/emulators                      # List all emulators
POST   /api/emulators                      # Create new emulator
DELETE /api/emulators/:name                # Delete emulator
GET    /api/emulators/:name/status         # Get emulator status
POST   /api/emulators/:name/start          # Start emulator
POST   /api/emulators/:name/stop           # Stop emulator
```

#### Device Interaction
```http
POST   /api/emulators/:name/input          # Send input to emulator
POST   /api/emulators/:name/install-app    # Install APK
GET    /api/emulators/:name/apps           # List installed apps
POST   /api/emulators/:name/apps/:pkg/launch # Launch app
```

#### System Health
```http
GET    /api/health                         # Health check endpoint
```

### WebSocket Events

#### Client → Server
```javascript
// Screen capture control
socket.emit('start-screen-capture', emulatorName)
socket.emit('stop-screen-capture')

// Device input
socket.emit('emulator-input', {
  emulatorName,
  action: 'tap|swipe|text|keyevent',
  coordinates: { x, y } | { startX, startY, endX, endY },
  text: 'input text'
})
```

#### Server → Client
```javascript
// Real-time screen updates
socket.emit('screen-capture', base64ImageData)

// Status updates
socket.emit('emulator-status-changed', {
  id: emulatorName,
  name: emulatorName,
  status: 'running|stopped|starting|stopping'
})

// Error notifications
socket.emit('error', {
  message: 'Error description',
  type: 'error_type'
})
```

## Data Flow

### Emulator Creation Flow
```
Frontend           Backend            Android SDK
   │                  │                    │
   │ POST /emulators   │                    │
   ├─────────────────►│                    │
   │                  │ avdmanager create  │
   │                  ├───────────────────►│
   │                  │                    │
   │                  │◄───────────────────┤
   │                  │ Success/Error      │
   │◄─────────────────┤                    │
   │ JSON Response    │                    │
```

### Real-time Screen Capture Flow
```
Frontend           Backend            Android SDK
   │                  │                    │
   │ start-screen-    │                    │
   │ capture (WS)     │                    │
   ├─────────────────►│                    │
   │                  │ setInterval        │
   │                  │ adb screencap      │
   │                  ├───────────────────►│
   │                  │◄───────────────────┤
   │                  │ PNG data           │
   │◄─────────────────┤                    │
   │ screen-capture   │                    │
   │ (Base64 WS)      │                    │
```

## Cross-Platform Compatibility

### Architecture Detection
The system automatically detects the host architecture and selects appropriate Android system images:

- **Intel/AMD (x86_64)**: Uses `x86_64` system images
- **Apple Silicon (arm64)**: Uses `arm64-v8a` system images

### Path Resolution
Automatic detection of Android SDK paths across different platforms:

```javascript
// Environment-based path resolution
this.androidHome = process.env.ANDROID_HOME || 
                   process.env.ANDROID_SDK_ROOT || 
                   `${os.homedir()}/Android/Sdk`

// Tool-specific paths
this.adbPath = `${this.androidHome}/platform-tools/adb`
this.emulatorPath = `${this.androidHome}/emulator/emulator`
this.avdManagerPath = `${this.androidHome}/cmdline-tools/latest/bin/avdmanager`
```

### Java Environment
Automatic Java path detection for M1 Macs:

```javascript
if (!process.env.JAVA_HOME) {
  process.env.JAVA_HOME = "/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home"
}
```

## Security Considerations

### CORS Configuration
```javascript
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
```

### Input Validation
- Emulator names are validated and sanitized
- File paths are checked for existence before operations
- Process execution uses proper escaping and quoting

### Resource Management
- Active process tracking prevents resource leaks
- Automatic cleanup on client disconnection
- Process limits to prevent system overload

## Performance Optimizations

### Screenshot Capture
- Configurable capture intervals (default: 1.5s)
- Process concurrency limits (max 6 concurrent)
- Automatic cleanup of temporary files
- Base64 encoding for efficient transmission

### Memory Management
- Automatic process counter reset
- Socket cleanup on disconnection
- Temporary file cleanup after screenshot processing

### Error Recovery
- Automatic retry mechanisms
- Graceful degradation on emulator disconnection
- Process leak prevention through defensive cleanup

## Development & Deployment

### Development Setup
```bash
# Install dependencies
npm run install:all

# Start development servers
npm run dev

# Setup for M1/M2 Macs
npm run setup:m1
```

### Production Considerations
- Environment variable configuration
- Process monitoring and restart capabilities
- Log aggregation and monitoring
- Resource usage monitoring
- Error tracking and alerting

This architecture provides a robust, scalable foundation for Android emulator management through web interfaces, with strong emphasis on cross-platform compatibility and real-time user interaction.
