'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, Inbox, Lock, RefreshCw } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import { BATCH_STATUS_META, PAYOUT_STATUS_META, TONE_CLASSES, type Tone } from '../utils/format';
import type { BatchStatus, PayoutStatus } from '../types';

export function Badge({ tone, children, title, wrap }: { tone: Tone; children: React.ReactNode; title?: string; wrap?: boolean }) {
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1 px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${wrap ? 'whitespace-normal rounded-lg leading-snug' : 'truncate rounded-full'} ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  const meta = PAYOUT_STATUS_META[status] || { label: status, tone: 'stone' as Tone };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const meta = BATCH_STATUS_META[status] || { label: status, tone: 'stone' as Tone };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/** Placeholder rows shaped like the table they stand in for. */
export function TableSkeleton({ rows = 6, cols = 5, label = 'Loading' }: { rows?: number; cols?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="divide-y divide-stone-100 dark:divide-gray-700">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((__, c) => (
            <div
              key={c}
              className="h-3 animate-pulse rounded bg-stone-100 dark:bg-gray-700"
              style={{ width: c === 1 ? '32%' : `${10 + ((r + c) % 3) * 4}%` }}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function BlockSkeleton({ className = 'h-64' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl border border-stone-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${className}`} aria-hidden="true" />;
}

export function EmptyState({
  title, description, icon, action,
}: { title: string; description?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-400 dark:bg-gray-700 dark:text-gray-400 [&_svg]:h-5 [&_svg]:w-5">
        {icon || <Inbox />}
      </div>
      <p className="mt-3 text-sm font-medium text-stone-800 dark:text-gray-100">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-stone-500 dark:text-gray-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Couldn't load this", message, onRetry, retrying,
}: { title?: string; message?: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <AlertCircle className="h-9 w-9 text-amber-500" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-stone-900 dark:text-white">{title}</p>
      <p className="mt-1 max-w-md text-sm text-stone-500 dark:text-gray-400">
        {message || 'The finance service did not respond. Check your connection and try again.'}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} disabled={retrying} className={`mt-4 ${ui.btnPrimary}`}>
          <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

export function AccessDenied({ what = 'the finance module' }: { what?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className={`w-full max-w-md p-8 text-center ${ui.card}`}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-wine dark:bg-wine/30 dark:text-rose-200">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-lg font-semibold text-stone-900 dark:text-white">You don&apos;t have access</h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-gray-400">
          You need the <strong>View Incentive Payouts</strong> permission to open {what}. Ask your administrator to
          assign it to you under User &amp; Role Management.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/research/my-incentives" className={ui.btnSecondary}>My incentives</Link>
          <Link href="/dashboard" className={ui.btnPrimary}>Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}

/** Inline error inside a dialog. */
export function InlineError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

/** Outline button for destructive actions (cancel line / batch). */
export const btnDangerOutline =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-950/40';
