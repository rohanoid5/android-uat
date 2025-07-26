# Android Emulator Web Dashboard

A comprehensive web-based platform for managing and controlling Android emulators through a modern browser interface. Built with React and Node.js, this application provides real-time emulator interaction, screen capture streaming, and full device control capabilities.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-v16+-green.svg)
![React](https://img.shields.io/badge/react-v18+-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)

## ✨ Features

### 🚀 Emulator Management
- **Create** new Android Virtual Devices with automatic architecture detection
- **Start/Stop** emulator instances with real-time status monitoring
- **Delete** emulators with confirmation safeguards
- **Cross-platform** support (Intel/M1/M2 Macs)

### 📱 Real-time Device Control
- **Live screen capture** streaming at 1.5-second intervals
- **Touch input simulation** (tap, swipe gestures)
- **Text input** and keyboard event handling
- **App installation** and launching capabilities
- **Device information** display and monitoring

### � APK Preinstallation
- **Automatic APK installation** from `/apps` directory when emulators start
- **Bulk app deployment** for efficient testing workflows
- **Quick Install UI** for manual preinstallation triggers
- **Automatic app launching** with smart package detection
- **Installation status tracking** with detailed success/failure reporting

### �🔧 Developer-Friendly
- **WebSocket-based** real-time communication
- **RESTful API** for programmatic access
- **Auto-detection** of system architecture and Java paths
- **Comprehensive error handling** and recovery
- **Hot-reload** development environment

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │◄──►│  Node.js Backend │◄──►│   Android SDK   │
│                 │    │                 │    │                 │
│ • EmulatorList  │    │ • REST API      │    │ • AVD Manager   │
│ • Dashboard     │    │ • WebSocket     │    │ • ADB Bridge    │
│ • Real-time UI  │    │ • Controllers   │    │ • Emulator      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack

**Frontend**
- React 18 with Vite
- Tailwind CSS
- Socket.IO Client
- Axios HTTP Client

**Backend** 
- Node.js with Express
- Socket.IO WebSocket
- Child Process Management
- Android SDK Integration

**Infrastructure**
- Android SDK & Emulator
- ADB (Android Debug Bridge)
- AVD Manager
- Java Runtime Environment

## 📚 Documentation

Comprehensive documentation is available:

- **[🏗️ Architecture Guide](./ARCHITECTURE.md)** - System design, components, and data flow
- **[🔧 Setup & Deployment](./SETUP.md)** - Installation, configuration, and deployment
- **[📡 API Reference](./API.md)** - REST endpoints and WebSocket events  
- **[⚛️ Frontend Components](./FRONTEND.md)** - React components and state management
- **[🚀 Quick Start Guide](./QUICKSTART.md)** - Get up and running in minutes

## 🚀 Quick Start

### Prerequisites

- **Node.js** v16+ and npm
- **Java Development Kit** (JDK 8+)
- **Android SDK** with required components

### 1. Clone & Install

```bash
git clone https://github.com/rohanoid5/android-uat.git
cd android-uat
npm run install:all
```

### 2. Setup Android SDK

**For M1/M2 Macs:**
```bash
npm run setup:m1
```

**For Intel Macs:**
```bash
npm run setup:intel
```

### 3. Start Development

```bash
npm run dev
```

Access the application at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

### 4. Setup APK Preinstallation (Optional)

For automatic app installation when emulators start:

```bash
# Create apps directory
mkdir apps

# Place your APK files in the apps directory
cp /path/to/your/app.apk apps/
```

**Features:**
- APKs in `/apps` directory are automatically installed when emulators start
- Use the "Quick Install Apps" section in the UI for manual installation
- Supports multiple APK files for bulk deployment

### 5. Create Your First Emulator

1. Open the web interface
2. Click "Create Emulator"
3. Wait for creation to complete
4. Click "Start" to launch the emulator
5. Click "Open Dashboard" for real-time control

## 📖 Usage Examples

### Creating an Emulator via API

```bash
curl -X POST http://localhost:3001/api/emulators \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MyTestDevice",
    "apiLevel": 34,
    "device": "pixel_5"
  }'
```

### Starting an Emulator

```bash
curl -X POST http://localhost:3001/api/emulators/MyTestDevice/start
```

### WebSocket Screen Capture

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

// Start screen capture
socket.emit('start-screen-capture', 'MyTestDevice');

// Receive screen updates
socket.on('screen-capture', (base64ImageData) => {
  const img = document.getElementById('emulator-screen');
  img.src = `data:image/png;base64,${base64ImageData}`;
});
```

### APK Preinstallation

```bash
# Get available APKs for preinstallation
curl http://localhost:3001/api/preinstall/apps

# Preinstall all APKs on an emulator
curl -X POST http://localhost:3001/api/emulators/MyTestDevice/preinstall

# Launch preinstalled app automatically
curl -X POST http://localhost:3001/api/emulators/MyTestDevice/launch-preinstalled
```

**Example Response:**
```json
{
  "installed": ["app-debug.apk", "myapp-release.apk"],
  "failed": []
}
```

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

## 🔧 System Requirements

### Minimum Requirements
- **RAM**: 8 GB (16 GB recommended)
- **Storage**: 20 GB free space
- **CPU**: Intel/AMD x64 or Apple Silicon
- **OS**: macOS 10.14+ (Intel) or macOS 11.0+ (Apple Silicon)

### Recommended Configuration
- **RAM**: 16+ GB for multiple emulators
- **Storage**: SSD for better performance
- **CPU**: Multi-core processor for emulation
- **Network**: Stable internet for SDK downloads

## 🛠️ Troubleshooting

### Common Issues

**Java Not Found**
```bash
npm run fix:java
```

**Android SDK Not Detected**
```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

**Emulator Creation Fails**
```bash
# Check available system images
sdkmanager --list | grep system-images

# Install required image
sdkmanager "system-images;android-34;google_apis;arm64-v8a"
```

**Screen Capture Issues**
- Ensure emulator is fully booted
- Check ADB connection: `adb devices`
- Restart the application

For detailed troubleshooting, see the [Setup Guide](./SETUP.md#troubleshooting).

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style

- **Frontend**: ESLint + Prettier
- **Backend**: ESLint + Node.js best practices
- **Commits**: Conventional Commits format

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- **Android Open Source Project** for emulator technology
- **React Team** for the excellent frontend framework
- **Node.js Community** for the robust backend platform
- **Socket.IO** for real-time communication capabilities

## 📞 Support

- **Documentation**: Comprehensive guides in the `/docs` folder
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join community discussions
- **Wiki**: Additional resources and examples

---

<div align="center">

**Built with ❤️ for the Android development community**

[⭐ Star this repo](https://github.com/rohanoid5/android-uat) • [🐛 Report Bug](https://github.com/rohanoid5/android-uat/issues) • [💡 Request Feature](https://github.com/rohanoid5/android-uat/issues)

</div>
