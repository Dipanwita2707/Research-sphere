'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

// Toast Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

// Toast options for the convenience toast() method
export interface ToastOptions {
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

// Success Modal Details
export interface SuccessModalDetails {
  passId?: string;
  verificationCode?: string;
  mobile?: string;
  email?: string;
  title?: string;
  message?: string;
  // Optional translated labels (for i18n support)
  passIdLabel?: string;
  verificationCodeLabel?: string;
  okButtonText?: string;
  shareNote?: string;
  whatsappSentText?: string;
  emailSentText?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  // Convenience methods
  toast: (options: ToastOptions) => string;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
  // Success Modal
  showSuccessModal: (details: SuccessModalDetails) => void;
  hideSuccessModal: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// Toast icon based on type
const ToastIcon = ({ type }: { type: ToastType }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'info':
      return <Info className="w-5 h-5 text-blue-500" />;
    default:
      return null;
  }
};

// Toast background colors
const toastStyles: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  info: 'bg-blue-50 border-blue-200',
};

// Individual Toast Component
const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: () => void }) => {
  const [isExiting, setIsExiting] = React.useState(false);

  // Auto-dismiss
  React.useEffect(() => {
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onRemove, 300); // Wait for exit animation
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onRemove, 300);
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        transform transition-all duration-300 ease-out
        ${toastStyles[toast.type]}
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
    >
      <ToastIcon type={toast.type} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="font-semibold text-gray-900 text-sm">{toast.title}</p>
        )}
        <p className="text-gray-700 text-sm">{toast.message}</p>
      </div>
      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  );
};

// Toast Container Component
const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-auto"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

// Success Modal Component for Pass Creation
const SuccessModal = ({
  isOpen,
  onClose,
  details,
}: {
  isOpen: boolean;
  onClose: () => void;
  details: SuccessModalDetails;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full animate-modal-in overflow-hidden">
        {/* Success Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white rounded-full" />
          </div>
          <div className="relative">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-white">{details.title || 'Pass Created Successfully!'}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Pass Details Card */}
          {(details.passId || details.verificationCode) && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 mb-5 border-l-4 border-blue-500 shadow-sm">
              <div className="space-y-4">
                {details.passId && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm font-medium">{details.passIdLabel || 'Pass ID'}</span>
                    <span className="font-mono font-bold text-blue-700 bg-white px-4 py-1.5 rounded-lg shadow-sm border border-blue-100">
                      {details.passId}
                    </span>
                  </div>
                )}
                {details.verificationCode && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm font-medium">{details.verificationCodeLabel || 'Verification Code'}</span>
                    <span className="font-mono font-bold text-green-700 bg-green-100 px-4 py-2 rounded-lg text-xl tracking-widest shadow-sm border border-green-200">
                      {details.verificationCode}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notification Status */}
          {(details.mobile || details.email) && (
            <div className="space-y-3 mb-6">
              {details.mobile && (
                <div className="flex items-center gap-3 text-sm text-gray-700 bg-green-50 rounded-xl px-4 py-3 border-l-4 border-green-400">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <span>{details.whatsappSentText || '📱 WhatsApp sent to'} <strong className="text-green-700">{details.mobile}</strong></span>
                </div>
              )}
              {details.email && (
                <div className="flex items-center gap-3 text-sm text-gray-700 bg-blue-50 rounded-xl px-4 py-3 border-l-4 border-blue-400">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-blue-500" />
                  </div>
                  <span>{details.emailSentText || '📧 Email sent to'} <strong className="text-blue-700">{details.email}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Custom Message */}
          {details.message && (
            <p className="text-center text-gray-600 text-sm mb-5 bg-gray-50 rounded-lg p-3">
              {details.message}
            </p>
          )}

          {/* Share Note */}
          {details.verificationCode && (
            <p className="text-center text-gray-500 text-sm mb-5">
              {details.shareNote || '🔐 Share the verification code with your visitor for entry'}
            </p>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {details.okButtonText || 'OK, Got It!'}
          </button>
        </div>
      </div>

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-in {
          from {
            transform: scale(0.9) translateY(20px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
        .animate-modal-in {
          animation: modal-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

// Toast Provider
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [successModalState, setSuccessModalState] = useState<{
    isOpen: boolean;
    details: SuccessModalDetails;
  }>({ isOpen: false, details: {} });

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = generateId();
    const newToast: Toast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Generic toast method
  const toast = useCallback(
    (options: ToastOptions) => addToast(options),
    [addToast]
  );

  // Convenience methods
  const success = useCallback(
    (message: string, title?: string) => addToast({ type: 'success', message, title }),
    [addToast]
  );

  const error = useCallback(
    (message: string, title?: string) => addToast({ type: 'error', message, title }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, title?: string) => addToast({ type: 'warning', message, title }),
    [addToast]
  );

  const info = useCallback(
    (message: string, title?: string) => addToast({ type: 'info', message, title }),
    [addToast]
  );

  // Success Modal methods
  const showSuccessModal = useCallback((details: SuccessModalDetails) => {
    setSuccessModalState({ isOpen: true, details });
  }, []);

  const hideSuccessModal = useCallback(() => {
    setSuccessModalState({ isOpen: false, details: {} });
  }, []);

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    toast,
    success,
    error,
    warning,
    info,
    showSuccessModal,
    hideSuccessModal,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <SuccessModal
        isOpen={successModalState.isOpen}
        onClose={hideSuccessModal}
        details={successModalState.details}
      />
    </ToastContext.Provider>
  );
}

// useToast hook
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export default ToastProvider;
