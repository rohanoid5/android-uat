const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const sharp = require("sharp");

const execAsync = promisify(exec);

class ScreenCaptureService {
  constructor(io) {
    this.io = io;
    this.activeStreams = new Map(); // emulatorName -> stream info
    this.deviceMappings = new Map(); // emulatorName -> deviceId
    this.screenshotCache = new Map(); // deviceId -> last screenshot buffer
    this.inputQueue = new Map(); // deviceId -> queued inputs
    this.processingInputs = new Set(); // devices currently processing inputs

    this.androidHome =
      process.env.ANDROID_HOME ||
      process.env.ANDROID_SDK_ROOT ||
      `${require("os").homedir()}/Android/Sdk`;
    this.adbPath =
      process.env.ADB_PATH || `${this.androidHome}/platform-tools/adb`;

    console.log("🚀 Optimized WebRTC Service initialized");

    // Initialize with better emulator discovery
    this.refreshEmulatorMappings();

    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  // OPTIMIZED SCREENSHOT CAPTURE - No file I/O
  async captureOptimizedScreenshot(deviceId, quality = 70) {
    try {
      // Use exec-out for direct streaming - no file operations
      const { stdout } = await this.executeCommandWithOutput(
        `"${this.adbPath}" -s ${deviceId} exec-out screencap -p`
      );

      // Compress using sharp for much better performance
      const compressedBuffer = await sharp(stdout)
        .jpeg({ quality, progressive: true })
        .resize(null, 720) // Scale to 720p height for better performance
        .toBuffer();

      return compressedBuffer;
    } catch (error) {
      console.error(
        `Screenshot capture failed for ${deviceId}:`,
        error.message
      );
      throw error;
    }
  }

  // OPTIMIZED COMMAND EXECUTION
  async executeCommandWithOutput(command) {
    return new Promise((resolve, reject) => {
      const child = spawn("sh", ["-c", command], {
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      let stdout = Buffer.alloc(0);
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout = Buffer.concat([stdout, data]);
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on("error", reject);

      // 3 second timeout for responsiveness
      setTimeout(() => {
        child.kill();
        reject(new Error("Screenshot capture timeout"));
      }, 3000);
    });
  }

  // DELTA COMPRESSION for Screenshots
  async captureWithDelta(deviceId, quality = 70) {
    const currentBuffer = await this.captureOptimizedScreenshot(
      deviceId,
      quality
    );
    const previousBuffer = this.screenshotCache.get(deviceId);

    if (!previousBuffer || !currentBuffer.equals(previousBuffer)) {
      this.screenshotCache.set(deviceId, currentBuffer);
      return {
        type: "full",
        data: currentBuffer,
        size: currentBuffer.length,
        changed: true,
      };
    }

    return {
      type: "unchanged",
      data: null,
      size: 0,
      changed: false,
    };
  }

  // BATCHED INPUT PROCESSING
  async processInputBatch(deviceId, inputs) {
    if (this.processingInputs.has(deviceId)) {
      return { success: false, reason: "Device busy processing inputs" };
    }

    this.processingInputs.add(deviceId);

    try {
      // Process only the most recent input for taps, or all inputs for swipes
      const input = inputs[inputs.length - 1];

      let adbCommand;
      if (input.action === "tap") {
        adbCommand = `"${this.adbPath}" -s ${deviceId} shell input tap ${input.coordinates.x} ${input.coordinates.y}`;
      } else if (input.action === "swipe") {
        const { startX, startY, endX, endY } = input.coordinates;
        adbCommand = `"${this.adbPath}" -s ${deviceId} shell input swipe ${startX} ${startY} ${endX} ${endY} 300`;
      }

      if (adbCommand) {
        await this.executeCommand(adbCommand);
        return { success: true };
      }

      return { success: false, reason: "Unknown action" };
    } catch (error) {
      console.error(`Input processing error for ${deviceId}:`, error.message);
      return { success: false, reason: error.message };
    } finally {
      this.processingInputs.delete(deviceId);
    }
  }

  // OPTIMIZED STREAMING LOOP
  async startOptimizedStream(socket, emulatorName) {
    try {
      const deviceId = await this.checkEmulatorReady(emulatorName);
      const roomName = `emulator:${emulatorName}`;

      socket.join(roomName);

      const viewerCount =
        this.io.sockets.adapter.rooms.get(roomName)?.size || 0;
      console.log(`📺 ${viewerCount} viewers watching ${emulatorName}`);

      // Start streaming if not already active
      if (!this.activeStreams.has(emulatorName)) {
        console.log(`🎬 Starting optimized stream for ${emulatorName}`);

        this.activeStreams.set(emulatorName, {
          deviceId,
          isActive: true,
          viewers: viewerCount,
          lastCapture: 0,
        });

        // Start the optimized streaming loop
        this.optimizedStreamingLoop(emulatorName, deviceId);
      }

      return { success: true, deviceId };
    } catch (error) {
      console.error(
        `Failed to start stream for ${emulatorName}:`,
        error.message
      );
      socket.emit("streamError", {
        error: error.message,
        emulator: emulatorName,
      });
      throw error;
    }
  }

  async optimizedStreamingLoop(emulatorName, deviceId) {
    console.log(`🔄 Starting optimized streaming loop for ${emulatorName}`);

    const roomName = `emulator:${emulatorName}`;
    let consecutiveErrors = 0;
    const maxErrors = 3;
    const targetFPS = 15; // Optimized FPS for balance between responsiveness and performance
    const frameInterval = 1000 / targetFPS;

    while (this.activeStreams.has(emulatorName)) {
      const startTime = Date.now();

      try {
        // Check for viewers
        const viewerCount =
          this.io.sockets.adapter.rooms.get(roomName)?.size || 0;
        if (viewerCount === 0) {
          console.log(`⚠️ No viewers for ${emulatorName}, stopping stream`);
          break;
        }

        // Process any queued inputs first
        const queuedInputs = this.inputQueue.get(deviceId) || [];
        if (queuedInputs.length > 0) {
          this.inputQueue.set(deviceId, []);
          await this.processInputBatch(deviceId, queuedInputs);
        }

        // Capture with delta compression
        const result = await this.captureWithDelta(deviceId, 75);

        if (result.changed) {
          // Broadcast only if screen changed
          this.io.to(roomName).emit("videoChunk", {
            type: "screenshot",
            data: result.data.toString("base64"),
            emulator: emulatorName,
            timestamp: Date.now(),
            size: result.size,
            fps: targetFPS,
          });

          console.log(
            `📡 Broadcasted ${result.size} bytes to ${viewerCount} viewers`
          );
        }

        consecutiveErrors = 0; // Reset error counter

        // Dynamic frame rate adjustment
        const processingTime = Date.now() - startTime;
        const sleepTime = Math.max(0, frameInterval - processingTime);

        if (sleepTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, sleepTime));
        }
      } catch (error) {
        consecutiveErrors++;
        console.error(
          `Stream error for ${emulatorName} (${consecutiveErrors}/${maxErrors}):`,
          error.message
        );

        if (consecutiveErrors >= maxErrors) {
          console.error(
            `💥 Too many errors for ${emulatorName}, stopping stream`
          );
          this.io.to(roomName).emit("streamError", {
            error: `Stream failed: ${error.message}`,
            emulator: emulatorName,
          });
          break;
        }

        // Exponential backoff on errors
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(1000 * consecutiveErrors, 5000))
        );
      }
    }

