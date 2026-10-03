'use client';

import React from 'react';
import { PAYOUT_STATUS_META, BATCH_STATUS_META, eventLabel, formatDateTime, formatINR } from '../utils/format';
import type { PayoutEvent } from '../types';

function actorName(e: PayoutEvent): string | null {
  const emp = e.actor?.employeeDetails;
  const name = emp?.displayName || [emp?.firstName, emp?.lastName].filter(Boolean).join(' ');
  return name || e.actor?.uid || null;
}

function statusLabel(s: string | null): string | null {
  if (!s) return null;
  return (PAYOUT_STATUS_META as Record<string, { label: string }>)[s]?.label
    || (BATCH_STATUS_META as Record<string, { label: string }>)[s]?.label
    || s;
}

const DOT: Record<string, string> = {
  recommended: 'bg-sky-500',
  held: 'bg-rose-500',
  adjusted: 'bg-amber-500',
  cancelled: 'bg-stone-400',
  batch_cancelled: 'bg-stone-400',
  batch_created: 'bg-wine',
  batch_approved: 'bg-violet-500',
  batch_paid: 'bg-emerald-500',
};

/** Audit trail, oldest first. */
export function EventTimeline({ events, emptyText }: { events: PayoutEvent[] | undefined; emptyText: string }) {
  if (!events || events.length === 0) {
    return <p className="text-sm text-stone-500 dark:text-gray-400">{emptyText}</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-stone-200 pl-5 dark:border-gray-700">
      {events.map((e, i) => {
        const who = actorName(e);
        const from = statusLabel(e.fromStatus);
        const to = statusLabel(e.toStatus);
        const amount = e.amount != null && e.amount !== '' ? Number(e.amount) : null;
        return (
          <li key={e.id || `${e.action}-${e.createdAt}-${i}`} className="relative">
            <span className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-gray-900 ${DOT[e.action] || 'bg-stone-400'}`} aria-hidden="true" />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-medium text-stone-900 dark:text-white">{eventLabel(e.action)}</p>
              <time dateTime={e.createdAt} className="text-xs text-stone-500 dark:text-gray-400">{formatDateTime(e.createdAt)}</time>
            </div>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">
              {[who && `by ${who}`, from && to ? `${from} → ${to}` : to, amount != null && Number.isFinite(amount) ? formatINR(amount) : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {e.comments && <p className="mt-1 whitespace-pre-line text-sm text-stone-700 dark:text-gray-300">{e.comments}</p>}
          </li>
        );
      })}
    </ol>
  );
}
