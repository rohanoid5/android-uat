const { exec, spawn } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

class EmulatorController {
  constructor(io = null) {
    this.runningEmulators = new Map();
    this.adbPath = process.env.ADB_PATH || "adb";
    this.emulatorPath = process.env.EMULATOR_PATH || "emulator";
    this.io = io;
  }

  async getAvailableEmulators() {
    return new Promise((resolve, reject) => {
      exec(`${this.emulatorPath} -list-avds`, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to get emulators: ${error.message}`));
          return;
        }

        const emulators = stdout
          .trim()
          .split("\n")
          .filter((line) => line.trim())
          .map((name) => ({
            id: name.trim(),
            name: name.trim(),
            status: this.runningEmulators.has(name.trim())
              ? "running"
              : "stopped",
          }));

        resolve(emulators);
      });
    });
  }

  async startEmulator(emulatorName) {
    return new Promise((resolve, reject) => {
      if (this.runningEmulators.has(emulatorName)) {
        resolve({ message: "Emulator already running", status: "running" });
        return;
      }

      console.log(`Starting emulator: ${emulatorName}`);

      const emulatorProcess = spawn(this.emulatorPath, [
        "-avd",
        emulatorName,
        "-no-audio",
        "-no-snapshot-save",
        "-no-snapshot-load",
        "-camera-back",
        "webcam0",
        "-camera-front",
        "webcam0",
        "-read-only",
        "-no-metrics",
      ]);

      this.runningEmulators.set(emulatorName, {
        process: emulatorProcess,
        startTime: new Date(),
        status: "starting",
      });

      emulatorProcess.stdout.on("data", (data) => {
        console.log(`Emulator ${emulatorName} stdout: ${data}`);
      });

      emulatorProcess.stderr.on("data", (data) => {
        console.log(`Emulator ${emulatorName} stderr: ${data}`);
      });

      emulatorProcess.on("close", (code) => {
        console.log(`Emulator ${emulatorName} exited with code ${code}`);
        this.runningEmulators.delete(emulatorName);
      });

      // Wait for emulator to boot
      setTimeout(async () => {
        try {
          await this.waitForEmulatorBoot(emulatorName);
          const emulatorInfo = this.runningEmulators.get(emulatorName);
          if (emulatorInfo) {
            emulatorInfo.status = "running";
          }

          // Notify frontend via WebSocket
          if (this.io) {
            this.io.emit("emulator-status-changed", {
              id: emulatorName,
              name: emulatorName,
              status: "running",
            });
          }

          resolve({
            message: `Emulator ${emulatorName} started successfully`,
            status: "running",
          });
        } catch (error) {
          reject(error);
        }
      }, 5000);
    });
  }

  async stopEmulator(emulatorName) {
    return new Promise((resolve, reject) => {
      const emulatorInfo = this.runningEmulators.get(emulatorName);

      if (!emulatorInfo) {
        resolve({ message: "Emulator not running", status: "stopped" });
        return;
      }

      console.log(`Stopping emulator: ${emulatorName}`);

      // Try graceful shutdown first
      exec(`${this.adbPath} -s emulator-5554 emu kill`, (error) => {
        if (error) {
          // Force kill if graceful shutdown fails
          emulatorInfo.process.kill("SIGTERM");
        }

        this.runningEmulators.delete(emulatorName);
        resolve({
          message: `Emulator ${emulatorName} stopped`,
          status: "stopped",
        });
      });
    });
  }

  async getEmulatorStatus(emulatorName) {
    const emulatorInfo = this.runningEmulators.get(emulatorName);

    if (!emulatorInfo) {
      return { name: emulatorName, status: "stopped" };
    }

    return {
      name: emulatorName,
      status: emulatorInfo.status,
      startTime: emulatorInfo.startTime,
      uptime: Date.now() - emulatorInfo.startTime.getTime(),
    };
  }

  async sendInput(emulatorName, action, coordinates, text) {
    return new Promise((resolve, reject) => {
      if (!this.runningEmulators.has(emulatorName)) {
        reject(new Error("Emulator not running"));
        return;
      }

      let command;

      switch (action) {
        case "tap":
          command = `${this.adbPath} shell input tap ${coordinates.x} ${coordinates.y}`;
          break;
        case "swipe":
          command = `${this.adbPath} shell input swipe ${coordinates.startX} ${coordinates.startY} ${coordinates.endX} ${coordinates.endY}`;
          break;
        case "text":
          command = `${this.adbPath} shell input text "${text}"`;
          break;
        case "keyevent":
          command = `${this.adbPath} shell input keyevent ${text}`;
          break;
        default:
          reject(new Error(`Unknown action: ${action}`));
          return;
      }

      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Input failed: ${error.message}`));
          return;
        }
        resolve({ message: "Input sent successfully" });
      });
    });
  }

  async installApp(emulatorName, apkPath) {
    return new Promise((resolve, reject) => {
      if (!this.runningEmulators.has(emulatorName)) {
        reject(new Error("Emulator not running"));
        return;
      }

      if (!fs.existsSync(apkPath)) {
        reject(new Error("APK file not found"));
        return;
      }

      const command = `${this.adbPath} install "${apkPath}"`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`App installation failed: ${error.message}`));
          return;
        }

        if (stdout.includes("Success")) {
          resolve({ message: "App installed successfully" });
        } else {
          reject(new Error(`Installation failed: ${stdout}`));
        }
      });
    });
  }

  async getInstalledApps(emulatorName) {
    return new Promise((resolve, reject) => {
      if (!this.runningEmulators.has(emulatorName)) {
        reject(new Error("Emulator not running"));
        return;
      }

      const command = `${this.adbPath} shell pm list packages -3`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to get apps: ${error.message}`));
          return;
        }

        const apps = stdout
          .trim()
          .split("\n")
          .filter((line) => line.startsWith("package:"))
          .map((line) => line.replace("package:", ""));

        resolve(apps);
      });
    });
  }

  async launchApp(emulatorName, packageName) {
    return new Promise((resolve, reject) => {
      if (!this.runningEmulators.has(emulatorName)) {
        reject(new Error("Emulator not running"));
        return;
      }

      const command = `${this.adbPath} shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to launch app: ${error.message}`));
          return;
        }
        resolve({ message: `App ${packageName} launched successfully` });
      });
    });
  }

  async waitForEmulatorBoot(emulatorName) {
    return new Promise((resolve, reject) => {
      const maxAttempts = 30;
      let attempts = 0;

      const checkBoot = () => {
        exec(
          `${this.adbPath} shell getprop sys.boot_completed`,
          (error, stdout) => {
            attempts++;

            if (stdout.trim() === "1") {
              resolve();
            } else if (attempts >= maxAttempts) {
              reject(new Error("Emulator boot timeout"));
            } else {
              setTimeout(checkBoot, 2000);
            }
          }
        );
      };

      checkBoot();
    });
  }

  async createEmulator(name, options = {}) {
    const { apiLevel = 34, arch = "x86_64", device = "pixel_5" } = options;

    return new Promise((resolve, reject) => {
      // First check if emulator already exists
      exec(`${this.emulatorPath} -list-avds`, (error, stdout) => {
        if (error) {
          reject(
            new Error(`Failed to check existing emulators: ${error.message}`)
          );
          return;
        }

        const existingEmulators = stdout
          .trim()
          .split("\n")
          .filter((line) => line.trim());
        if (existingEmulators.includes(name)) {
          reject(new Error(`Emulator with name '${name}' already exists`));
          return;
        }

        // Create the emulator
        const systemImage = `system-images;android-${apiLevel};google_apis;${arch}`;
        const createCommand = `avdmanager create avd -n "${name}" -k "${systemImage}" -d "${device}" --force`;

        console.log(`Creating emulator: ${createCommand}`);

        exec(createCommand, (createError, createStdout, createStderr) => {
          if (createError) {
            reject(
              new Error(
                `Failed to create emulator: ${createError.message}. Stderr: ${createStderr}`
              )
            );
            return;
          }

          console.log(`Emulator created successfully: ${createStdout}`);
          resolve({
            message: `Emulator '${name}' created successfully`,
            name: name,
            apiLevel: apiLevel,
            arch: arch,
            device: device,
          });
        });
      });
    });
  }
}

module.exports = EmulatorController;