    // Cleanup
    this.cleanupStream(emulatorName);
    console.log(`🏁 Optimized streaming loop ended for ${emulatorName}`);
  }

  // HANDLE BATCHED INPUTS
  handleEmulatorInput(emulatorName, inputData) {
    const deviceId = this.deviceMappings.get(emulatorName);
    if (!deviceId) {
      return { success: false, reason: "Device not found" };
    }

    // Add to input queue
    if (!this.inputQueue.has(deviceId)) {
      this.inputQueue.set(deviceId, []);
    }

    this.inputQueue.get(deviceId).push(inputData);

    // Limit queue size to prevent memory issues
    const queue = this.inputQueue.get(deviceId);
    if (queue.length > 10) {
      queue.shift(); // Remove oldest input
    }

    return { success: true };
  }

  // OPTIMIZED EMULATOR DISCOVERY
  async refreshEmulatorMappings() {
    try {
      const { stdout } = await execAsync(`"${this.adbPath}" devices -l`);
      const lines = stdout.split("\n").filter((line) => line.trim());

      const devicePromises = lines
        .filter((line) => line.includes("device") && line.includes("emulator-"))
        .map(async (line) => {
          const deviceId = line.split(/\s+/)[0];
          try {
            const avdName = await this.getAvdName(deviceId);
            return { deviceId, avdName };
          } catch {
            return null;
          }
        });

      const devices = (await Promise.all(devicePromises)).filter(Boolean);

      this.deviceMappings.clear();
      devices.forEach(({ deviceId, avdName }) => {
        this.deviceMappings.set(avdName, deviceId);
        console.log(`📌 Mapped: ${avdName} → ${deviceId}`);
      });

      console.log(`✅ Cached ${devices.length} emulator mappings`);
    } catch (error) {
      console.error("Failed to refresh emulator mappings:", error.message);
    }
  }

  isEmulatorNameMatch(requestedName, avdName) {
    const requested = requestedName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const avd = avdName.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Direct match
    if (requested === avd) return true;

    // Partial match (either contains the other)
    if (requested.includes(avd) || avd.includes(requested)) return true;

    // Handle common patterns like "PhonePe-Stage-V2" vs "phonepe_stage_v2"
    const normalizedRequested = requested.replace(/[-_]/g, "");
    const normalizedAvd = avd.replace(/[-_]/g, "");

    return (
      normalizedRequested === normalizedAvd ||
      normalizedRequested.includes(normalizedAvd) ||
      normalizedAvd.includes(normalizedRequested)
    );
  }

  // Verify a device is still online
  async verifyDeviceOnline(deviceId) {
    return new Promise((resolve) => {
      exec(`"${this.adbPath}" -s ${deviceId} shell echo "test"`, (error) => {
        resolve(!error);
      });
    });
  }

  async checkEmulatorReady(emulatorName) {
    // First check cache
    if (this.deviceMappings.has(emulatorName)) {
      const cachedDeviceId = this.deviceMappings.get(emulatorName);
      console.log(
        `📋 Using cached mapping: ${emulatorName} → ${cachedDeviceId}`
      );

      // Verify the device is still online and responding
      const isOnline = await this.verifyDeviceOnline(cachedDeviceId);
      if (isOnline) {
        // Additional check: verify the device is actually the emulator we want
        try {
          const avdName = await this.getAvdName(cachedDeviceId);
          if (this.isEmulatorNameMatch(emulatorName, avdName)) {
            return cachedDeviceId;
          } else {
            console.log(
              `⚠️ Cached device ${cachedDeviceId} is now different emulator (${avdName}), refreshing...`
            );
            this.deviceMappings.delete(emulatorName);
          }
        } catch (error) {
          console.log(
            `⚠️ Cannot verify cached device ${cachedDeviceId}, refreshing mappings...`
          );
          this.deviceMappings.delete(emulatorName);
        }
      } else {
        console.log(
          `⚠️ Cached device ${cachedDeviceId} is offline, refreshing mappings...`
        );
        this.deviceMappings.delete(emulatorName);
      }
    }

    // If not in cache or device is offline, refresh and search
    await this.refreshEmulatorMappings();

    if (this.deviceMappings.has(emulatorName)) {
      const deviceId = this.deviceMappings.get(emulatorName);
      console.log(`✅ Found after refresh: ${emulatorName} → ${deviceId}`);
      return deviceId;
    }

    // Try fuzzy matching if exact name not found
    for (const [cachedName, deviceId] of this.deviceMappings) {
      if (this.isEmulatorNameMatch(emulatorName, cachedName)) {
        console.log(
          `🔍 Fuzzy match found: ${emulatorName} ≈ ${cachedName} → ${deviceId}`
        );
        // Cache this match for faster future lookups
        this.deviceMappings.set(emulatorName, deviceId);
        return deviceId;
      }
    }

    throw new Error(
      `No device found for emulator: ${emulatorName}. Available: ${Array.from(
        this.deviceMappings.keys()
      ).join(", ")}`
    );
  }

  async getAvdName(deviceId) {
    return new Promise((resolve, reject) => {
      // Try primary property first
      exec(
        `"${this.adbPath}" -s ${deviceId} shell getprop ro.kernel.qemu.avd_name`,
        (error, stdout) => {
          if (!error && stdout.trim()) {
            resolve(stdout.trim());
            return;
          }

          // Try alternative property
          exec(
            `"${this.adbPath}" -s ${deviceId} shell getprop ro.boot.qemu.avd_name`,
            (error2, stdout2) => {
              if (!error2 && stdout2.trim()) {
                resolve(stdout2.trim());
                return;
              }

              // Try getting device model as fallback
              exec(
                `"${this.adbPath}" -s ${deviceId} shell getprop ro.product.model`,
                (error3, stdout3) => {
                  if (!error3 && stdout3.trim()) {
                    resolve(stdout3.trim());
                  } else {
                    reject(new Error(`Could not get AVD name for ${deviceId}`));
                  }
                }
              );
            }
          );
        }
      );
    });
  }

  executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${error.message}\nStderr: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  stopStream(socket) {
    const rooms = Array.from(socket.rooms);
    const emulatorRooms = rooms.filter((room) => room.startsWith("emulator:"));

    emulatorRooms.forEach((roomName) => {
      const emulatorName = roomName.replace("emulator:", "");
      const remainingViewers =
        this.io.sockets.adapter.rooms.get(roomName)?.size || 0;

      console.log(
        `👥 ${remainingViewers} viewers remaining for ${emulatorName}`
      );

      if (remainingViewers === 0) {
        console.log(`🛑 Stopping stream for ${emulatorName}`);
        this.cleanupStream(emulatorName);
      }
    });
  }

  cleanupStream(emulatorName) {
    const stream = this.activeStreams.get(emulatorName);
    if (stream) {
      stream.isActive = false;
      this.activeStreams.delete(emulatorName);

      // Clear screenshot cache
      if (stream.deviceId) {
        this.screenshotCache.delete(stream.deviceId);
        this.inputQueue.delete(stream.deviceId);
      }

      console.log(`🧹 Cleaned up stream for ${emulatorName}`);
    }
  }

  startPeriodicCleanup() {
    setInterval(() => {
      // Clean up inactive streams
      for (const [emulatorName, stream] of this.activeStreams) {
        const roomName = `emulator:${emulatorName}`;
        const viewerCount =
          this.io.sockets.adapter.rooms.get(roomName)?.size || 0;

        if (viewerCount === 0) {
          console.log(`🧹 Cleaning up inactive stream: ${emulatorName}`);
          this.cleanupStream(emulatorName);
        }
      }

      // Clear old screenshot cache
      if (this.screenshotCache.size > 20) {
        const oldestEntries = Array.from(this.screenshotCache.keys()).slice(
          0,
          10
        );
        oldestEntries.forEach((key) => this.screenshotCache.delete(key));
      }
    }, 10000); // Every 10 seconds
  }

  handleSocketDisconnect(socket) {
    console.log(`🔌 Socket ${socket.id} disconnected`);

    // Use setTimeout to ensure room cleanup is complete
    setTimeout(() => this.stopStream(socket), 100);
  }

  getStreamingStatus() {
    const streams = [];
    for (const [emulatorName, stream] of this.activeStreams) {
      const roomName = `emulator:${emulatorName}`;
      const viewerCount =
        this.io.sockets.adapter.rooms.get(roomName)?.size || 0;

      streams.push({
        emulatorName,
        deviceId: stream.deviceId,
        viewerCount,
        isActive: stream.isActive,
      });
    }

    return {
      totalActiveStreams: this.activeStreams.size,
      streams,
    };
  }

  cleanup() {
    console.log("🧹 Cleaning up Optimized WebRTC service...");

    for (const [emulatorName] of this.activeStreams) {
      this.cleanupStream(emulatorName);
    }

    this.screenshotCache.clear();
    this.inputQueue.clear();
    this.processingInputs.clear();

    console.log("✅ Cleanup complete");
  }
}

module.exports = ScreenCaptureService;
