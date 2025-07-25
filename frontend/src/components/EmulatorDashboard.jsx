import React, { useState, useEffect } from "react";
import { useEmulator } from "../context/EmulatorContext";
import EmulatorScreen from "./EmulatorScreen";
import EmulatorControls from "./EmulatorControls";
import AppManager from "./AppManager";

function EmulatorDashboard({ emulator }) {
  const { socket, screenStream } = useEmulator();
  const [activeTab, setActiveTab] = useState("screen");

  useEffect(() => {
    if (socket && emulator) {
      // Request screen streaming for this emulator
      socket.emit("start-screen-capture", { emulatorId: emulator.id });

      return () => {
        socket.emit("stop-screen-capture", { emulatorId: emulator.id });
      };
    }
  }, [socket, emulator]);

  if (!emulator) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No emulator selected</p>
      </div>
    );
  }

  const tabs = [
    { id: "screen", label: "Screen Control", icon: "📱" },
    { id: "apps", label: "App Manager", icon: "📦" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            <div className="lg:col-span-2">
              <EmulatorScreen emulator={emulator} screenStream={screenStream} />
            </div>
            <div>
              <EmulatorControls emulator={emulator} />
            </div>
          </div>
        )}

        {activeTab === "apps" && (
          <div className="p-6">
            <AppManager emulator={emulator} />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="p-6">
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold mb-4">Emulator Settings</h3>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Device Information
                  </h4>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-gray-600">Name:</dt>
                    <dd className="text-gray-900">{emulator.name}</dd>
                    <dt className="text-gray-600">API Level:</dt>
                    <dd className="text-gray-900">{emulator.apiLevel}</dd>
                    <dt className="text-gray-600">Architecture:</dt>
                    <dd className="text-gray-900">{emulator.arch}</dd>
                    <dt className="text-gray-600">Status:</dt>
                    <dd className="text-gray-900 capitalize">
                      {emulator.status}
                    </dd>
                  </dl>
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
