# Setup & Deployment Guide

## Prerequisites

### System Requirements

#### For Intel/AMD Macs
- macOS 10.14 or later
- Intel processor with hardware acceleration support
- At least 8 GB RAM (16 GB recommended)
- 20+ GB free disk space

#### For Apple Silicon (M1/M2) Macs
- macOS 11.0 or later  
- Apple Silicon processor (M1, M1 Pro, M1 Max, M2)
- At least 8 GB RAM (16 GB recommended)
- 20+ GB free disk space

### Software Dependencies

#### Required
- **Node.js** (v16.0 or later)
- **npm** (v8.0 or later)
- **Java Development Kit** (JDK 8 or later)
- **Android SDK** with required components

#### Optional
- **Android Studio** (provides GUI for SDK management)
- **Git** (for version control)

---

## Installation Guide

### 1. Clone the Repository

```bash
git clone https://github.com/rohanoid5/android-uat.git
cd android-uat
```

### 2. Install Dependencies

```bash
# Install all project dependencies (frontend + backend)
npm run install:all
```

### 3. Android SDK Setup

#### Option A: Automated Setup (Recommended)

**For M1/M2 Macs:**
```bash
npm run setup:m1
```

**For Intel Macs:**
```bash
npm run setup:intel
```

#### Option B: Manual Setup

1. **Download Android SDK Command Line Tools**
   - Visit: https://developer.android.com/studio#command-tools
   - Download the command line tools for your platform

2. **Set up Android SDK**
   ```bash
   # Create Android SDK directory
   mkdir -p ~/Android/Sdk
   
   # Extract command line tools
   unzip commandlinetools-mac-*.zip -d ~/Android/Sdk/
   mv ~/Android/Sdk/cmdline-tools ~/Android/Sdk/cmdline-tools-temp
   mkdir -p ~/Android/Sdk/cmdline-tools/latest
   mv ~/Android/Sdk/cmdline-tools-temp/* ~/Android/Sdk/cmdline-tools/latest/
   rmdir ~/Android/Sdk/cmdline-tools-temp
   ```

3. **Set Environment Variables**
   ```bash
   # Add to ~/.zshrc or ~/.bash_profile
   export ANDROID_HOME="$HOME/Android/Sdk"
   export ANDROID_SDK_ROOT="$ANDROID_HOME"
   export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator"
   
   # Reload shell configuration
   source ~/.zshrc
   ```

4. **Install SDK Components**
   ```bash
   # Accept licenses
   yes | sdkmanager --licenses
   
   # Install required components
   sdkmanager "platform-tools" "emulator"
   
   # For Intel Macs
   sdkmanager "system-images;android-34;google_apis;x86_64"
   
   # For M1/M2 Macs  
   sdkmanager "system-images;android-34;google_apis;arm64-v8a"
   ```

### 4. Java Setup

The application will attempt to auto-detect Java installation. If issues occur:

```bash
# Check Java installation
java -version

# Set JAVA_HOME manually if needed (example for M1/M2 Macs)
export JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home"

# Or use the fix script
npm run fix:java
```

---

## Development

### Start Development Environment

```bash
# Start both frontend and backend servers
npm run dev
```

This will start:
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:3000

### Individual Server Commands

```bash
# Backend only
npm run server

# Frontend only  
npm run client
```

### Development Workflow

1. **Backend Changes**: 
   - Automatic restart via nodemon
   - API available at `http://localhost:3001/api`

2. **Frontend Changes**:
   - Hot module replacement via Vite
   - Changes reflect immediately in browser

3. **Testing Emulator Functions**:
   - Create emulator via UI
   - Start emulator
   - Access dashboard for real-time control

---

## Production Deployment

### Build for Production

```bash
# Build frontend for production
npm run build

# Start production server
npm start
```

### Environment Configuration

Create `.env` file in project root:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Android SDK Configuration
ANDROID_HOME=/path/to/android/sdk
ANDROID_SDK_ROOT=/path/to/android/sdk
JAVA_HOME=/path/to/java

# Optional: Custom tool paths
ADB_PATH=/custom/path/to/adb
EMULATOR_PATH=/custom/path/to/emulator
AVDMANAGER_PATH=/custom/path/to/avdmanager
```

### Process Management

#### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs android-uat

# Stop application
pm2 stop android-uat

# Restart application
pm2 restart android-uat
```

#### PM2 Configuration (`ecosystem.config.js`)

```javascript
module.exports = {
  apps: [{
    name: 'android-uat',
    script: './backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
```

