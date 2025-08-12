import React, { useState, useEffect } from "react";
import {
  XMarkIcon,
  PlusIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline";
import axios from "axios";

function CreateEmulatorModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    apiLevel: 34,
    device: "pixel_5",
    preinstallApp: "",
    preconfiguredDeeplink: "",
    deeplink: "",
  });
  const [availableApps, setAvailableApps] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState({});

  // Preconfigured deeplinks for different insurance types
  const preconfiguredDeeplinks = [
    {
      label: "Health Insurance",
      value: "insurance://health/dashboard?category=health&view=plans",
    },
    {
      label: "Life Insurance",
      value: "insurance://life/quotes?product=term&age=30",
    },
    {
      label: "Motor Insurance",
      value: "insurance://motor/calculator?vehicle=car&coverage=comprehensive",
    },
    {
      label: "Home Insurance",
      value: "insurance://home/estimate?property=apartment&location=urban",
    },
    {
      label: "Travel Insurance",
      value:
        "insurance://travel/booking?destination=international&duration=7days",
    },
  ];

  // Fetch available apps when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableApps();
      // Generate default name
      setFormData((prev) => ({
        ...prev,
        name: prev.name || `WebControllerEmulator-${Date.now()}`,
      }));
    }
  }, [isOpen]);

  const fetchAvailableApps = async () => {
    try {
      const response = await axios.get("/api/preinstall/apps");
      setAvailableApps(response.data);
    } catch (error) {
      console.error("Failed to fetch available apps:", error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Emulator name is required";
    } else if (!/^[a-zA-Z0-9-_]+$/.test(formData.name)) {
      newErrors.name =
        "Name can only contain letters, numbers, hyphens, and underscores";
    }

    // Validate deeplink if provided
    if (formData.deeplink.trim() || formData.preconfiguredDeeplink) {
      if (!formData.preinstallApp) {
        newErrors.deeplink =
          "Please select an app to preinstall before adding a deeplink";
      } else if (
        formData.deeplink.trim() &&
        !formData.deeplink.includes("://")
      ) {
        newErrors.deeplink =
          "Deeplink must include a scheme (e.g., myapp:// or https://)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsCreating(true);
    try {
      const payload = {
        name: formData.name.trim(),
        apiLevel: formData.apiLevel,
        device: formData.device,
      };

      // Add preinstall app if selected
      if (formData.preinstallApp) {
        payload.preinstallApp = formData.preinstallApp;
      }

      // Add deeplink if provided (prioritize preconfigured over custom)
      const finalDeeplink =
        formData.preconfiguredDeeplink || formData.deeplink?.trim();
      if (finalDeeplink) {
        payload.deeplink = finalDeeplink;
      }

      await axios.post("/api/emulators", payload);

      // Reset form
      setFormData({
        name: "",
        apiLevel: 34,
        device: "pixel_5",
        preinstallApp: "",
        preconfiguredDeeplink: "",
        deeplink: "",
      });
      setErrors({});

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to create emulator:", error);
      setErrors({
        submit: error.response?.data?.error || error.message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <DevicePhoneMobileIcon className="h-6 w-6 mr-2 text-blue-600" />
            Create New Emulator
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Emulator Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emulator Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="e.g., MyTestDevice"
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* API Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Android API Level
            </label>
            <select
              value={formData.apiLevel}
              onChange={(e) =>
                handleInputChange("apiLevel", parseInt(e.target.value))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={34}>API 34 (Android 14)</option>
              <option value={33}>API 33 (Android 13)</option>
              <option value={32}>API 32 (Android 12L)</option>
              <option value={31}>API 31 (Android 12)</option>
              <option value={30}>API 30 (Android 11)</option>
            </select>
          </div>

          {/* Device Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Device Type
            </label>
            <select
              value={formData.device}
              onChange={(e) => handleInputChange("device", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="pixel_5">Pixel 5</option>
              <option value="pixel_4">Pixel 4</option>
              <option value="pixel_3">Pixel 3</option>
              <option value="nexus_6">Nexus 6</option>
            </select>
          </div>

          {/* App to Preinstall */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              App to Pre-install (Optional)
            </label>
            <select
              value={formData.preinstallApp}
              onChange={(e) =>
                handleInputChange("preinstallApp", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">No app selected</option>
              {availableApps.map((app, index) => (
                <option key={index} value={app.name}>
                  {app.name}
                </option>
              ))}
            </select>
            {availableApps.length === 0 ? (
              <p className="text-xs text-gray-500 mt-1">
                No APK files found in /apps directory
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                {availableApps.length} APK
                {availableApps.length !== 1 ? "s" : ""} available
              </p>
            )}
          </div>

          {/* Preconfigured Deeplinks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preconfigured Deeplinks (Optional)
            </label>
            <select
              value={formData.preconfiguredDeeplink}
              onChange={(e) =>
                handleInputChange("preconfiguredDeeplink", e.target.value)
              }
              disabled={!formData.preinstallApp}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                !formData.preinstallApp ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
            >
              <option value="">Select a preconfigured deeplink</option>
              {preconfiguredDeeplinks.map((deeplink, index) => (
                <option key={index} value={deeplink.value}>
                  {deeplink.label}
                </option>
              ))}
            </select>
            {!formData.preinstallApp && (
              <p className="text-xs text-gray-500 mt-1">
                Select an app first to enable preconfigured deeplinks
              </p>
            )}
            {formData.preinstallApp && formData.preconfiguredDeeplink && (
              <p className="text-xs text-gray-500 mt-1">
                Using preconfigured deeplink for{" "}
                {
                  preconfiguredDeeplinks.find(
                    (d) => d.value === formData.preconfiguredDeeplink
                  )?.label
                }
              </p>
            )}
          </div>

          {/* Custom Deeplink */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom App Deeplink (Optional)
            </label>
            <input
              type="text"
              value={formData.deeplink}
              onChange={(e) => handleInputChange("deeplink", e.target.value)}
              disabled={
                !formData.preinstallApp || !!formData.preconfiguredDeeplink
              }
              placeholder={
                !formData.preinstallApp
                  ? "Select an app first to enable deeplink"
                  : formData.preconfiguredDeeplink
                  ? "Preconfigured deeplink selected - custom input disabled"
                  : "e.g., myapp://launch or https://example.com/page"
              }
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                !formData.preinstallApp || !!formData.preconfiguredDeeplink
                  ? "bg-gray-100 cursor-not-allowed"
                  : ""
              }`}
            />
            {errors.deeplink && (
              <p className="text-red-500 text-xs mt-1">{errors.deeplink}</p>
            )}
            {formData.preinstallApp && !formData.preconfiguredDeeplink && (
              <p className="text-xs text-gray-500 mt-1">
                Enter a custom deeplink or select a pre-configured one above
              </p>
            )}
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 control-button secondary"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 control-button primary flex items-center justify-center"
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Emulator
                </>
              )}
            </button>
          </div>
        </form>

        {/* Help Text */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700">
            <strong>Tip:</strong> If you select an app to preinstall, it will be
            automatically installed when the emulator starts. You can choose
            from preconfigured deeplinks for common insurance scenarios or enter
            a custom deeplink. Add more APK files to the /apps directory for
            bulk installation.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CreateEmulatorModal;
