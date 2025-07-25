import React, { useState, useEffect } from "react";
import EmulatorDashboard from "./components/EmulatorDashboard";
import EmulatorList from "./components/EmulatorList";
import Header from "./components/Header";
import { EmulatorProvider } from "./context/EmulatorContext";

function App() {
  const [selectedEmulator, setSelectedEmulator] = useState(null);
  const [view, setView] = useState("list"); // 'list' or 'dashboard'

  const handleEmulatorSelect = (emulator) => {
    setSelectedEmulator(emulator);
    setView("dashboard");
  };

  const handleBackToList = () => {
    setView("list");
    setSelectedEmulator(null);
  };

  return (
    <EmulatorProvider>
      <div className="min-h-screen bg-gray-100">
        <Header
          onBackToList={view === "dashboard" ? handleBackToList : null}
          selectedEmulator={selectedEmulator}
        />

        <main className="container mx-auto px-4 py-8">
          {view === "list" ? (
            <EmulatorList onEmulatorSelect={handleEmulatorSelect} />
          ) : (
            <EmulatorDashboard emulator={selectedEmulator} />
          )}
        </main>
      </div>
    </EmulatorProvider>
  );
}

export default App;