### Reverse Proxy Setup (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Serve frontend static files
    location / {
        root /path/to/android-uat/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine

# Install Android SDK dependencies
RUN apk add --no-cache \
    openjdk11-jre \
    wget \
    unzip \
    bash

# Set up Android SDK
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=$ANDROID_HOME
ENV PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin

# Create Android SDK directory
RUN mkdir -p $ANDROID_HOME

# Download and install Android command line tools
RUN wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip -O cmdline-tools.zip && \
    unzip cmdline-tools.zip -d $ANDROID_HOME && \
    rm cmdline-tools.zip && \
    mv $ANDROID_HOME/cmdline-tools $ANDROID_HOME/cmdline-tools-temp && \
    mkdir -p $ANDROID_HOME/cmdline-tools/latest && \
    mv $ANDROID_HOME/cmdline-tools-temp/* $ANDROID_HOME/cmdline-tools/latest/ && \
    rmdir $ANDROID_HOME/cmdline-tools-temp

# Accept licenses and install SDK components
RUN yes | sdkmanager --licenses && \
    sdkmanager "platform-tools" "emulator" "system-images;android-34;google_apis;x86_64"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Expose port
EXPOSE 3001

# Start application
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  android-uat:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    volumes:
      - ./data:/app/data
      - /tmp/.X11-unix:/tmp/.X11-unix:rw
    devices:
      - /dev/kvm:/dev/kvm
    privileged: true
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - android-uat
    restart: unless-stopped
```

---

## Troubleshooting

### Common Issues

#### 1. Java Not Found
```bash
# Check Java installation
java -version

# Auto-fix Java configuration
npm run fix:java

# Manual Java setup
export JAVA_HOME=$(java -home)
```

#### 2. Android SDK Not Found
```bash
# Verify SDK installation
ls -la ~/Android/Sdk

# Check environment variables
echo $ANDROID_HOME
echo $ANDROID_SDK_ROOT

# Re-run setup
npm run setup:m1  # or setup:intel
```

#### 3. Emulator Creation Fails
```bash
# Check available system images
sdkmanager --list | grep system-images

# Install missing system image
sdkmanager "system-images;android-34;google_apis;arm64-v8a"
```

#### 4. ADB Not Found
```bash
# Check ADB path
which adb

# Add to PATH
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

#### 5. Permission Issues
```bash
# Fix permissions
chmod +x ~/Android/Sdk/platform-tools/adb
chmod +x ~/Android/Sdk/emulator/emulator
```

### Logging and Debugging

#### Enable Debug Logging
```bash
# Start with debug output
DEBUG=* npm run dev
```

#### View Emulator Logs
```bash
# Check emulator processes
ps aux | grep emulator

# View ADB devices
adb devices

# Check system logs
tail -f /var/log/system.log
```

### Performance Optimization

#### Emulator Performance
- Allocate sufficient RAM (2-4 GB)
- Enable hardware acceleration
- Close unnecessary applications
- Use SSD storage for better I/O

#### Application Performance
- Monitor memory usage
- Implement request caching
- Use connection pooling
- Optimize screenshot capture intervals

---

## Monitoring and Maintenance

### Health Checks

```bash
# API health check
curl http://localhost:3001/api/health

# Process status
pm2 status

# System resources
top -p $(pgrep -f "node.*server.js")
```

### Log Management

```bash
# Application logs
pm2 logs android-uat

# Rotate logs
pm2 flush

# System logs
journalctl -u android-uat
```

### Backup and Recovery

#### Data Backup
```bash
# Backup emulator data
tar -czf emulator-backup.tar.gz ~/.android/avd/

# Backup application data
tar -czf app-backup.tar.gz ./backend/temp/
```

#### Recovery
```bash
# Restore emulator data
tar -xzf emulator-backup.tar.gz -C ~/

# Restart services
pm2 restart all
```

---

## Security Considerations

### Network Security
- Use HTTPS in production
- Implement proper CORS policies
- Consider VPN access for remote use

### Access Control
- Implement authentication if needed
- Use firewall rules to restrict access
- Monitor access logs

### System Security
- Keep dependencies updated
- Regular security audits
- Monitor for vulnerabilities

---

## Support and Resources

### Documentation
- [Android Emulator Documentation](https://developer.android.com/studio/run/emulator)
- [Android SDK Command Line Tools](https://developer.android.com/studio/command-line)
- [Node.js Documentation](https://nodejs.org/docs/)

### Community
- [Android Developer Community](https://developer.android.com/community)
- [Node.js Community](https://nodejs.org/community/)

### Issue Reporting
Please report issues on the project's GitHub repository with:
- System information (OS, architecture)
- Error logs and stack traces
- Steps to reproduce the issue
- Expected vs actual behavior
