const { exec, spawn } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

class ScreenStreamService {
  constructor(io) {
    this.io = io;
    this.streamProcesses = new Map(); // Map of socket.id -> stream process info
    this.androidHome =
      process.env.ANDROID_HOME ||
      process.env.ANDROID_SDK_ROOT ||
      `${require("os").homedir()}/Android/Sdk`;
    this.adbPath =
      process.env.ADB_PATH || `${this.androidHome}/platform-tools/adb`;
    this.screenshotDir = path.join(__dirname, "../temp/screenshots");

    // Ensure screenshot directory exists
    fs.ensureDirSync(this.screenshotDir);

    console.log(
      "🎥 Screen Stream Service initialized with optimized screenshot streaming"
    );
  }

  async checkEmulatorReady(emulatorName) {
    return new Promise((resolve, reject) => {
      exec(`"${this.adbPath}" devices`, (error, stdout) => {
        if (error) {
          reject(new Error(`ADB check failed: ${error.message}`));
          return;
        }

        const devices = stdout
          .split("\n")
          .filter(
            (line) => line.includes("emulator") && line.includes("device")
          )
          .filter((line) => !line.includes("offline"));

        if (devices.length === 0) {
          reject(new Error("No online emulator devices found"));
          return;
        }

        // Return the device ID for future reference
        resolve(devices[0].split("\t")[0]);
      });
    });
  }

  async startScreenStream(socket, emulatorName) {
    try {
      console.log(`Starting optimized screen stream for ${emulatorName}`);

      // Check if emulator is ready
      const deviceId = await this.checkEmulatorReady(emulatorName);
      console.log(`Device ID: ${deviceId}`);

      // Stop any existing stream for this socket
      this.stopScreenStream(socket);

      // Start optimized screenshot streaming
      this.streamScreenshots(socket, deviceId, emulatorName);

      return { success: true, deviceId };
    } catch (error) {
      console.error(`Failed to start screen stream: ${error.message}`);
      socket.emit("streamError", {
        error: error.message,
        emulator: emulatorName,
      });
      return { success: false, error: error.message };
    }
  }

  streamScreenshots(socket, deviceId, emulatorName) {
    const streamId = socket.id;
    const interval = 500; // 500ms = 2 FPS, much more efficient than 1 FPS

    // Take screenshot function
    const takeScreenshot = () => {
      const filename = `${streamId}_${Date.now()}.png`;
      const filepath = path.join(this.screenshotDir, filename);

      // Use adb exec-out for faster screenshots
      const command = `"${this.adbPath}" -s ${deviceId} exec-out screencap -p > "${filepath}"`;

      exec(command, { timeout: 2000 }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Screenshot error for ${deviceId}:`, error.message);

          // Don't emit error for every failed screenshot, just log it
          if (!this.streamProcesses.has(streamId)) {
            return; // Stream was stopped
          }

          // Only emit error if it's a persistent issue
          const streamInfo = this.streamProcesses.get(streamId);
          if (streamInfo) {
            streamInfo.errorCount = (streamInfo.errorCount || 0) + 1;

            if (streamInfo.errorCount > 5) {
              socket.emit("streamError", {
                error: `Persistent screenshot errors: ${error.message}`,
                emulator: emulatorName,
              });
              this.stopScreenStream(socket);
            }
          }
          return;
        }

        // Check if file exists and has content
        if (fs.existsSync(filepath)) {
          const stats = fs.statSync(filepath);
          if (stats.size > 1000) {
            // Must be > 1KB to be a valid screenshot
            try {
              // Read screenshot and convert to base64
              const screenshotBuffer = fs.readFileSync(filepath);
              const base64Screenshot = screenshotBuffer.toString("base64");

              // Send to client
              socket.emit("videoChunk", {
                data: base64Screenshot,
                timestamp: Date.now(),
                type: "screenshot",
              });

              // Reset error count on success
              const streamInfo = this.streamProcesses.get(streamId);
              if (streamInfo) {
                streamInfo.errorCount = 0;
              }

              // Clean up file
              fs.unlink(filepath, (unlinkErr) => {
                if (unlinkErr)
                  console.error("Failed to delete screenshot:", unlinkErr);
              });
            } catch (readError) {
              console.error("Failed to read screenshot:", readError);
            }
          } else {
            // File too small, delete it
            fs.unlink(filepath, () => {});
          }
        }
      });
    };

    // Store stream info
    const intervalId = setInterval(takeScreenshot, interval);
    this.streamProcesses.set(streamId, {
      intervalId,
      deviceId,
      emulatorName,
      startTime: Date.now(),
      errorCount: 0,
    });

    // Take first screenshot immediately
    setTimeout(takeScreenshot, 100);

    console.log(
      `✅ Optimized screen stream started for ${emulatorName} (socket: ${streamId})`
    );
  }

  stopScreenStream(socket) {
    const streamInfo = this.streamProcesses.get(socket.id);

    if (streamInfo) {
      console.log(
        `Stopping screen stream for socket ${socket.id} (emulator: ${streamInfo.emulatorName})`
      );

      // Clear interval
      if (streamInfo.intervalId) {
        clearInterval(streamInfo.intervalId);
      }

      this.streamProcesses.delete(socket.id);
      console.log(`✅ Screen stream stopped for socket ${socket.id}`);
    }
  }

  // Handle socket disconnect
  handleSocketDisconnect(socket) {
    this.stopScreenStream(socket);
  }

  // Get active streams info
  getActiveStreams() {
    const streams = [];
    for (const [socketId, streamInfo] of this.streamProcesses) {
      streams.push({
        socketId,
        emulatorName: streamInfo.emulatorName,
        deviceId: streamInfo.deviceId,
        duration: Date.now() - streamInfo.startTime,
        errorCount: streamInfo.errorCount || 0,
      });
    }
    return streams;
  }

  // Clean up all streams
  cleanup() {
    console.log("Cleaning up all screen streams...");
    for (const [socketId, streamInfo] of this.streamProcesses) {
      this.stopScreenStream({ id: socketId });
    }
    this.streamProcesses.clear();

    // Clean up old screenshot files
    try {
      const files = fs.readdirSync(this.screenshotDir);
      const now = Date.now();
      files.forEach((file) => {
        const filepath = path.join(this.screenshotDir, file);
        const stats = fs.statSync(filepath);
        // Delete files older than 10 minutes
        if (now - stats.mtime.getTime() > 10 * 60 * 1000) {
          fs.unlinkSync(filepath);
        }
      });
    } catch (error) {
      console.error("Error cleaning up screenshots:", error);
    }
  }
}

module.exports = ScreenStreamService;
