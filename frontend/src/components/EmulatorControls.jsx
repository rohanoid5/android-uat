import React from "react";
import { useEmulator } from "../context/EmulatorContext";
import {
  HomeIcon,
  ArrowUturnLeftIcon,
  Squares2X2Icon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PowerIcon,
} from "@heroicons/react/24/outline";

function EmulatorControls({ emulator }) {
  const { socket } = useEmulator();

  const sendCommand = (command, params = {}) => {
    if (socket && emulator) {
      socket.emit("emulator-command", {
        emulatorId: emulator.id,
        command,
        ...params,
      });
    }
  };

  const controls = [
    {
      label: "Home",
      icon: HomeIcon,
      action: () => sendCommand("home"),
      description: "Go to home screen",
    },
    {
      label: "Back",
      icon: ArrowUturnLeftIcon,
      action: () => sendCommand("back"),
      description: "Go back",
    },
    {
      label: "Recent Apps",
      icon: Squares2X2Icon,
      action: () => sendCommand("recent"),
      description: "Show recent apps",
    },
    {
      label: "Volume Up",
      icon: SpeakerWaveIcon,
      action: () => sendCommand("volume-up"),
      description: "Increase volume",
    },
    {
      label: "Volume Down",
      icon: SpeakerXMarkIcon,
      action: () => sendCommand("volume-down"),
      description: "Decrease volume",
    },
    {
      label: "Power",
      icon: PowerIcon,
      action: () => sendCommand("power"),
      description: "Power button",
    },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Device Controls</h3>

      {/* Hardware Buttons */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Hardware Buttons</h4>
        <div className="grid grid-cols-2 gap-2">
          {controls.map((control) => (
            <button
              key={control.label}
              onClick={control.action}
              className="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
              title={control.description}
            >
              <control.icon className="h-6 w-6 text-gray-600 group-hover:text-gray-800 mb-1" />
              <span className="text-xs text-gray-600 group-hover:text-gray-800">
                {control.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Quick Actions</h4>
        <div className="space-y-2">
          <button
            onClick={() => sendCommand("rotate")}
            className="w-full control-button secondary text-left"
          >
            🔄 Rotate Screen
          </button>
          <button
            onClick={() => sendCommand("screenshot")}
            className="w-full control-button secondary text-left"
          >
            📷 Take Screenshot
          </button>
          <button
            onClick={() => sendCommand("shake")}
            className="w-full control-button secondary text-left"
          >
            📳 Shake Device
          </button>
        </div>
      </div>

      {/* Input Methods */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Input</h4>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Type text..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                sendCommand("type", { text: e.target.value });
                e.target.value = "";
              }
            }}
          />
          <p className="text-xs text-gray-500">Press Enter to send text</p>
        </div>
      </div>

      {/* Device Status */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Device Status</h4>
        <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            <span className="font-medium capitalize">
              {emulator?.status || "Unknown"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">API Level:</span>
            <span className="font-medium">{emulator?.apiLevel || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Architecture:</span>
            <span className="font-medium">{emulator?.arch || "N/A"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmulatorControls;
