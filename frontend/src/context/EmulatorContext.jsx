import React, { createContext, useContext, useReducer, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";

const EmulatorContext = createContext();

const initialState = {
  emulators: [],
  currentEmulator: null,
  loading: false,
  error: null,
  socket: null,
  screenStream: null,
  emulatorLoading: {}, // Track loading state per emulator
};

function emulatorReducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_EMULATOR_LOADING":
      return {
        ...state,
        emulatorLoading: {
          ...state.emulatorLoading,
          [action.payload.id]: action.payload.loading,
        },
      };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "SET_EMULATORS":
      return { ...state, emulators: action.payload, loading: false };
    case "SET_CURRENT_EMULATOR":
      return { ...state, currentEmulator: action.payload };
    case "UPDATE_EMULATOR":
      return {
        ...state,
        emulators: state.emulators.map((emu) =>
          emu.id === action.payload.id ? { ...emu, ...action.payload } : emu
        ),
        currentEmulator:
          state.currentEmulator?.id === action.payload.id
            ? { ...state.currentEmulator, ...action.payload }
            : state.currentEmulator,
      };
    case "SET_SOCKET":
      return { ...state, socket: action.payload };
    case "SET_SCREEN_STREAM":
      return { ...state, screenStream: action.payload };
    default:
      return state;
  }
}

export function EmulatorProvider({ children }) {
  const [state, dispatch] = useReducer(emulatorReducer, initialState);

  useEffect(() => {
    // Initialize socket connection
    const socket = io();
    dispatch({ type: "SET_SOCKET", payload: socket });

    socket.on("emulator-status-changed", (data) => {
      console.log("🔄 WebSocket: emulator-status-changed received:", data);
      console.log(
        "📊 Current emulator state before update:",
        state.emulators.find((e) => e.id === data.id)
      );
      console.log(
        "📊 Current loading state before update:",
        state.emulatorLoading[data.id]
      );

      dispatch({ type: "UPDATE_EMULATOR", payload: data });

      // Clear loading state when emulator reaches a stable state
      if (data.status === "running" || data.status === "stopped") {
        console.log(
          `Clearing loading state for emulator ${data.id} (status: ${data.status})`
        );
        dispatch({
          type: "SET_EMULATOR_LOADING",
          payload: { id: data.id, loading: false },
        });
      }
    });

    socket.on("screen-capture", (data) => {
      // Format the base64 data as a data URL for image sources
      const formattedData = `data:image/png;base64,${data}`;
      dispatch({ type: "SET_SCREEN_STREAM", payload: formattedData });
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
      dispatch({ type: "SET_ERROR", payload: error.message });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const value = {
    ...state,
    dispatch,
    // Helper function to get loading state for a specific emulator
    isEmulatorLoading: (emulatorId) =>
      state.emulatorLoading[emulatorId] || false,
    // Action functions
    startEmulator: async (emulatorId) => {
      try {
        dispatch({
          type: "SET_EMULATOR_LOADING",
          payload: { id: emulatorId, loading: true },
        });

        const response = await axios.post(`/api/emulators/${emulatorId}/start`);

        const result = response.data;
        dispatch({
          type: "UPDATE_EMULATOR",
          payload: { id: emulatorId, status: result.status },
        });
        return result;
      } catch (error) {
        const errorMessage =
          error.response?.data?.error ||
          error.message ||
          "Failed to start emulator";
        dispatch({ type: "SET_ERROR", payload: errorMessage });
        // Clear loading state on error
        dispatch({
          type: "SET_EMULATOR_LOADING",
          payload: { id: emulatorId, loading: false },
        });
        throw new Error(errorMessage);
      }
      // Don't clear loading state here - let WebSocket event handle it when status becomes "running"
    },

    stopEmulator: async (emulatorId) => {
      try {
        console.log(`🛑 Starting stop process for emulator ${emulatorId}`);
        dispatch({
          type: "SET_EMULATOR_LOADING",
          payload: { id: emulatorId, loading: true },
        });
        console.log(`🛑 Set loading=true for emulator ${emulatorId}`);

        const response = await axios.post(`/api/emulators/${emulatorId}/stop`);

        const result = response.data;
        console.log(`🛑 API response for ${emulatorId}:`, result);
        dispatch({
          type: "UPDATE_EMULATOR",
          payload: { id: emulatorId, status: result.status },
        });
        console.log(
          `🛑 Set status=${result.status} for emulator ${emulatorId}`
        );
        return result;
      } catch (error) {
        console.error(`🛑 Error stopping emulator ${emulatorId}:`, error);
        const errorMessage =
          error.response?.data?.error ||
          error.message ||
          "Failed to stop emulator";
        dispatch({ type: "SET_ERROR", payload: errorMessage });
        // Clear loading state on error
        dispatch({
          type: "SET_EMULATOR_LOADING",
          payload: { id: emulatorId, loading: false },
        });
        throw new Error(errorMessage);
      }
      // Don't clear loading state here - let WebSocket event handle it when status becomes "stopped"
    },
  };

  return (
    <EmulatorContext.Provider value={value}>
      {children}
    </EmulatorContext.Provider>
  );
}

export function useEmulator() {
  const context = useContext(EmulatorContext);
  if (!context) {
    throw new Error("useEmulator must be used within an EmulatorProvider");
  }
  return context;
}
