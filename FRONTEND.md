# Frontend Components Documentation

## Overview

The frontend is built using React 18 with Vite as the build tool and Tailwind CSS for styling. The application follows a component-based architecture with global state management using React Context.

## Project Structure

```
frontend/
├── public/
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── EmulatorList.jsx
│   │   ├── EmulatorDashboard.jsx
│   │   └── [Other Components]
│   ├── context/
│   │   └── EmulatorContext.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## Core Components

### 1. EmulatorList Component

**File**: `src/components/EmulatorList.jsx`

**Purpose**: Main interface for managing Android emulators (CRUD operations)

#### Features
- ✅ Display all available emulators with real-time status
- ✅ Create new emulators with auto-architecture detection
- ✅ Start/stop emulator instances
- ✅ Delete emulators with confirmation dialog
- ✅ Navigate to emulator dashboard
- ✅ Real-time status updates via WebSocket

#### Props
```javascript
interface EmulatorListProps {
  onEmulatorSelect: (emulator: Emulator) => void;
}
```

#### State Management
Uses the `EmulatorContext` for:
- `emulators` - Array of available emulators
- `loading` - Loading state indicator
- `dispatch` - Context action dispatcher

#### Key Methods

##### `fetchEmulators()`
```javascript
const fetchEmulators = async () => {
  dispatch({ type: "SET_LOADING", payload: true });
  try {
    const response = await axios.get("/api/emulators");
    dispatch({ type: "SET_EMULATORS", payload: response.data });
  } catch (error) {
    dispatch({ type: "SET_ERROR", payload: error.message });
  }
};
```

##### `handleCreateEmulator()`
```javascript
const handleCreateEmulator = async () => {
  setIsCreating(true);
  try {
    const newEmulatorName = `WebControllerEmulator-${Date.now()}`;
    await axios.post("/api/emulators", {
      name: newEmulatorName,
      apiLevel: 34,
      // Architecture auto-detected by backend
      device: "pixel_5",
    });
    await fetchEmulators();
  } catch (error) {
    dispatch({
      type: "SET_ERROR",
      payload: error.response?.data?.error || error.message,
    });
  } finally {
    setIsCreating(false);
  }
};
```

##### `handleDeleteEmulator()`
```javascript
const handleDeleteEmulator = async (emulator) => {
  if (!window.confirm(`Are you sure you want to delete "${emulator.name}"?`)) {
    return;
  }
  
  try {
    await axios.delete(`/api/emulators/${emulator.id}`);
    await fetchEmulators();
  } catch (error) {
    dispatch({ type: "SET_ERROR", payload: error.message });
  }
};
```

#### UI Structure
```jsx
<div className="max-w-6xl mx-auto">
  {/* Header with Create Button */}
  <div className="flex justify-between items-center mb-8">
    <h2>Available Emulators</h2>
    <CreateEmulatorButton />
  </div>

  {/* Emulator Grid */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {emulators.map(emulator => (
      <EmulatorCard 
        key={emulator.id}
        emulator={emulator}
        onStart={handleStartEmulator}
        onStop={handleStopEmulator}
        onDelete={handleDeleteEmulator}
        onSelect={onEmulatorSelect}
      />
    ))}
  </div>
</div>
```

#### Styling Classes
- `control-button primary` - Primary action buttons
- `control-button success` - Start buttons  
- `control-button danger` - Stop/delete buttons
- `control-button secondary` - Disabled state buttons

---

### 2. EmulatorDashboard Component

**File**: `src/components/EmulatorDashboard.jsx`

**Purpose**: Real-time emulator interaction interface with live screen capture

#### Features
- ✅ Live screen capture streaming
- ✅ Touch input simulation (tap, swipe)
- ✅ Text input and key events
- ✅ Device information display
- ✅ Connection status monitoring

#### Props
```javascript
interface EmulatorDashboardProps {
  emulator: {
    id: string;
    name: string;
    status: string;
  };
  onBack: () => void;
}
```

#### State Variables
```javascript
const [screenData, setScreenData] = useState(null);
const [isConnected, setIsConnected] = useState(false);
const [deviceInfo, setDeviceInfo] = useState(null);
const [isStreaming, setIsStreaming] = useState(false);
```

#### WebSocket Integration
```javascript
useEffect(() => {
  const socket = io();
  
  // Start screen capture
  socket.emit("start-screen-capture", emulator.name);
  
  // Listen for screen updates
  socket.on("screen-capture", (base64ImageData) => {
    setScreenData(`data:image/png;base64,${base64ImageData}`);
    setIsStreaming(true);
  });
  
  // Handle errors
  socket.on("error", (error) => {
    if (error.type === "emulator_disconnected") {
      setIsStreaming(false);
      // Show disconnection message
    }
  });
  
  return () => {
    socket.emit("stop-screen-capture");
    socket.disconnect();
  };
}, [emulator.name]);
```

#### Input Handling

##### Touch Events
```javascript
const handleScreenClick = (event) => {
  const rect = event.target.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // Scale coordinates to emulator resolution
  const scaledX = (x / rect.width) * deviceInfo.screenSize.width;
  const scaledY = (y / rect.height) * deviceInfo.screenSize.height;
  
  socket.emit("emulator-input", {
    emulatorName: emulator.name,
    action: "tap",
    coordinates: { x: scaledX, y: scaledY }
  });
};
```

##### Swipe Gestures
```javascript
const handleSwipe = (startCoords, endCoords) => {
  socket.emit("emulator-input", {
    emulatorName: emulator.name,
    action: "swipe",
    coordinates: {
      startX: startCoords.x,
      startY: startCoords.y,
      endX: endCoords.x,
      endY: endCoords.y
    }
  });
};
```

#### UI Structure
```jsx
<div className="emulator-dashboard">
  {/* Header */}
  <div className="dashboard-header">
    <BackButton onClick={onBack} />
    <EmulatorInfo emulator={emulator} />
    <ConnectionStatus isConnected={isStreaming} />
  </div>

  {/* Main Content */}
  <div className="dashboard-content">
    {/* Screen Display */}
    <div className="screen-container">
      {screenData ? (
        <img 
          src={screenData}
          onClick={handleScreenClick}
          className="emulator-screen"
        />
      ) : (
        <div className="loading-screen">
          Connecting to emulator...
        </div>
      )}
    </div>

    {/* Control Panel */}
    <div className="control-panel">
      <DeviceInfo info={deviceInfo} />
      <InputControls 
        onTextInput={handleTextInput}
        onKeyPress={handleKeyPress}
      />
    </div>
  </div>
</div>
```

---

### 3. AppManager Component

**File**: `src/components/AppManager.jsx`

**Purpose**: Manages Android applications on emulator instances, including installation, launching, and preinstallation features

#### Features
- ✅ Upload and install APK files manually
- ✅ View list of installed applications
- ✅ Launch installed applications
- ✅ Uninstall user-installed apps
- ✅ **APK preinstallation** from `/apps` directory
- ✅ **Bulk app installation** with status tracking
- ✅ **Quick Install UI** for manual preinstallation
- ✅ **Automatic app launching** with smart detection
- ✅ Search and filter installed applications

#### Props
```javascript
interface AppManagerProps {
  emulator: {
    id: string;
    name: string;
    status: string;
  };
}
```

#### Key State Variables
```javascript
const [apps, setApps] = useState([]);                    // Installed apps list
const [searchTerm, setSearchTerm] = useState("");        // Search filter
const [uploading, setUploading] = useState(false);       // Upload status
const [preinstallApks, setPreinstallApks] = useState([]); // Available APKs
const [preinstalling, setPreinstalling] = useState(false); // Installation status
const [preinstallResult, setPreinstallResult] = useState(null); // Installation results
```

#### Key Methods

**APK Preinstallation Methods:**
```javascript
// Fetch available APKs from /apps directory
const fetchPreinstallApks = async () => {
  const response = await axios.get("/api/preinstall/apps");
  setPreinstallApks(response.data);
};

// Install all APKs from apps directory
const handlePreinstall = async () => {
  setPreinstalling(true);
  const response = await axios.post(`/api/emulators/${emulator.id}/preinstall`);
  setPreinstallResult(response.data);
  await fetchInstalledApps(); // Refresh apps list
  setPreinstalling(false);
};

// Launch first preinstalled app automatically
const handleLaunchPreinstalled = async () => {
  const response = await axios.post(
    `/api/emulators/${emulator.id}/launch-preinstalled`
  );
  console.log("Launched preinstalled app:", response.data);
};
```

**Standard App Management:**
```javascript
// Install APK file via upload
const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  const formData = new FormData();
  formData.append("apk", file);
  
  await axios.post(`/api/emulators/${emulator.id}/apps/install`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  
  await fetchInstalledApps();
};

// Launch installed application
const handleLaunchApp = async (packageName) => {
  await axios.post(`/api/emulators/${emulator.id}/apps/${packageName}/launch`);
};

// Uninstall user application
const handleUninstallApp = async (packageName) => {
  await axios.delete(`/api/emulators/${emulator.id}/apps/${packageName}`);
  await fetchInstalledApps();
};
```

#### UI Structure

**Preinstallation Section:**
```jsx
{preinstallApks.length > 0 && (
  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
    <div className="flex items-center justify-between mb-3">
      <div>
        <h4 className="font-medium text-blue-900">Quick Install Apps</h4>
        <p className="text-sm text-blue-700">
          {preinstallApks.length} APK{preinstallApks.length !== 1 ? "s" : ""} 
          available for quick installation
        </p>
      </div>
      <div className="flex space-x-2">
        <button onClick={handlePreinstall} disabled={preinstalling}>
          {preinstalling ? "Installing..." : "Install All"}
        </button>
        <button onClick={handleLaunchPreinstalled}>
          Launch App
        </button>
      </div>
    </div>
    
    {/* APK File List */}
    <div className="flex flex-wrap gap-2">
      {preinstallApks.map((apk, index) => (
        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
          {apk.name}
        </span>
      ))}
    </div>
    
    {/* Installation Results */}
    {preinstallResult && (
      <div className="mt-3 p-3 bg-white rounded border">
        {preinstallResult.installed.length > 0 && (
          <div className="text-green-600 mb-1">
            ✅ Installed: {preinstallResult.installed.join(", ")}
          </div>
        )}
        {preinstallResult.failed.length > 0 && (
          <div className="text-red-600">
            ❌ Failed: {preinstallResult.failed.map(f => f.name).join(", ")}
          </div>
        )}
      </div>
    )}
  </div>
)}
```

**App List Section:**
```jsx
<div className="space-y-3">
  {filteredApps.map((app) => (
    <div key={app.packageName} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          {app.icon ? (
            <img src={app.icon} alt={app.name} className="w-8 h-8 rounded" />
          ) : (
            <span className="text-blue-600 text-xl">📱</span>
          )}
        </div>
        <div>
          <h4 className="font-medium text-gray-900">{app.name}</h4>
          <p className="text-sm text-gray-600">{app.packageName}</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <button onClick={() => handleLaunchApp(app.packageName)}>
          Launch
        </button>
        {app.isUserApp && (
          <button onClick={() => handleUninstallApp(app.packageName)}>
            Uninstall
          </button>
        )}
      </div>
    </div>
  ))}
</div>
```

#### Styling Classes
- `control-button primary` - Primary action buttons (Install All)
- `control-button secondary` - Secondary actions (Launch App)
- `bg-blue-50` - Preinstallation section background
- `bg-gray-50` - Individual app item background
- `text-blue-800` - APK file tags
- `text-green-600` - Success messages
- `text-red-600` - Error messages

---

### 4. EmulatorContext

**File**: `src/context/EmulatorContext.jsx`

**Purpose**: Global state management for emulator data and application state

#### Context Structure
```javascript
const EmulatorContext = createContext({
  emulators: [],
  loading: false,
  error: null,
  selectedEmulator: null,
  dispatch: () => {}
});
```

#### State Schema
```javascript
interface EmulatorState {
  emulators: Emulator[];
  loading: boolean;
  error: string | null;
  selectedEmulator: Emulator | null;
}

interface Emulator {
  id: string;
  name: string;
  status: 'stopped' | 'running' | 'starting' | 'stopping';
  apiLevel?: number;
  arch?: string;
  device?: string;
}
```

#### Actions
```javascript
const emulatorReducer = (state, action) => {
  switch (action.type) {
    case 'SET_EMULATORS':
      return { ...state, emulators: action.payload, loading: false };
      
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
      
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
      
    case 'SELECT_EMULATOR':
      return { ...state, selectedEmulator: action.payload };
      
    case 'UPDATE_EMULATOR_STATUS':
      return {
        ...state,
        emulators: state.emulators.map(emulator =>
          emulator.id === action.payload.id
            ? { ...emulator, status: action.payload.status }
            : emulator
        )
      };
      
    case 'CLEAR_ERROR':
      return { ...state, error: null };
      
    default:
      return state;
  }
};
```

#### Provider Component
```javascript
export const EmulatorProvider = ({ children }) => {
  const [state, dispatch] = useReducer(emulatorReducer, initialState);
  
  // WebSocket connection for real-time updates
  useEffect(() => {
    const socket = io();
    
    socket.on('emulator-status-changed', (data) => {
      dispatch({
        type: 'UPDATE_EMULATOR_STATUS',
        payload: { id: data.id, status: data.status }
      });
    });
    
    return () => socket.disconnect();
  }, []);
  
  return (
    <EmulatorContext.Provider value={{ ...state, dispatch }}>
      {children}
    </EmulatorContext.Provider>
  );
};
```

#### Hook Usage
```javascript
export const useEmulator = () => {
  const context = useContext(EmulatorContext);
  if (!context) {
    throw new Error('useEmulator must be used within EmulatorProvider');
  }
  return context;
};
```

---

## Utility Components

### LoadingSpinner
```jsx
const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);
```

### ErrorMessage
```jsx
const ErrorMessage = ({ error, onDismiss }) => (
  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
    <div className="flex justify-between items-center">
      <span>{error}</span>
      <button onClick={onDismiss} className="text-red-700 hover:text-red-900">
        ×
      </button>
    </div>
  </div>
);
```

### StatusBadge
```jsx
const StatusBadge = ({ status }) => {
  const statusClasses = {
    running: "bg-green-100 text-green-800",
    stopped: "bg-gray-100 text-gray-800", 
    starting: "bg-yellow-100 text-yellow-800",
    stopping: "bg-orange-100 text-orange-800"
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[status]}`}>
      {status}
    </span>
  );
};
```

---

## Styling System

### Tailwind Configuration

**File**: `tailwind.config.js`

```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    },
  },
  plugins: [],
};
```

### Custom CSS Classes

**File**: `src/index.css`

```css
/* Button Variants */
.control-button {
  @apply px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed;
}

.control-button.primary {
  @apply bg-blue-600 text-white hover:bg-blue-700;
}

.control-button.success {
  @apply bg-green-600 text-white hover:bg-green-700;
}

.control-button.danger {
  @apply bg-red-600 text-white hover:bg-red-700;
}

.control-button.secondary {
  @apply bg-gray-200 text-gray-700 hover:bg-gray-300;
}

/* Emulator Screen */
.emulator-screen {
  @apply max-w-full h-auto border rounded-lg shadow-lg cursor-pointer;
}

/* Loading States */
.loading-screen {
  @apply flex items-center justify-center h-96 bg-gray-100 rounded-lg text-gray-500;
}
```

---

## Event Handling

### WebSocket Events

#### Outgoing Events
```javascript
// Start screen capture
socket.emit('start-screen-capture', emulatorName);

// Stop screen capture  
socket.emit('stop-screen-capture');

// Send device input
socket.emit('emulator-input', {
  emulatorName,
  action: 'tap|swipe|text|keyevent',
  coordinates: { x, y } | { startX, startY, endX, endY },
  text: 'input text'
});
```

#### Incoming Events
```javascript
// Screen capture data
socket.on('screen-capture', (base64ImageData) => {
  setScreenData(`data:image/png;base64,${base64ImageData}`);
});

// Status updates
socket.on('emulator-status-changed', (data) => {
  dispatch({
    type: 'UPDATE_EMULATOR_STATUS',
    payload: data
  });
});

// Error handling
socket.on('error', (error) => {
  handleError(error);
});
```

### HTTP Requests

#### API Client Setup
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

// Request interceptor
api.interceptors.request.use(config => {
  // Add auth headers if needed
  return config;
});

// Response interceptor
api.interceptors.response.use(
  response => response,
  error => {
    // Global error handling
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
```

---

## Performance Optimizations

### React Optimizations

#### useMemo for Expensive Calculations
```javascript
const filteredEmulators = useMemo(() => {
  return emulators.filter(emulator => 
    emulator.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
}, [emulators, searchTerm]);
```

#### useCallback for Event Handlers
```javascript
const handleEmulatorSelect = useCallback((emulator) => {
  dispatch({ type: 'SELECT_EMULATOR', payload: emulator });
  onEmulatorSelect(emulator);
}, [onEmulatorSelect]);
```

#### React.memo for Component Optimization
```javascript
const EmulatorCard = React.memo(({ emulator, onStart, onStop, onDelete }) => {
  // Component implementation
});
```

### Image Optimization

#### Lazy Loading for Screenshots
```javascript
const [imageSrc, setImageSrc] = useState(null);

useEffect(() => {
  if (screenData) {
    const img = new Image();
    img.onload = () => setImageSrc(screenData);
    img.src = screenData;
  }
}, [screenData]);
```

---

## Error Handling

### Global Error Boundary
```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong.</h2>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Async Error Handling
```javascript
const handleAsyncOperation = async () => {
  try {
    setLoading(true);
    const result = await api.post('/emulators', data);
    setResult(result.data);
  } catch (error) {
    if (error.response) {
      // Server error
      setError(error.response.data.error);
    } else if (error.request) {
      // Network error
      setError('Network error. Please check your connection.');
    } else {
      // Other error
      setError('An unexpected error occurred.');
    }
  } finally {
    setLoading(false);
  }
};
```

---

## Testing Considerations

### Component Testing
```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import { EmulatorProvider } from '../context/EmulatorContext';
import EmulatorList from '../components/EmulatorList';

const renderWithContext = (component) => {
  return render(
    <EmulatorProvider>
      {component}
    </EmulatorProvider>
  );
};

test('creates new emulator', async () => {
  renderWithContext(<EmulatorList onEmulatorSelect={jest.fn()} />);
  
  const createButton = screen.getByText('Create Emulator');
  fireEvent.click(createButton);
  
  // Assert API call made
  // Assert UI updates
});
```

### WebSocket Testing
```javascript
import { io } from 'socket.io-client';

// Mock socket for testing
const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn()
};

jest.mock('socket.io-client', () => ({
  io: () => mockSocket
}));
```

This comprehensive frontend documentation covers all the major components, patterns, and best practices used in the Android Emulator Web Dashboard frontend application.
