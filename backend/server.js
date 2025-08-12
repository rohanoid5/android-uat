const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const EmulatorController = require("./controllers/EmulatorController");
const WebRTCService = require("./services/WebRTCService");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Initialize services
const webRTCService = new WebRTCService(io);
const emulatorController = new EmulatorController(io, webRTCService);

// Serve static files from React build
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Add debugging endpoint for streaming status
app.get("/api/streaming/status", (req, res) => {
  try {
    const status = webRTCService.getStreamingStatus();
    const emulatorMappings = Array.from(webRTCService.deviceMappings.entries());

    res.json({
      ...status,
      emulatorMappings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add endpoint to refresh emulator mappings and restart streams
app.post("/api/streaming/refresh", async (req, res) => {
  try {
    console.log("🔄 Manual refresh requested via API");

    // Refresh emulator mappings
    await webRTCService.refreshEmulatorMappings();

    // Get updated status
    const status = webRTCService.getStreamingStatus();
    const emulatorMappings = Array.from(webRTCService.deviceMappings.entries());

    res.json({
      message: "Emulator mappings refreshed successfully",
      ...status,
      emulatorMappings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Failed to refresh mappings:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add endpoint to force restart a specific stream
app.post("/api/streaming/restart/:emulatorName", async (req, res) => {
  try {
    const { emulatorName } = req.params;
    console.log(`🔄 Manual restart requested for ${emulatorName}`);

    // Stop existing recording
    webRTCService.stopRecording(emulatorName);

    // Wait a moment for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Start new recording
    await webRTCService.startRecording(emulatorName);

    res.json({
      message: `Stream restarted successfully for ${emulatorName}`,
      emulator: emulatorName,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      `❌ Failed to restart stream for ${req.params.emulatorName}:`,
      error
    );
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/emulators", async (req, res) => {
  try {
    const emulators = await emulatorController.getAvailableEmulators();
    res.json(emulators);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/emulators", async (req, res) => {
  try {
    const { name, apiLevel, arch, device, preinstallApp } = req.body;
    const result = await emulatorController.createEmulator(name, {
      apiLevel,
      arch,
      device,
      preinstallApp,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/emulators/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const result = await emulatorController.deleteEmulator(name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/emulators/:name/start", async (req, res) => {
  try {
    const { name } = req.params;
    const result = await emulatorController.startEmulator(name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/emulators/:name/stop", async (req, res) => {
  try {
    const { name } = req.params;
    const result = await emulatorController.stopEmulator(name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/emulators/:name/status", async (req, res) => {
  try {
    const { name } = req.params;
    const status = await emulatorController.getEmulatorStatus(name);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/emulators/:name/screenshot-status", async (req, res) => {
  try {
    // First get connected devices
    const { exec } = require("child_process");
    const androidHome =
      process.env.ANDROID_HOME ||
      process.env.ANDROID_SDK_ROOT ||
      `${require("os").homedir()}/Android/Sdk`;
    const adbPath = process.env.ADB_PATH || `${androidHome}/platform-tools/adb`;

    exec(
      `"${adbPath}" devices`,
      { timeout: 5000 },
      async (deviceError, deviceStdout) => {
        if (deviceError) {
          return res.status(500).json({
            error: `ADB devices check failed: ${deviceError.message}`,
          });
        }

        const devices = deviceStdout
          .split("\n")
          .filter(
            (line) => line.includes("emulator") && line.includes("device")
          )
          .filter((line) => !line.includes("offline"));

        if (devices.length === 0) {
          return res.status(404).json({ error: "No emulator devices found" });
        }

        // Use the first available device (you might want to match by emulator name)
        const deviceId = devices[0].split("\t")[0];

        try {
          const screenshotStatus =
            await emulatorController.checkScreenshotStatus(deviceId);
          res.json(screenshotStatus);
        } catch (statusError) {
          res.status(500).json({ error: statusError.message });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/emulators/:name/input", async (req, res) => {
  try {
    const { name } = req.params;
    const { action, coordinates, text } = req.body;
    const result = await emulatorController.sendInput(
      name,
      action,
      coordinates,
      text
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/emulators/:name/install-app", async (req, res) => {
  try {
    const { name } = req.params;
    const { apkPath } = req.body;
    const result = await emulatorController.installApp(name, apkPath);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/emulators/:name/apps", async (req, res) => {
  try {
    const { name } = req.params;
    const apps = await emulatorController.getInstalledApps(name);
    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/emulators/:name/apps/:packageName/launch", async (req, res) => {
  try {
    const { name, packageName } = req.params;
    const result = await emulatorController.launchApp(name, packageName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Launch app using deeplink
app.post("/api/emulators/:name/launch-deeplink", async (req, res) => {
  try {
    const { name } = req.params;
    const { deeplink, fallbackToStore = false, timeout = 10000 } = req.body;

    if (!deeplink) {
      return res.status(400).json({ error: "Deeplink is required" });
    }

    const result = await emulatorController.launchAppWithDeeplink(
      name,
      deeplink,
      {
        fallbackToStore,
        timeout,
      }
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get list of available APKs for preinstallation
app.get("/api/preinstall/apps", async (req, res) => {
  try {
    const apks = await emulatorController.getPreinstallApks();
    res.json(apks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger preinstallation on a running emulator
app.post("/api/emulators/:name/preinstall", async (req, res) => {
  try {
    const { name } = req.params;
    const result = await emulatorController.preinstallApks(name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Launch preinstalled app
app.post("/api/emulators/:name/launch-preinstalled", async (req, res) => {
  try {
    const { name } = req.params;
    const result = await emulatorController.launchPreinstalledApp(name);
    res.json({
      message: result
        ? `Launched ${result}`
        : "Could not launch preinstalled app",
      packageName: result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit feedback for emulator screen (dummy endpoint)
app.post("/api/emulators/:name/feedback", async (req, res) => {
  try {
    const { name } = req.params;
    const { feedback, screenshot, rating, category } = req.body;

    // TODO: Implement actual feedback storage (database, file system, etc.)
    console.log(`Feedback received for emulator ${name}:`, {
      feedback,
      rating,
      category,
      screenshotProvided: !!screenshot,
      timestamp: new Date().toISOString(),
    });

    res.json({
      message: "Feedback submitted successfully",
      emulatorName: name,
      feedbackId: `feedback_${Date.now()}`, // Dummy ID
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connections
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("start-screen-stream", (emulatorName) => {
    console.log(
      `🎬 Socket ${socket.id} requesting stream for: ${emulatorName}`
    );

    // Join emulator-specific room
    const roomName = `emulator:${emulatorName}`;
    socket.join(roomName);
    console.log(`👥 Socket ${socket.id} joined room: ${roomName}`);

    // Start stream with room-based broadcasting
    webRTCService.startScreenStream(socket, emulatorName);
  });

  socket.on("stop-screen-stream", () => {
    // Leave emulator rooms
    const rooms = Array.from(socket.rooms);
    rooms.forEach((room) => {
      if (room.startsWith("emulator:")) {
        socket.leave(room);
        console.log(`👋 Socket ${socket.id} left room: ${room}`);
      }
    });

    webRTCService.stopScreenStream(socket);
  });

  // Handle emulator input (tap, swipe, etc.)
  socket.on("emulator-input", async (data) => {
    try {
      console.log(`📱 Input received from ${socket.id}:`, data);

      const { emulatorName, action, coordinates, text } = data;

      if (!emulatorName) {
        console.error("❌ No emulator name provided for input");
        socket.emit("input-error", { error: "Emulator name is required" });
        return;
      }

      const result = await emulatorController.sendInput(
        emulatorName,
        action,
        coordinates,
        text
      );

      console.log(`✅ Input sent successfully to ${emulatorName}:`, result);
      socket.emit("input-success", result);
    } catch (error) {
      console.error(`❌ Input failed for ${socket.id}:`, error.message);
      socket.emit("input-error", { error: error.message });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    // Rooms are automatically cleaned up on disconnect
    webRTCService.handleSocketDisconnect(socket);
  });
});

// Catch-all handler: send back React's index.html file for client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

// Cleanup on server shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, cleaning up WebRTC streams...");
  webRTCService.cleanup();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, cleaning up WebRTC streams...");
  webRTCService.cleanup();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
  console.log(`🎥 WebRTC Service ready for video streaming`);
});

module.exports = app;
