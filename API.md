# API Documentation

## REST API Endpoints

### Base URL
```
http://localhost:3001/api
```

### Authentication
Currently, no authentication is required for API access.

---

## Emulator Management

### List All Emulators
```http
GET /emulators
```

**Description**: Retrieves a list of all available Android Virtual Devices (AVDs).

**Response**:
```json
[
  {
    "id": "TestEmulator-1753534091319",
    "name": "TestEmulator-1753534091319", 
    "status": "stopped|running|starting|stopping",
    "apiLevel": 34,
    "arch": "arm64-v8a"
  }
]
```

**Status Codes**:
- `200` - Success
- `500` - Internal server error

---

### Create New Emulator
```http
POST /emulators
```

**Description**: Creates a new Android Virtual Device with the specified configuration.

**Request Body**:
```json
{
  "name": "MyEmulator-123456",
  "apiLevel": 34,
  "device": "pixel_5"
}
```

**Parameters**:
- `name` (string, required): Unique name for the emulator
- `apiLevel` (number, optional): Android API level (default: 34)
- `arch` (string, optional): Architecture - auto-detected if not provided
- `device` (string, optional): Device profile (default: "pixel_5")

**Response**:
```json
{
  "message": "Emulator 'MyEmulator-123456' created successfully",
  "name": "MyEmulator-123456",
  "apiLevel": 34,
  "arch": "arm64-v8a",
  "device": "pixel_5"
}
```

**Status Codes**:
- `200` - Emulator created successfully
- `400` - Invalid request parameters
- `500` - Creation failed

---

### Delete Emulator
```http
DELETE /emulators/:name
```

**Description**: Permanently deletes an Android Virtual Device.

**Parameters**:
- `name` (string): Name of the emulator to delete

**Response**:
```json
{
  "message": "Emulator 'MyEmulator-123456' deleted successfully",
  "name": "MyEmulator-123456"
}
```

**Status Codes**:
- `200` - Emulator deleted successfully
- `400` - Emulator is currently running (must be stopped first)
- `404` - Emulator not found
- `500` - Deletion failed

---

### Start Emulator
```http
POST /emulators/:name/start
```

**Description**: Starts the specified emulator instance.

**Parameters**:
- `name` (string): Name of the emulator to start

**Response**:
```json
{
  "message": "Emulator MyEmulator-123456 started successfully",
  "status": "running"
}
```

**Status Codes**:
- `200` - Emulator started successfully
- `400` - Emulator already running
- `404` - Emulator not found
- `500` - Start failed

---

### Stop Emulator
```http
POST /emulators/:name/stop
```

**Description**: Stops the specified emulator instance.

**Parameters**:
- `name` (string): Name of the emulator to stop

**Response**:
```json
{
  "message": "Emulator MyEmulator-123456 stopped",
  "status": "stopped"
}
```

**Status Codes**:
- `200` - Emulator stopped successfully
- `400` - Emulator already stopped
- `404` - Emulator not found
- `500` - Stop failed

---

### Get Emulator Status
```http
GET /emulators/:name/status
```

**Description**: Retrieves the current status and information about a specific emulator.

**Parameters**:
- `name` (string): Name of the emulator

**Response**:
```json
{
  "name": "MyEmulator-123456",
  "status": "running",
  "startTime": "2025-07-26T18:18:35.976Z",
  "uptime": 125000
}
```

**Status Codes**:
- `200` - Status retrieved successfully
- `404` - Emulator not found
- `500` - Status check failed

---

## Device Interaction

### Send Input to Emulator
```http
POST /emulators/:name/input
```

**Description**: Sends input events to the running emulator (tap, swipe, text, key events).

**Parameters**:
- `name` (string): Name of the target emulator

**Request Body for Tap**:
```json
{
  "action": "tap",
  "coordinates": {
    "x": 540,
    "y": 1170
  }
}
```

**Request Body for Swipe**:
```json
{
  "action": "swipe", 
  "coordinates": {
    "startX": 540,
    "startY": 1500,
    "endX": 540,
    "endY": 800
  }
}
```

**Request Body for Text Input**:
```json
{
  "action": "text",
  "text": "Hello World"
}
```

**Request Body for Key Event**:
```json
{
  "action": "keyevent",
  "text": "KEYCODE_BACK"
}
```

**Response**:
```json
{
  "message": "Input sent successfully"
}
```

**Status Codes**:
- `200` - Input sent successfully
- `400` - Invalid action or parameters
- `404` - Emulator not found or not running
- `500` - Input failed

---

## App Management

### Install App (APK)
```http
POST /emulators/:name/install-app
```

**Description**: Installs an APK file on the specified emulator.

**Parameters**:
- `name` (string): Name of the target emulator

**Request Body**:
```json
{
  "apkPath": "/path/to/app.apk"
}
```

**Response**:
```json
{
  "message": "App installed successfully"
}
```

**Status Codes**:
- `200` - App installed successfully
- `400` - Invalid APK path
- `404` - Emulator not found or APK file not found
- `500` - Installation failed

---

### List Installed Apps
```http
GET /emulators/:name/apps
```

**Description**: Retrieves a list of user-installed applications on the emulator.

**Parameters**:
- `name` (string): Name of the target emulator

**Response**:
```json
[
  "com.example.myapp",
  "com.company.anotherapp"
]
```

**Status Codes**:
- `200` - Apps list retrieved successfully
- `404` - Emulator not found or not running
- `500` - Failed to retrieve apps

---

### Launch App
```http
POST /emulators/:name/apps/:packageName/launch
```

**Description**: Launches a specific app on the emulator.

**Parameters**:
- `name` (string): Name of the target emulator
- `packageName` (string): Package name of the app to launch

