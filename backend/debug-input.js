#!/usr/bin/env node

// Debug script to test emulator input in Docker environment
const { exec, spawn } = require("child_process");
const fs = require("fs");

class InputDebugger {
  constructor() {
    this.androidHome = process.env.ANDROID_HOME || "/opt/android-sdk";
    this.adbPath = `${this.androidHome}/platform-tools/adb`;
  }

  async checkADBConnection() {
    console.log("🔍 Checking ADB connection...");
    return new Promise((resolve) => {
      exec(`"${this.adbPath}" devices -l`, (error, stdout) => {
        if (error) {
          console.error("❌ ADB not accessible:", error.message);
          resolve(false);
        } else {
          console.log("📱 ADB devices output:");
          console.log(stdout);
          const devices = stdout
            .split("\n")
            .filter(
              (line) => line.includes("emulator") && line.includes("device")
            );
          resolve(devices.length > 0);
        }
      });
    });
  }

  async checkEmulatorBoot(deviceId) {
    console.log(`🚀 Checking if ${deviceId} is fully booted...`);
    return new Promise((resolve) => {
      exec(
        `"${this.adbPath}" -s ${deviceId} shell getprop sys.boot_completed`,
        (error, stdout) => {
          if (error) {
            console.error("❌ Boot check failed:", error.message);
            resolve(false);
          } else {
            const isBooted = stdout.trim() === "1";
            console.log(
              `📱 Boot status for ${deviceId}: ${
                isBooted ? "Complete" : "Still booting"
              }`
            );
            resolve(isBooted);
          }
        }
      );
    });
  }

  async testInputMethods(deviceId) {
    console.log(`🧪 Testing input methods on ${deviceId}...`);

    const tests = [
      {
        name: "Ping Test",
        command: `"${this.adbPath}" -s ${deviceId} shell echo "ping"`,
        expectedOutput: "ping",
      },
      {
        name: "Touch Service Check",
        command: `"${this.adbPath}" -s ${deviceId} shell service list | grep -i input`,
        expectedOutput: "input",
      },
      {
        name: "Screen Properties",
        command: `"${this.adbPath}" -s ${deviceId} shell wm size`,
        expectedOutput: "x",
      },
      {
        name: "Test Tap (center screen)",
        command: `"${this.adbPath}" -s ${deviceId} shell input tap 540 960`,
        expectedOutput: null,
      },
      {
        name: "Input Method Check",
        command: `"${this.adbPath}" -s ${deviceId} shell ime list`,
        expectedOutput: "input",
      },
    ];

    for (const test of tests) {
      console.log(`\n🔬 Running: ${test.name}`);
      console.log(`   Command: ${test.command}`);

      await new Promise((resolve) => {
        exec(test.command, { timeout: 5000 }, (error, stdout, stderr) => {
          if (error) {
            console.log(`   ❌ Failed: ${error.message}`);
          } else {
            console.log(`   ✅ Success: ${stdout.trim()}`);
            if (stderr) {
              console.log(`   ⚠️ Stderr: ${stderr.trim()}`);
            }
          }
          resolve();
        });
      });

      // Wait between tests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async checkDisplaySetup() {
    console.log("\n🖥️ Checking display setup...");

    const displayCommands = [
      "echo $DISPLAY",
      "ps aux | grep Xvfb",
      "ps aux | grep x11vnc",
      'xrandr 2>/dev/null || echo "xrandr not available"',
    ];

    for (const cmd of displayCommands) {
      console.log(`\n🔧 Running: ${cmd}`);
      await new Promise((resolve) => {
        exec(cmd, (error, stdout) => {
          if (error) {
            console.log(`   ❌ Error: ${error.message}`);
          } else {
            console.log(`   📋 Output: ${stdout.trim()}`);
          }
          resolve();
        });
      });
    }
  }

  async run() {
    console.log("🚀 Android Emulator Input Debug Tool");
    console.log("=====================================\n");

    // Check display setup first
    await this.checkDisplaySetup();

    // Check ADB connection
    const adbConnected = await this.checkADBConnection();
    if (!adbConnected) {
      console.log("❌ No devices found. Make sure emulator is running.");
      return;
    }

    // Get first available device
    const devices = await new Promise((resolve) => {
      exec(`"${this.adbPath}" devices`, (error, stdout) => {
        if (error) {
          resolve([]);
        } else {
          const deviceList = stdout
            .split("\n")
            .filter(
              (line) => line.includes("emulator") && line.includes("device")
            )
            .map((line) => line.split("\t")[0]);
          resolve(deviceList);
        }
      });
    });

    if (devices.length === 0) {
      console.log("❌ No emulator devices found.");
      return;
    }

    const deviceId = devices[0];
    console.log(`\n🎯 Testing device: ${deviceId}`);

    // Check if device is fully booted
    const isBooted = await this.checkEmulatorBoot(deviceId);
    if (!isBooted) {
      console.log(
        "⚠️ Device is still booting. Input may not work until fully booted."
      );
    }

    // Test input methods
    await this.testInputMethods(deviceId);

    console.log("\n✅ Debug complete! Check the output above for any issues.");
  }
}

// Run if called directly
if (require.main === module) {
  const inputDebugger = new InputDebugger();
  inputDebugger.run().catch(console.error);
}

module.exports = InputDebugger;
