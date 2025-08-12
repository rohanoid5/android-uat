import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import EmulatorList from "./components/EmulatorList";
import EmulatorPage from "./components/EmulatorPage";
import Header from "./components/Header";
import { EmulatorProvider } from "./context/EmulatorContext";

function App() {
  return (
    <EmulatorProvider>
      <Router>
        <div className="min-h-screen bg-gray-100">
          <Header />

          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<EmulatorList />} />
              <Route path="/emulator/:emulatorId" element={<EmulatorPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </EmulatorProvider>
  );
}

export default App;
