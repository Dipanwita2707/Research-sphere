'use client';

import React, { useState } from 'react';
import { gateEntryService } from '@/shared/services/gateEntry.service';
import { useToast } from '@/shared/ui-components/Toast';

interface ExtendPassModalProps {
  passId: string;
  currentEntryTime: string;
  currentVisitDate: string;
  currentEndDate?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ExtendPassModal({
  passId,
  currentEntryTime,
  currentVisitDate,
  currentEndDate,
  onClose,
  onSuccess
}: ExtendPassModalProps) {
  const { error: showError, success: showSuccess } = useToast();
  const [newEndDate, setNewEndDate] = useState(currentEndDate || currentVisitDate);
  const [extensionReason, setExtensionReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEndDate) {
      showError('Please select new end date');
      return;
    }

    if (!extensionReason.trim()) {
      showError('Please provide a reason for extension');
      return;
    }

    // Validate new end date is not before current end date or visit date
    const selectedDate = new Date(newEndDate);
    const currentDate = new Date(currentEndDate || currentVisitDate);
    currentDate.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate <= currentDate) {
      showError('New end date must be after current end date');
      return;
    }

    setIsLoading(true);
    try {
      const response = await gateEntryService.extendPass(passId, newEndDate, extensionReason);
      
      if (response.success) {
        showSuccess(response.message || 'Pass end date extended successfully');
        await onSuccess(response.pass); // Pass the updated pass data
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
            <span className="font-semibold">Note:</span> Extending the end date will update the pass expiry time to the new end date at 23:59. 
            QR code expiration will be updated automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Current Details</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Pass ID:</span> {passId}</p>
              <p><span className="font-medium">Visit Start Date:</span> {new Date(currentVisitDate).toLocaleDateString()}</p>
              <p><span className="font-medium">Current End Date:</span> {currentEndDate ? new Date(currentEndDate).toLocaleDateString() : new Date(currentVisitDate).toLocaleDateString()}</p>
              <p><span className="font-medium">Entry Time:</span> {currentEntryTime}</p>
            </div>
          </div>

          {/* New End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New End Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              min={currentEndDate || currentVisitDate}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Pass will expire at 23:59 on this date
            </p>
          </div>

          {/* Extension Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Extension Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={extensionReason}
              onChange={(e) => setExtensionReason(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Please provide a reason for extending the pass..."
              required
              disabled={isLoading}
            />
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
