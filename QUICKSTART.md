# Quick Start Guide - Android Emulator Web Control

## 🚀 Getting Started

Follow these steps to get your Android emulator working with the web dashboard:

### Step 1: Install Android SDK and Create Emulator

```bash
./install_android_sdk.sh
```

This script will:

- ✅ Download and install Android SDK Command Line Tools
- ✅ Install required platform tools (ADB, emulator)
- ✅ Download Android system images
- ✅ Create an optimized Android Virtual Device (AVD)
- ✅ Configure environment variables
- ✅ Create helper scripts for starting/stopping the emulator

**⏱️ Estimated time: 10-15 minutes (depending on internet speed)**

### Step 2: Restart Your Terminal

After installation, restart your terminal or run:

```bash
source ~/.zshrc  # or ~/.bash_profile if you use bash
```

### Step 3: Start the Emulator

```bash
./start_emulator.sh
```

This will:

- Start the Android emulator in the background
- Wait for it to fully boot (2-3 minutes)
- Show you when it's ready for web control

### Step 4: Start the Web Dashboard

In another terminal window:

```bash
npm run dev
```

### Step 5: Open the Web Interface

Open your browser and go to: **http://localhost:3000**

---

## 🎮 Using the Web Dashboard

### Emulator List View

- See all available emulators
- Start/stop emulators
- View real-time status

### Emulator Control Dashboard

- **Screen Tab**: Live screen view with click/touch interaction
- **Apps Tab**: Install APKs, launch apps, manage applications
- **Settings Tab**: View emulator information

### Controls Available

- 📱 **Touch/Click**: Click on the emulator screen to interact
- 🏠 **Hardware Buttons**: Home, Back, Volume, Power buttons
- ⌨️ **Text Input**: Type text that gets sent to the emulator
- 📷 **Screenshots**: Capture screen images
- 🔄 **Device Actions**: Rotate, shake device

---

## 🛠️ Helpful Commands

### Emulator Management

```bash
./start_emulator.sh     # Start the emulator
./stop_emulator.sh      # Stop the emulator
adb devices            # List connected devices
```

### Development

```bash
npm run dev           # Start both frontend and backend
npm run server        # Start only backend (port 3001)
npm run client        # Start only frontend (port 3000)
```

### Android Tools

```bash
adb shell             # Connect to emulator shell
adb install app.apk   # Install APK manually
adb logcat           # View device logs
```

---

## 🐛 Troubleshooting

### Emulator Won't Start

1. Check the log file: `cat emulator.log`
2. Ensure you have enough RAM (8GB+ recommended)
3. Enable hardware acceleration if available
4. Try stopping and restarting: `./stop_emulator.sh && ./start_emulator.sh`

### Web Dashboard Not Connecting

1. Ensure emulator is fully booted: `adb devices`
2. Check if backend is running on port 3001
3. Verify frontend is running on port 3000
4. Check browser console for WebSocket connection errors

### Screen Capture Not Working

1. Verify ADB connection: `adb devices`
2. Test manual screenshot: `adb exec-out screencap -p > test.png`
3. Check backend logs for errors
4. Restart the emulator if needed

### Performance Issues

- Allocate more RAM to the emulator
- Close other applications to free up resources
- Use x86_64 images on Intel Macs for better performance
- Enable hardware acceleration (HAXM on Intel, Hypervisor Framework on Apple Silicon)

---

## 📱 Installing Apps

### Via Web Dashboard

1. Go to the "Apps" tab in the dashboard
2. Click "Install APK"
3. Select your .apk file
4. Wait for installation to complete
5. Launch the app from the list

### Via Command Line

```bash
adb install path/to/your/app.apk
```

---

## 🎯 What You Can Do

✅ **Remote Control**: Control Android emulator from web browser  
✅ **Live Screen**: Real-time screen sharing via WebSocket  
✅ **App Management**: Install, launch, and uninstall apps  
✅ **Hardware Simulation**: Use all hardware buttons and gestures  
✅ **Multi-Device**: Support for multiple emulators (future enhancement)  
✅ **Cross-Platform**: Works on any device with a web browser

---

## 🚨 Important Notes

- **First Boot**: The emulator may take 3-5 minutes to fully boot the first time
- **Resources**: Emulator requires significant CPU and RAM
- **Network**: Ensure ports 3000 and 3001 are available
- **Storage**: Android SDK requires ~10GB of disk space

---

## 🆘 Need Help?

If you encounter issues:

1. Check the console logs in your browser (F12)
2. Look at the backend logs in your terminal
3. Check `emulator.log` for emulator-specific issues
4. Ensure all dependencies are properly installed

**Happy Android Testing! 🎉**
