import React, { useRef, useEffect, useState } from "react";
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

function EmulatorScreen({
  emulator,
  currentStatus,
  emulatorLoading,
  handleStartEmulator,
  handleStopEmulator,
}) {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const { socket, error } = useEmulator();
  const [isInteracting, setIsInteracting] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastDrawTime = useRef(0);

  // Continuous canvas drawing function with frame rate limiting to reduce jitter
  const drawVideoToCanvas = React.useCallback(() => {
    const now = performance.now();
    const frameInterval = 1000 / 60; // 60 FPS for smoother playback with faster chunks

    // Only draw if enough time has passed since last frame
    if (now - lastDrawTime.current >= frameInterval) {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        // More permissive condition - draw if video has any data available
        if (
          video.readyState >= 2 &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          // HAVE_CURRENT_DATA
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setLastUpdate(new Date().toLocaleTimeString());
        }
      }
      lastDrawTime.current = now;
    }

    // Continue animation loop only if we have an active frame request
    if (animationRef.current) {
      animationRef.current = requestAnimationFrame(drawVideoToCanvas);
    }
  }, []);

  useEffect(() => {
    if (!socket || !emulator) return;

    console.log("Setting up WebRTC video stream for emulator:", emulator.name);

    // Set up WebSocket listeners for WebRTC video streaming
    const handleVideoChunk = (data) => {
      if (data.type === "screenshot" && data.data && canvasRef.current) {
        // Handle screenshot data (unified approach for both local and VM)
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const img = new Image();

        img.onload = () => {
          // Clear and draw with smooth scaling for optimal quality
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setLastUpdate(new Date().toLocaleTimeString());
        };

        img.src = `data:image/png;base64,${data.data}`;
        setIsStreaming(true);
        setStreamError(null);
      } else if (data.type === "mp4" && data.data) {
        // Handle WebRTC video data with smoother playback (optimized for local)
        try {
          // Convert base64 to Uint8Array
          const binaryString = atob(data.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const blob = new Blob([bytes], { type: "video/mp4" });
          const videoUrl = URL.createObjectURL(blob);

          // Use the existing video element to play the chunk smoothly
          if (videoRef.current) {
            const video = videoRef.current;

            // Store previous URL for cleanup after new one is loaded
            const previousUrl = video.src;

            video.src = videoUrl;
            video.muted = true;
            video.playsInline = true;
            video.loop = false; // Don't loop - play each chunk once for smoother streaming

            video.onloadeddata = () => {
              // Clean up previous URL only after new one is loaded
              if (previousUrl && previousUrl.startsWith("blob:")) {
                setTimeout(() => URL.revokeObjectURL(previousUrl), 100);
              }

              video.currentTime = 0;
              video
                .play()
                .catch((err) => console.warn("Playback failed:", err));

              // Set last update to indicate we have data
              setLastUpdate(new Date().toLocaleTimeString());

              // Ensure animation frame is running if streaming is active
              if (!animationRef.current) {
                animationRef.current = requestAnimationFrame(drawVideoToCanvas);
              }
            };

            video.onerror = (err) => {
              console.error("Video playback error:", err);
              URL.revokeObjectURL(videoUrl);
            };

            // Clean up after video chunk duration + buffer (2 seconds for ultra-low latency)
            setTimeout(() => {
              if (video.src === videoUrl) {
                URL.revokeObjectURL(videoUrl);
              }
            }, 2000); // Reduced from 2500ms to 2000ms
          }

          setIsStreaming(true);
          setStreamError(null);

          // Backup: Set last update to indicate we received data, even if video processing fails
          setTimeout(() => {
            if (isStreaming && !lastUpdate) {
              setLastUpdate(new Date().toLocaleTimeString());
            }
          }, 1000);
        } catch (error) {
          console.error("Error processing video chunk:", error);
        }
      }
    };

    const handleStreamError = (error) => {
      console.error("Stream error:", error);
      setStreamError(error.error || "Stream error occurred");
      setIsStreaming(false);
    };

    const handleInputSuccess = (result) => {
      console.log("✅ Input success:", result);
    };

    const handleInputError = (error) => {
      console.error("❌ Input error:", error);
    };

    const handleDeviceInfo = (info) => {
      // Device resolution received
    };

    socket.on("videoChunk", handleVideoChunk);
    socket.on("streamError", handleStreamError);
    socket.on("input-success", handleInputSuccess);
    socket.on("input-error", handleInputError);
    socket.on("device-info", handleDeviceInfo);

    // Start streaming
    startStreaming();

    return () => {
      socket.off("videoChunk", handleVideoChunk);
      socket.off("streamError", handleStreamError);
      socket.off("input-success", handleInputSuccess);
      socket.off("input-error", handleInputError);
      socket.off("device-info", handleDeviceInfo);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      stopStreaming();
    };
  }, [socket, emulator]); // Remove drawVideoToCanvas dependency to prevent useEffect loop

  const startStreaming = () => {
    if (!socket || !emulator) return;

    // Reset state
    setLastUpdate(null);

    socket.emit("start-screen-stream", emulator.name);
    setIsStreaming(true);
    setStreamError(null);

    // Start animation frame loop for smooth rendering
    if (!animationRef.current) {
      animationRef.current = requestAnimationFrame(drawVideoToCanvas);
    }
  };

  const stopStreaming = () => {
    if (!socket) return;

    console.log("Stopping WebRTC video stream");
    socket.emit("stop-screen-stream");
    setIsStreaming(false);

    // Stop animation frame
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Pause video
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const refreshStreaming = async () => {
    if (!emulator || isRefreshing) return;

    try {
      setIsRefreshing(true);
      setStreamError(null);
      console.log(`Refreshing stream for ${emulator.name}...`);

      // Call the backend restart API
      const response = await fetch(`/api/streaming/restart/${emulator.name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to restart stream: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Stream refreshed:", result);

      // If we were streaming, restart it
      if (isStreaming) {
        stopStreaming();
        setTimeout(() => {
          startStreaming();
        }, 1000); // Wait 1 second before restarting
      }
    } catch (error) {
      console.error("Failed to refresh stream:", error);
      setStreamError(`Failed to refresh stream: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMouseDown = (event) => {
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
  };

  const getCoordinates = (event) => {
    if (!canvasRef.current) return null;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Handle both mouse and touch events
    const clientX =
      event.clientX || (event.touches && event.touches[0]?.clientX);
    const clientY =
      event.clientY || (event.touches && event.touches[0]?.clientY);

    if (clientX === undefined || clientY === undefined) return null;

    // Get click position relative to the displayed canvas
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    // Validate click is within bounds
    if (
      clickX < 0 ||
      clickY < 0 ||
      clickX > rect.width ||
      clickY > rect.height
    ) {
      return null;
    }

    // CRITICAL: Use the actual styled dimensions, not rect
    // Canvas CSS dimensions: width: "324px", height: "703px" (1080x2340 aspect ratio)
    const displayWidth = 324;
    const displayHeight = 703;

    // Device resolution from canvas attributes (updated to match actual emulator resolution)
    const deviceWidth = canvas.width; // 1080
    const deviceHeight = canvas.height; // 2340

    // Calculate scaling factors
    const scaleX = deviceWidth / displayWidth; // 1080 / 324 = 3.333...
    const scaleY = deviceHeight / displayHeight; // 2340 / 703 = 3.328...

    // Apply scaling to get device coordinates
    const deviceX = Math.round(clickX * scaleX);
    const deviceY = Math.round(clickY * scaleY);

    // Clamp to device bounds
    const finalX = Math.max(0, Math.min(deviceWidth - 1, deviceX));
    const finalY = Math.max(0, Math.min(deviceHeight - 1, deviceY));

    return { x: finalX, y: finalY };
  };

  // UPDATED: Touch event handler with better coordinate handling
  const handleTouchStart = (event) => {
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
  };

  // UPDATED: Click handler with better logging
  const handleClick = (event) => {
    if (!socket || isInteracting) return;

    const coords = getCoordinates(event);
    if (!coords) return;

    setIsInteracting(true);

    console.log("🖱️ Sending click:", coords);

    socket.emit("emulator-input", {
      emulatorName: emulator.name,
      action: "tap",
      coordinates: coords,
    });

    setTimeout(() => setIsInteracting(false), 100);
  };

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

        {/* Stream Status */}
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
                {isStreaming ? "🔴 Live" : "⭕ Offline"}
              </div>
            </div>
            {lastUpdate && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Update:</span>
                <span className="text-xs text-gray-500">{lastUpdate}</span>
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

      {/* Center Panel - Device */}
      <div className="flex-1 flex items-center justify-center bg-gray-100 p-8">
        <div className="relative">
          {/* Hidden video element for WebRTC processing */}
          <video ref={videoRef} style={{ display: "none" }} muted playsInline />

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
              width: "324px", // Base width for good mobile phone size
              height: "703px", // 324 * (2340/1080) = 703px - correct 1080x2340 aspect ratio
            }}
          />

          {/* Overlay content when not streaming or streaming placeholder */}
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
            !lastUpdate && (
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

          {isInteracting && (
            <div className="absolute inset-0 bg-blue-500 bg-opacity-20 rounded-2xl pointer-events-none" />
          )}
        </div>
      </div>

      {/* Right Panel - Information & Settings */}
      <div className="w-64 bg-white border-l border-gray-200 p-4 flex flex-col space-y-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Device Info
          </h3>
          <div className="w-full h-px bg-gray-200"></div>
        </div>

        {/* Device Information */}
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
              <div>Frame Rate: 60 FPS</div>
              <div>Chunk Size: 0.5s</div>
              <div>Bitrate: 300K</div>
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

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <FeedbackModal
          emulator={emulator}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}
    </div>
  );
}

export default EmulatorScreen;
