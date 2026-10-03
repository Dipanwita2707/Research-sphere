'use client';

import React, { useId, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import FinanceDialog from './FinanceDialog';
import { InlineError } from './FinanceStates';
import { SelectionSummary, fieldLabel, textarea, useSubmit } from './PayoutActionDialogs';
import { SEPARATION_OF_DUTIES_MESSAGE, formatINR, todayIST, toFinanceError } from '../utils/format';
import type { PayoutBatchDetail, PayoutLine } from '../types';

/**
 * Why the current user may not approve this batch, or null if they may.
 * Mirrors the backend rule: the approver neither created the batch nor recommended any line.
 */
/** What ties this user to the batch ("prepared this batch" / "recommended 2 of its lines"), or null. */
export function approvalConflict(
  batch: Pick<PayoutBatchDetail, 'createdById' | 'payouts'>,
  userId: string | null | undefined,
): string | null {
  if (!userId) return null;
  if (batch.createdById === userId) return 'prepared this batch';
  const mine = (batch.payouts || []).filter((l) => l.recommendedById === userId).length;
  return mine > 0 ? `recommended ${mine} of its line${mine === 1 ? '' : 's'}` : null;
}

/** Why this user may not approve, or null. With self-approval allowed nobody is blocked (a reason is asked instead). */
export function approvalBlockReason(
  batch: Pick<PayoutBatchDetail, 'createdById' | 'payouts'>,
  userId: string | null | undefined,
  allowSelfApproval = false,
): string | null {
  if (!userId || allowSelfApproval) return null;
  if (batch.createdById === userId) {
    return 'You prepared this batch, so someone else must approve it (separation of duties).';
  }
  const mine = (batch.payouts || []).filter((l) => l.recommendedById === userId).length;
  if (mine > 0) {
    return `You recommended ${mine} of its lines, so someone else must approve it (separation of duties).`;
  }
  return null;
}

export function describeApproveError(err: unknown): string {
  const e = toFinanceError(err);
  if (e.code === 'SEPARATION_OF_DUTIES') return SEPARATION_OF_DUTIES_MESSAGE;
  if (e.code === 'SELF_APPROVAL_REASON_REQUIRED') return e.message;
  if (e.status === 403) return 'You do not have permission to approve payment batches (Approve Payment Batches).';
  return e.message;
}

export function SeparationOfDutiesNote({ blockedReason, selfApprovalAllowed }: { blockedReason?: string | null; selfApprovalAllowed?: boolean }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${
        blockedReason
          ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100'
          : 'border-stone-200 bg-stone-50 text-stone-700 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300'
      }`}
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        {blockedReason || (selfApprovalAllowed
          ? 'This university allows self-approval: whoever prepared the batch or recommended its lines may approve it, giving a reason that is recorded. A second person is still preferred.'
          : 'Approval needs a second person: whoever approves must not have prepared the batch or recommended any of its lines.')}
      </p>
    </div>
  );
}

// ─── Approve ────────────────────────────────────────────────────────────────

interface ApproveProps {
  open: boolean;
  onClose: () => void;
  batchNumber: string;
  count: number;
  total: number;
  /** Set when the approver prepared the batch or recommended lines (self-approval allowed): a reason is required. */
  selfConflict?: string | null;
  onSubmit: (comments?: string, selfApprovalReason?: string) => Promise<unknown>;
}

export function ApproveBatchDialog(props: ApproveProps) {
  if (!props.open) return null;
  return <ApproveBody {...props} />;
}

function ApproveBody({ onClose, batchNumber, count, total, selfConflict, onSubmit }: ApproveProps) {
  const [comments, setComments] = useState('');
  const [selfReason, setSelfReason] = useState('');
  const [touched, setTouched] = useState(false);
  const selfReasonError = selfConflict && selfReason.trim().length < 10 ? 'Give a reason of at least 10 characters.' : null;
  const { submitting, error, run } = useSubmit(onClose, describeApproveError);
  const id = useId();
  return (
    <FinanceDialog
      open
      onClose={onClose}
      busy={submitting}
      title={`Approve ${batchNumber}`}
      description="Approving releases the batch for payment. Its lines show as “Approved for payment” to the authors."
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={submitting} className={ui.btnSecondary}>Back</button>
          <button type="submit" form={`${id}-form`} disabled={submitting} className={ui.btnPrimary}>
            {submitting ? 'Approving…' : 'Approve batch'}
          </button>
        </>
      )}
    >
      <form
        id={`${id}-form`}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (selfReasonError) return;
          void run(() => onSubmit(comments.trim() || undefined, selfConflict ? selfReason.trim() : undefined));
        }}
      >
        <SelectionSummary count={count} total={total} />
        {selfConflict ? (
          <>
            <SeparationOfDutiesNote blockedReason={`You ${selfConflict}. Your university allows self-approval, so you can approve it, but the batch will be marked self-approved and your reason recorded in the audit trail.`} />
            <div>
              <label htmlFor={`${id}-self`} className={fieldLabel}>
                Reason for approving your own batch <span aria-hidden="true">*</span>
              </label>
              <textarea
                id={`${id}-self`}
                rows={2}
                maxLength={2000}
                value={selfReason}
                onChange={(e) => setSelfReason(e.target.value)}
                aria-invalid={touched && !!selfReasonError}
                aria-describedby={touched && selfReasonError ? `${id}-self-err` : undefined}
                placeholder="e.g. Sole finance officer this term; verified against the policy"
                className={textarea}
              />
              {touched && selfReasonError && <p id={`${id}-self-err`} className="mt-1 text-xs text-red-700 dark:text-red-300">{selfReasonError}</p>}
            </div>
          </>
        ) : (
          <SeparationOfDutiesNote />
        )}
        <div>
          <label htmlFor={`${id}-comments`} className={fieldLabel}>
            Comment <span className="font-normal text-stone-500 dark:text-gray-400">(optional)</span>
          </label>
          <textarea id={`${id}-comments`} rows={3} maxLength={2000} value={comments} onChange={(e) => setComments(e.target.value)} className={textarea} />
        </div>
        <InlineError message={error} />
      </form>
    </FinanceDialog>
  );
}

// ─── Record payment ─────────────────────────────────────────────────────────

interface PayProps {
  open: boolean;
  onClose: () => void;
  batchNumber: string;
  lines: PayoutLine[];
  onSubmit: (input: { paymentReference: string; paymentDate: string; tds?: Record<string, number> }) => Promise<unknown>;
}

export function RecordPaymentDialog(props: PayProps) {
  if (!props.open) return null;
  return <PayBody {...props} />;
}

function PayBody({ onClose, batchNumber, lines, onSubmit }: PayProps) {
  const id = useId();
  const today = todayIST();
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(today);
  const [showTds, setShowTds] = useState(false);
  const [tds, setTds] = useState<Record<string, string>>({});
  const { submitting, error, run } = useSubmit(onClose);

  const tdsErrors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const l of lines) {
      const raw = tds[l.id];
      if (raw == null || raw.trim() === '') continue;
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 0 || v > l.approvedAmount) out[l.id] = `Between ₹0 and ${formatINR(l.approvedAmount)}`;
    }
    return out;
  }, [lines, tds]);

  const totals = useMemo(() => {
    let gross = 0;
    let tdsSum = 0;
    for (const l of lines) {
      gross += l.approvedAmount;
      const v = Number(tds[l.id]);
      if (showTds && tds[l.id]?.trim() && Number.isFinite(v) && !tdsErrors[l.id]) tdsSum += v;
    }
    return { gross, tds: tdsSum, net: gross - tdsSum };
  }, [lines, tds, tdsErrors, showTds]);

  const refValid = reference.trim().length >= 3;
  const dateValid = !!date && date <= today;
  const tdsValid = !showTds || Object.keys(tdsErrors).length === 0;
  const canSubmit = refValid && dateValid && tdsValid && !submitting;

  const submit = () => {
    const tdsPayload: Record<string, number> = {};
    if (showTds) {
      for (const l of lines) {
        const raw = tds[l.id];
        if (raw != null && raw.trim() !== '') tdsPayload[l.id] = Math.round(Number(raw) * 100) / 100;
      }
    }
    return run(() => onSubmit({
      paymentReference: reference.trim(),
      paymentDate: date,
      ...(Object.keys(tdsPayload).length ? { tds: tdsPayload } : {}),
    }));
  };

  return (
    <FinanceDialog
      open
      onClose={onClose}
      busy={submitting}
      size={showTds ? 'xl' : 'md'}
      title={`Record payment — ${batchNumber}`}
      description="Record the payroll run, voucher or bank UTR once the money has actually been paid. Authors will see the line as paid with this reference."
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={submitting} className={ui.btnSecondary}>Back</button>
          <button type="submit" form={`${id}-form`} disabled={!canSubmit} className={`${ui.btnPrimary} disabled:cursor-not-allowed`}>
            {submitting ? 'Recording…' : 'Mark batch paid'}
          </button>
        </>
      )}
    >
      <form id={`${id}-form`} className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (canSubmit) void submit(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-ref`} className={fieldLabel}>
              Payment reference <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <input
              id={`${id}-ref`}
              type="text"
              required
              maxLength={64}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="UTR / voucher / payroll run"
              className={`mt-1.5 w-full ${ui.input}`}
            />
            <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">At least 3 characters.</p>
          </div>
          <div>
            <label htmlFor={`${id}-date`} className={fieldLabel}>
              Payment date <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <input
              id={`${id}-date`}
              type="date"
              required
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`mt-1.5 w-full ${ui.input}`}
            />
            {!dateValid && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Choose a date that is not in the future.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 dark:border-gray-700">
          <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm text-stone-800 dark:text-gray-100">
            <input
              type="checkbox"
              checked={showTds}
              onChange={(e) => setShowTds(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-wine focus:ring-wine/30"
            />
            Deduct TDS per line
            <span className="text-xs text-stone-500 dark:text-gray-400">(optional)</span>
          </label>
          {showTds && (
            <div className="max-h-[40vh] overflow-auto border-t border-stone-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <caption className="sr-only">TDS per payout line</caption>
                <thead className="sticky top-0 bg-stone-50 dark:bg-gray-900">
                  <tr>
                    <th scope="col" className={ui.th}>Payee</th>
                    <th scope="col" className={`${ui.th} text-right`}>Amount</th>
                    <th scope="col" className={`${ui.th} text-right`}>TDS (₹)</th>
                    <th scope="col" className={`${ui.th} text-right`}>Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                  {lines.map((l) => {
                    const v = Number(tds[l.id]);
                    const net = tds[l.id]?.trim() && Number.isFinite(v) && !tdsErrors[l.id] ? l.approvedAmount - v : l.approvedAmount;
                    return (
                      <tr key={l.id}>
                        <td className="px-4 py-2">
                          <div className="font-medium text-stone-800 dark:text-gray-100">{l.payeeName}</div>
                          <div className="text-xs text-stone-500 dark:text-gray-400">{l.payeeEmployeeId || 'No employee ID'}</div>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-stone-700 dark:text-gray-200">{formatINR(l.approvedAmount)}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={l.approvedAmount}
                            step="0.01"
                            inputMode="decimal"
                            aria-label={`TDS for ${l.payeeName}`}
                            aria-invalid={!!tdsErrors[l.id]}
                            value={tds[l.id] ?? ''}
                            onChange={(e) => setTds((prev) => ({ ...prev, [l.id]: e.target.value }))}
                            placeholder="0"
                            className={`w-28 text-right ${ui.input} ${tdsErrors[l.id] ? 'border-red-400' : ''}`}
                          />
                          {tdsErrors[l.id] && <div className="mt-0.5 text-[11px] text-red-600 dark:text-red-400">{tdsErrors[l.id]}</div>}
                        </td>
                        <td className="px-4 py-2 text-right font-medium tabular-nums text-stone-900 dark:text-white">{formatINR(net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div><dt className={ui.label}>Gross</dt><dd className="mt-0.5 font-semibold tabular-nums text-stone-900 dark:text-white">{formatINR(totals.gross)}</dd></div>
          <div><dt className={ui.label}>TDS</dt><dd className="mt-0.5 font-semibold tabular-nums text-stone-900 dark:text-white">{formatINR(totals.tds)}</dd></div>
          <div><dt className={ui.label}>Net payable</dt><dd className="mt-0.5 font-semibold tabular-nums text-stone-900 dark:text-white">{formatINR(totals.net)}</dd></div>
        </dl>
        <InlineError message={error} />
      </form>
    </FinanceDialog>
  );
}
