# Quick Start Guide

Get up and running with the Android Emulator Web Dashboard in under 10 minutes!

## 🎯 Prerequisites Checklist

Before starting, ensure you have:

- [ ] **macOS** 10.14+ (Intel) or 11.0+ (Apple Silicon)
- [ ] **Node.js** v16+ installed ([Download here](https://nodejs.org/))
- [ ] **Git** installed
- [ ] **8+ GB RAM** available
- [ ] **20+ GB free disk space**

## 🚀 5-Minute Setup

### Step 1: Clone and Install
```bash
# Clone the repository
git clone https://github.com/rohanoid5/android-uat.git
cd android-uat

# Install all dependencies (frontend + backend)
npm run install:all
```

### Step 2: Automated Setup

**For M1/M2 Macs:**
```bash
npm run setup:m1
```

**For Intel Macs:**
```bash
npm run setup:intel
```

This will automatically:
- ✅ Download and install Android SDK
- ✅ Configure Java environment  
- ✅ Install required system images
- ✅ Set up environment variables

### Step 3: Start the Application
```bash
npm run dev
```

---

## 🎮 First Emulator Walkthrough

### 1. Create Your First Emulator
1. Open http://localhost:3000
2. Click the **"Create Emulator"** button
3. Wait 30-60 seconds for creation
4. You'll see a new emulator card appear

### 2. Start the Emulator
1. Click **"Start"** on your emulator card
2. Wait 1-2 minutes for the emulator to boot
3. Status will change from "starting" → "running"

### 3. Open the Dashboard
1. Click **"Open Dashboard"** when status is "running"
2. You'll see a live screen capture of your Android device
3. Click anywhere on the screen to interact!

### 4. Test Interactions
- **Tap**: Click anywhere on the emulator screen
- **Swipe**: Click and drag to simulate swipe gestures
- **Home**: Use on-screen navigation buttons
- **Back**: Android back gesture or button

---

## 🛠️ Troubleshooting Common Issues

### "Java Not Found" Error

**Quick Fix:**
```bash
npm run fix:java
```

**Manual Fix:**
```bash
# Check Java installation
java -version

# Set JAVA_HOME (example for M1/M2 Macs)
export JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home"
```

### "Android SDK Not Found" Error

**Solution:**
```bash
# Set environment variables
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"

# Re-run setup
npm run setup:m1  # or setup:intel
```

### "Failed to Create Emulator" Error

**Check System Images:**
```bash
# List available system images
sdkmanager --list | grep system-images

# Install missing system image (M1/M2)
sdkmanager "system-images;android-34;google_apis;arm64-v8a"

# Install missing system image (Intel)
sdkmanager "system-images;android-34;google_apis;x86_64"
```

### "Screen Capture Not Working"

**Solutions:**
1. **Wait for boot**: Ensure emulator shows Android home screen
2. **Check ADB**: Run `adb devices` - should show your emulator
3. **Restart**: Stop and start the emulator again
4. **Refresh**: Reload the web dashboard

---

## 📱 Testing Your Setup

### 1. Basic Functionality Test
```bash
# Check if API is running
curl http://localhost:3001/api/health

# Expected response:
# {"status":"healthy","timestamp":"2025-07-26T..."}
```

### 2. Create Emulator via API
```bash
curl -X POST http://localhost:3001/api/emulators \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestDevice-'$(date +%s)'",
    "apiLevel": 34,
    "device": "pixel_5"
  }'
```

### 3. List All Emulators
```bash
curl http://localhost:3001/api/emulators
```

---

## 🎯 Next Steps

Once your setup is working:

### Explore the Features
- 📱 **Create multiple emulators** with different configurations
- 🖥️ **Test different screen sizes** (phone, tablet)
- 📦 **Install APK files** through the web interface
- 🎮 **Control multiple emulators** simultaneously

### Development Workflow
- 🔄 **Live reload** - changes reflect immediately
- 🐛 **Debug mode** - check browser console for errors
- 📊 **Monitor logs** - watch terminal output
- 🔧 **API testing** - use curl or Postman

### Advanced Configuration
- ⚙️ **Custom system images** - different Android versions
- 🚀 **Performance tuning** - allocate more RAM/CPU
- 🌐 **Network setup** - configure proxy settings
- � **File management** - share files with emulator

### Read the Documentation
- 📖 **[Architecture Guide](./ARCHITECTURE.md)** - understand the system design
- 🔧 **[Setup Guide](./SETUP.md)** - detailed installation instructions
- 📡 **[API Reference](./API.md)** - complete API documentation
- ⚛️ **[Frontend Guide](./FRONTEND.md)** - React component details

---

## 🎉 Success Checklist

You're ready to go when you can:

- [ ] ✅ Access http://localhost:3000 (frontend)
- [ ] ✅ Get response from http://localhost:3001/api/health
- [ ] ✅ Create a new emulator via the web interface
- [ ] ✅ Start an emulator and see "running" status
- [ ] ✅ Open emulator dashboard and see live screen
- [ ] ✅ Interact with emulator by clicking the screen
- [ ] ✅ See real-time screen updates

---

## 🆘 Getting Help

### Immediate Help
- **Check logs**: Look at terminal output for error messages
- **Browser console**: Check for JavaScript errors (F12)
- **Test API**: Use `curl` commands to verify backend
- **Restart**: Try `npm run dev` again

### Community Support
- 📖 **Documentation**: Complete guides in repository
- 🐛 **GitHub Issues**: Report bugs and get help
- 💬 **Discussions**: Community Q&A and tips
- 📝 **Wiki**: Additional examples and tutorials

### Common Error Solutions
- **Port conflicts**: Use different ports if 3000/3001 are taken
- **Permission issues**: Check file/folder permissions
- **Memory issues**: Close other applications to free RAM
- **Network issues**: Disable VPN/proxy if having connection problems

---

## 🎊 Congratulations!

You now have a fully functional Android Emulator Web Dashboard! 

**What you've accomplished:**
- 🏗️ Set up a complete Android development environment
- 🚀 Built a real-time web application
- 📱 Created your first virtual Android device
- 🎮 Gained remote control over Android emulators

**Ready for more?** Explore advanced features, customize configurations, and build amazing Android testing workflows!

---

<div align="center">

**Need help?** [Report an Issue](https://github.com/rohanoid5/android-uat/issues) • [Read Docs](./ARCHITECTURE.md) • [View Examples](./API.md)

**Enjoying the project?** [⭐ Star the repo](https://github.com/rohanoid5/android-uat) to show your support!

</div>

**Happy Android Testing! 🎉**
