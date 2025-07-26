const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const EmulatorController = require("./controllers/EmulatorController");
const ScreenCaptureService = require("./services/ScreenCaptureService");

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
const emulatorController = new EmulatorController(io);
const screenCaptureService = new ScreenCaptureService(io);

// Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
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
    const { name, apiLevel, arch, device } = req.body;
    const result = await emulatorController.createEmulator(name, {
      apiLevel,
      arch,
      device,
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

// WebSocket connections
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("start-screen-capture", (emulatorName) => {
    console.log(
      `Received start-screen-capture request for:`,
      typeof emulatorName,
      emulatorName
    );
    console.log(
      `Raw emulatorName data:`,
      JSON.stringify(emulatorName, null, 2)
    );
    screenCaptureService.startCapture(emulatorName, socket);
  });

  socket.on("stop-screen-capture", () => {
    screenCaptureService.stopCapture(socket);
  });

  socket.on("emulator-input", async (data) => {
    try {
      const { emulatorName, action, coordinates, text } = data;
      await emulatorController.sendInput(
        emulatorName,
        action,
        coordinates,
        text
      );
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    screenCaptureService.stopCapture(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});

module.exports = app;
