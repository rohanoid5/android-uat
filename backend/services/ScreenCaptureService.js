const { exec, spawn } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

class ScreenCaptureService {
  constructor(io) {
    this.io = io;
    this.captureProcesses = new Map();
    this.androidHome =
      process.env.ANDROID_HOME ||
      process.env.ANDROID_SDK_ROOT ||
      `${require("os").homedir()}/Android/Sdk`;
    this.adbPath =
      process.env.ADB_PATH || `${this.androidHome}/platform-tools/adb`;
    this.screenshotDir = path.join(__dirname, "../temp/screenshots");
    this.activeProcesses = 0;
    this.maxConcurrentProcesses = 6; // Increased from 3 to 6

    // Ensure screenshot directory exists
    fs.ensureDirSync(this.screenshotDir);
  }

  startCapture(emulatorName, socket) {
    // Ensure emulatorName is a string to prevent [object Object] issues
    const emulatorNameStr =
      typeof emulatorName === "string"
        ? emulatorName
        : JSON.stringify(emulatorName);

    // Always stop any existing capture for this socket first
    if (this.captureProcesses.has(socket.id)) {
      console.log(
        `Stopping existing capture for socket ${socket.id} before starting new one`
      );
      this.stopCapture(socket);
    }

    console.log(
      `Starting screen capture for ${emulatorNameStr} on socket ${socket.id}`
    );

    // Check if emulator is ready before starting capture
    this.checkEmulatorReady(emulatorNameStr)
      .then(() => {
        const captureInterval = setInterval(async () => {
          // Prevent too many concurrent processes
          if (this.activeProcesses >= this.maxConcurrentProcesses) {
            console.log(
              `Skipping screenshot - too many active processes (${this.activeProcesses}/${this.maxConcurrentProcesses})`
            );
            return;
          }

          try {
            const screenshot = await this.takeScreenshot(emulatorNameStr);
            socket.emit("screen-capture", screenshot);
          } catch (error) {
            console.error("Screenshot capture error:", error);

            // If no emulator devices found, stop the capture automatically
            if (error.message.includes("No online emulator devices found")) {
              console.log(
                `No emulator found for ${emulatorNameStr}, stopping capture for socket ${socket.id}`
              );

              // Clear the interval immediately to stop the loop
              clearInterval(captureInterval);
              this.captureProcesses.delete(socket.id);

              // Reset active processes counter if no more captures are running
              if (this.captureProcesses.size === 0) {
                console.log(
                  `Resetting active processes counter from ${this.activeProcesses} to 0`
                );
                this.activeProcesses = 0;
              }

              socket.emit("error", {
                message:
                  "Emulator is no longer running. Screen capture stopped.",
                type: "emulator_disconnected",
              });
              return;
            }

            // Only emit other errors occasionally to avoid spam
            if (Math.random() < 0.1) {
              socket.emit("error", { message: "Screen capture failed" });
            }
          }
        }, 1500); // Increased interval to 1.5 seconds

        this.captureProcesses.set(socket.id, {
          emulatorName: emulatorNameStr,
          interval: captureInterval,
          startTime: new Date(),
        });
      })
      .catch((error) => {
        console.error("Emulator not ready:", error);
        socket.emit("error", {
          message: "Emulator not ready. Please start an emulator first.",
        });
      });
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

  // Check if a specific emulator is still running
  async isEmulatorRunning(emulatorName) {
    try {
      await this.checkEmulatorReady(emulatorName);
      return true;
    } catch (error) {
      return false;
    }
  }

  stopCapture(socket) {
    const captureInfo = this.captureProcesses.get(socket.id);

    if (captureInfo) {
      console.log(
        `Stopping screen capture for socket ${socket.id} (emulator: ${captureInfo.emulatorName})`
      );
      clearInterval(captureInfo.interval);
      this.captureProcesses.delete(socket.id);

      // Reset active processes counter if no more captures are running
      if (this.captureProcesses.size === 0) {
        console.log(
          `Resetting active processes counter from ${this.activeProcesses} to 0`
        );
        this.activeProcesses = 0;
      }
    } else {
      console.log(`No active capture found for socket ${socket.id}`);
    }
  }

  // Stop all active captures (useful when all emulators are stopped)
  stopAllCaptures() {
    console.log(
      `Stopping all ${this.captureProcesses.size} active screen captures`
    );
    this.captureProcesses.forEach((captureInfo, socketId) => {
      clearInterval(captureInfo.interval);
      console.log(
        `Stopped capture for socket ${socketId} (emulator: ${captureInfo.emulatorName})`
      );
    });
    this.captureProcesses.clear();
    this.activeProcesses = 0;
    console.log("All screen captures stopped and counters reset");
  }

  async takeScreenshot(emulatorName) {
    return new Promise((resolve, reject) => {
      // Track active processes
      this.activeProcesses++;

      // Ensure we always decrement the counter
      const decrementCounter = () => {
        this.activeProcesses = Math.max(0, this.activeProcesses - 1);
      };

      const timestamp = Date.now();
      const screenshotPath = path.join(
        this.screenshotDir,
        `${emulatorName}_${timestamp}.png`
      );

      // First, check if any devices are connected
      exec(
        `"${this.adbPath}" devices`,
        { timeout: 5000 },
        (deviceError, deviceStdout) => {
          if (deviceError) {
            decrementCounter();
            reject(
              new Error(`ADB devices check failed: ${deviceError.message}`)
            );
            return;
          }

          console.log(`ADB devices output: ${deviceStdout}`);

          const devices = deviceStdout
            .split("\n")
            .filter(
              (line) => line.includes("emulator") && line.includes("device")
            )
            .filter((line) => !line.includes("offline"));

          if (devices.length === 0) {
            decrementCounter();
            reject(
              new Error(
                `No online emulator devices found. ADB output: ${deviceStdout}`
              )
            );
            return;
          }

          // Use the first available emulator device
          const deviceId = devices[0].split("\t")[0];
          const command = `"${this.adbPath}" -s ${deviceId} exec-out screencap -p > "${screenshotPath}"`;

          exec(command, { timeout: 10000 }, async (error, stdout, stderr) => {
            decrementCounter();

            if (error) {
              reject(
                new Error(
                  `Screenshot failed: ${error.message}. ADB stderr: ${stderr}`
                )
              );
              return;
            }

            try {
              // Read the screenshot file and convert to base64
              const imageBuffer = await fs.readFile(screenshotPath);
              const base64Image = imageBuffer.toString("base64");

              // Clean up the temporary file
              await fs.unlink(screenshotPath);

              resolve(base64Image);
            } catch (fileError) {
              reject(
                new Error(`Failed to process screenshot: ${fileError.message}`)
              );
            }
          });
        }
      );
    });
  }

  async getEmulatorInfo(emulatorName) {
    return new Promise((resolve, reject) => {
      const commands = [
        `"${this.adbPath}" shell getprop ro.product.model`,
        `"${this.adbPath}" shell getprop ro.build.version.release`,
        `"${this.adbPath}" shell wm size`,
      ];

      Promise.all(
        commands.map(
          (cmd) =>
            new Promise((res, rej) => {
              exec(cmd, (error, stdout) => {
                if (error) rej(error);
                else res(stdout.trim());
              });
            })
        )
      )
        .then((results) => {
          const [model, version, size] = results;
          const dimensions = size.match(/(\d+)x(\d+)/);

          resolve({
            model,
            androidVersion: version,
            screenSize: dimensions
              ? {
                  width: parseInt(dimensions[1]),
                  height: parseInt(dimensions[2]),
                }
              : null,
          });
        })
        .catch(reject);
    });
  }

  getActiveCaptureCount() {
    return this.captureProcesses.size;
  }

  getCaptureInfo() {
    const info = [];
    this.captureProcesses.forEach((captureData, socketId) => {
      info.push({
        socketId,
        emulatorName: captureData.emulatorName,
        startTime: captureData.startTime,
        duration: Date.now() - captureData.startTime.getTime(),
      });
    });
    return info;
  }

  // Debug method to check process counter status
  getProcessStatus() {
    return {
      activeProcesses: this.activeProcesses,
      maxConcurrentProcesses: this.maxConcurrentProcesses,
      activeCaptureCount: this.captureProcesses.size,
      captureSocketIds: Array.from(this.captureProcesses.keys()),
    };
  }
}

module.exports = ScreenCaptureService;
