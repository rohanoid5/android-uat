import React, { useEffect, useState } from "react";
import { useEmulator } from "../context/EmulatorContext";
import {
  PlayIcon,
  StopIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import axios from "axios";
import CreateEmulatorModal from "./CreateEmulatorModal";

function EmulatorList({ onEmulatorSelect }) {
  const { emulators, dispatch, loading } = useEmulator();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    fetchEmulators();
  }, []);

  const fetchEmulators = async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const response = await axios.get("/api/emulators");
      dispatch({ type: "SET_EMULATORS", payload: response.data });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
    }
  };

  const handleStartEmulator = async (emulator) => {
    try {
      await axios.post(`/api/emulators/${emulator.id}/start`);
      // Refresh emulator list to get updated status
      await fetchEmulators();

      // Wait a moment for status to update, then navigate to dashboard
      setTimeout(() => {
        onEmulatorSelect(emulator);
      }, 2000);

      // Status will also be updated via socket
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
    }
  };

  const handleStopEmulator = async (emulator) => {
    try {
      await axios.post(`/api/emulators/${emulator.id}/stop`);
      // Status will be updated via socket
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
    }
  };

  const handleDeleteEmulator = async (emulator) => {
    // Confirm deletion
    if (
      !window.confirm(
        `Are you sure you want to delete the emulator "${emulator.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await axios.delete(`/api/emulators/${emulator.id}`);
      // Refresh emulator list
      await fetchEmulators();
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
    }
  };

  const handleCreateEmulator = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = () => {
    fetchEmulators();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Available Emulators
        </h2>
        <button
          onClick={handleCreateEmulator}
          className="control-button primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Emulator
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {emulators.map((emulator) => (
          <div key={emulator.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {emulator.name}
                </h3>
                <p className="text-sm text-gray-600">
                  API Level: {emulator.apiLevel}
                </p>
                <p className="text-sm text-gray-600">
                  Architecture: {emulator.arch}
                </p>
              </div>
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  emulator.status === "running"
                    ? "bg-green-100 text-green-800"
                    : emulator.status === "starting"
                    ? "bg-yellow-100 text-yellow-800"
                    : emulator.status === "stopping"
                    ? "bg-orange-100 text-orange-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {emulator.status}
              </div>
            </div>

            <div className="space-y-3">
              {emulator.status === "running" && (
                <button
                  onClick={() => onEmulatorSelect(emulator)}
                  className="w-full control-button primary"
                >
                  Open Dashboard
                </button>
              )}

              <div className="flex space-x-2">
                {emulator.status === "stopped" ? (
                  <button
                    onClick={() => handleStartEmulator(emulator)}
                    className="flex-1 control-button success flex items-center justify-center"
                  >
                    <PlayIcon className="h-4 w-4 mr-2" />
                    Start
                  </button>
                ) : emulator.status === "running" ? (
                  <button
                    onClick={() => handleStopEmulator(emulator)}
                    className="flex-1 control-button danger flex items-center justify-center"
                  >
                    <StopIcon className="h-4 w-4 mr-2" />
                    Stop
                  </button>
                ) : (
                  <button disabled className="flex-1 control-button secondary">
                    {emulator.status}...
                  </button>
                )}
              </div>

              {/* Delete button - only show when emulator is stopped */}
              {emulator.status === "stopped" && (
                <button
                  onClick={() => handleDeleteEmulator(emulator)}
                  className="w-full control-button danger flex items-center justify-center"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete Emulator
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {emulators.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">No emulators found</p>
          <button
            onClick={handleCreateEmulator}
            className="control-button primary"
          >
            Create Your First Emulator
          </button>
        </div>
      )}

      <CreateEmulatorModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}

export default EmulatorList;
