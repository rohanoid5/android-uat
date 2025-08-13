FROM ubuntu:22.04

# Set Android SDK environment variables
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV DOCKER_CONTAINER=true
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

# Environment variables for emulator GUI support and QEMU
ENV ANDROID_EMULATOR_USE_SYSTEM_LIBS=1
ENV DISPLAY=:0
ENV LIBGL_ALWAYS_SOFTWARE=1
ENV ANDROID_AVD_HOME=/root/.android/avd
ENV ANDROID_EMULATOR_HOME=/root/.android
ENV QEMU_AUDIO_DRV=none
ENV ANDROID_EMULATOR_FORCE_32BIT=false

# Install necessary packages and setup as root
RUN apt-get update && apt-get install -y \
    sudo \
    x11-apps \
    xauth \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Setup the application directory
RUN mkdir -p /usr/src/backend
RUN mkdir -p /usr/src/frontend

# Copy setup script first and run it to install Node.js and other dependencies
COPY setup_ubuntu22.sh /usr/src/backend/setup_ubuntu22.sh
RUN chmod +x /usr/src/backend/setup_ubuntu22.sh

WORKDIR /usr/src/backend

# Run the setup script to install all dependencies including Node.js
RUN ./setup_ubuntu22.sh

# Copy application files after dependencies are installed
COPY backend/ /usr/src/backend
COPY frontend/ /usr/src/frontend

# Install backend dependencies
RUN npm install

WORKDIR /usr/src/frontend
# Install frontend dependencies and build
RUN npm install && npm run build

WORKDIR /usr/src/backend

# Globally install pm2
RUN npm install -g pm2

EXPOSE 3001

# Startup script server (Need to replace with pm2)
CMD ["pm2-runtime", "start", "npm", "--", "run", "start"]
