'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { DuplicateClaim, duplicateClaimMessage } from '@/features/research-management/services/duplicateClaim';

interface Props {
  claims: DuplicateClaim[];
  /** Submit-time message (409 DUPLICATE_CLAIM) when there is no live-check claim to show. */
  message?: string | null;
}

/** Amber inline warning: this work is already claimed by someone at this university. */
export default function DuplicateClaimWarning({ claims, message }: Props) {
  const lines = claims.length > 0 ? claims.map(duplicateClaimMessage) : message ? [message] : [];
  if (lines.length === 0) return null;
  return (
    <div
      role="alert"
      data-testid="duplicate-claim-warning"
      className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex items-start gap-3 shadow-sm"
    >
      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-amber-900 dark:text-amber-200">This work may already be claimed</p>
        {lines.map((line, i) => (
          <p key={i} className="mt-1 text-amber-800 dark:text-amber-300">{line}</p>
        ))}
      </div>
    </div>
  );
}
