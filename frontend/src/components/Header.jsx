import React from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

function Header({ onBackToList, selectedEmulator }) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            {onBackToList && (
              <button
                onClick={onBackToList}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Back to Emulators
              </button>
            )}
            <h1 className="text-xl font-semibold text-gray-900">
              {selectedEmulator
                ? `${selectedEmulator.name} Dashboard`
                : "Android Emulator Control"}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {selectedEmulator && (
              <div className="flex items-center space-x-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    selectedEmulator.status === "running"
                      ? "bg-green-500"
                      : selectedEmulator.status === "starting"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                ></div>
                <span className="text-sm text-gray-600 capitalize">
                  {selectedEmulator.status}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
