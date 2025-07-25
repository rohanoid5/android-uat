const { exec, spawn } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

class ScreenCaptureService {
  constructor(io) {
    this.io = io;
    this.captureProcesses = new Map();
    this.adbPath = process.env.ADB_PATH || "adb";
    this.screenshotDir = path.join(__dirname, "../temp/screenshots");
    this.activeProcesses = 0;
    this.maxConcurrentProcesses = 3;

    // Ensure screenshot directory exists
    fs.ensureDirSync(this.screenshotDir);
  }

  startCapture(emulatorName, socket) {
    if (this.captureProcesses.has(socket.id)) {
      this.stopCapture(socket);
    }

    console.log(
      `Starting screen capture for ${emulatorName} on socket ${socket.id}`
    );

    // Check if emulator is ready before starting capture
    this.checkEmulatorReady(emulatorName)
      .then(() => {
        const captureInterval = setInterval(async () => {
          // Prevent too many concurrent processes
          if (this.activeProcesses >= this.maxConcurrentProcesses) {
            console.log("Skipping screenshot - too many active processes");
            return;
          }

          try {
            const screenshot = await this.takeScreenshot(emulatorName);
            socket.emit("screen-capture", screenshot);
          } catch (error) {
            console.error("Screenshot capture error:", error);
            // Only emit error occasionally to avoid spam
            if (Math.random() < 0.1) {
              socket.emit("error", { message: "Screen capture failed" });
            }
          }
        }, 1500); // Increased interval to 1.5 seconds

        this.captureProcesses.set(socket.id, {
          emulatorName,
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
      exec(`${this.adbPath} devices`, (error, stdout) => {
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

        resolve(devices[0].split("\t")[0]);
      });
    });
  }

  stopCapture(socket) {
    const captureInfo = this.captureProcesses.get(socket.id);

    if (captureInfo) {
      clearInterval(captureInfo.interval);
      this.captureProcesses.delete(socket.id);
      console.log(`Stopped screen capture for socket ${socket.id}`);

      // Reset active processes counter if needed
      if (this.captureProcesses.size === 0) {
        this.activeProcesses = 0;
      }
    }
  }

  async takeScreenshot(emulatorName) {
    return new Promise((resolve, reject) => {
      // Track active processes
      this.activeProcesses++;

      const timestamp = Date.now();
      const screenshotPath = path.join(
        this.screenshotDir,
        `${emulatorName}_${timestamp}.png`
      );

      // First, check if any devices are connected
      exec(
        `${this.adbPath} devices`,
        { timeout: 5000 },
        (deviceError, deviceStdout) => {
          if (deviceError) {
            this.activeProcesses--;
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
            this.activeProcesses--;
            reject(
              new Error(
                `No online emulator devices found. ADB output: ${deviceStdout}`
              )
            );
            return;
          }

          // Use the first available emulator device
          const deviceId = devices[0].split("\t")[0];
          const command = `${this.adbPath} -s ${deviceId} exec-out screencap -p > "${screenshotPath}"`;

          exec(command, { timeout: 10000 }, async (error, stdout, stderr) => {
            this.activeProcesses--;

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
        `${this.adbPath} shell getprop ro.product.model`,
        `${this.adbPath} shell getprop ro.build.version.release`,
        `${this.adbPath} shell wm size`,
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
}

module.exports = ScreenCaptureService;
