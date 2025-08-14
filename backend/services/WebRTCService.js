// Add to the top of your file if not already present
const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const fs = require("fs-extra");
const path = require("path");

const execAsync = promisify(exec);

class WebRTCService {
  constructor(io) {
    this.io = io;
    this.streamProcesses = new Map(); // Map of socket.id -> stream process info
    this.deviceMappings = new Map(); // Cache: emulatorName -> deviceId
    this.activeRecordings = new Map(); // Add this missing property
    this.deviceRecordingLocks = new Set(); // Simple set to track devices currently recording
    this.deviceLockTimestamps = new Map(); // Track when each device was locked

    this.androidHome =
      process.env.ANDROID_HOME ||
      process.env.ANDROID_SDK_ROOT ||
      `${require("os").homedir()}/Android/Sdk`;
    this.adbPath =
      process.env.ADB_PATH || `${this.androidHome}/platform-tools/adb`;
    this.ffmpegPath = this.findFFmpeg();

    console.log("🚀 WebRTC Service initialized");

    // Discover and cache emulator mappings on startup
    this.refreshEmulatorMappings();

    // Start periodic cleanup of stuck locks
    this.startLockCleanup();
  }

  async recordVideoChunk(deviceId, outputFile, retryCount = 0) {
    const maxRetries = 2;

    return new Promise(async (resolve, reject) => {
      // Define required variables
      const timestamp = Date.now();
      const deviceTempFile = `/sdcard/temp_video_${timestamp}.mp4`;
      const outputDir = path.dirname(
        outputFile || `/tmp/video_${timestamp}.mp4`
      );
      const rawVideoPath =
        outputFile ||
        path.join(outputDir, `video_${deviceId}_${timestamp}.mp4`);

      // Check if device is already recording with timeout - but be more lenient
      if (this.deviceRecordingLocks.has(deviceId)) {
        const lockTime = this.deviceLockTimestamps.get(deviceId);
        const lockAge = Date.now() - (lockTime || 0);

        // If lock is older than 5 seconds, consider it stale and remove it
        if (lockAge > 5000) {
          console.log(
            `🧹 Removing stale lock for device ${deviceId} (${lockAge}ms old)`
          );
          this.deviceRecordingLocks.delete(deviceId);
          this.deviceLockTimestamps.delete(deviceId);
        } else {
          console.log(
            `⏳ Device ${deviceId} is recording, waiting... (${lockAge}ms old)`
          );
          return reject(new Error(`Device ${deviceId} is busy recording`));
        }
      }

      // Check device status first with multiple boot properties
      try {
        const { stdout: deviceStatus } = await execAsync(
          `adb -s ${deviceId} shell "getprop sys.boot_completed && getprop dev.bootcomplete"`
        );
        const lines = deviceStatus ? deviceStatus.trim().split("\n") : [];
        const bootCompleted = lines[0] === "1";
        const devBootComplete = lines[1] === "1";

        if (!bootCompleted && !devBootComplete) {
          console.log(
            `❌ Device ${deviceId} boot properties not ready: sys.boot_completed=${
              lines[0] || "empty"
            }, dev.bootcomplete=${lines[1] || "empty"}`
          );

          // Fallback: If boot properties fail, try basic responsiveness test
          console.log(
            `🔄 Attempting fallback readiness check for ${deviceId}...`
          );
          try {
            const { stdout: serviceStatus } = await execAsync(
              `adb -s ${deviceId} shell "getprop init.svc.bootanim"`
            );

            // If boot animation service is stopped, device might be ready
            if (serviceStatus.trim() === "stopped") {
              console.log(
                `✅ Device ${deviceId} fallback check passed (bootanim stopped)`
              );
            } else {
              console.log(
                `❌ Device ${deviceId} fallback check failed: bootanim=${serviceStatus.trim()}`
              );
              return reject(new Error(`Device ${deviceId} not ready`));
            }
          } catch (fallbackError) {
            console.log(`❌ Fallback check failed: ${fallbackError.message}`);
            return reject(new Error(`Device ${deviceId} not ready`));
          }
        } else {
          console.log(
            `✅ Device ${deviceId} boot ready: sys.boot_completed=${lines[0]}, dev.bootcomplete=${lines[1]}`
          );
        }

        // Quick ping test to ensure device is responsive
        const startTime = Date.now();
        await execAsync(`adb -s ${deviceId} shell echo "ping"`);
        const pingTime = Date.now() - startTime;
        console.log(`📱 Device ${deviceId} ping: ${pingTime}ms`);

        if (pingTime > 3000) {
          console.log(
            `⚠️ Device ${deviceId} responding slowly (${pingTime}ms)`
          );
        }
      } catch (error) {
        console.log(
          `⚠️ Cannot check device ${deviceId} status: ${error.message}`
        );
        if (retryCount < maxRetries) {
          console.log(
            `🔄 Retrying recording for ${deviceId} (${
              retryCount + 1
            }/${maxRetries})`
          );
          setTimeout(() => {
            this.recordVideoChunk(deviceId, outputFile, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, 1000 * (retryCount + 1)); // Exponential backoff
          return;
        }
        return reject(
          new Error(
            `Device ${deviceId} not accessible after ${maxRetries} retries`
          )
        );
      }

      // Lock the device with timestamp for timeout tracking
      this.deviceRecordingLocks.add(deviceId);
      this.deviceLockTimestamps.set(deviceId, Date.now());
      const lockStartTime = Date.now();
      console.log(`🔐 Locked device ${deviceId} for recording`);

      let recordProcess;
      let timeoutId;

      // Cleanup function to ensure device is unlocked
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.deviceRecordingLocks.delete(deviceId);
        this.deviceLockTimestamps.delete(deviceId);
        const lockDuration = Date.now() - lockStartTime;
        console.log(
          `🔓 Unlocked device ${deviceId} (held for ${lockDuration}ms)`
        );
      };

      // Ensure temp directory exists
      fs.ensureDir(outputDir)
        .then(() => {
          // Step 1: Record video on device with optimized parameters
          recordProcess = spawn(this.adbPath, [
            "-s",
            deviceId,
            "shell",
            "screenrecord",
            "--time-limit",
            "1", // 1 second chunks
            "--bit-rate",
            "1000000", // Reduced to 1M for faster encoding
            "--size",
            "720x1280", // Reduced resolution for better performance
            deviceTempFile, // Unique temp file on device
          ]);

          // Handle process output for debugging
          recordProcess.stdout.on("data", (data) => {
            console.log(`📹 screenrecord stdout: ${data}`);
          });

          recordProcess.stderr.on("data", (data) => {
            console.log(`📹 screenrecord stderr: ${data}`);
          });

          recordProcess.on("close", async (code) => {
            cleanup(); // Always cleanup first

            if (code === 0) {
              try {
                // Step 2: Check if file exists before pulling
                const checkResult = await this.executeCommand(
                  `"${this.adbPath}" -s ${deviceId} shell "[ -f ${deviceTempFile} ] && echo 'exists' || echo 'not found'"`
                );

                if (!checkResult.includes("exists")) {
                  throw new Error(
                    `Recording file not created: ${deviceTempFile}`
                  );
                }

                // Step 3: Pull video from device to server
                await this.executeCommand(
                  `"${this.adbPath}" -s ${deviceId} pull ${deviceTempFile} "${rawVideoPath}"`
                );

                // Step 4: Read video file
                const videoBuffer = await fs.readFile(rawVideoPath);

                console.log(
                  `🎥 Recorded ${videoBuffer.length} bytes for ${deviceId}`
                );

                // Immediately resolve with video buffer for faster streaming
                resolve(videoBuffer);

                // Cleanup files in background (non-blocking)
                setImmediate(async () => {
                  const cleanupPromises = [
                    fs
                      .remove(rawVideoPath)
                      .catch((err) =>
                        console.warn(
                          `Failed to remove local file: ${err.message}`
                        )
                      ),
                  ];

                  // Only try to remove device file if it exists
                  try {
                    await this.executeCommand(
                      `"${this.adbPath}" -s ${deviceId} shell "rm -f ${deviceTempFile}"`
                    );
                  } catch (cleanupError) {
                    console.warn(
                      `Failed to cleanup device file: ${cleanupError.message}`
                    );
                  }

                  await Promise.all(cleanupPromises);
                });
              } catch (error) {
                console.error(
                  `Error processing video for ${deviceId}:`,
                  error.message
                );

                // Cleanup on error
                fs.remove(rawVideoPath).catch(() => {});
                this.executeCommand(
                  `"${this.adbPath}" -s ${deviceId} shell rm -f ${deviceTempFile}`
                ).catch(() => {});

                reject(error);
              }
            } else {
              console.warn(
                `Screen recording failed with code ${code} for device ${deviceId}`
              );

              // Retry logic for failed recordings
              if (retryCount < maxRetries) {
                console.log(
                  `🔄 Retrying recording for ${deviceId} (${
                    retryCount + 1
                  }/${maxRetries}) after failure with code ${code}`
                );
                setTimeout(() => {
                  this.recordVideoChunk(deviceId, outputFile, retryCount + 1)
                    .then(resolve)
                    .catch(reject);
                }, 1000 * (retryCount + 1)); // Exponential backoff
              } else {
                reject(
                  new Error(
                    `Screen recording failed with code ${code} for device ${deviceId} after ${maxRetries} retries`
                  )
                );
              }
            }
          });

          recordProcess.on("error", (error) => {
            cleanup(); // Always cleanup on error
            console.error(
              `Recording process error for ${deviceId}:`,
              error.message
            );
            reject(error);
          });

          // Set timeout for recording with cleanup - increased timeout
          timeoutId = setTimeout(() => {
            if (recordProcess && !recordProcess.killed) {
              console.log(
                `⏰ Recording timeout for ${deviceId}, killing process...`
              );
              recordProcess.kill("SIGTERM");
              setTimeout(() => {
                if (recordProcess && !recordProcess.killed) {
                  recordProcess.kill("SIGKILL");
                }
              }, 1000);
            }
            cleanup(); // Cleanup on timeout

            // Retry logic for timeouts
            if (retryCount < maxRetries) {
              console.log(
                `🔄 Retrying recording for ${deviceId} (${
                  retryCount + 1
                }/${maxRetries}) after timeout`
              );
              setTimeout(() => {
                this.recordVideoChunk(deviceId, outputFile, retryCount + 1)
                  .then(resolve)
                  .catch(reject);
              }, 1000 * (retryCount + 1)); // Exponential backoff
            } else {
              reject(
                new Error(
                  `Recording timeout for device ${deviceId} after ${maxRetries} retries`
                )
              );
            }
          }, 5000); // Increased timeout to 5 seconds
        })
        .catch((error) => {
          cleanup(); // Cleanup on fs error
          reject(error);
        });
    });
  }

  // Helper method to execute shell commands (if not already present)
  executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `Command failed: ${command}\nError: ${error.message}\nStderr: ${stderr}`
            )
          );
        } else {
          resolve(stdout);
        }
      });
    });
  }

  findFFmpeg() {
    // Common FFmpeg paths
    const possiblePaths = [
      "/usr/local/bin/ffmpeg",
      "/opt/homebrew/bin/ffmpeg",
      "/usr/bin/ffmpeg",
      "ffmpeg", // system PATH
    ];

    for (const ffmpegPath of possiblePaths) {
      try {
        require("child_process").execSync(`${ffmpegPath} -version`, {
          stdio: "ignore",
        });
        console.log(`Found FFmpeg at: ${ffmpegPath}`);
        return ffmpegPath;
      } catch (error) {
        // Continue to next path
      }
    }

    console.warn(
      'FFmpeg not found in common paths, using "ffmpeg" and hoping it\'s in PATH'
    );
    return "ffmpeg";
  }

  // Discover all emulators and cache their mappings
  async refreshEmulatorMappings() {
    console.log("🔄 Refreshing emulator mappings...");

    try {
      const devices = await this.getAllEmulatorDevices();

      this.deviceMappings.clear();

      for (const device of devices) {
        this.deviceMappings.set(device.avdName, device.deviceId);
        console.log(
          `📌 Cached mapping: ${device.avdName} → ${device.deviceId}`
        );
      }

      console.log(`✅ Cached ${devices.length} emulator mappings`);

      // Log all available emulators
      if (devices.length > 0) {
        console.log("📱 Available emulators:");
        devices.forEach((device) => {
          console.log(
            `   • ${device.avdName} (${device.deviceId}) - Port ${device.port}`
          );
        });
      }
    } catch (error) {
      console.error("❌ Failed to refresh emulator mappings:", error.message);
    }
  }

  // Get all emulator devices with their details
  async getAllEmulatorDevices() {
    return new Promise((resolve) => {
      exec(`"${this.adbPath}" devices -l`, (error, stdout) => {
        if (error) {
          console.error("Failed to get devices:", error.message);
          resolve([]);
          return;
        }

        const lines = stdout.split("\n").filter((line) => line.trim());
        const devicePromises = [];

        for (const line of lines) {
          if (line.includes("List of devices attached")) continue;

          const parts = line.split(/\s+/);
          if (
            parts.length >= 2 &&
            parts[1] === "device" &&
            parts[0].startsWith("emulator-")
          ) {
            const deviceId = parts[0];
            const port = deviceId.replace("emulator-", "");

            const devicePromise = this.getAvdName(deviceId)
              .then((avdName) => {
                return {
                  deviceId,
                  port: parseInt(port),
                  avdName: avdName || `Unknown-${port}`,
                  status: "online",
                };
              })
              .catch(() => {
                return {
                  deviceId,
                  port: parseInt(port),
                  avdName: `Unknown-${port}`,
                  status: "online",
                };
              });

            devicePromises.push(devicePromise);
          }
        }

        Promise.all(devicePromises).then((devices) => {
          resolve(devices);
        });
      });
    });
  }

  // Updated checkEmulatorReady with caching
  async checkEmulatorReady(emulatorName) {
    // First check cache
    if (this.deviceMappings.has(emulatorName)) {
      const cachedDeviceId = this.deviceMappings.get(emulatorName);
      console.log(
        `📋 Using cached mapping: ${emulatorName} → ${cachedDeviceId}`
      );

      // Verify the device is still online
      const isOnline = await this.verifyDeviceOnline(cachedDeviceId);
      if (isOnline) {
        return cachedDeviceId;
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

  // Verify a device is still online
  async verifyDeviceOnline(deviceId) {
    return new Promise((resolve) => {
      exec(`"${this.adbPath}" -s ${deviceId} shell echo "test"`, (error) => {
        resolve(!error);
      });
    });
  }

  // Helper method to get AVD name from device
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

  // Helper method to match emulator names
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

  async startScreenStream(socket, emulatorName) {
    try {
      const roomName = `emulator:${emulatorName}`;
      socket.join(roomName); // Make sure socket joins the room

      const viewerCount =
        this.io.sockets.adapter.rooms.get(roomName)?.size || 0;

      console.log(`📺 ${viewerCount} viewers now watching ${emulatorName}`);

      // If this is the first viewer or recording stopped, start recording
      if (!this.activeRecordings.has(emulatorName)) {
        console.log(`🎬 Starting new recording for ${emulatorName}`);
        await this.startRecording(emulatorName);
      } else {
        console.log(`📡 Joined existing recording for ${emulatorName}`);

        // Check if recording actually ended but activeRecordings wasn't cleared
        const recording = this.activeRecordings.get(emulatorName);
        if (recording && !recording.isActive) {
          console.log(`🔄 Restarting stopped recording for ${emulatorName}`);
          this.activeRecordings.delete(emulatorName);
          await this.startRecording(emulatorName);
        }
      }

      return { success: true };
    } catch (error) {
      console.error(
        `❌ Failed to start stream for ${emulatorName}:`,
        error.message
      );
      socket.emit("streamError", {
        error: error.message,
        emulator: emulatorName,
      });
      return { success: false, error: error.message };
    }
  }

  stopScreenStream(socket) {
    // Find which emulator this socket was watching
    const rooms = Array.from(socket.rooms);
    const emulatorRooms = rooms.filter((room) => room.startsWith("emulator:"));

    emulatorRooms.forEach((roomName) => {
      const emulatorName = roomName.replace("emulator:", "");
      const remainingViewers =
        this.io.sockets.adapter.rooms.get(roomName)?.size || 0;

      console.log(
        `👥 ${remainingViewers} viewers remaining for ${emulatorName}`
      );

      // If no more viewers, stop recording
      if (remainingViewers === 0) {
        console.log(`🛑 Stopping recording for ${emulatorName} (no viewers)`);
        this.stopRecording(emulatorName);
      }
    });
  }

  async startRecording(emulatorName) {
    try {
      console.log(`🔍 Starting recording for ${emulatorName}...`);
      const deviceId = await this.checkEmulatorReady(emulatorName);
      console.log(`✅ Device ready: ${deviceId} for ${emulatorName}`);

      this.activeRecordings.set(emulatorName, { deviceId, isActive: true });
      console.log(`📝 Added ${emulatorName} to active recordings`);

      // Start recording loop
      this.recordingLoop(emulatorName, deviceId);
      console.log(`🔄 Started recording loop for ${emulatorName}`);
    } catch (error) {
      console.error(
        `❌ Failed to start recording for ${emulatorName}:`,
        error.message
      );

      // Notify all viewers about the error
      this.io.to(`emulator:${emulatorName}`).emit("streamError", {
        error: error.message,
        emulator: emulatorName,
      });

      throw error; // Re-throw to be caught by startScreenStream
    }
  }

  stopRecording(emulatorName) {
    const recording = this.activeRecordings.get(emulatorName);
    if (recording) {
      console.log(`🛑 Marking recording as inactive for ${emulatorName}`);
      recording.isActive = false;

      // Clean up device locks for this emulator's device
      if (
        recording.deviceId &&
        this.deviceRecordingLocks.has(recording.deviceId)
      ) {
        this.deviceRecordingLocks.delete(recording.deviceId);
        this.deviceLockTimestamps.delete(recording.deviceId);
        console.log(`🧹 Cleaned up locks for device ${recording.deviceId}`);
      }

      this.activeRecordings.delete(emulatorName);
      console.log(`🗑️ Removed ${emulatorName} from active recordings`);
    }
  }

  async recordingLoop(emulatorName, deviceId) {
    console.log(`🎬 Starting recording loop for ${emulatorName} (${deviceId})`);

    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5; // Increased from 3 to 5
    let isRecording = false; // Flag to prevent concurrent recordings

    while (this.activeRecordings.has(emulatorName)) {
      try {
        // Check if there are still viewers first
        const roomName = `emulator:${emulatorName}`;
        const viewerCount =
          this.io.sockets.adapter.rooms.get(roomName)?.size || 0;

        if (viewerCount === 0) {
          console.log(`⚠️ No viewers for ${emulatorName}, stopping recording`);
          break;
        }

        // Skip if already recording to prevent race conditions
        if (isRecording) {
          console.log(
            `⏳ Previous recording still in progress for ${emulatorName}...`
          );
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        // Also check device lock more carefully
        if (this.deviceRecordingLocks.has(deviceId)) {
          const lockTime = this.deviceLockTimestamps.get(deviceId);
          const lockAge = Date.now() - (lockTime || 0);

          if (lockAge > 6000) {
            // 6 seconds
            console.log(
              `🧹 Removing stale lock in recording loop for device ${deviceId} (${lockAge}ms old)`
            );
            this.deviceRecordingLocks.delete(deviceId);
            this.deviceLockTimestamps.delete(deviceId);
          } else {
            console.log(
              `⏳ Device ${deviceId} locked in recording loop, waiting... (${lockAge}ms old)`
            );
            await new Promise((resolve) => setTimeout(resolve, 200));
            continue;
          }
        }

        console.log(`🎥 Recording chunk for ${emulatorName}...`);
        isRecording = true; // Set flag to prevent concurrent recordings

        // Record 1-second chunk
        const videoBuffer = await this.recordVideoChunk(deviceId);
        console.log(
          `✅ Recorded ${videoBuffer.length} bytes for ${emulatorName}`
        );

        // Reset error counter on successful recording
        consecutiveErrors = 0;

        console.log(`👥 ${viewerCount} viewers watching ${emulatorName}`);

        // Broadcast to all viewers in the room
        this.io.to(roomName).emit("videoChunk", {
          type: "mp4",
          data: videoBuffer.toString("base64"), // Convert to base64 for frontend
          emulator: emulatorName,
          timestamp: Date.now(),
          size: videoBuffer.length,
        });

        console.log(
          `📡 Broadcasted chunk for ${emulatorName} to ${viewerCount} viewers`
        );

        isRecording = false; // Clear flag after successful recording

        // Minimal delay between recordings - optimized for better stability
        await new Promise((resolve) => setTimeout(resolve, 100)); // Increased from 50ms to 100ms for stability
      } catch (error) {
        isRecording = false; // Clear flag on error
        consecutiveErrors++;

        // Handle different types of errors differently
        if (
          error.message.includes("busy") ||
          error.message.includes("already recording")
        ) {
          console.log(`⏳ Device busy for ${emulatorName}, will retry...`);
          // Don't count busy errors against consecutive error limit
          consecutiveErrors = Math.max(0, consecutiveErrors - 1);
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }

        console.error(
          `❌ Recording error for ${emulatorName} (${consecutiveErrors}/${maxConsecutiveErrors}):`,
          error.message
        );

        // Only show streamError for serious errors, not device busy errors
        if (
          !error.message.includes("already recording") &&
          !error.message.includes("busy")
        ) {
          this.io.to(`emulator:${emulatorName}`).emit("streamError", {
            error: error.message,
            emulator: emulatorName,
          });
        }

        // If too many consecutive errors, stop recording
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.error(
            `💥 Too many consecutive errors for ${emulatorName}, stopping recording`
          );
          break;
        }

        // Wait shorter time before retrying after error
        await new Promise((resolve) =>
          setTimeout(resolve, 500 + consecutiveErrors * 200)
        ); // Progressive backoff
      }
    }

    // Cleanup on exit
    console.log(`🔚 Recording loop ended for ${emulatorName}`);
    this.stopRecording(emulatorName);
  }

  // Handle socket disconnection
  handleSocketDisconnect(socket) {
    console.log(`🔌 Socket ${socket.id} disconnected`);

    // Find which emulator rooms this socket was in
    const rooms = Array.from(socket.rooms);
    const emulatorRooms = rooms.filter((room) => room.startsWith("emulator:"));

    emulatorRooms.forEach((roomName) => {
      const emulatorName = roomName.replace("emulator:", "");

      // Check remaining viewers after this socket disconnects
      setTimeout(() => {
        const remainingViewers =
          this.io.sockets.adapter.rooms.get(roomName)?.size || 0;

        console.log(
          `👥 ${remainingViewers} viewers remaining for ${emulatorName} after disconnect`
        );

        // If no more viewers, stop recording
        if (remainingViewers === 0) {
          console.log(
            `🛑 Stopping recording for ${emulatorName} (no viewers after disconnect)`
          );
          this.stopRecording(emulatorName);
        }
      }, 100); // Small delay to ensure room cleanup is complete
    });
  }

  // Get current streaming status
  getStreamingStatus() {
    const streams = [];

    for (const [emulatorName] of this.activeRecordings) {
      const roomName = `emulator:${emulatorName}`;
      const viewerCount =
        this.io.sockets.adapter.rooms.get(roomName)?.size || 0;

      streams.push({
        emulatorName,
        viewerCount,
        isRecording: true,
      });
    }

    return {
      totalActiveStreams: this.activeRecordings.size,
      streams,
    };
  }
  // Start periodic cleanup of stuck device locks
  startLockCleanup() {
    setInterval(() => {
      const now = Date.now();
      const maxLockDuration = 10000; // Reduced to 10 seconds max lock time

      for (const [deviceId, lockTime] of this.deviceLockTimestamps) {
        if (now - lockTime > maxLockDuration) {
          console.log(
            `🧹 Cleaning up stuck lock for device ${deviceId} (${
              now - lockTime
            }ms old)`
          );
          this.deviceRecordingLocks.delete(deviceId);
          this.deviceLockTimestamps.delete(deviceId);
        }
      }
    }, 5000); // Check every 5 seconds (more frequent)
  }

  // Cleanup method for server shutdown
  cleanup() {
    console.log("🧹 Cleaning up WebRTC service...");

    // Stop all active recordings
    for (const [emulatorName, recording] of this.activeRecordings) {
      console.log(`🛑 Stopping recording for ${emulatorName}`);
      recording.isActive = false;
    }

    this.activeRecordings.clear();
    this.deviceRecordingLocks.clear(); // Clear recording locks
    this.deviceLockTimestamps.clear(); // Clear lock timestamps
    console.log("✅ WebRTC service cleanup complete");
  }
}

module.exports = WebRTCService;
