#!/bin/bash

echo "🛑 Stopping Android Emulator..."

# Kill emulator processes
pkill -f "emulator.*WebControllerEmulator" || true

# Wait a moment and force kill if necessary
sleep 2
pkill -9 -f "emulator.*WebControllerEmulator" || true

echo "✓ Emulator stopped"
