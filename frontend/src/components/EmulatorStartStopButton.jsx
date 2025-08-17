import React from "react";
import { PlayIcon, StopIcon, PowerIcon } from "@heroicons/react/24/outline";

export default function EmulatorStartStopButton({
  currentStatus,
  emulatorLoading,
  handleStartEmulator,
  handleStopEmulator,
}) {
  return (
    <>
      {currentStatus === "stopped" && !emulatorLoading ? (
        <button
          onClick={handleStartEmulator}
          disabled={emulatorLoading}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlayIcon className="h-5 w-5 mr-2" />
          <span>{emulatorLoading ? "Starting..." : "Start Emulator"}</span>
        </button>
      ) : currentStatus === "running" && !emulatorLoading ? (
        <button
          onClick={handleStopEmulator}
          disabled={emulatorLoading}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <StopIcon className="h-5 w-5 mr-2" />
          <span>{emulatorLoading ? "Stopping..." : "Stop Emulator"}</span>
        </button>
      ) : (
        <button
          disabled
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed"
        >
          <PowerIcon className="h-5 w-5 mr-2" />
          <span className="capitalize">
            {emulatorLoading
              ? currentStatus === "running" || currentStatus === "stopping"
                ? "Stopping..."
                : "Starting..."
              : `${currentStatus}...`}
          </span>
        </button>
      )}
    </>
  );
}
