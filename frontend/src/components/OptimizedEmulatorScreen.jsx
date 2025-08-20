import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useEmulator } from "../context/EmulatorContext";
import {
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
  CogIcon,
  DevicePhoneMobileIcon,
  InformationCircleIcon,
  ClockIcon,
  SignalIcon,
  BugAntIcon,
} from "@heroicons/react/24/outline";
import FeedbackModal from "./FeedbackModal";
import EmulatorStartStopButton from "./EmulatorStartStopButton";

const EmulatorCanvas = React.memo(
  ({
    canvasRef,
    handleClick,
    handleMouseDown,
    handleTouchStart,
    isInteracting,
  }) => (
    <canvas
      ref={canvasRef}
      className={`bg-black shadow-2xl rounded-2xl ${
        isInteracting ? "cursor-pointer" : "cursor-crosshair"
      }`}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      width={1080}
      height={2340}
      style={{
        width: "324px",
        height: "703px",
      }}
    />
  )
);

function OptimizedEmulatorScreen({
  emulator,
  currentStatus,
  emulatorLoading,
  handleStartEmulator,
  handleStopEmulator,
}) {
  const canvasRef = useRef(null);
  const { socket, error } = useEmulator();
  const [isInteracting, setIsInteracting] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statsUpdate, setStatsUpdate] = useState(0); // Force re-render when stats update

  const streamStatsRef = useRef({
    lastUpdate: null,
    frameCount: 0,
    startTime: Date.now(),
    fps: 0,
  });

  const inputQueueRef = useRef([]);
  const inputTimeoutRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", {
      alpha: false, // Better performance
      desynchronized: true, // Allow async rendering
      willReadFrequently: false, // Optimize for write operations
    });

    // Optimal rendering settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium"; // Balance quality/performance
  }, []);

  const handleDirectImageRender = useCallback(
    async (base64Data) => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      try {
        // Convert base64 to blob for createImageBitmap
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: "image/jpeg" });

        if (window.createImageBitmap) {
          const bitmap = await createImageBitmap(blob);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          bitmap.close(); // Free memory
        } else {
          // Fallback for browsers without createImageBitmap
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = `data:image/jpeg;base64,${base64Data}`;
        }

        // Update stats and trigger re-render
        streamStatsRef.current.frameCount++;
        streamStatsRef.current.lastUpdate = new Date().toLocaleTimeString();

        // Calculate FPS every 30 frames and trigger UI update
        if (streamStatsRef.current.frameCount % 30 === 0) {
          const now = Date.now();
          const elapsed = (now - streamStatsRef.current.startTime) / 1000;
          streamStatsRef.current.fps = Math.round(
            streamStatsRef.current.frameCount / elapsed
          );
          // Trigger re-render for FPS update
          setStatsUpdate((prev) => prev + 1);
        } else if (streamStatsRef.current.frameCount % 5 === 0) {
          // Trigger re-render every 5 frames for lastUpdate display
          setStatsUpdate((prev) => prev + 1);
        }

        setIsStreaming(true);
        setStreamError(null);
      } catch (error) {
        console.error("Image rendering error:", error);
      }
    },
    [setStatsUpdate]
  );

  const sendBatchedInput = useCallback(() => {
    if (inputQueueRef.current.length === 0 || !socket) return;

    const batch = [...inputQueueRef.current];
    inputQueueRef.current = [];

    // Send most recent input for responsiveness
    const latestInput = batch[batch.length - 1];

    socket.emit("emulator-input", {
      emulatorName: emulator.name,
      ...latestInput,
    });

    console.log(`📤 Sent batched input:`, latestInput);
  }, [socket, emulator]);

  const queueInput = useCallback(
    (inputData) => {
      inputQueueRef.current.push(inputData);

      // Clear existing timeout
      if (inputTimeoutRef.current) {
        clearTimeout(inputTimeoutRef.current);
      }

      // Send immediately for swipes, batch taps for 16ms (60fps)
      const delay = inputData.action === "swipe" ? 0 : 16;
      inputTimeoutRef.current = setTimeout(sendBatchedInput, delay);
    },
    [sendBatchedInput]
  );

  useEffect(() => {
    if (!socket || !emulator) return;

    console.log("Setting up optimized streaming for emulator:", emulator.name);

    const handleVideoChunk = (data) => {
      if (data.type === "screenshot" && data.data && canvasRef.current) {
        handleDirectImageRender(data.data);
      }
    };

    const handleStreamError = (error) => {
      console.error("Stream error:", error);
      setStreamError(error.error || "Stream error occurred");
      setIsStreaming(false);
    };

    const handleInputSuccess = (result) => {
      console.log("Input success:", result);
    };

    const handleInputError = (error) => {
      console.error("Input error:", error);
    };

    // Socket event listeners
    socket.on("videoChunk", handleVideoChunk);
    socket.on("streamError", handleStreamError);
    socket.on("input-success", handleInputSuccess);
    socket.on("input-error", handleInputError);

    // Configure socket for low latency
    socket.io.opts.forceNew = true;
    socket.io.opts.upgrade = true;
    socket.io.opts.transports = ["websocket"];

    // Start streaming
    startStreaming();

    return () => {
      socket.off("videoChunk", handleVideoChunk);
      socket.off("streamError", handleStreamError);
      socket.off("input-success", handleInputSuccess);
      socket.off("input-error", handleInputError);
      stopStreaming();
    };
  }, [socket, emulator, handleDirectImageRender]);

  const startStreaming = useCallback(() => {
    if (!socket || !emulator) return;

    console.log(`🎬 Starting optimized stream for ${emulator.name}`);

    // Reset stats
    streamStatsRef.current = {
      lastUpdate: null,
      frameCount: 0,
      startTime: Date.now(),
      fps: 0,
    };

    // Reset stats update counter to trigger initial UI update
    setStatsUpdate(0);

    socket.emit("start-screen-stream", emulator.name);
    setIsStreaming(true);
    setStreamError(null);
  }, [socket, emulator]);

  const stopStreaming = useCallback(() => {
    if (!socket) return;

    console.log("🛑 Stopping optimized stream");
    socket.emit("stop-screen-stream");
    setIsStreaming(false);
  }, [socket]);

  const refreshStreaming = useCallback(async () => {
    if (!emulator || isRefreshing) return;

    try {
      setIsRefreshing(true);
      setStreamError(null);

      const response = await fetch(`/api/streaming/restart/${emulator.name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to restart stream: ${response.statusText}`);
      }

      console.log("Stream refreshed successfully");

      if (isStreaming) {
        stopStreaming();
        setTimeout(startStreaming, 1000);
      }
    } catch (error) {
      console.error("Failed to refresh stream:", error);
      setStreamError(`Refresh failed: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [emulator, isRefreshing, isStreaming, stopStreaming, startStreaming]);

  const getCoordinates = useCallback((event) => {
    if (!canvasRef.current) return null;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const clientX =
      event.clientX || (event.touches && event.touches[0]?.clientX);
    const clientY =
      event.clientY || (event.touches && event.touches[0]?.clientY);

    if (clientX === undefined || clientY === undefined) return null;

    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    if (
      clickX < 0 ||
      clickY < 0 ||
      clickX > rect.width ||
      clickY > rect.height
    ) {
      return null;
    }

    // Direct scaling calculation
    const deviceX = Math.round(clickX * (1080 / 324));
    const deviceY = Math.round(clickY * (2340 / 703));

    return {
      x: Math.max(0, Math.min(1079, deviceX)),
      y: Math.max(0, Math.min(2339, deviceY)),
    };
  }, []);

  const handleClick = useCallback(
    (event) => {
      if (!socket || isInteracting) return;

      const coords = getCoordinates(event);
      if (!coords) return;

      setIsInteracting(true);

      queueInput({
        action: "tap",
        coordinates: coords,
      });

      setTimeout(() => setIsInteracting(false), 50);
    },
    [socket, isInteracting, getCoordinates, queueInput]
  );

  const handleMouseDown = useCallback(
    (event) => {
      if (event.button !== 0 || isInteracting) return; // Only handle left mouse button

      const coords = getCoordinates(event);
      if (!coords) return;

      setIsInteracting(true);
      const startCoords = coords;

      const handleMouseMove = (moveEvent) => {
        const currentCoords = getCoordinates(moveEvent);
        if (!currentCoords) return;

        // Calculate distance to determine if it's a swipe
        const distance = Math.sqrt(
          Math.pow(currentCoords.x - startCoords.x, 2) +
            Math.pow(currentCoords.y - startCoords.y, 2)
        );

        if (distance > 10) {
          // It's a swipe
          socket.emit("emulator-input", {
            emulatorName: emulator.name,
            action: "swipe",
            coordinates: {
              startX: startCoords.x,
              startY: startCoords.y,
              endX: currentCoords.x,
              endY: currentCoords.y,
            },
          });

          cleanup();
        }
      };

      const handleMouseUp = () => {
        cleanup();
      };

      const cleanup = () => {
        setIsInteracting(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      // Auto-cleanup after 3 seconds
      setTimeout(cleanup, 3000);
    },
    [isInteracting, getCoordinates, queueInput]
  );

  const handleTouchStart = useCallback(
    (event) => {
      event.preventDefault();
      if (isInteracting || event.touches.length !== 1) return;

      const coords = getCoordinates(event.touches[0]);
      if (!coords) return;

      setIsInteracting(true);
      const startCoords = coords;
      const startTime = Date.now();

      const handleTouchMove = (moveEvent) => {
        moveEvent.preventDefault();
        if (moveEvent.touches.length !== 1) return;

        const currentCoords = getCoordinates(moveEvent.touches[0]);
        if (!currentCoords) return;

        const distance = Math.sqrt(
          Math.pow(currentCoords.x - startCoords.x, 2) +
            Math.pow(currentCoords.y - startCoords.y, 2)
        );

        if (distance > 15) {
          console.log("🔄 Sending swipe:", {
            startX: startCoords.x,
            startY: startCoords.y,
            endX: currentCoords.x,
            endY: currentCoords.y,
            distance,
          });

          socket.emit("emulator-input", {
            emulatorName: emulator.name,
            action: "swipe",
            coordinates: {
              startX: startCoords.x,
              startY: startCoords.y,
              endX: currentCoords.x,
              endY: currentCoords.y,
            },
          });

          cleanup();
        }
      };

      const handleTouchEnd = (endEvent) => {
        endEvent.preventDefault();
        const endTime = Date.now();
        const duration = endTime - startTime;

        if (duration < 300) {
          console.log("👆 Sending tap:", startCoords);

          socket.emit("emulator-input", {
            emulatorName: emulator.name,
            action: "tap",
            coordinates: startCoords,
          });
        }

        cleanup();
      };

      const cleanup = () => {
        setIsInteracting(false);
        canvasRef.current?.removeEventListener("touchmove", handleTouchMove);
        canvasRef.current?.removeEventListener("touchend", handleTouchEnd);
      };

      canvasRef.current?.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      canvasRef.current?.addEventListener("touchend", handleTouchEnd, {
        passive: false,
      });

      setTimeout(cleanup, 3000);
    },
    [isInteracting, getCoordinates, queueInput]
  );

  const statusDisplay = useMemo(() => {
    const stats = streamStatsRef.current;

    return {
      status: isStreaming ? "🔴 Live" : "⭕ Offline",
      lastUpdate: stats.lastUpdate,
      fps: stats.fps,
      frameCount: stats.frameCount,
    };
  }, [isStreaming, statsUpdate]); // Use statsUpdate instead of frameCount

  useEffect(() => {
    return () => {
      if (inputTimeoutRef.current) {
        clearTimeout(inputTimeoutRef.current);
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="text-red-500 text-lg font-semibold mb-2">
            Connection Error
          </div>
          <div className="text-gray-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Panel - Actions */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col space-y-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Actions</h3>
          <div className="w-full h-px bg-gray-200"></div>
        </div>

        {/* Stream Controls */}
        <div className="space-y-3">
          <EmulatorStartStopButton
            currentStatus={currentStatus}
            emulatorLoading={emulatorLoading}
            handleStartEmulator={handleStartEmulator}
            handleStopEmulator={handleStopEmulator}
          />

          {!isStreaming ? (
            <button
              onClick={startStreaming}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
            >
              <PlayIcon className="h-5 w-5 mr-2" />
              Start Stream
            </button>
          ) : (
            <button
              onClick={stopStreaming}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
            >
              <StopIcon className="h-5 w-5 mr-2" />
              Stop Stream
            </button>
          )}

          <button
            onClick={refreshStreaming}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors ${
              isRefreshing ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={!emulator || isRefreshing}
          >
            <ArrowPathIcon
              className={`h-5 w-5 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            onClick={() => setShowFeedbackModal(true)}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
          >
            <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
            Feedback
          </button>
        </div>

        {/* Optimized Stream Status */}
        <div className="!mt-auto">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Stream Status
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isStreaming
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {statusDisplay.status}
              </div>
            </div>

            {statusDisplay.lastUpdate && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Frame:</span>
                <span className="text-xs text-gray-500">
                  {statusDisplay.lastUpdate}
                </span>
              </div>
            )}

            {statusDisplay.fps > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">FPS:</span>
                <span className="text-xs text-gray-500">
                  {statusDisplay.fps}
                </span>
              </div>
            )}

            {statusDisplay.frameCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Frames:</span>
                <span className="text-xs text-gray-500">
                  {statusDisplay.frameCount}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stream Error */}
        {streamError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-700">
              <strong>Stream Error:</strong> {streamError}
            </div>
          </div>
        )}
      </div>

      {/* Center Panel - Optimized Device Display */}
      <div className="flex-1 flex items-center justify-center bg-gray-100 p-8">
        <div className="relative">
          <EmulatorCanvas
            canvasRef={canvasRef}
            handleClick={handleClick}
            handleMouseDown={handleMouseDown}
            handleTouchStart={handleTouchStart}
            isInteracting={isInteracting}
          />

          {/* Optimized overlay states */}
          {!isStreaming ? (
            <div className="absolute inset-0 flex items-center justify-center text-white pointer-events-none rounded-2xl">
              <div className="text-center">
                <div className="text-gray-400 text-4xl mb-4">📱</div>
                <div className="text-xl font-semibold mb-2">No Stream</div>
                <div className="text-sm opacity-75">
                  Click "Start Stream" to begin
                </div>
              </div>
            </div>
          ) : (
            !statusDisplay.lastUpdate && (
              <div className="absolute inset-0 flex items-center justify-center text-white pointer-events-none rounded-2xl">
                <div className="text-center">
                  <div className="text-green-400 text-4xl mb-4 animate-pulse">
                    📡
                  </div>
                  <div className="text-xl font-semibold mb-2">
                    Connecting...
                  </div>
                  <div className="text-sm opacity-75">
                    Waiting for device screen...
                  </div>
                </div>
              </div>
            )
          )}

          {/* Interaction feedback */}
          {isInteracting && (
            <div className="absolute inset-0 bg-blue-500 bg-opacity-20 rounded-2xl pointer-events-none" />
          )}
        </div>
      </div>

      {/* Right Panel - Device Info */}
      <div className="w-64 bg-white border-l border-gray-200 p-4 flex flex-col space-y-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Device Info
          </h3>
          <div className="w-full h-px bg-gray-200"></div>
        </div>

        {/* Optimized Device Information */}
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center mb-2">
              <DevicePhoneMobileIcon className="h-5 w-5 text-gray-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">Device</span>
            </div>
            <div className="text-sm text-gray-600">
              <div>Name: {emulator?.name || "Unknown"}</div>
              <div>Resolution: 1080x2340</div>
              <div>API Level: 29</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center mb-2">
              <SignalIcon className="h-5 w-5 text-gray-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                Connection
              </span>
            </div>
            <div className="text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>WebSocket:</span>
                <span className={socket ? "text-green-600" : "text-red-600"}>
                  {socket ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Stream:</span>
                <span
                  className={isStreaming ? "text-green-600" : "text-red-600"}
                >
                  {isStreaming ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center mb-2">
              <ClockIcon className="h-5 w-5 text-gray-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                Performance
              </span>
            </div>
            <div className="text-sm text-gray-600">
              <div>Target FPS: 15</div>
              <div>Quality: 75%</div>
              <div>Format: JPEG</div>
              <div>Compression: ✅</div>
            </div>
          </div>
        </div>

        {/* Settings & Debug */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Settings</h4>
          <div className="space-y-2">
            <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg flex items-center justify-start text-sm transition-colors">
              <CogIcon className="h-4 w-4 mr-2" />
              Device Settings
            </button>
            <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg flex items-center justify-start text-sm transition-colors">
              <BugAntIcon className="h-4 w-4 mr-2" />
              Debug Mode
            </button>
            <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg flex items-center justify-start text-sm transition-colors">
              <InformationCircleIcon className="h-4 w-4 mr-2" />
              About
            </button>
          </div>
        </div>
      </div>

      {/* Lazy-loaded Feedback Modal */}
      {showFeedbackModal && (
        <React.Suspense fallback={<div>Loading...</div>}>
          <FeedbackModal
            emulator={emulator}
            onClose={() => setShowFeedbackModal(false)}
          />
        </React.Suspense>
      )}
    </div>
  );
}

export default OptimizedEmulatorScreen;
