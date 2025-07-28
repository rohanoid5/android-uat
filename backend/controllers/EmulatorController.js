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
      const preferredApp = this.getPreinstallAppPreference(emulatorName);

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

      console.log(`Attempting to launch preinstalled app: ${targetApk.name}`);

      // Extract actual package information from the APK
      const packageInfo = await this.getApkPackageInfo(targetApk.path);

      if (packageInfo && packageInfo.packageName) {
        // Get list of installed apps to verify it's installed
        const installedApps = await this.getInstalledApps(emulatorName);

        if (installedApps.includes(packageInfo.packageName)) {
          // Launch with main activity if available, otherwise use generic launcher intent
          await this.launchApp(
            emulatorName,
            packageInfo.packageName,
            packageInfo.mainActivity
          );
          console.log(
            `✅ Launched ${packageInfo.packageName} ${
              preferredApp ? "(preferred app)" : ""
            } with activity: ${packageInfo.mainActivity || "default launcher"}`
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
    const {
      apiLevel = 34,
      arch = defaultArch,
      device = "pixel_5",
      preinstallApp,
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

            // Store preinstall app preference if provided
            if (preinstallApp) {
              this.storePreinstallAppPreference(name, preinstallApp);
            }

            resolve({
              message: `Emulator '${name}' created successfully`,
              name: name,
              apiLevel: apiLevel,
              arch: arch,
              device: device,
              preinstallApp: preinstallApp || null,
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
  storePreinstallAppPreference(emulatorName, appName) {
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
        preinstallApp: appName,
        createdAt: new Date().toISOString(),
      };

      fs.writeJsonSync(preferencesFile, preferences, { spaces: 2 });
      console.log(
        `Stored preinstall preference for ${emulatorName}: ${appName}`
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
