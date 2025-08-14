const { exec, spawn } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

class EmulatorController {
  constructor(io = null, webRTCService = null) {
    this.runningEmulators = new Map();
    this.webRTCService = webRTCService; // Reference to WebRTCService for device mappings
    this.androidHome =
      process.env.ANDROID_HOME ||
      process.env.ANDROID_SDK_ROOT ||
      `${require("os").homedir()}/Android/Sdk`;
    this.adbPath =
      process.env.ADB_PATH || `${this.androidHome}/platform-tools/adb`;
    this.emulatorPath =
      process.env.EMULATOR_PATH || `${this.androidHome}/emulator/emulator`;
    this.avdManagerPath =
      process.env.AVDMANAGER_PATH ||
      `${this.androidHome}/cmdline-tools/latest/bin/avdmanager`;

    // Set up apps directory for pre-installation
    this.appsDir = path.join(__dirname, "../../apps");

    // Set correct JAVA_HOME based on environment
    // Only override JAVA_HOME if we're not in a Docker container and on macOS
    if (!process.env.DOCKER_CONTAINER && process.platform === "darwin") {
      process.env.JAVA_HOME =
        "/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home";
    }
    // In Docker, use the environment variable set in Dockerfile
    if (!process.env.JAVA_HOME) {
      process.env.JAVA_HOME = "/usr/lib/jvm/java-17-openjdk-amd64";
    }

    this.io = io;
  }

  getDefaultArchitecture() {
    const os = require("os");
    const arch = os.arch();
    const platform = os.platform();

    // For macOS M1/M2 (Apple Silicon) - always use ARM64
    if (platform === "darwin" && arch === "arm64") {
      return "arm64-v8a";
    }

    // For Docker containers and other x86_64 systems, use x86_64
    return "x86_64";
  }

  getEmulatorArgs(emulatorName) {
    const os = require("os");
    const arch = os.arch();
    const platform = os.platform();

    let args = [
      "-avd",
      emulatorName,
      "-no-audio",
      "-no-snapshot-save",
      "-no-snapshot-load",
      "-camera-back",
      "none",
      "-camera-front",
      "none",
      "-no-metrics",
      "-verbose",
    ];

    // Docker container optimizations - force software emulation with GUI
    if (process.env.DOCKER_CONTAINER) {
      args.push(
        "-no-accel", // Explicitly disable hardware acceleration
        "-gpu",
        "swiftshader_indirect", // Use software GPU rendering
        "-memory",
        "6144", // Increase memory for better performance
        "-cores",
        "4",
        "-no-snapshot-load",
        "-no-snapshot-save",
        "-no-boot-anim", // Skip boot animation for faster startup
        "-netdelay",
        "none", // No network delay
        "-netspeed",
        "full", // Full network speed
        "-delay-adb", // Delay ADB to allow proper startup
        "-skin",
        "1080x1920", // Set a proper screen size
        "-feature",
        "-Vulkan", // Disable Vulkan to avoid compatibility issues
        "-writable-system", // Allow system modifications
        "-selinux",
        "permissive", // Set permissive SELinux for Docker compatibility
        "-qemu",
        "-enable-kvm", // Enable KVM if available for better performance
        "-qemu",
        "-cpu",
        "host" // Use host CPU features
      );
    }
    // M1 Mac optimizations
    else if (platform === "darwin" && arch === "arm64") {
      args.push("-gpu", "auto", "-memory", "2048", "-cores", "4");
    } else {
      // Intel Mac and other x86_64 optimizations
      args.push("-gpu", "auto", "-memory", "2048", "-accel", "auto");
    }

    return args;
  }

