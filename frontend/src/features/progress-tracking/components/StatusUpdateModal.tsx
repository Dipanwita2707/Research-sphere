'use client';

import { useState, useEffect } from 'react';
import logger from '@/shared/utils/logger';
import progressTrackerService, {
  ResearchTrackerStatus,
  TrackerPublicationType,
  statusLabels,
} from '@/features/research-management/services/progressTracker.service';

// Status-specific form components
import {
  ResearchPaperStatusForm,
  BookStatusForm,
  BookChapterStatusForm,
  ConferencePaperStatusForm,
} from './status-forms';

interface StatusUpdateModalProps {
  trackerId: string;
  publicationType: TrackerPublicationType;
  currentStatus: ResearchTrackerStatus;
  nextStatus: ResearchTrackerStatus;
  onClose: () => void;
  onComplete: () => void;
}

export default function StatusUpdateModal({
  trackerId,
  publicationType,
  currentStatus,
  nextStatus,
  onClose,
  onComplete,
}: StatusUpdateModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportedDate, setReportedDate] = useState(new Date().toISOString().split('T')[0]);
  const [actualDate, setActualDate] = useState('');
  const [notes, setNotes] = useState('');
  const [statusData, setStatusData] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<File[]>([]);

  // Check if this is a monthly report (same status update)
  const isMonthlyReport = currentStatus ===
   nextStatus;

  // Fetch and prefill tracker data for monthly reports
  useEffect(() => {
    if (isMonthlyReport) {
      fetchTrackerData();
    }
  }, [isMonthlyReport, trackerId]);

  const fetchTrackerData = async () => {
    try {
      const response = await progressTrackerService.getTrackerById(trackerId);
      const tracker = response.data;
      
      // Get the type-specific data based on publication type
      let typeData: Record<string, unknown> = {};
      switch (publicationType) {
        case 'research_paper':
          typeData = (tracker.researchPaperData as Record<string, unknown>) || {};
          break;
        case 'book':
          typeData = (tracker.bookData as Record<string, unknown>) || {};
          break;
        case 'book_chapter':
          typeData = (tracker.bookChapterData as Record<string, unknown>) || {};
          break;
        case 'conference_paper':
          typeData = (tracker.conferencePaperData as Record<string, unknown>) || {};
          break;
      }
      
      // Pre-fill the status data with existing information
      setStatusData(typeData);
      
      // Pre-fill notes if there's a recent history entry
      if (tracker.statusHistory && tracker.statusHistory.length > 0) {
        const latestHistory = tracker.statusHistory[0];
        if (latestHistory.notes) {
          setNotes('Previous: ' + latestHistory.notes);
        }
      }
    } catch (err) {
      logger.error('Error fetching tracker data:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Upload files first if any
      let attachments: { originalName: string; filename: string; path: string }[] = [];
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });
        const uploadResponse = await progressTrackerService.uploadAttachments(trackerId, formData);
        attachments = uploadResponse.data;
      }

      // Update status
      await progressTrackerService.updateStatus(trackerId, {
        newStatus: nextStatus,
        reportedDate,
        actualDate: actualDate || undefined,
        notes: notes || undefined,
        statusData,
        attachments,
      });

      onComplete();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update status';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const renderStatusForm = () => {
    const props = {
      status: nextStatus,
      data: statusData,
      onChange: setStatusData,
    };

    switch (publicationType) {
      case 'research_paper':
        return <ResearchPaperStatusForm {...props} />;
      case 'book':
        return <BookStatusForm {...props} />;
      case 'book_chapter':
        return <BookChapterStatusForm {...props} />;
      case 'conference_paper':
        return <ConferencePaperStatusForm {...props} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        {/* Modal panel */}
        <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="px-6 py-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {isMonthlyReport ? (
                    <>
                      📝 Submit Monthly Report - {statusLabels[currentStatus]}
                    </>
                  ) : (
                    <>
                      Update Status: {statusLabels[currentStatus]} → {statusLabels[nextStatus]}
                    </>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {isMonthlyReport && (
                <p className="text-sm text-gray-600 mt-2">
                  Submit your monthly progress without changing the current status. All details are pre-filled and editable.
                </p>
              )}
            </div>

            {/* Body */}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  {error}
                </div>
              )}

              {/* Date Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reported Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={reportedDate}
                    onChange={(e) => setReportedDate(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">When did this status change occur?</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Actual Date (if different)
                  </label>
                  <input
                    type="date"
                    value={actualDate}
                    onChange={(e) => setActualDate(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">The actual date if reporting retroactively</p>
                </div>
              </div>

              {/* Status-Specific Form */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  {isMonthlyReport ? 'Current Progress Details' : `${statusLabels[nextStatus]} Details`}
                </h4>
                {isMonthlyReport && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    <strong>Monthly Report:</strong> Update your progress details below. Previous information will be pre-filled.
                  </div>
                )}
                {renderStatusForm()}
              </div>

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Any additional notes about this status change..."
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isMonthlyReport ? 'Progress Documents (Required for Monthly Report)' : 'Attachments (Optional)'}
                  {isMonthlyReport && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  multiple
                  accept=".zip"
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  required={isMonthlyReport}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {isMonthlyReport 
                    ? 'Upload ZIP file containing your current progress documents (max 50MB)'
                    : 'Upload ZIP file with supporting documents (acceptance letter, publication proof, etc., max 50MB)'}
                </p>
                {files.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center text-sm text-gray-600">
                        <span className="mr-2">📎</span>
                        {file.name}
                        <button
                          type="button"
                          onClick={() => setFiles(files.filter((_, i) => i !== index))}
                          className="ml-2 text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 text-white rounded-lg ${
                  nextStatus ===
   'rejected'
                    ? 'bg-red-600 hover:bg-red-700'
                    : isMonthlyReport
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? (isMonthlyReport ? 'Submitting Report...' : 'Updating...') : (isMonthlyReport ? 'Submit Monthly Report' : `Mark as ${statusLabels[nextStatus]}`)}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