**Response**:
```json
{
  "message": "App com.example.myapp launched successfully"
}
```

**Status Codes**:
- `200` - App launched successfully
- `404` - Emulator not found, not running, or app not installed
- `500` - Launch failed

---

## APK Preinstallation

### Get Available Preinstall APKs
```http
GET /preinstall/apps
```

**Description**: Retrieves a list of APK files available for preinstallation from the `/apps` directory.

**Response**:
```json
[
  {
    "name": "app-debug.apk",
    "path": "/Users/user/android-uat/apps/app-debug.apk"
  },
  {
    "name": "myapp-release.apk", 
    "path": "/Users/user/android-uat/apps/myapp-release.apk"
  }
]
```

**Status Codes**:
- `200` - APK list retrieved successfully
- `500` - Failed to scan apps directory

---

### Preinstall Apps on Emulator
```http
POST /emulators/:name/preinstall
```

**Description**: Installs all available APK files from the `/apps` directory on the specified emulator.

**Parameters**:
- `name` (string): Name of the target emulator

**Response**:
```json
{
  "installed": ["app-debug.apk", "myapp-release.apk"],
  "failed": []
}
```

**Response (with failures)**:
```json
{
  "installed": ["app-debug.apk"],
  "failed": [
    {
      "name": "broken-app.apk",
      "error": "Installation failed: INSTALL_FAILED_INVALID_APK"
    }
  ]
}
```

**Status Codes**:
- `200` - Preinstallation completed (check response for individual results)
- `404` - Emulator not found or not running
- `500` - Preinstallation process failed

**Features**:
- Automatically installs all APK files from the `/apps` directory
- Provides detailed results for each installation attempt
- Runs automatically when emulators are started
- Supports bulk installation for efficient app deployment

---

### Launch Preinstalled App
```http
POST /emulators/:name/launch-preinstalled
```

**Description**: Attempts to automatically launch the first preinstalled app on the emulator.

**Parameters**:
- `name` (string): Name of the target emulator

**Response**:
```json
{
  "message": "Launched com.example.app",
  "packageName": "com.example.app"
}
```

**Response (if no app detected)**:
```json
{
  "message": "Could not automatically launch preinstalled app - package name not detected",
  "packageName": null
}
```

**Status Codes**:
- `200` - Launch attempt completed (check response for actual result)
- `404` - Emulator not found or not running
- `500` - Launch process failed

**Note**: This endpoint uses heuristic package name detection. For guaranteed app launching, use the standard app launch endpoint with the specific package name.

---

## System Health

### Health Check
```http
GET /health
```

**Description**: Basic health check endpoint to verify API availability.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-07-26T18:21:35.976Z"
}
```

**Status Codes**:
- `200` - Service is healthy

---

## WebSocket Events

### Connection
```javascript
const socket = io('http://localhost:3001');
```

### Screen Capture

#### Start Screen Capture
```javascript
socket.emit('start-screen-capture', emulatorName);
```

**Parameters**:
- `emulatorName` (string): Name of the emulator to capture

#### Stop Screen Capture
```javascript
socket.emit('stop-screen-capture');
```

#### Receive Screen Updates
```javascript
socket.on('screen-capture', (base64ImageData) => {
  // base64ImageData is a PNG image encoded as base64 string
  const imageSrc = `data:image/png;base64,${base64ImageData}`;
});
```

### Device Input via WebSocket

#### Send Input
```javascript
socket.emit('emulator-input', {
  emulatorName: 'MyEmulator-123456',
  action: 'tap',
  coordinates: { x: 540, y: 1170 }
});
```

### Status Updates

#### Emulator Status Changes
```javascript
socket.on('emulator-status-changed', (data) => {
  // data = { id, name, status }
  console.log(`Emulator ${data.name} is now ${data.status}`);
});
```

### Error Handling

#### Error Events
```javascript
socket.on('error', (error) => {
  // error = { message, type? }
  console.error('Error:', error.message);
});
```

**Common Error Types**:
- `emulator_disconnected` - Emulator stopped during screen capture
- `adb_error` - ADB communication failed
- `capture_failed` - Screenshot capture failed

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Detailed error message describing what went wrong"
}
```

### Common Error Scenarios

#### Emulator Not Found
```json
{
  "error": "Emulator 'NonExistentEmulator' not found"
}
```

#### Emulator Not Running
```json
{
  "error": "Emulator 'MyEmulator-123456' is not currently running"
}
```

#### Invalid Input
```json
{
  "error": "Invalid action type. Supported actions: tap, swipe, text, keyevent"
}
```

#### System Errors
```json
{
  "error": "Failed to create emulator: Exit code 1. Output: ... Error: ..."
}
```

---

## Rate Limits

Currently, no rate limiting is implemented, but consider the following guidelines:

- **Screen capture**: Automatically limited to 1 frame per 1.5 seconds
- **Input events**: No limit, but excessive rapid input may cause issues
- **Emulator operations**: No limit, but emulator start/stop operations take time

---

## SDK Requirements

### Required Android SDK Components
- **Platform Tools**: Contains ADB
- **Emulator**: Android Emulator runtime
- **Command Line Tools**: Contains AVD Manager
- **System Images**: At least one system image for target architecture

### Supported Architectures
- **Intel/AMD (x86_64)**: Uses `x86_64` system images
- **Apple Silicon (arm64)**: Uses `arm64-v8a` system images

### Environment Variables
- `ANDROID_HOME` or `ANDROID_SDK_ROOT`: Path to Android SDK
- `JAVA_HOME`: Path to Java installation (auto-detected on M1 Macs)
- `ADB_PATH`: Custom ADB path (optional)
- `EMULATOR_PATH`: Custom emulator path (optional)
