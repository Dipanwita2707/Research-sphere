'use client';

import React, { useId } from 'react';
import { BadgeCheck, Download, IndianRupee, XCircle } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import { approvalBlockReason } from './BatchDialogs';
import { btnDangerOutline } from './FinanceStates';
import type { PayoutBatchDetail } from '../types';

export interface BatchActionsProps {
  batch: Pick<PayoutBatchDetail, 'status' | 'createdById' | 'payouts'>;
  userId: string | null | undefined;
  canApprove: boolean;
  canReview: boolean;
  canRecordPayment: boolean;
  /** The university lets the preparer / recommenders approve (with a reason). */
  allowSelfApproval?: boolean;
  exporting?: boolean;
  onApprove: () => void;
  onPay: () => void;
  onCancel: () => void;
  onExport: () => void;
  /** Rendered on the wine hero: light text for the explanation. */
  onDark?: boolean;
}

/** Batch action bar. Visibility follows permissions; the backend still enforces every rule. */
export default function BatchActions({
  batch, userId, canApprove, canReview, canRecordPayment, allowSelfApproval = false, exporting, onApprove, onPay, onCancel, onExport, onDark,
}: BatchActionsProps) {
  const noteId = useId();
  const isDraft = batch.status === 'draft';
  const blocked = isDraft && canApprove ? approvalBlockReason(batch, userId, allowSelfApproval) : null;
  const showApprove = isDraft && canApprove;
  const showPay = batch.status === 'approved' && canRecordPayment;
  const showCancel = isDraft && canReview;
  const showExport = batch.status === 'approved' || batch.status === 'paid';

  if (!showApprove && !showPay && !showCancel && !showExport) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {showApprove && (
          // Disabled buttons swallow hover in some browsers, so the tooltip sits on a wrapper.
          <span title={blocked || undefined} className="inline-flex">
            <button
              type="button"
              onClick={onApprove}
              disabled={!!blocked}
              aria-describedby={blocked ? noteId : undefined}
              className={`${ui.btnPrimary} disabled:cursor-not-allowed`}
            >
              <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Approve batch
            </button>
          </span>
        )}
        {showPay && (
          <button type="button" onClick={onPay} className={ui.btnPrimary}>
            <IndianRupee className="h-4 w-4" aria-hidden="true" /> Record payment
          </button>
        )}
        {showExport && (
          <button type="button" onClick={onExport} disabled={exporting} className={`${ui.btnSecondary} disabled:opacity-60`}>
            <Download className={`h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} aria-hidden="true" /> {exporting ? 'Preparing…' : 'Export xlsx'}
          </button>
        )}
        {showCancel && (
          <button type="button" onClick={onCancel} className={btnDangerOutline}>
            <XCircle className="h-4 w-4" aria-hidden="true" /> Cancel batch
          </button>
        )}
      </div>
      {blocked && (
        <p id={noteId} className={`max-w-md text-xs ${onDark ? 'text-white/85' : 'text-amber-800 dark:text-amber-200'}`}>
          {blocked}
        </p>
      )}
    </div>
  );
}
