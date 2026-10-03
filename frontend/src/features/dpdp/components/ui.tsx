'use client';

import React, { useEffect, useId, useRef } from 'react';
import { AlertCircle, Inbox, Loader2, RefreshCw, X } from 'lucide-react';

export const inputClass =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-wine/40 focus:border-wine disabled:opacity-60';

export const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-wine px-4 py-2 text-sm font-medium text-wine-fg shadow-sm hover:bg-wine-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/50 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

export function Card({
  title,
  description,
  icon,
  actions,
  children,
  className = '',
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 px-4 sm:px-6 pt-5 pb-3">
          <div className="flex items-start gap-3 min-w-0">
            {icon && <div className="p-2 rounded-xl bg-wine/10 dark:bg-wine/20 text-wine dark:text-hi shrink-0">{icon}</div>}
            <div className="min-w-0">
              {title && <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>}
              {description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className="px-4 sm:px-6 pb-5">{children}</div>
    </section>
  );
}

export function Badge({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500 dark:text-gray-400">
      <Loader2 className="h-7 w-7 animate-spin text-wine" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-4">
      <Inbox className="h-8 w-8 text-gray-300 dark:text-gray-600" aria-hidden="true" />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center text-center gap-3 py-10 px-4">
      <AlertCircle className="h-8 w-8 text-red-500" aria-hidden="true" />
      <p className="text-sm text-gray-700 dark:text-gray-300 max-w-md">{message}</p>
      {onRetry && (
        <button type="button" className={btnSecondary} onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  );
}

function useDialogBehaviour(open: boolean, onClose: (() => void) | undefined, containerRef: React.RefObject<HTMLDivElement | null>) {
  // Keep the latest onClose without re-running the effect (which would steal focus on every render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = containerRef.current;
    const focusable = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) || [],
      );
    // focus first field (or the dialog itself)
    const t = window.setTimeout(() => {
      const first = focusable()[0];
      (first || node)?.focus();
    }, 20);

    const onKey = (e: KeyboardEvent) => {
      // Ignore keys while another dialog (e.g. the shared ConfirmModal) has focus.
      const active = document.activeElement;
      if (active && active !== document.body && node && !node.contains(active)) return;
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const items = focusable();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, containerRef]);
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  zIndex = 'z-[60]',
}: {
  open: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Omit to make the dialog non-dismissable (blocking). */
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  zIndex?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useDialogBehaviour(open, onClose, ref);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <div className={`fixed inset-0 ${zIndex} flex items-end sm:items-center justify-center p-0 sm:p-4`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-hidden="true" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative w-full ${width} max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800 focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 sm:px-6 py-4 border-t border-gray-100 dark:border-gray-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogBehaviour(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative h-full w-full sm:max-w-xl flex flex-col bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-800 focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-800">{footer}</div>}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}) {
  const toneClass = {
    default: 'text-wine dark:text-hi bg-wine/10 dark:bg-wine/20',
    warning: 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300',
    danger: 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300',
    success: 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300',
  }[tone];
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
        {icon && <span className={`p-2 rounded-lg ${toneClass}`}>{icon}</span>}
      </div>
      <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  id,
}: {
  checked: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
        checked ? 'bg-wine' : 'bg-gray-300 dark:bg-gray-700'
      } ${disabled ? 'opacity-70' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
