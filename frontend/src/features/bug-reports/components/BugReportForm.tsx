'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { X, Bug, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScreenshotUpload } from './ScreenshotUpload';
import { ScreenshotPreview } from './ScreenshotPreview';
import { useBugReport } from '../hooks/useBugReport';
import { useAuthStore } from '@/shared/auth/authStore';
import { cn } from '@/lib/utils';

interface BugReportFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 2000;

export function BugReportForm({ isOpen, onClose }: BugReportFormProps) {
  const { user } = useAuthStore();
  const {
    description,
    setDescription,
    screenshots,
    setScreenshots,
    errors,
    isSubmitting,
    submitBugReport,
    resetForm,
  } = useBugReport();

  const [showSuccess, setShowSuccess] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Get current page URL and user identifier
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  let userIdentifier = user?.uid || user?.id || 'Unknown';
  if (user?.student?.registrationNo) {
    userIdentifier = user.student.registrationNo;
  } else if (user?.employee?.empId) {
    userIdentifier = user.employee.empId;
  }

  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSubmitting]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;

    setIsClosing(true);
    setTimeout(() => {
      onClose();
      resetForm();
      setShowSuccess(false);
      setIsClosing(false);
    }, 200);
  }, [isSubmitting, onClose, resetForm]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isSubmitting) {
        handleClose();
      }
    },
    [handleClose, isSubmitting]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      
      setStatusMessage('Submitting bug report...');
      await submitBugReport();
      
      // Show success message if no errors
      if (!errors.general && !errors.description && !errors.screenshots) {
        setShowSuccess(true);
        setStatusMessage('Bug report submitted successfully!');
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        setStatusMessage('Error submitting bug report. Please check the form and try again.');
      }
    },
    [submitBugReport, errors, handleClose]
  );

  const handleRemoveScreenshot = useCallback(
    (index: number) => {
      const newScreenshots = screenshots.filter((_, i) => i !== index);
      setScreenshots(newScreenshots);
    },
    [screenshots, setScreenshots]
  );

  const remainingChars = MAX_DESCRIPTION_LENGTH - description.length;
  const isDescriptionValid = description.trim().length >= MIN_DESCRIPTION_LENGTH;

  if (!isOpen) return null;

  // Success state
  if (showSuccess) {
    return (
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm',
          isClosing ? 'animate-fade-out' : 'animate-fade-in'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-title"
        aria-describedby="success-description"
      >
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 mx-4 animate-modal-in text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" aria-hidden="true" />
          </div>
          <h3 id="success-title" className="text-xl font-semibold text-gray-900 mb-2">Bug Report Submitted!</h3>
          <p id="success-description" className="text-gray-600">
            Thank you for helping us improve the system. We'll review your report soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4',
        isClosing ? 'animate-fade-out' : 'animate-fade-in'
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bug-report-title"
    >
      <div
        ref={modalRef}
        className={cn(
          'bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col',
          isClosing ? 'animate-modal-out' : 'animate-modal-in'
        )}
        role="document"
      >
        {/* ARIA Live Region for Status Messages */}
        <div
          ref={statusRef}
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {statusMessage}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Bug className="w-5 h-5 text-red-600" aria-hidden="true" />
            </div>
            <h2 id="bug-report-title" className="text-xl font-semibold text-gray-900">
              Report a Bug
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close bug report form"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Context Information */}
          <div className="space-y-3">
            <div>
              <label htmlFor="page-url" className="block text-sm font-medium text-gray-700 mb-1">Page URL</label>
              <input
                id="page-url"
                type="text"
                value={pageUrl}
                readOnly
                aria-readonly="true"
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-600"
              />
            </div>
            <div>
              <label htmlFor="user-identifier" className="block text-sm font-medium text-gray-700 mb-1">Your Identifier</label>
              <input
                id="user-identifier"
                type="text"
                value={userIdentifier}
                readOnly
                aria-readonly="true"
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-600"
              />
            </div>
          </div>

          {/* Bug Description */}
          <div>
            <label htmlFor="bug-description" className="block text-sm font-medium text-gray-700 mb-1">
              Bug Description <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={textareaRef}
              id="bug-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe the bug you encountered in detail. What were you trying to do? What happened? What did you expect to happen?"
              rows={6}
              maxLength={MAX_DESCRIPTION_LENGTH}
              className={cn(
                'w-full px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                errors.description ? 'border-red-500' : 'border-gray-300'
              )}
              disabled={isSubmitting}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'description-error' : 'description-hint'}
            />
            <div className="flex items-center justify-between mt-1">
              <div>
                {errors.description && (
                  <p id="description-error" className="text-xs text-red-600">
                    {errors.description}
                  </p>
                )}
                {!errors.description && (
                  <p id="description-hint" className="text-xs text-gray-500">
                    Minimum {MIN_DESCRIPTION_LENGTH} characters required
                  </p>
                )}
              </div>
              <p
                className={cn(
                  'text-xs',
                  remainingChars < 100 ? 'text-orange-600' : 'text-gray-500',
                  remainingChars < 0 && 'text-red-600 font-medium'
                )}
              >
                {remainingChars} characters remaining
              </p>
            </div>
          </div>

          {/* Screenshots */}
          <div>
            <label id="screenshots-label" className="block text-sm font-medium text-gray-700 mb-2">
              Screenshots <span className="text-gray-500 text-xs font-normal">(Optional)</span>
            </label>
            <div role="group" aria-labelledby="screenshots-label">
              <ScreenshotUpload
                screenshots={screenshots}
                onScreenshotsChange={setScreenshots}
                error={errors.screenshots}
              />
            </div>
            {screenshots.length > 0 && (
              <div className="mt-4">
                <ScreenshotPreview screenshots={screenshots} onRemove={handleRemoveScreenshot} />
              </div>
            )}
          </div>

          {/* General Error */}
          {errors.general && (
            <div 
              className="p-3 bg-red-50 border border-red-200 rounded-md"
              role="alert"
              aria-live="assertive"
            >
              <p className="text-sm text-red-800">{errors.general}</p>
              {(errors.general.includes('connect') || errors.general.includes('network')) && (
                <button
                  type="button"
                  onClick={() => {
                    // Clear error and allow retry
                    submitBugReport();
                  }}
                  className="mt-2 text-sm text-red-700 underline hover:text-red-900"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !isDescriptionValid}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              'Submit Report'
            )}
          </Button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes fade-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        @keyframes modal-in {
          from {
            transform: scale(0.95) translateY(20px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
        @keyframes modal-out {
          from {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
          to {
            transform: scale(0.95) translateY(20px);
            opacity: 0;
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
        .animate-fade-out {
          animation: fade-out 0.2s ease-out forwards;
        }
        .animate-modal-in {
          animation: modal-in 0.3s ease-out forwards;
        }
        .animate-modal-out {
          animation: modal-out 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
