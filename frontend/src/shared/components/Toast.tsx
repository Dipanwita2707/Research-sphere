'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, X, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, message: string, duration?: number) => void;
  showSuccessModal: (title: string, details: { passId?: string; verificationCode?: string; mobile?: string; email?: string }) => void;
}

const ToastContext = React.createContext<ToastContextType | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

const toastConfig = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-l-green-500',
    iconColor: 'text-green-500',
    titleColor: 'text-green-800',
    messageColor: 'text-green-700',
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-l-red-500',
    iconColor: 'text-red-500',
    titleColor: 'text-red-800',
    messageColor: 'text-red-700',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-l-yellow-500',
    iconColor: 'text-yellow-500',
    titleColor: 'text-yellow-800',
    messageColor: 'text-yellow-700',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-l-blue-500',
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-800',
    messageColor: 'text-blue-700',
  },
};

// Toast notification component
function ToastNotification({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const config = toastConfig[toast.type];
  const Icon = config.icon;

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(onClose, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onClose]);

  return (
    <div
      className={`${config.bgColor} ${config.borderColor} border-l-4 rounded-lg shadow-lg p-4 mb-3 animate-slide-in flex items-start gap-3 min-w-[320px] max-w-md`}
      role="alert"
    >
      <Icon className={`w-6 h-6 ${config.iconColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1">
        <h4 className={`font-semibold ${config.titleColor}`}>{toast.title}</h4>
        <p className={`text-sm ${config.messageColor} mt-1 whitespace-pre-line`}>{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// Success Modal for pass creation
function SuccessModal({
  isOpen,
  onClose,
  title,
  details,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  details: { passId?: string; verificationCode?: string; mobile?: string; email?: string };
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full animate-modal-in overflow-hidden">
        {/* Success Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Pass Details Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-4 border-l-4 border-blue-500">
            <div className="space-y-3">
              {details.passId && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Pass ID</span>
                  <span className="font-mono font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-lg">
                    {details.passId}
                  </span>
                </div>
              )}
              {details.verificationCode && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Verification Code</span>
                  <span className="font-mono font-bold text-green-700 bg-green-100 px-3 py-1 rounded-lg text-lg tracking-wider">
                    {details.verificationCode}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notification Status */}
          <div className="space-y-2 mb-6">
            {details.mobile && (
              <div className="flex items-center gap-2 text-sm text-gray-700 bg-green-50 rounded-lg px-3 py-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>📱 WhatsApp notification sent to <strong>{details.mobile}</strong></span>
              </div>
            )}
            {details.email && (
              <div className="flex items-center gap-2 text-sm text-gray-700 bg-blue-50 rounded-lg px-3 py-2">
                <CheckCircle className="w-4 h-4 text-blue-500" />
                <span>📧 Email sent to <strong>{details.email}</strong></span>
              </div>
            )}
          </div>

          {/* Share Note */}
          <p className="text-center text-gray-500 text-sm mb-4">
            Share the verification code with your visitor for entry
          </p>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            OK, Got It!
          </button>
        </div>
      </div>
    </div>
  );
}

// Provider component
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    title: string;
    details: { passId?: string; verificationCode?: string; mobile?: string; email?: string };
  }>({ isOpen: false, title: '', details: {} });

  const showToast = (type: ToastType, title: string, message: string, duration = 5000) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const showSuccessModal = (
    title: string,
    details: { passId?: string; verificationCode?: string; mobile?: string; email?: string }
  ) => {
    setSuccessModal({ isOpen: true, title, details });
  };

  const closeSuccessModal = () => {
    setSuccessModal({ isOpen: false, title: '', details: {} });
  };

  return (
    <ToastContext.Provider value={{ showToast, showSuccessModal }}>
      {children}
      
      {/* Toast Container - Top Right */}
      <div className="fixed top-4 right-4 z-50">
        {toasts.map(toast => (
          <ToastNotification
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModal.isOpen}
        onClose={closeSuccessModal}
        title={successModal.title}
        details={successModal.details}
      />

      {/* Animation Styles */}
      <style jsx global>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes modal-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out forwards;
        }
        
        .animate-modal-in {
          animation: modal-in 0.3s ease-out forwards;
        }
      `}</style>
    </ToastContext.Provider>
  );
}
