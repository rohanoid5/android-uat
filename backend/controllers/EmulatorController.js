const { exec, spawn } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

class EmulatorController {
  constructor(io = null) {
    this.runningEmulators = new Map();
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

    // Set up apps directory for preinstallation
    this.appsDir = path.join(__dirname, "../../apps");

    // Set correct JAVA_HOME for M1 Macs
    // Always override JAVA_HOME to ensure it's correct
    process.env.JAVA_HOME =
      "/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home";

    this.io = io;
  }

  getDefaultArchitecture() {
    const os = require("os");
    const arch = os.arch();
    const platform = os.platform();

    // For macOS M1/M2 (Apple Silicon)
    if (platform === "darwin" && arch === "arm64") {
      return "arm64-v8a";
    }

    // For Intel Macs and other x86_64 systems
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
      "webcam0",
      "-camera-front",
      "webcam0",
      "-read-only",
      "-no-metrics",
    ];

    // M1 Mac optimizations
    if (platform === "darwin" && arch === "arm64") {
      args.push("-gpu", "auto", "-memory", "2048", "-cores", "4");
    } else {
      // Intel Mac optimizations
      args.push("-gpu", "auto", "-memory", "2048");
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

          // Preinstall APKs after emulator is ready
          console.log(
            `Emulator ${emulatorName} is ready, starting preinstallation...`
          );
          const preinstallResult = await this.preinstallApks(emulatorName);

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

  // Get list of APK files from apps directory
  async getPreinstallApks() {
    try {
      if (!fs.existsSync(this.appsDir)) {
        console.log(`Apps directory not found: ${this.appsDir}`);
        return [];
      }

      const files = await fs.readdir(this.appsDir);
      const apkFiles = files
        .filter((file) => file.toLowerCase().endsWith(".apk"))
        .map((file) => ({
          name: file,
          path: path.join(this.appsDir, file),
        }));

      console.log(
        `Found ${apkFiles.length} APK files for preinstallation:`,
        apkFiles.map((f) => f.name)
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

      if (apkFiles.length === 0) {
        console.log("No APK files found for preinstallation");
        return { installed: [], failed: [] };
      }

      console.log(
        `Starting preinstallation of ${apkFiles.length} APKs on emulator ${emulatorName}`
      );

      const installed = [];
      const failed = [];

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

      const result = { installed, failed };
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
      };
    }
  }

  // Get the main launcher activity of an APK
  async getApkMainActivity(apkPath) {
    return new Promise((resolve, reject) => {
      const command = `${this.androidHome}/build-tools/*/aapt dump badging "${apkPath}" | grep "launchable-activity"`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          resolve(null); // Return null if we can't determine the activity
          return;
        }

        const match = stdout.match(/name='([^']+)'/);
        resolve(match ? match[1] : null);
      });
    });
  }

  // Launch the first preinstalled app automatically
  async launchPreinstalledApp(emulatorName) {
    try {
      const apkFiles = await this.getPreinstallApks();

      if (apkFiles.length === 0) {
        return null;
      }

      // Try to launch the first APK
      const firstApk = apkFiles[0];
      console.log(`Attempting to launch preinstalled app: ${firstApk.name}`);

      // Get package name from installed apps
      const installedApps = await this.getInstalledApps(emulatorName);

      // For now, we'll use a simple approach - try common package naming patterns
      // This could be enhanced to parse the APK and get the exact package name
      const apkBaseName = path.basename(firstApk.name, ".apk");
      const possiblePackages = [
        `com.example.${apkBaseName}`,
        `com.${apkBaseName}`,
        `com.company.${apkBaseName}`,
      ];

      for (const packageName of possiblePackages) {
        if (installedApps.includes(packageName)) {
          await this.launchApp(emulatorName, packageName);
          console.log(`✅ Launched ${packageName}`);
          return packageName;
        }
      }

      console.log(
        "Could not automatically launch preinstalled app - package name not detected"
      );
      return null;
    } catch (error) {
      console.error("Error launching preinstalled app:", error);
      return null;
    }
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
    // Detect architecture automatically for M1 Macs
    const defaultArch = this.getDefaultArchitecture();
    const { apiLevel = 34, arch = defaultArch, device = "pixel_5" } = options;

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
              JAVA_HOME:
                "/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home",
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
            resolve({
              message: `Emulator '${name}' created successfully`,
              name: name,
              apiLevel: apiLevel,
              arch: arch,
              device: device,
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
}

module.exports = EmulatorController;
