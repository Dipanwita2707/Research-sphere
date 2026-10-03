'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink, PauseCircle, PencilLine, ThumbsUp, XCircle } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import FinanceDialog from './FinanceDialog';
import { ErrorState, PayoutStatusBadge, TableSkeleton, btnDangerOutline } from './FinanceStates';
import { EventTimeline } from './EventTimeline';
import { allowedActions, type PayoutActionKind } from './usePayoutActions';
import { usePayout } from '../hooks/useFinance';
import {
  SOURCE_LABELS, formatDate, formatDateTime, formatINR, sourceHref, toFinanceError, workTypeLabel,
} from '../utils/format';
import type { PayoutLine } from '../types';

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className={ui.label}>{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-stone-800 dark:text-gray-100">{children ?? '—'}</dd>
    </div>
  );
}

export default function PayoutDetailDrawer({
  id, onClose, canReview, onAction,
}: {
  id: string | null;
  onClose: () => void;
  canReview: boolean;
  onAction: (kind: PayoutActionKind, line: PayoutLine) => void;
}) {
  const q = usePayout(id);
  const line = q.data;
  const allowed = line ? allowedActions(line) : null;
  const href = line ? sourceHref(line) : null;
  const adjusted = line && Math.round(line.calculatedAmount * 100) !== Math.round(line.approvedAmount * 100);

  return (
    <FinanceDialog
      open={!!id}
      onClose={onClose}
      variant="drawer"
      size="lg"
      title={line ? line.payeeName : 'Payout line'}
      description={line ? <span className="line-clamp-2">{line.title}</span> : undefined}
      footer={line && canReview && allowed && (allowed.recommend || allowed.hold || allowed.adjust || allowed.cancel) ? (
        <>
          {allowed.cancel && (
            <button type="button" onClick={() => onAction('cancel', line)} className={btnDangerOutline}>
              <XCircle className="h-4 w-4" aria-hidden="true" /> Cancel line
            </button>
          )}
          {allowed.adjust && (
            <button type="button" onClick={() => onAction('adjust', line)} className={ui.btnSecondary}>
              <PencilLine className="h-4 w-4" aria-hidden="true" /> Adjust amount
            </button>
          )}
          {allowed.hold && (
            <button type="button" onClick={() => onAction('hold', line)} className={ui.btnSecondary}>
              <PauseCircle className="h-4 w-4" aria-hidden="true" /> Hold
            </button>
          )}
          {allowed.recommend && (
            <button type="button" onClick={() => onAction('recommend', line)} className={ui.btnPrimary}>
              <ThumbsUp className="h-4 w-4" aria-hidden="true" /> Recommend
            </button>
          )}
        </>
      ) : undefined}
    >
      {q.isLoading ? (
        <TableSkeleton rows={8} cols={2} label="Loading payout line" />
      ) : q.isError || !line ? (
        <ErrorState title="Couldn't load this line" message={toFinanceError(q.error).message} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <PayoutStatusBadge status={line.status} />
            {line.batch && (
              <Link href={`/finance/batches/${line.batch.id}`} className="text-xs font-medium text-wine hover:underline dark:text-amber">
                In batch {line.batch.batchNumber}
              </Link>
            )}
          </div>

          {line.holdReason && (line.status === 'on_hold' || line.status === 'cancelled') && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
              <span className="font-medium">{line.status === 'on_hold' ? 'On hold: ' : 'Cancelled: '}</span>{line.holdReason}
            </div>
          )}

          <section aria-labelledby="payout-amounts">
            <h3 id="payout-amounts" className="sr-only">Amounts</h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Calculated', formatINR(line.calculatedAmount)],
                ['Approved', formatINR(line.approvedAmount)],
                ['TDS', line.tdsAmount != null ? formatINR(line.tdsAmount) : '—'],
                ['Net', line.netAmount != null ? formatINR(line.netAmount) : '—'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-stone-200 px-3 py-2.5 dark:border-gray-700">
                  <dt className={ui.label}>{k}</dt>
                  <dd className="mt-0.5 text-base font-semibold tabular-nums text-stone-900 dark:text-white">{v}</dd>
                </div>
              ))}
            </dl>
            {adjusted && line.adjustmentReason && (
              <p className="mt-2 text-xs text-stone-600 dark:text-gray-400">
                <span className="font-medium">Adjusted:</span> {line.adjustmentReason}
              </p>
            )}
          </section>

          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field label="Payee">{line.payeeName}</Field>
            <Field label="Employee ID">{line.payeeEmployeeId || '—'}</Field>
            <Field label="Role on the work">{line.payeeRole ? line.payeeRole.replace(/_/g, ' ') : '—'}</Field>
            <Field label="Points">{line.points}</Field>
            <Field label="Work type">{workTypeLabel(line.workType)}</Field>
            <Field label="Reference number">{line.referenceNumber || '—'}</Field>
            <Field label="Financial year">FY {line.financialYear}</Field>
            <Field label="Approved by DRD on">{formatDate(line.sourceApprovedAt)}</Field>
            <Field label="Recommended on">{formatDateTime(line.recommendedAt)}</Field>
            <Field label="Paid on">{formatDate(line.paidAt)}</Field>
            <Field label="Payment reference">{line.paymentReference || '—'}</Field>
            <Field label="Source">
              {href ? (
                <Link href={href} className="inline-flex items-center gap-1 font-medium text-wine hover:underline dark:text-amber">
                  {SOURCE_LABELS[line.sourceType] || 'Source record'} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ) : (SOURCE_LABELS[line.sourceType] || line.sourceType)}
            </Field>
            <Field label="Title" wide>{line.title}</Field>
          </dl>

          <section aria-labelledby="payout-history">
            <h3 id="payout-history" className="mb-3 text-sm font-semibold text-stone-900 dark:text-white">History</h3>
            <EventTimeline events={line.events} emptyText="No actions recorded yet. The line was created when DRD approved the work." />
          </section>
        </div>
      )}
    </FinanceDialog>
  );
}
