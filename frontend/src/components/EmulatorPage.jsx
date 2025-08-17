import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEmulator } from "../context/EmulatorContext";
import EmulatorDashboard from "./EmulatorDashboard";
import { PlayIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import axios from "axios";

function EmulatorPage() {
  const { emulatorId } = useParams();
  const navigate = useNavigate();
  const { emulators, startEmulator, emulatorLoading, dispatch } = useEmulator();
  const [emulator, setEmulator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEmulatorData();
  }, [emulatorId]);

  const fetchEmulatorData = async () => {
    try {
      setLoading(true);
      setError(null);

      // First try to get emulator from context
      let foundEmulator = emulators.find((e) => e.id === emulatorId);

      if (!foundEmulator) {
        // If not in context, fetch from API
        const response = await axios.get("/api/emulators");
        const allEmulators = response.data;
        foundEmulator = allEmulators.find((e) => e.id === emulatorId);

        // Update context with fresh data
        dispatch({ type: "SET_EMULATORS", payload: allEmulators });
      }

      if (!foundEmulator) {
        setError(`Emulator "${emulatorId}" not found`);
        return;
      }

      setEmulator(foundEmulator);
    } catch (err) {
      console.error("Error fetching emulator data:", err);
      setError(err.message || "Failed to load emulator data");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEmulator = async () => {
    try {
      await startEmulator(emulatorId);
      // Refresh emulator data after starting
      setTimeout(() => {
        fetchEmulatorData();
      }, 2000);
    } catch (error) {
      console.error("Error starting emulator:", error);
      setError(error.message || "Failed to start emulator");
    }
  };

  const handleBackToList = () => {
    navigate("/");
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-8">
          <button
            onClick={handleBackToList}
            className="control-button secondary flex items-center mr-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to List
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            Loading Emulator...
          </h1>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-8">
          <button
            onClick={handleBackToList}
            className="control-button secondary flex items-center mr-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to List
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            Emulator Not Found
          </h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
          <button
            onClick={handleBackToList}
            className="mt-4 control-button secondary"
          >
            Go Back to Emulator List
          </button>
        </div>
      </div>
    );
  }

  if (!emulator) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-8">
          <button
            onClick={handleBackToList}
            className="control-button secondary flex items-center mr-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to List
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            Emulator Not Found
          </h1>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">
            Emulator Not Found
          </h2>
          <p className="text-yellow-700">
            The emulator "{emulatorId}" could not be found. It may have been
            deleted or renamed.
          </p>
          <button
            onClick={handleBackToList}
            className="mt-4 control-button secondary"
          >
            Go Back to Emulator List
          </button>
        </div>
      </div>
    );
  }

  const isStarting = emulatorLoading[emulatorId];
  const currentStatus =
    emulators.find((e) => e.id === emulatorId)?.status || emulator.status;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header with back button and emulator info */}
      {/* <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <button
            onClick={handleBackToList}
            className="control-button secondary flex items-center mr-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to List
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {emulator.name}
            </h1>
            <div className="flex items-center mt-2 space-x-4">
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  currentStatus === "running"
                    ? "bg-green-100 text-green-800"
                    : currentStatus === "starting"
                    ? "bg-yellow-100 text-yellow-800"
                    : currentStatus === "stopping"
                    ? "bg-orange-100 text-orange-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {currentStatus}
              </div>
              {emulator.apiLevel && (
                <span className="text-sm text-gray-600">
                  API Level: {emulator.apiLevel}
                </span>
              )}
              {emulator.arch && (
                <span className="text-sm text-gray-600">
                  Arch: {emulator.arch}
                </span>
              )}
            </div>
          </div>
        </div>

        {currentStatus === "stopped" && (
          <button
            onClick={handleStartEmulator}
            disabled={isStarting}
            className="control-button success flex items-center"
          >
            {isStarting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Starting...
              </>
            ) : (
              <>
                <PlayIcon className="h-5 w-5 mr-2" />
                Start Emulator
              </>
            )}
          </button>
        )}
      </div> */}

      {/* Emulator content */}
      {currentStatus === "running" ? (
        <EmulatorDashboard emulator={emulator} />
      ) : currentStatus === "starting" ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">
              Starting Emulator
            </h2>
            <p className="text-yellow-700">
              Please wait while the emulator "{emulator.name}" is starting up.
              This may take a few moments.
            </p>
          </div>
        </div>
      ) : currentStatus === "stopping" ? (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold text-orange-800 mb-2">
              Stopping Emulator
            </h2>
            <p className="text-orange-700">
              The emulator "{emulator.name}" is being stopped.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-blue-800 mb-4">
              Emulator is Stopped
            </h2>
            <p className="text-blue-700 mb-6">
              The emulator "{emulator.name}" is currently stopped. Click the
              start button to launch it.
            </p>
            <button
              onClick={handleStartEmulator}
              disabled={isStarting}
              className="control-button success flex items-center mx-auto"
            >
              {isStarting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Starting...
                </>
              ) : (
                <>
                  <PlayIcon className="h-5 w-5 mr-2" />
                  Start Emulator
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmulatorPage;
