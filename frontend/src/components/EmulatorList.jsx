import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEmulator } from "../context/EmulatorContext";
import {
  PlayIcon,
  StopIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import axios from "axios";
import CreateEmulatorModal from "./CreateEmulatorModal";

function EmulatorList() {
  const navigate = useNavigate();
  const {
    emulators,
    dispatch,
    loading,
    startEmulator,
    stopEmulator,
    emulatorLoading,
  } = useEmulator();
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
      await startEmulator(emulator.id);
      // The context will handle loading states and status updates via WebSocket
    } catch (error) {
      console.error("Error starting emulator:", error);
      dispatch({ type: "SET_ERROR", payload: error.message });
    }
  };

  const handleStopEmulator = async (emulator) => {
    try {
      await stopEmulator(emulator.id);
      // The context will handle loading states and status updates via WebSocket
    } catch (error) {
      console.error("Error stopping emulator:", error);
      dispatch({ type: "SET_ERROR", payload: error.message });
    }
  };

  const handleViewEmulator = (emulator) => {
    navigate(`/emulator/${emulator.id}`);
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
    <div className="max-w-7xl mx-auto">
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

      {emulators.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">No emulators found</p>
          <button
            onClick={handleCreateEmulator}
            className="control-button primary"
          >
            Create Your First Emulator
          </button>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Emulator Name
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Creation Date
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    App Loaded
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    API Level
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Device Type
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {emulators.map((emulator) => {
                  const isEmulatorLoading =
                    emulatorLoading[emulator.id] || false;

                  return (
                    <tr key={emulator.id} className="hover:bg-gray-50">
                      {/* Emulator Name */}
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {emulator.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {emulator.arch}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Creation Date */}
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                        {emulator.createdAt
                          ? new Date(emulator.createdAt).toLocaleDateString()
                          : "N/A"}
                      </td>

                      {/* App Loaded */}
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                        {emulator.preinstallApp || "None"}
                      </td>

                      {/* API Level */}
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {emulator.apiLevel || "N/A"}
                      </td>

                      {/* Device Type */}
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                        {emulator.device || "Default"}
                      </td>

                      {/* Status */}
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
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
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-1 md:space-x-3">
                          {/* View Button */}
                          <button
                            onClick={() => handleViewEmulator(emulator)}
                            className="inline-flex items-center px-2 py-1 md:px-3 md:py-2 border border-blue-300 rounded-md text-xs md:text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-colors duration-200"
                            title="View Emulator"
                          >
                            <EyeIcon className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                            <span className="hidden md:inline ml-1">View</span>
                          </button>

                          {/* Start/Stop Button */}
                          {emulator.status === "stopped" ? (
                            <button
                              onClick={() => handleStartEmulator(emulator)}
                              disabled={isEmulatorLoading}
                              className="inline-flex items-center px-2 py-1 md:px-3 md:py-2 border border-green-300 rounded-md text-xs md:text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                              title="Start Emulator"
                            >
                              {isEmulatorLoading ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-b-2 border-green-600 md:mr-1"></div>
                                  <span className="hidden md:inline ml-1">
                                    Starting
                                  </span>
                                </>
                              ) : (
                                <>
                                  <PlayIcon className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                                  <span className="hidden md:inline ml-1">
                                    Start
                                  </span>
                                </>
                              )}
                            </button>
                          ) : emulator.status === "running" ? (
                            <button
                              onClick={() => handleStopEmulator(emulator)}
                              disabled={isEmulatorLoading}
                              className="inline-flex items-center px-2 py-1 md:px-3 md:py-2 border border-red-300 rounded-md text-xs md:text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 hover:border-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                              title="Stop Emulator"
                            >
                              {isEmulatorLoading ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-b-2 border-red-600 md:mr-1"></div>
                                  <span className="hidden md:inline ml-1">
                                    Stopping
                                  </span>
                                </>
                              ) : (
                                <>
                                  <StopIcon className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                                  <span className="hidden md:inline ml-1">
                                    Stop
                                  </span>
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              disabled
                              className="inline-flex items-center px-2 py-1 md:px-3 md:py-2 border border-gray-300 rounded-md text-xs md:text-sm font-medium text-gray-500 bg-gray-50 cursor-not-allowed"
                              title={`${emulator.status}...`}
                            >
                              <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-b-2 border-gray-400 md:mr-1"></div>
                              <span className="hidden md:inline ml-1">
                                {emulator.status}
                              </span>
                            </button>
                          )}

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteEmulator(emulator)}
                            disabled={
                              emulator.status !== "stopped" || isEmulatorLoading
                            }
                            className={`inline-flex items-center px-2 py-1 md:px-3 md:py-2 border rounded-md text-xs md:text-sm font-medium transition-colors duration-200 ${
                              emulator.status !== "stopped" || isEmulatorLoading
                                ? "border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed"
                                : "border-red-300 text-red-700 bg-red-50 hover:bg-red-100 hover:border-red-400"
                            }`}
                            title="Delete Emulator"
                          >
                            <TrashIcon className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                            <span className="hidden md:inline ml-1">
                              Delete
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
