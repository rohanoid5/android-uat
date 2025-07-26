# Quick Start Guide for M1 Macs

## One-Command Setup for M1/M2 Macs

```bash
./setup_m1.sh
```

This will automatically:
✅ Install Java 17 (if needed)
✅ Install Android SDK with ARM64 support  
✅ Create an M1-optimized emulator
✅ Install all project dependencies
✅ Configure optimal performance settings

## Quick Start

1. **Start the M1-optimized emulator:**
   ```bash
   ./start_m1_emulator.sh
   ```

2. **Start the web dashboard:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   ```
   http://localhost:3000
   ```

## M1-Specific Optimizations

- **ARM64 System Images**: Native ARM64 Android images for better performance
- **4GB RAM**: Increased memory allocation for smooth operation
- **GPU Acceleration**: Automatic GPU acceleration setup
- **Faster Boot**: Optimized boot time (~1-2 minutes vs 3-5 minutes)
- **Lower Power**: Native ARM execution uses less battery

## NPM Scripts for M1

```bash
npm run setup:m1        # Run M1 setup
npm run emulator:m1     # Start M1-optimized emulator
npm run dev             # Start development servers
npm run emulator:stop   # Stop emulator
```

## Troubleshooting M1-Specific Issues

### Emulator Won't Start
```bash
# Check if ARM64 system image is installed
$HOME/Android/Sdk/cmdline-tools/latest/bin/sdkmanager --list | grep arm64

# Install if missing
$HOME/Android/Sdk/cmdline-tools/latest/bin/sdkmanager "system-images;android-34;google_apis;arm64-v8a"
```

### Performance Issues
- Ensure you have at least 8GB RAM total
- Close other memory-intensive applications
- Check Activity Monitor for emulator CPU usage

### ADB Connection Issues
```bash
# Reset ADB
adb kill-server
adb start-server
adb devices
```

### Java Issues
```bash
# Check Java version
java -version

# Should show OpenJDK 17+ for compatibility
```

## Comparison: M1 vs Intel Performance

| Feature | M1 Mac | Intel Mac |
|---------|--------|-----------|
| Boot Time | 1-2 minutes | 3-5 minutes |
| CPU Usage | Lower (native ARM) | Higher (x86 emulation) |
| Battery Impact | Minimal | Moderate |
| GPU Performance | Excellent | Good |
| Memory Efficiency | Better | Standard |

## Next Steps

Once everything is running:
1. Create additional emulators via the web UI
2. Install APK files through the dashboard
3. Use the interactive screen controls
4. Monitor emulator performance in real-time

Need help? Check the main README.md for detailed documentation.
