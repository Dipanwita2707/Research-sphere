'use client';

import React, { useState } from 'react';
import { gateEntryService } from '@/shared/services/gateEntry.service';
import { useToast } from '@/shared/ui-components/Toast';

interface ExtendPassModalProps {
  passId: string;
  currentEntryTime: string;
  currentVisitDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ExtendPassModal({
  passId,
  currentEntryTime,
  currentVisitDate,
  onClose,
  onSuccess
}: ExtendPassModalProps) {
  const { error: showError, success: showSuccess } = useToast();
  const [newVisitDate, setNewVisitDate] = useState(currentVisitDate);
  const [newEntryTime, setNewEntryTime] = useState(currentEntryTime);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newVisitDate || !newEntryTime) {
      showError('Please select both date and time');
      return;
    }

    // Validate new date is not in the past
    const selectedDate = new Date(newVisitDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      showError('Visit date cannot be in the past');
      return;
    }

    setIsLoading(true);
    try {
      const response = await gateEntryService.extendPass(passId, newEntryTime, newVisitDate);
      
      if (response.success) {
        showSuccess(response.message || 'Pass extended successfully');
        onSuccess();
        onClose();
      } else {
        showError('Failed to extend pass');
      }
    } catch (error: any) {
      console.error('Error extending pass:', error);
      showError(error.response?.data?.message || 'Failed to extend pass');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Extend Pass</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Note:</span> Extending the pass will regenerate the QR code. 
            The new QR will activate 5 hours before the new entry time.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Current Details</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Pass ID:</span> {passId}</p>
              <p><span className="font-medium">Visit Date:</span> {new Date(currentVisitDate).toLocaleDateString()}</p>
              <p><span className="font-medium">Entry Time:</span> {currentEntryTime}</p>
            </div>
          </div>

          {/* New Visit Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Visit Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={newVisitDate}
              onChange={(e) => setNewVisitDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isLoading}
            />
          </div>

          {/* New Entry Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Entry Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={newEntryTime}
              onChange={(e) => setNewEntryTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              QR code will activate 5 hours before this time
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Extending...' : 'Extend Pass'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
