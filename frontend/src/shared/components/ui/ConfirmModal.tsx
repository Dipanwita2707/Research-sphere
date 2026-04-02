'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { AlertTriangle, Info, HelpCircle, Trash2, X } from 'lucide-react';
import logger from '@/shared/utils/logger';

// Modal Types
export type ConfirmType = 'default' | 'warning' | 'danger' | 'info';

export interface ConfirmModalOptions {
  title: string;
  message: string | ReactNode;
  type?: ConfirmType;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClassName?: string;
  cancelButtonClassName?: string;
  icon?: ReactNode;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ConfirmModalContextValue {
  confirm: (options: ConfirmModalOptions) => Promise<boolean>;
  // Convenience methods
  confirmDelete: (titleOrItemName?: string, message?: string) => Promise<boolean>;
  confirmAction: (titleOrAction: string, messageOrItemName?: string) => Promise<boolean>;
}

const ConfirmModalContext = createContext<ConfirmModalContextValue | undefined>(undefined);

// Icon based on type
const ModalIcon = ({ type, customIcon }: { type: ConfirmType; customIcon?: ReactNode }) => {
  if (customIcon) return <>{customIcon}</>;

  const iconClass = 'w-6 h-6';
  const wrapperStyles: Record<ConfirmType, string> = {
    default: 'bg-gray-100 text-gray-600',
    warning: 'bg-yellow-100 text-yellow-600',
    danger: 'bg-red-100 text-red-600',
    info: 'bg-blue-100 text-blue-600',
  };

  const icons: Record<ConfirmType, ReactNode> = {
    default: <HelpCircle className={iconClass} />,
    warning: <AlertTriangle className={iconClass} />,
    danger: <Trash2 className={iconClass} />,
    info: <Info className={iconClass} />,
  };

  return (
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${wrapperStyles[type]}`}>
      {icons[type]}
    </div>
  );
};

// Button styles based on type
const confirmButtonStyles: Record<ConfirmType, string> = {
  default: 'bg-blue-600 hover:bg-blue-700 text-white',
  warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  info: 'bg-blue-600 hover:bg-blue-700 text-white',
};

interface ModalState extends ConfirmModalOptions {
  isOpen: boolean;
  resolve: (value: boolean) => void;
}

// Modal Component
const Modal = ({ state, onClose }: { state: ModalState; onClose: (confirmed: boolean) => void }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Focus management
  useEffect(() => {
    if (state.isOpen) {
      confirmButtonRef.current?.focus();
    }
  }, [state.isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key ===
   'Escape' && state.isOpen && !isLoading) {
        handleClose(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [state.isOpen, isLoading]);

  // Lock body scroll
  useEffect(() => {
    if (state.isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [state.isOpen]);

  const handleClose = (confirmed: boolean) => {
    setIsClosing(true);
    setTimeout(() => {
      onClose(confirmed);
      setIsClosing(false);
    }, 200);
  };

  const handleConfirm = async () => {
    if (state.onConfirm) {
      setIsLoading(true);
      try {
        await state.onConfirm();
        handleClose(true);
      } catch (error) {
        logger.error('Confirm action failed:', error);
        setIsLoading(false);
      }
    } else {
      handleClose(true);
    }
  };

  const handleCancel = () => {
    if (state.onCancel) {
      state.onCancel();
    }
    handleClose(false);
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target ===
   e.currentTarget && !isLoading) {
      handleCancel();
    }
  };

  if (!state.isOpen) return null;

  const type = state.type || 'default';

  return (
    <div
      className={`
        fixed inset-0 z-[10000] flex items-center justify-center p-4
        bg-black/50 backdrop-blur-sm
        transition-opacity duration-200
        ${isClosing ? 'opacity-0' : 'opacity-100'}
      `}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        ref={modalRef}
        className={`
          bg-white rounded-xl shadow-2xl max-w-md w-full p-6
          transform transition-all duration-200
          ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Icon and Content */}
        <div className="flex flex-col items-center text-center">
          <ModalIcon type={type} customIcon={state.icon} />
          
          <h2
            id="confirm-modal-title"
            className="mt-4 text-lg font-semibold text-gray-900"
          >
            {state.title}
          </h2>
          
          <div className="mt-2 text-gray-600">
            {typeof state.message ===
   'string' ? (
              <p>{state.message}</p>
            ) : (
              state.message
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className={`
              px-4 py-2 rounded-lg font-medium
              bg-gray-100 text-gray-700 hover:bg-gray-200
              transition-colors disabled:opacity-50
              ${state.cancelButtonClassName || ''}
            `}
          >
            {state.cancelText || 'Cancel'}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={handleConfirm}
            disabled={isLoading}
            className={`
              px-4 py-2 rounded-lg font-medium
              transition-colors disabled:opacity-50
              flex items-center gap-2
              ${state.confirmButtonClassName || confirmButtonStyles[type]}
            `}
          >
            {isLoading && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {state.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Provider
export function ConfirmModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    resolve: () => {},
  });

  const confirm = useCallback((options: ConfirmModalOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setModalState({
        ...options,
        isOpen: true,
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback((confirmed: boolean) => {
    modalState.resolve(confirmed);
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, [modalState]);

  // Convenience methods
  const confirmDelete = useCallback(
    (titleOrItemName?: string, message?: string): Promise<boolean> => {
      // If message is provided, first arg is title, otherwise it's item name
      if (message) {
        return confirm({
          title: titleOrItemName || 'Confirm Delete',
          message,
          type: 'danger',
          confirmText: 'Delete',
        });
      }
      return confirm({
        title: 'Confirm Delete',
        message: titleOrItemName
          ? `Are you sure you want to delete "${titleOrItemName}"? This action cannot be undone.`
          : 'Are you sure you want to delete this item? This action cannot be undone.',
        type: 'danger',
        confirmText: 'Delete',
      });
    },
    [confirm]
  );

  const confirmAction = useCallback(
    (titleOrAction: string, messageOrItemName?: string): Promise<boolean> => {
      // If messageOrItemName looks like a full message (contains space and starts lowercase), 
      // treat first arg as title and second as message
      const looksLikeMessage = messageOrItemName && 
        (messageOrItemName.includes('?') || messageOrItemName.length > 50 || messageOrItemName.includes(' you '));
      
      if (looksLikeMessage) {
        return confirm({
          title: titleOrAction,
          message: messageOrItemName,
          type: 'warning',
          confirmText: 'Confirm',
        });
      }
      
      return confirm({
        title: `Confirm ${titleOrAction}`,
        message: messageOrItemName
          ? `Are you sure you want to ${titleOrAction.toLowerCase()} "${messageOrItemName}"?`
          : `Are you sure you want to ${titleOrAction.toLowerCase()} this item?`,
        type: 'warning',
        confirmText: titleOrAction,
      });
    },
    [confirm]
  );

  const value: ConfirmModalContextValue = {
    confirm,
    confirmDelete,
    confirmAction,
  };

  return (
    <ConfirmModalContext.Provider value={value}>
      {children}
      <Modal state={modalState} onClose={handleClose} />
    </ConfirmModalContext.Provider>
  );
}

// useConfirm hook
export function useConfirm(): ConfirmModalContextValue {
  const context = useContext(ConfirmModalContext);
  if (context ===
   undefined) {
    throw new Error('useConfirm must be used within a ConfirmModalProvider');
  }
  return context;
}

export default ConfirmModalProvider;
