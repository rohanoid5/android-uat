import React, { useRef, useEffect, useState } from "react";
import { useEmulator } from "../context/EmulatorContext";

function EmulatorScreen({ emulator, screenStream }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const { socket, error } = useEmulator();
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    if (screenStream && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // Create an image from the base64 data
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      };
      img.src = `data:image/png;base64,${screenStream}`;
    }
  }, [screenStream]);

  useEffect(() => {
    // Start screen capture when component mounts and emulator is available
    if (socket && emulator) {
      socket.emit("start-screen-capture", emulator.name);

      return () => {
        // Stop screen capture when component unmounts
        socket.emit("stop-screen-capture");
      };
    }
  }, [socket, emulator]);

  const handleCanvasClick = (event) => {
    if (!socket || !emulator) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    setIsInteracting(true);
    socket.emit("emulator-input", {
      emulatorName: emulator.name,
      action: "tap",
      coordinates: { x: Math.round(x), y: Math.round(y) },
    });

    // Visual feedback
    setTimeout(() => setIsInteracting(false), 200);
  };

  const handleCanvasSwipe = (event) => {
    if (!socket || !emulator) return;

    // Simple swipe detection (can be enhanced)
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const startX = (event.touches[0].clientX - rect.left) * scaleX;
    const startY = (event.touches[0].clientY - rect.top) * scaleY;

    socket.emit("emulator-input", {
      emulatorName: emulator.name,
      action: "swipe",
      coordinates: {
        startX: Math.round(startX),
        startY: Math.round(startY),
        direction: "up", // This would need proper gesture detection
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Device Screen</h3>
        <div className="flex items-center space-x-2">
          <div
            className={`w-2 h-2 rounded-full ${
              screenStream ? "bg-green-500" : "bg-red-500"
            }`}
          ></div>
          <span className="text-sm text-gray-600">
            {screenStream ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="emulator-screen relative overflow-hidden"
      >
        {screenStream ? (
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onTouchStart={handleCanvasSwipe}
            className={`w-full h-full cursor-pointer transition-opacity ${
              isInteracting ? "opacity-80" : "opacity-100"
            }`}
            style={{ imageRendering: "crisp-edges" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
            <div className="text-center">
              {error ? (
                <>
                  <div className="text-red-400 text-4xl mb-4">⚠</div>
                  <p className="text-red-400 mb-2">Connection Error</p>
                  <p className="text-sm text-gray-400">{error}</p>
                </>
              ) : (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p>Connecting to emulator...</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Touch feedback overlay */}
        {isInteracting && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-20 pointer-events-none"></div>
        )}
      </div>

      <div className="text-xs text-gray-500 text-center">
        Click or tap on the screen to interact with the emulator
      </div>
    </div>
  );
}

export default EmulatorScreen;