  async getAvailableEmulators() {
    return new Promise((resolve, reject) => {
      exec(`"${this.emulatorPath}" -list-avds`, (error, stdout, stderr) => {
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

      // Get optimal emulator arguments based on architecture
      const emulatorArgs = this.getEmulatorArgs(emulatorName);

      const emulatorProcess = spawn(this.emulatorPath, emulatorArgs);

      this.runningEmulators.set(emulatorName, {
        process: emulatorProcess,
        startTime: new Date(),
        status: "starting",
        intentionallyStopped: false, // Track if this was intentionally stopped
      });

      emulatorProcess.stdout.on("data", (data) => {
        console.log(`Emulator ${emulatorName} stdout: ${data}`);
      });

      emulatorProcess.stderr.on("data", (data) => {
        console.log(`Emulator ${emulatorName} stderr: ${data}`);
      });

      emulatorProcess.on("close", (code) => {
        console.log(`Emulator ${emulatorName} exited with code ${code}`);
        const emulatorInfo = this.runningEmulators.get(emulatorName);

        if (emulatorInfo) {
          console.log(
            `Emulator ${emulatorName} exit - intentionallyStopped: ${emulatorInfo.intentionallyStopped}, status: ${emulatorInfo.status}`
          );

          // Only clean up if we haven't already done so in stopEmulator method
          this.runningEmulators.delete(emulatorName);

          // Only send status notification if this wasn't an intentional stop (already handled in stopEmulator)
          // and it was a running emulator that crashed/exited unexpectedly
          if (
            !emulatorInfo.intentionallyStopped &&
            emulatorInfo.status === "running"
          ) {
            if (this.io) {
              this.io.emit("emulator-status-changed", {
                id: emulatorName,
                name: emulatorName,
                status: "stopped",
              });
              console.log(
                `Sent "stopped" status for ${emulatorName} after unexpected exit`
              );
            }
          } else if (emulatorInfo.intentionallyStopped) {
            console.log(
              `Emulator ${emulatorName} was intentionally stopped, status already sent`
            );
          } else {
            console.log(
              `Emulator ${emulatorName} exited during startup, not sending stopped status`
            );
          }
        } else {
          console.log(`Emulator ${emulatorName} exit - already cleaned up`);
        }
      });

      // Wait for emulator to boot
      setTimeout(
        async () => {
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

            // Preinstall APKs only if this is the first time starting this emulator
            console.log(
              `Emulator ${emulatorName} is ready, checking installation status...`
            );

            if (this.shouldInstallApps(emulatorName)) {
              console.log(
                `First time starting ${emulatorName}, performing preinstallation...`
              );
              const preinstallResult = await this.preinstallApks(emulatorName);

              // Store the installation status in preferences
              this.updateInstallationStatus(emulatorName, preinstallResult);

              // Optional: Launch the first preinstalled app automatically
              if (preinstallResult.installed.length > 0) {
                console.log("Attempting to launch preinstalled app...");
                await this.launchPreinstalledApp(emulatorName);
              }

              resolve({
                message: `Emulator ${emulatorName} started successfully`,
                status: "running",
                preinstalled: preinstallResult,
              });
            } else {
              console.log(
                `${emulatorName} apps were already installed, skipping preinstallation`
              );

              // Still try to launch the preferred app if configured
              const emulatorPrefs = this.getEmulatorPreferences(emulatorName);
              if (emulatorPrefs?.preinstallApp) {
                console.log("Attempting to launch preinstalled app...");
                await this.launchPreinstalledApp(emulatorName);
              }

              resolve({
                message: `Emulator ${emulatorName} started successfully`,
                status: "running",
                preinstalled: {
                  installed: [],
                  failed: [],
                  skipped: this.getInstalledAppsList(emulatorName),
                  note: "Apps already installed on previous start",
                },
              });
            }
          } catch (error) {
            reject(error);
          }
        },
        process.env.DOCKER_CONTAINER ? 15000 : 5000
      ); // Longer initial wait for Docker
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

      // Mark as intentionally stopped
      emulatorInfo.intentionallyStopped = true;
      console.log(`Marked ${emulatorName} as intentionally stopped`);

      // Emit stopping status first
      if (this.io) {
        this.io.emit("emulator-status-changed", {
          id: emulatorName,
          name: emulatorName,
          status: "stopping",
        });
        console.log(`Sent "stopping" status for ${emulatorName}`);
      }

      // Get list of running devices to find the correct emulator
      exec(`${this.adbPath} devices`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error getting devices: ${error.message}`);
          // Mark as intentionally stopped and fallback to force kill the process
          emulatorInfo.intentionallyStopped = true;
          emulatorInfo.process.kill("SIGTERM");
          this.runningEmulators.delete(emulatorName);

          if (this.io) {
            this.io.emit("emulator-status-changed", {
              id: emulatorName,
              name: emulatorName,
              status: "stopped",
            });
          }

          resolve({
            message: `Emulator ${emulatorName} stopped (force killed)`,
            status: "stopped",
          });
          return;
        }

        // Parse devices output to find emulator
        const devices = stdout
          .split("\n")
          .filter(
            (line) => line.includes("emulator-") && line.includes("device")
          )
          .map((line) => line.split("\t")[0]);

        if (devices.length > 0) {
          // Try graceful shutdown using the first found emulator device
          const deviceId = devices[0];
          console.log(`Attempting graceful shutdown of ${deviceId}`);

          exec(`${this.adbPath} -s ${deviceId} emu kill`, (killError) => {
            if (killError) {
              console.log(
                `Graceful shutdown failed, force killing process: ${killError.message}`
              );
              // Force kill if graceful shutdown fails
              emulatorInfo.process.kill("SIGTERM");
            }

            // Clean up immediately and send stopped status
            this.runningEmulators.delete(emulatorName);
            console.log(
              `Cleaned up emulator ${emulatorName} from running list`
            );

            // Notify frontend via WebSocket about status change
            if (this.io) {
              this.io.emit("emulator-status-changed", {
                id: emulatorName,
                name: emulatorName,
                status: "stopped",
              });
              console.log(`Sent "stopped" status for ${emulatorName}`);
            }

            resolve({
              message: `Emulator ${emulatorName} stopped`,
              status: "stopped",
            });
          });
        } else {
          // No devices found, just kill the process
          console.log("No emulator devices found, force killing process");
          emulatorInfo.process.kill("SIGTERM");

          // Clean up immediately and send stopped status
          this.runningEmulators.delete(emulatorName);
          console.log(`Cleaned up emulator ${emulatorName} from running list`);

          if (this.io) {
            this.io.emit("emulator-status-changed", {
              id: emulatorName,
              name: emulatorName,
              status: "stopped",
            });
            console.log(`Sent "stopped" status for ${emulatorName}`);
          }

          resolve({
            message: `Emulator ${emulatorName} stopped`,
            status: "stopped",
          });
        }
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
    return new Promise(async (resolve, reject) => {
      try {
        // First, try to get device ID from WebRTCService mappings
        let deviceId = null;

        if (
          this.webRTCService &&
          this.webRTCService.deviceMappings.has(emulatorName)
        ) {
          deviceId = this.webRTCService.deviceMappings.get(emulatorName);
          console.log(`📋 Using WebRTC mapping: ${emulatorName} → ${deviceId}`);
        }

        // Fallback: try to get device ID from running emulators
        if (!deviceId && this.runningEmulators.has(emulatorName)) {
          const emulatorInfo = this.runningEmulators.get(emulatorName);
          deviceId = emulatorInfo.deviceId;
          console.log(`📋 Using emulator info: ${emulatorName} → ${deviceId}`);
        }

        // Last resort: try to find it via ADB
        if (!deviceId) {
          console.log(
            `🔍 Searching for device ID for emulator: ${emulatorName}`
          );
          deviceId = await this.findDeviceIdForEmulator(emulatorName);
        }

        if (!deviceId) {
          reject(
            new Error(
              `Cannot find device ID for emulator: ${emulatorName}. Available devices: ${
                this.webRTCService
                  ? Array.from(this.webRTCService.deviceMappings.keys()).join(
                      ", "
                    )
                  : "none"
              }`
            )
          );
          return;
        }

        let args = ["-s", deviceId]; // Specify the target device

        switch (action) {
          case "tap":
            console.log(
              `🔍 Sending tap to device ${deviceId} (${emulatorName}): x=${coordinates.x}, y=${coordinates.y}`
            );
            args.push(
              "shell",
              "input",
              "tap",
              coordinates.x.toString(),
              coordinates.y.toString()
            );
            break;
          case "swipe":
            console.log(
              `🔍 Sending swipe to device ${deviceId} (${emulatorName}): from (${coordinates.startX}, ${coordinates.startY}) to (${coordinates.endX}, ${coordinates.endY})`
            );
            args.push(
              "shell",
              "input",
              "swipe",
              coordinates.startX.toString(),
              coordinates.startY.toString(),
              coordinates.endX.toString(),
              coordinates.endY.toString()
            );
            break;
          case "text":
            console.log(
              `🔍 Sending text to device ${deviceId} (${emulatorName}): "${text}"`
            );
            args.push("shell", "input", "text", `"${text}"`);
            break;
          case "keyevent":
            console.log(
              `🔍 Sending keyevent to device ${deviceId} (${emulatorName}): ${text}`
            );
            args.push("shell", "input", "keyevent", text.toString());
            break;
          default:
            reject(new Error(`Unknown action: ${action}`));
            return;
        }

        // Use spawn for faster execution with device targeting
        const inputProcess = spawn(this.adbPath, args);

        inputProcess.on("close", (code) => {
          if (code === 0) {
            resolve({
              message: "Input sent successfully",
              deviceId,
              emulator: emulatorName,
            });
          } else {
            reject(new Error(`Input failed with code: ${code}`));
          }
        });

        inputProcess.on("error", (error) => {
          reject(new Error(`Input failed: ${error.message}`));
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Helper method to find device ID for an emulator name
  async findDeviceIdForEmulator(emulatorName) {
    return new Promise((resolve) => {
      exec(`"${this.adbPath}" devices -l`, (error, stdout) => {
        if (error) {
          console.error("Failed to get devices:", error.message);
          resolve(null);
          return;
        }

        const lines = stdout.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          if (line.includes("List of devices attached")) continue;

          const parts = line.split(/\s+/);
          if (
            parts.length >= 2 &&
            parts[1] === "device" &&
            parts[0].startsWith("emulator-")
          ) {
            const deviceId = parts[0];

            // Try to get AVD name for this device
            exec(
              `"${this.adbPath}" -s ${deviceId} shell getprop ro.kernel.qemu.avd_name`,
              (error, stdout) => {
                if (!error && stdout.trim()) {
                  const avdName = stdout.trim();
                  if (this.isEmulatorNameMatch(emulatorName, avdName)) {
                    resolve(deviceId);
                    return;
                  }
                }

                // Try alternative property
                exec(
                  `"${this.adbPath}" -s ${deviceId} shell getprop ro.boot.qemu.avd_name`,
                  (error2, stdout2) => {
                    if (!error2 && stdout2.trim()) {
                      const avdName = stdout2.trim();
                      if (this.isEmulatorNameMatch(emulatorName, avdName)) {
                        resolve(deviceId);
                        return;
                      }
                    }

                    // Try device model as fallback
                    exec(
                      `"${this.adbPath}" -s ${deviceId} shell getprop ro.product.model`,
                      (error3, stdout3) => {
                        if (!error3 && stdout3.trim()) {
                          const modelName = stdout3.trim();
                          if (
                            this.isEmulatorNameMatch(emulatorName, modelName)
                          ) {
                            resolve(deviceId);
                            return;
                          }
                        }
                      }
                    );
                  }
                );
              }
            );
          }
        }

        // If no match found, resolve with null
        setTimeout(() => resolve(null), 2000); // Give it 2 seconds to find a match
      });
    });
  }

  // Helper method to match emulator names (similar to WebRTCService)
  isEmulatorNameMatch(requestedName, avdName) {
    if (!requestedName || !avdName) return false;

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

  async getDeviceResolution(emulatorName) {
    return new Promise((resolve, reject) => {
      if (!this.runningEmulators.has(emulatorName)) {
        reject(new Error("Emulator not running"));
        return;
      }

      console.log(`🔍 Getting device resolution for: ${emulatorName}`);

      // Get device screen size using ADB
      const sizeProcess = spawn(this.adbPath, ["shell", "wm", "size"]);
      let sizeOutput = "";

      sizeProcess.stdout.on("data", (data) => {
        sizeOutput += data.toString();
      });

      sizeProcess.on("close", (code) => {
        if (code === 0) {
          // Parse output like "Physical size: 1080x2340"
          const match = sizeOutput.match(/(\d+)x(\d+)/);
          if (match) {
            const width = parseInt(match[1]);
            const height = parseInt(match[2]);
            console.log(`🔍 Device resolution detected: ${width}x${height}`);
            resolve({ width, height });
          } else {
            console.log(`🔍 Could not parse resolution from: ${sizeOutput}`);
            reject(new Error(`Could not parse screen size: ${sizeOutput}`));
          }
        } else {
          reject(new Error(`Failed to get screen size, code: ${code}`));
        }
      });

      sizeProcess.on("error", (error) => {
        reject(new Error(`Screen size detection failed: ${error.message}`));
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

  async launchApp(emulatorName, packageName, mainActivity = null) {
    return new Promise((resolve, reject) => {
      if (!this.runningEmulators.has(emulatorName)) {
        reject(new Error("Emulator not running"));
        return;
      }

      let command;

      if (mainActivity) {
        // Use am start with specific activity - most reliable method
        command = `${this.adbPath} shell am start -n ${packageName}/${mainActivity}`;
      } else {
        // Fallback to launcher intent if no specific activity provided
        command = `${this.adbPath} shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER ${packageName}`;
      }

      console.log(`Launching app with command: ${command}`);

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Launch command failed: ${error.message}`);
          console.error(`stdout: ${stdout}`);
          console.error(`stderr: ${stderr}`);
          reject(new Error(`Failed to launch app: ${error.message}`));
          return;
        }

        // Check if launch was successful
        if (stdout.includes("Error") || stderr.includes("Error")) {
          reject(new Error(`App launch failed: ${stdout} ${stderr}`));
          return;
        }

        console.log(`App launch output: ${stdout}`);
        resolve({ message: `App ${packageName} launched successfully` });
      });
    });
  }

  // Launch app using deeplink/app link
  async launchAppWithDeeplink(emulatorName, deeplink, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.runningEmulators.has(emulatorName)) {
        reject(new Error("Emulator not running"));
        return;
      }

      // Validate deeplink format
      if (!deeplink || typeof deeplink !== "string") {
        reject(new Error("Invalid deeplink provided"));
        return;
      }

      const { fallbackToStore = false, timeout = 10000 } = options;

      // Support different deeplink formats:
      // - Custom scheme: myapp://path/to/feature
      // - HTTP/HTTPS: https://example.com/app/feature
      // - Android App Link: https://myapp.com/feature
      let command;

      if (deeplink.startsWith("http://") || deeplink.startsWith("https://")) {
        // HTTP/HTTPS deeplink - use VIEW intent
        command = `${this.adbPath} shell am start -a android.intent.action.VIEW -d "${deeplink}"`;
      } else if (deeplink.includes("://")) {
        // Custom scheme deeplink - use VIEW intent
        command = `${this.adbPath} shell am start -a android.intent.action.VIEW -d "${deeplink}"`;
      } else {
        reject(
          new Error(
            "Invalid deeplink format. Must include scheme (e.g., myapp:// or https://)"
          )
        );
        return;
      }

      console.log(`Launching app with deeplink: ${deeplink}`);
      console.log(`Command: ${command}`);

      exec(command, { timeout }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Deeplink launch failed: ${error.message}`);
          console.error(`stdout: ${stdout}`);
          console.error(`stderr: ${stderr}`);

          // Provide specific error messages based on error type
          if (error.message.includes("timeout")) {
            reject(
              new Error(
                `Deeplink launch timed out after ${timeout}ms - app may not be responding`
              )
            );
          } else if (stderr.includes("No Activity found")) {
            reject(
              new Error(
                `No app found to handle deeplink: ${deeplink}. The app may not be installed or the deeplink is not registered.`
              )
            );
          } else {
            reject(new Error(`Failed to launch deeplink: ${error.message}`));
          }
          return;
        }

        // Enhanced error detection in output
        const output = stdout + stderr;

        if (output.includes("Error") || output.includes("No Activity found")) {
          const errorMsg =
            `Deeplink launch failed: No app found to handle ${deeplink}. ` +
            `This usually means:\n` +
            `1. The target app is not installed\n` +
            `2. The deeplink scheme is not registered by any app\n` +
            `3. The deeplink format is incorrect`;

          if (
            fallbackToStore &&
            (deeplink.startsWith("http://") || deeplink.startsWith("https://"))
          ) {
            // Try to open in browser as fallback
            this.openInBrowser(emulatorName, deeplink)
              .then(() => {
                resolve({
                  message: `Deeplink failed, opened in browser instead: ${deeplink}`,
                  deeplink: deeplink,
                  fallbackUsed: "browser",
                });
              })
              .catch(() => {
                reject(new Error(errorMsg));
              });
            return;
          }

          reject(new Error(errorMsg));
          return;
        }

        // Check if the launch was actually successful by verifying app state
        setTimeout(() => {
          this.verifyDeeplinkSuccess(emulatorName, deeplink)
            .then((verification) => {
              resolve({
                message: `App launched successfully with deeplink: ${deeplink}`,
                deeplink: deeplink,
                verification: verification,
              });
            })
            .catch(() => {
              // Even if verification fails, consider it successful if ADB didn't error
              resolve({
                message: `Deeplink sent successfully: ${deeplink} (verification failed)`,
                deeplink: deeplink,
                warning: "Could not verify if app actually opened",
              });
            });
        }, 2000); // Wait 2 seconds for app to potentially open
      });
    });
  }

  // Verify if deeplink launch was successful
  async verifyDeeplinkSuccess(emulatorName, deeplink) {
    return new Promise((resolve, reject) => {
      // Get current foreground app to see if something opened
      const command = `${this.adbPath} shell dumpsys window windows | grep -E 'mCurrentFocus'`;

      exec(command, { timeout: 5000 }, (error, stdout) => {
        if (error) {
          reject(new Error("Could not verify app state"));
          return;
        }

        // Extract current app from focus
        const focusMatch = stdout.match(
          /mCurrentFocus=Window\{[^}]+\s+([a-zA-Z0-9._]+)\//
        );
        const currentApp = focusMatch ? focusMatch[1] : "unknown";

        resolve({
          currentApp: currentApp,
          focusedWindow: stdout.trim(),
        });
      });
    });
  }

  // Fallback: Open URL in browser
  async openInBrowser(emulatorName, url) {
    return new Promise((resolve, reject) => {
      const command = `${this.adbPath} shell am start -a android.intent.action.VIEW -d "${url}"`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Failed to open in browser: ${error.message}`));
          return;
        }

        resolve({ message: `Opened in browser: ${url}` });
      });
    });
  }

  // Get list of APK files from apps directory with package information
  async getPreinstallApks() {
    try {
      if (!fs.existsSync(this.appsDir)) {
        console.log(`Apps directory not found: ${this.appsDir}`);
        return [];
      }

      const files = await fs.readdir(this.appsDir);
      const apkFiles = [];

      for (const file of files) {
        if (file.toLowerCase().endsWith(".apk")) {
          const apkPath = path.join(this.appsDir, file);
          const stats = fs.statSync(apkPath);

          // Skip empty files (like our test files)
          if (stats.size === 0) {
            console.log(`Skipping empty APK file: ${file}`);
            continue;
          }

          const apkInfo = {
            name: file,
            path: apkPath,
            size: stats.size,
          };

          // Try to get package information (optional, for debugging)
          try {
            const packageInfo = await this.getApkPackageInfo(apkPath);
            if (packageInfo) {
              apkInfo.packageName = packageInfo.packageName;
              apkInfo.mainActivity = packageInfo.mainActivity;
            }
          } catch (error) {
            console.warn(
              `Could not extract package info for ${file}:`,
              error.message
            );
          }

          apkFiles.push(apkInfo);
        }
      }

      console.log(
        `Found ${apkFiles.length} valid APK files for preinstallation:`,
        apkFiles.map((f) => `${f.name} (${f.packageName || "package unknown"})`)
      );
      return apkFiles;
    } catch (error) {
      console.error("Error scanning apps directory:", error);
      return [];
    }
  }

  // Preinstall all APKs from the apps folder
  async preinstallApks(emulatorName) {
    try {
      const apkFiles = await this.getPreinstallApks();
      const preferredApp = this.getPreinstallAppPreference(emulatorName);

      if (apkFiles.length === 0) {
        console.log("No APK files found for preinstallation");
        return { installed: [], failed: [] };
      }

      console.log(
        `Starting preinstallation of ${apkFiles.length} APKs on emulator ${emulatorName}`
      );

      if (preferredApp) {
        console.log(`Prioritizing preselected app: ${preferredApp}`);
      }

      const installed = [];
      const failed = [];

      // Install preferred app first if specified
      if (preferredApp) {
        const preferredApk = apkFiles.find((apk) => apk.name === preferredApp);
        if (preferredApk) {
          try {
            console.log(`Installing preferred app ${preferredApk.name}...`);
            await this.installApp(emulatorName, preferredApk.path);
            installed.push(preferredApk.name);
            console.log(
              `✅ Successfully installed preferred app ${preferredApk.name}`
            );

            // Remove from the list to avoid duplicate installation
            const index = apkFiles.indexOf(preferredApk);
            apkFiles.splice(index, 1);
          } catch (error) {
            console.error(
              `❌ Failed to install preferred app ${preferredApk.name}:`,
              error.message
            );
            failed.push({ name: preferredApk.name, error: error.message });
          }
        } else {
          console.warn(
            `Preferred app ${preferredApp} not found in apps directory`
          );
        }
      }

      // Install remaining APKs
      for (const apk of apkFiles) {
        try {
          console.log(`Installing ${apk.name}...`);
          await this.installApp(emulatorName, apk.path);
          installed.push(apk.name);
          console.log(`✅ Successfully installed ${apk.name}`);
        } catch (error) {
          console.error(`❌ Failed to install ${apk.name}:`, error.message);
          failed.push({ name: apk.name, error: error.message });
        }
      }

      const result = { installed, failed, preferredApp };
      console.log(
        `Preinstallation complete: ${installed.length} installed, ${failed.length} failed`
      );

      // Notify frontend about preinstallation results
      if (this.io) {
        this.io.emit("apps-preinstalled", {
          emulatorName,
          result,
        });
      }

      return result;
    } catch (error) {
      console.error("Error during preinstallation:", error);
      return {
        installed: [],
        failed: [{ name: "preinstallation", error: error.message }],
        preferredApp: null,
      };
    }
  }

  // Get APK package information (package name and main activity)
  async getApkPackageInfo(apkPath) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(apkPath)) {
        resolve(null);
        return;
      }

      // Use aapt to extract package information
      const command = `${this.androidHome}/build-tools/*/aapt dump badging "${apkPath}"`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Failed to analyze APK ${apkPath}:`, error.message);
          resolve(null);
          return;
        }

        try {
          // Extract package name
          const packageMatch = stdout.match(/package: name='([^']+)'/);
          const packageName = packageMatch ? packageMatch[1] : null;

          // Extract main activity
          const activityMatch = stdout.match(
            /launchable-activity: name='([^']+)'/
          );
          const mainActivity = activityMatch ? activityMatch[1] : null;

          if (packageName) {
            resolve({
              packageName,
              mainActivity,
            });
          } else {
            resolve(null);
          }
        } catch (parseError) {
          console.error(
            `Failed to parse APK info for ${apkPath}:`,
            parseError.message
          );
          resolve(null);
        }
      });
    });
  }

  // Get the main launcher activity of an APK (deprecated - use getApkPackageInfo instead)
  async getApkMainActivity(apkPath) {
    const packageInfo = await this.getApkPackageInfo(apkPath);
    return packageInfo ? packageInfo.mainActivity : null;
  }

  // Launch the first preinstalled app automatically
  async launchPreinstalledApp(emulatorName) {
    try {
      const apkFiles = await this.getPreinstallApks();
      const emulatorPrefs = this.getEmulatorPreferences(emulatorName);
      const preferredApp = emulatorPrefs?.preinstallApp;
      const deeplink = emulatorPrefs?.deeplink;

      if (apkFiles.length === 0) {
        console.log("No APK files found for launch");
        return null;
      }

      // Determine which app to launch
      let targetApk = null;
      if (preferredApp) {
        targetApk = apkFiles.find((apk) => apk.name === preferredApp);
        if (targetApk) {
          console.log(`Attempting to launch preferred app: ${targetApk.name}`);
        } else {
          console.warn(
            `Preferred app ${preferredApp} not found, using first available`
          );
          targetApk = apkFiles[0];
        }
      } else {
        targetApk = apkFiles[0];
      }

      if (!targetApk) {
        console.log("No target APK found for launch");
        return null;
      }

      console.log(
        `Attempting to launch preinstalled app: ${targetApk.name}${
          deeplink ? ` with deeplink: ${deeplink}` : ""
        }`
      );

      // Extract actual package information from the APK
      const packageInfo = await this.getApkPackageInfo(targetApk.path);

      if (packageInfo && packageInfo.packageName) {
        // Get list of installed apps to verify it's installed
        const installedApps = await this.getInstalledApps(emulatorName);

        if (installedApps.includes(packageInfo.packageName)) {
          // Use deeplink if available, otherwise launch normally
          if (deeplink) {
            try {
              console.log(
                `🔗 Launching ${packageInfo.packageName} with deeplink: ${deeplink}`
              );
              await this.launchAppWithDeeplink(emulatorName, deeplink, {
                fallbackToStore: false,
                timeout: 10000,
              });
              console.log(
                `✅ Successfully launched ${packageInfo.packageName} with deeplink`
              );
              return packageInfo.packageName;
            } catch (error) {
              console.warn(
                `⚠️ Deeplink launch failed: ${error.message}, falling back to normal launch`
              );
              // Fall through to normal launch
            }
          }

          // Normal launch (either no deeplink or deeplink failed)
          await this.launchApp(
            emulatorName,
            packageInfo.packageName,
            packageInfo.mainActivity
          );
          console.log(
            `✅ Launched ${packageInfo.packageName} ${
              preferredApp ? "(preferred app)" : ""
            } with activity: ${packageInfo.mainActivity || "default launcher"}${
              deeplink ? " (deeplink failed, used normal launch)" : ""
            }`
          );
          return packageInfo.packageName;
        } else {
          console.warn(
            `Package ${packageInfo.packageName} not found in installed apps`
          );
        }
      } else {
        console.warn(
          `Could not extract package information from ${targetApk.name}`
        );

        // Fallback to old guessing method for compatibility
        console.log("Falling back to package name guessing...");
        const apkBaseName = path.basename(targetApk.name, ".apk");
        const possiblePackages = [
          `com.example.${apkBaseName}`,
          `com.${apkBaseName}`,
          `com.company.${apkBaseName}`,
        ];

        const installedApps = await this.getInstalledApps(emulatorName);
        for (const packageName of possiblePackages) {
          if (installedApps.includes(packageName)) {
            await this.launchApp(emulatorName, packageName); // No main activity for guessed packages
            console.log(`✅ Launched ${packageName} (guessed package name)`);
            return packageName;
          }
        }
      }

      console.log(
        "Could not launch preinstalled app - package not found or not installed"
      );
      return null;
    } catch (error) {
      console.error("Error launching preinstalled app:", error);
      return null;
    }
  }

  async waitForEmulatorBoot(emulatorName) {
    return new Promise((resolve, reject) => {
      const maxAttempts = 120; // Increase timeout for slower Docker environments (6 minutes)
      let attempts = 0;

      const checkBoot = () => {
        // First check if device is available
        exec(`${this.adbPath} devices`, (deviceError, deviceStdout) => {
          attempts++;

          if (deviceError) {
            console.log(
              `Boot check ${attempts}/${maxAttempts}: ADB devices command failed`
            );
            if (attempts >= maxAttempts) {
              reject(new Error("Emulator boot timeout - ADB not responding"));
              return;
            }
            setTimeout(checkBoot, 3000); // Longer delay for Docker
            return;
          }

          // Check if our emulator device is listed
          const hasDevice =
            deviceStdout.includes("emulator-") &&
            deviceStdout.includes("device");
          if (!hasDevice) {
            console.log(
              `Boot check ${attempts}/${maxAttempts}: No emulator device found in ADB`
            );
            if (attempts >= maxAttempts) {
              reject(new Error("Emulator boot timeout - device not found"));
              return;
            }
            setTimeout(checkBoot, 3000);
            return;
          }

          // Now check boot completion with multiple properties
          exec(
            `${this.adbPath} shell "getprop sys.boot_completed && getprop dev.bootcomplete"`,
            (error, stdout) => {
              const lines = stdout ? stdout.trim().split("\n") : [];
              const bootCompleted = lines[0] === "1";
              const devBootComplete = lines[1] === "1";

              if (bootCompleted || devBootComplete) {
                console.log(
                  `✅ Emulator ${emulatorName} boot completed successfully (sys.boot_completed: ${lines[0]}, dev.bootcomplete: ${lines[1]})`
                );
                resolve();
              } else if (attempts >= maxAttempts) {
                reject(
                  new Error("Emulator boot timeout - boot never completed")
                );
              } else {
                console.log(
                  `Boot check ${attempts}/${maxAttempts}: Boot status: sys.boot_completed=${
                    lines[0] || "empty"
                  }, dev.bootcomplete=${lines[1] || "empty"}`
                );
                setTimeout(checkBoot, 5000); // Increase check interval to 5 seconds
              }
            }
          );
        });
      };

      checkBoot();
    });
  }

  async createEmulator(name, options = {}) {
    // Detect architecture automatically for M1 Macs
    const defaultArch = this.getDefaultArchitecture();
    const {
      apiLevel = 34,
      arch = defaultArch,
      device = "pixel_5",
      preinstallApp,
      deeplink,
    } = options;

    return new Promise((resolve, reject) => {
      // First check if emulator already exists
      exec(`"${this.emulatorPath}" -list-avds`, (error, stdout) => {
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
        console.log(`Creating emulator with system image: ${systemImage}`);

        // Use spawn to handle interactive prompts with correct environment
        const createProcess = spawn(
          this.avdManagerPath,
          [
            "create",
            "avd",
            "-n",
            name,
            "-k",
            systemImage,
            "-d",
            device,
            "--force",
          ],
          {
            env: {
              ...process.env,
              JAVA_HOME: process.env.JAVA_HOME,
            },
          }
        );

        let output = "";
        let errorOutput = "";

        createProcess.stdout.on("data", (data) => {
          output += data.toString();
        });

        createProcess.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        // Send 'no' to any prompts (like custom hardware profile)
        createProcess.stdin.write("no\n");
        createProcess.stdin.end();

        createProcess.on("close", (code) => {
          if (code === 0) {
            console.log(`Emulator created successfully: ${output}`);

            // Store preinstall app preference if provided
            if (preinstallApp || deeplink) {
              this.storePreinstallAppPreference(name, preinstallApp, deeplink);
            }

            resolve({
              message: `Emulator '${name}' created successfully`,
              name: name,
              apiLevel: apiLevel,
              arch: arch,
              device: device,
              preinstallApp: preinstallApp || null,
              deeplink: deeplink || null,
            });
          } else {
            reject(
              new Error(
                `Failed to create emulator: Exit code ${code}. Output: ${output}. Error: ${errorOutput}`
              )
            );
          }
        });

        createProcess.on("error", (error) => {
          reject(new Error(`Failed to start avdmanager: ${error.message}`));
        });
      });
    });
  }

  async deleteEmulator(name) {
    return new Promise((resolve, reject) => {
      // First check if emulator is running and stop it
      if (this.runningEmulators.has(name)) {
        reject(
          new Error(
            `Cannot delete emulator '${name}' while it is running. Please stop it first.`
          )
        );
        return;
      }

      console.log(`Deleting emulator: ${name}`);

      // Use avdmanager to delete the AVD
      const deleteCommand = `"${this.avdManagerPath}" delete avd -n "${name}"`;
      console.log(`Delete command: ${deleteCommand}`);

      const deleteProcess = spawn(
        this.avdManagerPath,
        ["delete", "avd", "-n", name],
        {
          env: {
            ...process.env,
            JAVA_HOME: process.env.JAVA_HOME,
            ANDROID_HOME: this.androidHome,
            ANDROID_SDK_ROOT: this.androidHome,
          },
        }
      );

      let output = "";
      let errorOutput = "";

      deleteProcess.stdout.on("data", (data) => {
        output += data.toString();
        console.log(`Delete stdout: ${data}`);
      });

      deleteProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
        console.log(`Delete stderr: ${data}`);
      });

      deleteProcess.on("close", (code) => {
        console.log(`Delete process exited with code: ${code}`);
        console.log(`Output: ${output}`);
        console.log(`Error output: ${errorOutput}`);

        if (code === 0) {
          // Clean up preinstall preferences
          this.removePreinstallAppPreference(name);

          resolve({
            message: `Emulator '${name}' deleted successfully`,
            name: name,
          });
        } else {
          reject(
            new Error(
              `Failed to delete emulator: Exit code ${code}. Output: ${output}. Error: ${errorOutput}`
            )
          );
        }
      });

      deleteProcess.on("error", (error) => {
        reject(
          new Error(`Failed to start avdmanager for deletion: ${error.message}`)
        );
      });
    });
  }

  // Store preinstall app preference for an emulator
  storePreinstallAppPreference(emulatorName, appName, deeplink = null) {
    try {
      const preferencesFile = path.join(
        __dirname,
        "../temp/emulator-preferences.json"
      );

      // Ensure directory exists
      fs.ensureDirSync(path.dirname(preferencesFile));

      let preferences = {};
      if (fs.existsSync(preferencesFile)) {
        preferences = fs.readJsonSync(preferencesFile);
      }

      preferences[emulatorName] = {
        preinstallApp: appName || null,
        deeplink: deeplink || null,
        createdAt: new Date().toISOString(),
      };

      fs.writeJsonSync(preferencesFile, preferences, { spaces: 2 });
      console.log(
        `Stored preferences for ${emulatorName}: ${appName}${
          deeplink ? ` with deeplink: ${deeplink}` : ""
        }`
      );
    } catch (error) {
      console.error(`Failed to store preinstall preference: ${error.message}`);
    }
  }

  // Get preinstall app preference for an emulator
  getPreinstallAppPreference(emulatorName) {
    try {
      const preferencesFile = path.join(
        __dirname,
        "../temp/emulator-preferences.json"
      );

      if (!fs.existsSync(preferencesFile)) {
        return null;
      }

      const preferences = fs.readJsonSync(preferencesFile);
      return preferences[emulatorName]?.preinstallApp || null;
    } catch (error) {
      console.error(`Failed to get preinstall preference: ${error.message}`);
      return null;
    }
  }

  // Get emulator preferences (app and deeplink)
  getEmulatorPreferences(emulatorName) {
    try {
      const preferencesFile = path.join(
        __dirname,
        "../temp/emulator-preferences.json"
      );

      if (!fs.existsSync(preferencesFile)) {
        return null;
      }

      const preferences = fs.readJsonSync(preferencesFile);
      return preferences[emulatorName] || null;
    } catch (error) {
      console.error(`Failed to get emulator preferences: ${error.message}`);
      return null;
    }
  }

  // Remove preinstall app preference when emulator is deleted
  removePreinstallAppPreference(emulatorName) {
    try {
      const preferencesFile = path.join(
        __dirname,
        "../temp/emulator-preferences.json"
      );

      if (!fs.existsSync(preferencesFile)) {
        return;
      }

      const preferences = fs.readJsonSync(preferencesFile);
      delete preferences[emulatorName];

      fs.writeJsonSync(preferencesFile, preferences, { spaces: 2 });
      console.log(`Removed preinstall preference for ${emulatorName}`);
    } catch (error) {
      console.error(`Failed to remove preinstall preference: ${error.message}`);
    }
  }

  // Check if apps should be installed (first time start)
  shouldInstallApps(emulatorName) {
    try {
      const preferencesFile = path.join(
        __dirname,
        "../temp/emulator-preferences.json"
      );

      if (!fs.existsSync(preferencesFile)) {
        return true; // No preferences file means this is the first time
      }

      const preferences = fs.readJsonSync(preferencesFile);
      const emulatorData = preferences[emulatorName];

      // If no data for this emulator, or no installation status, install apps
      return !emulatorData?.installationStatus?.completed;
    } catch (error) {
      console.error(`Failed to check installation status: ${error.message}`);
      return true; // Default to allowing installation if we can't check
    }
  }

  // Update installation status in preferences after preinstallation
  updateInstallationStatus(emulatorName, preinstallResult) {
    try {
      const preferencesFile = path.join(
        __dirname,
        "../temp/emulator-preferences.json"
      );

      // Ensure directory exists
      fs.ensureDirSync(path.dirname(preferencesFile));

      let preferences = {};
      if (fs.existsSync(preferencesFile)) {
        preferences = fs.readJsonSync(preferencesFile);
      }

      // Initialize emulator data if it doesn't exist
      if (!preferences[emulatorName]) {
        preferences[emulatorName] = {};
      }

      // Store installation status
      preferences[emulatorName].installationStatus = {
        completed: true,
        installedAt: new Date().toISOString(),
        installedApps: preinstallResult.installed || [],
        failedApps: preinstallResult.failed || [],
        totalAttempted:
          (preinstallResult.installed?.length || 0) +
          (preinstallResult.failed?.length || 0),
      };

      fs.writeJsonSync(preferencesFile, preferences, { spaces: 2 });
      console.log(
        `Updated installation status for ${emulatorName}: ${
          preinstallResult.installed?.length || 0
        } apps installed`
      );
    } catch (error) {
      console.error(`Failed to update installation status: ${error.message}`);
    }
  }

  // Get list of previously installed apps for skipped message
  getInstalledAppsList(emulatorName) {
    try {
      const preferencesFile = path.join(
        __dirname,
        "../temp/emulator-preferences.json"
      );

      if (!fs.existsSync(preferencesFile)) {
        return [];
      }

      const preferences = fs.readJsonSync(preferencesFile);
      const installationStatus = preferences[emulatorName]?.installationStatus;

      if (installationStatus?.installedApps) {
        return installationStatus.installedApps.map((appName) => ({
          name: appName,
        }));
      }

      return [];
    } catch (error) {
      console.error(`Failed to get installed apps list: ${error.message}`);
      return [];
    }
  }

  // Check screenshot status for a device
  async checkScreenshotStatus(deviceId) {
    return new Promise((resolve) => {
      // First try to get window info to check for FLAG_SECURE
      const windowCommand = `"${this.adbPath}" -s ${deviceId} shell dumpsys window windows | grep -E 'mCurrentFocus|FLAG_SECURE'`;

      exec(
        windowCommand,
        { timeout: 5000 },
        async (windowError, windowStdout) => {
          let hasSecureFlag = false;
          let appName = "unknown";
          let packageName = "unknown";

          if (!windowError && windowStdout) {
            const output = windowStdout.toLowerCase();
            hasSecureFlag = output.includes("flag_secure");

            // Extract app name from focus
            const focusRegex = /mCurrentFocus=Window\{[^}]+\s+([^/\s]+)/;
            const focusMatch = focusRegex.exec(windowStdout);
            if (focusMatch) {
              appName = focusMatch[1];
            }

            // Also try to get package name
            const packageRegex =
              /mCurrentFocus=Window\{[^}]+\s+([a-zA-Z0-9._]+)\//;
            const packageMatch = packageRegex.exec(windowStdout);
            if (packageMatch) {
              packageName = packageMatch[1];
            }
          }

          // If FLAG_SECURE is detected, we know screenshots are blocked
          if (hasSecureFlag) {
            resolve({
              canScreenshot: false,
              reason: "App has FLAG_SECURE protection enabled",
              app: appName,
              package: packageName,
              deviceId: deviceId,
              hasSecureFlag: true,
              testMethod: "window_flags",
            });
            return;
          }

          // If no FLAG_SECURE, test with an actual screenshot attempt
          const testScreenshotPath = path.join(
            __dirname,
            `../temp/test_screenshot_${Date.now()}.png`
          );
          const testCommand = `"${this.adbPath}" -s ${deviceId} exec-out screencap -p > "${testScreenshotPath}"`;

          exec(
            testCommand,
            { timeout: 8000 },
            async (testError, testStdout, testStderr) => {
              let canScreenshot = true;
              let reason = "No screenshot restrictions detected";

              if (testError) {
                canScreenshot = false;
                reason = `Screenshot test failed: ${testError.message}`;
              } else {
                try {
                  // Check if the file exists and has reasonable content
                  const fs = require("fs").promises;
                  const stats = await fs.stat(testScreenshotPath);

                  if (stats.size === 0) {
                    canScreenshot = false;
                    reason =
                      "Screenshot produced empty file - app may be blocking capture";
                  } else if (stats.size < 1000) {
                    canScreenshot = false;
                    reason =
                      "Screenshot file too small - possible capture restriction";
                  }

                  // Clean up test file
                  await fs.unlink(testScreenshotPath).catch(() => {});
                } catch (fileError) {
                  canScreenshot = false;
                  reason = `Screenshot file check failed: ${fileError.message}`;
                }
              }

              resolve({
                canScreenshot: canScreenshot,
                reason: reason,
                app: appName,
                package: packageName,
                deviceId: deviceId,
                hasSecureFlag: false,
                testMethod: "actual_screenshot",
              });
            }
          );
        }
      );
    });
  }
}

module.exports = EmulatorController;
