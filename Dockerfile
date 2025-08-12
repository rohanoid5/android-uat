FROM docker.phonepe.com/core/ubuntu/jammy/nodejs/20

LABEL maintainer="Rohan Dey <rohan.dey@phonepe.com>"

ENV NODE_EXTRA_CA_CERTS /etc/ssl/certs/ca-certificates.crt

# Set Android SDK environment variables
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

# Setup proxy and registry
RUN npm config set -g https-proxy http://tinyproxy:8888
RUN npm config set -g registry https://artifactory.phonepe.com/repository/npm-all
RUN npm config get registry

# Install necessary packages and setup as root
RUN apt-get update && apt-get install -y sudo && rm -rf /var/lib/apt/lists/*

# Setup the application directory
RUN mkdir -p /usr/src/backend
RUN mkdir -p /usr/src/frontend

# Copy files
COPY backend/ /usr/src/backend
COPY frontend/ /usr/src/frontend
COPY setup_ubuntu22.sh /usr/src/backend/setup_ubuntu22.sh
RUN chmod +x /usr/src/backend/setup_ubuntu22.sh

WORKDIR /usr/src/frontend
# Install frontend dependencies
RUN npm install && npm run build

WORKDIR /usr/src/backend

# Run the setup script
RUN ./setup_ubuntu22.sh

# Install npm dependencies
RUN npm install

# Globally install pm2
RUN npm install -g pm2

EXPOSE 3001

# Startup script server (Need to replace with pm2)
CMD ["pm2-runtime", "start", "npm", "--", "run", "start"]
