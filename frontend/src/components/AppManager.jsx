import React, { useState, useEffect } from "react";
import { useEmulator } from "../context/EmulatorContext";
import {
  PlusIcon,
  TrashIcon,
  PlayIcon,
  ArrowUpTrayIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";
import axios from "axios";

function AppManager({ emulator }) {
  const { socket } = useEmulator();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preinstallApks, setPreinstallApks] = useState([]);
  const [preinstalling, setPreinstalling] = useState(false);
  const [preinstallResult, setPreinstallResult] = useState(null);

  useEffect(() => {
    if (emulator) {
      fetchInstalledApps();
      fetchPreinstallApks();
    }
  }, [emulator]);

  const fetchInstalledApps = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/emulators/${emulator.id}/apps`);
      setApps(response.data);
    } catch (error) {
      console.error("Failed to fetch apps:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith(".apk")) {
      alert("Please select an APK file");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("apk", file);

    try {
      await axios.post(`/api/emulators/${emulator.id}/apps/install`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      await fetchInstalledApps();
      alert("App installed successfully!");
    } catch (error) {
      alert("Failed to install app: " + error.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleLaunchApp = async (packageName) => {
    try {
      await axios.post(
        `/api/emulators/${emulator.id}/apps/${packageName}/launch`
      );
    } catch (error) {
      alert("Failed to launch app: " + error.message);
    }
  };

  const fetchPreinstallApks = async () => {
    try {
      const response = await axios.get("/api/preinstall/apps");
      setPreinstallApks(response.data);
    } catch (error) {
      console.error("Failed to fetch preinstall APKs:", error);
    }
  };

  const handlePreinstall = async () => {
    if (!emulator) return;

    setPreinstalling(true);
    try {
      const response = await axios.post(
        `/api/emulators/${emulator.id}/preinstall`
      );
      setPreinstallResult(response.data);
      // Refresh installed apps list
      await fetchInstalledApps();
    } catch (error) {
      console.error("Failed to preinstall apps:", error);
      setPreinstallResult({
        installed: [],
        failed: [{ name: "preinstall", error: error.message }],
      });
    } finally {
      setPreinstalling(false);
    }
  };

  const handleLaunchPreinstalled = async () => {
    if (!emulator) return;

    try {
      const response = await axios.post(
        `/api/emulators/${emulator.id}/launch-preinstalled`
      );
      console.log("Launched preinstalled app:", response.data);
    } catch (error) {
      console.error("Failed to launch preinstalled app:", error);
    }
  };

  const handleUninstallApp = async (packageName) => {
    if (!confirm("Are you sure you want to uninstall this app?")) return;

    try {
      await axios.delete(`/api/emulators/${emulator.id}/apps/${packageName}`);
      await fetchInstalledApps();
    } catch (error) {
      alert("Failed to uninstall app: " + error.message);
    }
  };

  const filteredApps = apps.filter(
    (app) =>
      app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.packageName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">App Manager</h3>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <input
              type="file"
              accept=".apk"
              onChange={handleFileUpload}
              className="hidden"
              id="apk-upload"
            />
            <label
              htmlFor="apk-upload"
              className={`control-button primary flex items-center cursor-pointer ${
                uploading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
              {uploading ? "Installing..." : "Install APK"}
            </label>
          </div>
          <button
            onClick={fetchInstalledApps}
            disabled={loading}
            className="control-button secondary"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search apps..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Preinstall Section */}
      {preinstallApks.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-medium text-blue-900">Quick Install Apps</h4>
              <p className="text-sm text-blue-700">
                {preinstallApks.length} APK
                {preinstallApks.length !== 1 ? "s" : ""} available for quick
                installation
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handlePreinstall}
                disabled={preinstalling}
                className={`control-button primary flex items-center ${
                  preinstalling ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                {preinstalling ? "Installing..." : "Install All"}
              </button>
              <button
                onClick={handleLaunchPreinstalled}
                className="control-button secondary flex items-center"
              >
                <RocketLaunchIcon className="h-4 w-4 mr-2" />
                Launch App
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {preinstallApks.map((apk, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
              >
                {apk.name}
              </span>
            ))}
          </div>

          {/* Preinstall Results */}
          {preinstallResult && (
            <div className="mt-3 p-3 bg-white rounded border">
              <div className="text-sm">
                {preinstallResult.installed.length > 0 && (
                  <div className="text-green-600 mb-1">
                    ✅ Installed: {preinstallResult.installed.join(", ")}
                  </div>
                )}
                {preinstallResult.failed.length > 0 && (
                  <div className="text-red-600">
                    ❌ Failed:{" "}
                    {preinstallResult.failed.map((f) => f.name).join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Apps List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApps.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm
                ? "No apps found matching your search"
                : "No apps installed"}
            </div>
          ) : (
            filteredApps.map((app) => (
              <div
                key={app.packageName}
                className="bg-gray-50 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    {app.icon ? (
                      <img
                        src={app.icon}
                        alt={app.name}
                        className="w-8 h-8 rounded"
                      />
                    ) : (
                      <span className="text-blue-600 text-xl">📱</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{app.name}</h4>
                    <p className="text-sm text-gray-600">{app.packageName}</p>
                    {app.version && (
                      <p className="text-xs text-gray-500">
                        Version: {app.version}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleLaunchApp(app.packageName)}
                    className="control-button success flex items-center text-sm"
                  >
                    <PlayIcon className="h-4 w-4 mr-1" />
                    Launch
                  </button>
                  {app.isUserApp && (
                    <button
                      onClick={() => handleUninstallApp(app.packageName)}
                      className="control-button danger flex items-center text-sm"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Uninstall
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Instructions</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Click "Install APK" to upload and install new applications</li>
          <li>• Use "Launch" to start an app on the emulator</li>
          <li>• System apps cannot be uninstalled</li>
          <li>• Use the search bar to quickly find specific apps</li>
        </ul>
      </div>
    </div>
  );
}

export default AppManager;
