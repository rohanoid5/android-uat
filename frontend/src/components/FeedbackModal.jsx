import React, { useState, useEffect } from "react";
import {
  XMarkIcon,
  StarIcon,
  PhotoIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import axios from "axios";

function FeedbackModal({ isOpen, onClose, emulator, currentScreenshot }) {
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const categories = [
    "Bug Report",
    "UI/UX Issue",
    "Performance",
    "Feature Request",
    "General Feedback",
    "Other",
  ];

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFeedback("");
      setRating(0);
      setCategory("");
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feedback.trim() || rating === 0) {
      alert("Please provide feedback and a rating");
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(
        `/api/emulators/${emulator.id}/feedback`,
        {
          feedback: feedback.trim(),
          rating,
          category,
          screenshot: currentScreenshot, // Base64 image data
        }
      );

      console.log("Feedback submitted:", response.data);
      alert("Feedback submitted successfully!");
      onClose();
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStarClick = (starRating) => {
    setRating(starRating);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Submit Feedback for {emulator?.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Form */}
            <div className="space-y-6">
              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Overall Rating *
                </label>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleStarClick(star)}
                      className="text-2xl transition-colors hover:scale-110 transform"
                    >
                      {star <= rating ? (
                        <StarIconSolid className="h-8 w-8 text-yellow-400" />
                      ) : (
                        <StarIcon className="h-8 w-8 text-gray-300" />
                      )}
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-gray-600">
                    {rating > 0 && `${rating}/5`}
                  </span>
                </div>
              </div>

              {/* Category */}
              <div>
                <label
                  htmlFor="category"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Feedback Category
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Feedback Text */}
              <div>
                <label
                  htmlFor="feedback"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Your Feedback *
                </label>
                <textarea
                  id="feedback"
                  rows={6}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Please describe your experience, any issues you encountered, or suggestions for improvement..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <div className="text-sm text-gray-500 mt-1">
                  {feedback.length}/1000 characters
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !feedback.trim() || rating === 0}
                  className={`px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                    submitting || !feedback.trim() || rating === 0
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  <span>
                    {submitting ? "Submitting..." : "Submit Feedback"}
                  </span>
                </button>
              </div>
            </div>

            {/* Right Column - Screenshot */}
            <div>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <PhotoIcon className="h-5 w-5 text-gray-500" />
                  <h3 className="text-sm font-medium text-gray-700">
                    Current Screen
                  </h3>
                </div>

                <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                  {currentScreenshot ? (
                    <img
                      src={currentScreenshot}
                      alt="Current emulator screen"
                      className="w-full h-auto max-h-96 object-contain"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      <div className="text-center">
                        <PhotoIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No screenshot available</p>
                        <p className="text-xs text-gray-400 mt-1">
                          The current screen will be included with your feedback
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
                  <p className="font-medium text-blue-800 mb-1">📝 Tip:</p>
                  <p>
                    This screenshot will be automatically included with your
                    feedback to help our team understand the context of your
                    report.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FeedbackModal;
