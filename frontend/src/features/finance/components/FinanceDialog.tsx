'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Modal centred on screen, or a panel sliding in from the right. */
  variant?: 'modal' | 'drawer';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** While busy, Escape and the backdrop do not close the dialog. */
  busy?: boolean;
  /** Element to focus on open; defaults to the first focusable control. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/** Open dialogs, innermost last: only the top one answers Escape and traps Tab. */
const openStack: string[] = [];

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/**
 * Accessible dialog: role="dialog", aria-modal, labelled by its title, Escape closes,
 * Tab is kept inside, and focus returns to the opener on close.
 */
export default function FinanceDialog({
  open, onClose, title, description, children, footer, variant = 'modal', size = 'md', busy = false, initialFocusRef,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => { onCloseRef.current = onClose; busyRef.current = busy; });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = initialFocusRef?.current || panel?.querySelector<HTMLElement>(FOCUSABLE) || panel;
    first?.focus();

    openStack.push(titleId);
    const onKey = (e: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== titleId) return;
      if (e.key === 'Escape') {
        if (!busyRef.current) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      const at = openStack.lastIndexOf(titleId);
      if (at >= 0) openStack.splice(at, 1);
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
    // initialFocusRef is a ref; reading it on open is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const isDrawer = variant === 'drawer';
  const node = (
    <div className={`fixed inset-0 z-[100] flex ${isDrawer ? 'justify-end' : 'items-end justify-center p-0 sm:items-center sm:p-4'}`}>
      <div
        className="absolute inset-0 bg-stone-950/45 backdrop-blur-[1px]"
        aria-hidden="true"
        onClick={() => { if (!busy) onClose(); }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={
          isDrawer
            ? `relative flex h-full w-full ${SIZES[size]} flex-col bg-white shadow-2xl outline-none dark:bg-gray-900`
            : `relative flex max-h-[92vh] w-full ${SIZES[size]} flex-col rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl dark:bg-gray-800`
        }
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4 dark:border-gray-700">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-stone-900 dark:text-white">{title}</h2>
            {description && <div id={descId} className="mt-1 text-sm text-stone-500 dark:text-gray-400">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
  return createPortal(node, document.body);
}
