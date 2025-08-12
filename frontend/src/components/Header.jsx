import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isEmulatorPage = location.pathname.startsWith('/emulator/');
  
  const getTitle = () => {
    if (isEmulatorPage) {
      return "UAT Control Center";
    }
    return "UAT Control Center";
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <h1 
              className="text-xl font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => navigate('/')}
            >
              {getTitle()}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {isEmulatorPage && (
              <button
                onClick={() => navigate('/')}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                All Emulators
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
