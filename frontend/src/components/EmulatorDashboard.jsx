import React, { useState, useEffect } from "react";
import { useEmulator } from "../context/EmulatorContext";
import { PlayIcon, StopIcon, PowerIcon } from "@heroicons/react/24/outline";
import EmulatorScreen from "./EmulatorScreen";
import EmulatorControls from "./EmulatorControls";
import AppManager from "./AppManager";

function EmulatorDashboard({ emulator }) {
  const {
    socket,
    startEmulator,
    stopEmulator,
    emulators,
    emulatorLoading: rawEmulatorLoading,
  } = useEmulator();
  const [activeTab, setActiveTab] = useState("screen");

  // Get the current emulator from the context to have real-time status updates
  const currentEmulator =
    emulators.find((emu) => emu.id === emulator.id) || emulator;

  console.log("currentEmulator", currentEmulator);

  // Get loading state for this specific emulator
  const emulatorLoading = rawEmulatorLoading[emulator.id] || false;

  useEffect(() => {
    if (socket && emulator) {
      // Request screen streaming for this emulator
      socket.emit("start-screen-stream", emulator.id);

      return () => {
        socket.emit("stop-screen-stream", emulator.id);
      };
    }
  }, [socket, emulator]);

  const handleStartEmulator = async () => {
    try {
      await startEmulator(emulator.id);
    } catch (error) {
      console.error("Failed to start emulator:", error);
    }
  };

  const handleStopEmulator = async () => {
    try {
      await stopEmulator(emulator.id);
    } catch (error) {
      console.error("Failed to stop emulator:", error);
    }
  };

  if (!emulator) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No emulator selected</p>
      </div>
    );
  }

  const currentStatus = currentEmulator.status || "unknown";

  const tabs = [
    { id: "screen", label: "Screen Control", icon: "📱" },
    { id: "apps", label: "App Manager", icon: "📦" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Emulator Status and Controls Header */}
      <div className="bg-white rounded-lg shadow-sm mb-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {currentEmulator.name}
              </h1>
              <div className="flex items-center space-x-4 mt-2">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      currentStatus === "running"
                        ? "bg-green-500"
                        : currentStatus === "starting"
                        ? "bg-yellow-500"
                        : currentStatus === "stopping"
                        ? "bg-orange-500"
                        : "bg-red-500"
                    }`}
                  ></div>
                  <span className="text-sm text-gray-600 capitalize font-medium">
                    {currentStatus}
                  </span>
                </div>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-600">
                  API {currentEmulator?.apiLevel}
                </span>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-600">
                  {currentEmulator?.arch}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {currentStatus === "stopped" && !emulatorLoading ? (
              <button
                onClick={handleStartEmulator}
                disabled={emulatorLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlayIcon className="h-5 w-5" />
                <span>
                  {emulatorLoading ? "Starting..." : "Start Emulator"}
                </span>
              </button>
            ) : currentStatus === "running" && !emulatorLoading ? (
              <button
                onClick={handleStopEmulator}
                disabled={emulatorLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <StopIcon className="h-5 w-5" />
                <span>{emulatorLoading ? "Stopping..." : "Stop Emulator"}</span>
              </button>
            ) : (
              <button
                disabled
                className="flex items-center space-x-2 px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed"
              >
                <PowerIcon className="h-5 w-5" />
                <span className="capitalize">
                  {emulatorLoading
                    ? currentStatus === "running" ||
                      currentStatus === "stopping"
                      ? "Stopping..."
                      : "Starting..."
                    : `${currentStatus}...`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm">
        {activeTab === "screen" && (
          <div className="p-6">
            {currentStatus === "running" ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <EmulatorScreen emulator={emulator} />
                </div>
                <div>
                  <EmulatorControls emulator={emulator} />
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <PowerIcon className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Emulator Not Running
                </h3>
                <p className="text-gray-600 mb-6">
                  Start the emulator to access screen control and device
                  interaction features.
                </p>
                <div className="flex justify-center">
                  {currentStatus === "stopped" && !emulatorLoading ? (
                    <button
                      onClick={handleStartEmulator}
                      disabled={emulatorLoading}
                      className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PlayIcon className="h-5 w-5" />
                      <span>
                        {emulatorLoading ? "Starting..." : "Start Emulator"}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center space-x-2 px-6 py-3 bg-gray-100 text-gray-600 rounded-lg">
                      <PowerIcon className="h-5 w-5" />
                      <span className="capitalize">
                        {emulatorLoading
                          ? currentStatus === "running" ||
                            currentStatus === "stopping"
                            ? "Stopping..."
                            : "Starting..."
                          : `${currentStatus}...`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "apps" && (
          <div className="p-6">
            <AppManager emulator={emulator} />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="p-6">
            <div className="max-w-2xl space-y-6">
              <h3 className="text-lg font-semibold">Emulator Settings</h3>

              {/* Device Information */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">
                  Device Information
                </h4>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-gray-600">Name:</dt>
                  <dd className="text-gray-900">{currentEmulator.name}</dd>
                  <dt className="text-gray-600">API Level:</dt>
                  <dd className="text-gray-900">{currentEmulator.apiLevel}</dd>
                  <dt className="text-gray-600">Architecture:</dt>
                  <dd className="text-gray-900">{currentEmulator.arch}</dd>
                  <dt className="text-gray-600">Status:</dt>
                  <dd className="text-gray-900 capitalize">{currentStatus}</dd>
                </dl>
              </div>

              {/* Emulator Controls */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">
                  Emulator Controls
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Power State
                      </p>
                      <p className="text-xs text-gray-600">
                        Start or stop the emulator
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      {currentStatus === "stopped" && !emulatorLoading ? (
                        <button
                          onClick={handleStartEmulator}
                          disabled={emulatorLoading}
                          className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <PlayIcon className="h-4 w-4" />
                          <span>
                            {emulatorLoading ? "Starting..." : "Start"}
                          </span>
                        </button>
                      ) : currentStatus === "running" && !emulatorLoading ? (
                        <button
                          onClick={handleStopEmulator}
                          disabled={emulatorLoading}
                          className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <StopIcon className="h-4 w-4" />
                          <span>
                            {emulatorLoading ? "Stopping..." : "Stop"}
                          </span>
                        </button>
                      ) : (
                        <span className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-sm capitalize">
                          {emulatorLoading
                            ? currentStatus === "running" ||
                              currentStatus === "stopping"
                              ? "Stopping..."
                              : "Starting..."
                            : `${currentStatus}...`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmulatorDashboard;
