import React, { createContext, useContext, useReducer, useEffect } from "react";
import io from "socket.io-client";

const EmulatorContext = createContext();

const initialState = {
  emulators: [],
  currentEmulator: null,
  loading: false,
  error: null,
  socket: null,
  screenStream: null,
};

function emulatorReducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
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
    const socket = io("http://localhost:3001");
    dispatch({ type: "SET_SOCKET", payload: socket });

    socket.on("emulator-status-changed", (data) => {
      dispatch({ type: "UPDATE_EMULATOR", payload: data });
    });

    socket.on("screen-capture", (data) => {
      dispatch({ type: "SET_SCREEN_STREAM", payload: data });
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
