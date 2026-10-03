'use client';

import React, { useId, useState } from 'react';
import { ui } from '@/components/analytics/theme';
import FinanceDialog from './FinanceDialog';
import { InlineError } from './FinanceStates';
import { formatINR, toFinanceError } from '../utils/format';

export const MIN_REASON_LENGTH = 3;

export const fieldLabel = 'block text-sm font-medium text-stone-800 dark:text-gray-100';
export const textarea =
  'mt-1.5 block w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-wine focus:ring-2 focus:ring-wine/15 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';
const btnDanger =
  'inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60';

/** Submit helper shared by every dialog: busy state, inline server error, close on success. */
export function useSubmit(onClose: () => void, describeError: (err: unknown) => string = (err) => toFinanceError(err).message) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setSubmitting(true);
    setError(null);
    try {
      await fn();
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };
  return { submitting, error, run };
}

export function SelectionSummary({ count, total, noun = 'line' }: { count: number; total: number; noun?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900/50">
      <span className="text-stone-600 dark:text-gray-300">
        {count} {noun}{count === 1 ? '' : 's'} selected
      </span>
      <span className="font-semibold tabular-nums text-stone-900 dark:text-white">{formatINR(total)}</span>
    </div>
  );
}

// ─── Reason-required dialog (hold, cancel line, cancel batch) ───────────────

export interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  confirmLabel: string;
  danger?: boolean;
  /** Shown above the reason field, e.g. the line or batch being acted on. */
  context?: React.ReactNode;
  onSubmit: (reason: string) => Promise<unknown>;
}

export function ReasonDialog(props: ReasonDialogProps) {
  if (!props.open) return null;
  return <ReasonDialogBody {...props} />;
}

function ReasonDialogBody({
  onClose, title, description, label = 'Reason', placeholder, confirmLabel, danger, context, onSubmit,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const { submitting, error, run } = useSubmit(onClose);
  const id = useId();
  const valid = reason.trim().length >= MIN_REASON_LENGTH;

  return (
    <FinanceDialog
      open
      onClose={onClose}
      busy={submitting}
      title={title}
      description={description}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={submitting} className={ui.btnSecondary}>Back</button>
          <button
            type="submit"
            form={`${id}-form`}
            disabled={!valid || submitting}
            className={danger ? btnDanger : `${ui.btnPrimary} disabled:cursor-not-allowed`}
          >
            {submitting ? 'Saving…' : confirmLabel}
          </button>
        </>
      )}
    >
      <form
        id={`${id}-form`}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void run(() => onSubmit(reason.trim()));
        }}
      >
        {context}
        <div>
          <label htmlFor={`${id}-reason`} className={fieldLabel}>
            {label} <span className="text-red-600" aria-hidden="true">*</span>
          </label>
          <textarea
            id={`${id}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={2000}
            required
            aria-required="true"
            aria-describedby={`${id}-hint`}
            placeholder={placeholder}
            className={textarea}
          />
          <p id={`${id}-hint`} className="mt-1 text-xs text-stone-500 dark:text-gray-400">
            Required. Recorded in the audit trail{reason.length > 0 && !valid ? ` — at least ${MIN_REASON_LENGTH} characters.` : '.'}
          </p>
        </div>
        <InlineError message={error} />
      </form>
    </FinanceDialog>
  );
}

// ─── Recommend selected ─────────────────────────────────────────────────────

export interface RecommendDialogProps {
  open: boolean;
  onClose: () => void;
  count: number;
  total: number;
  onSubmit: (comments?: string) => Promise<unknown>;
}

export function RecommendDialog(props: RecommendDialogProps) {
  if (!props.open) return null;
  return <RecommendDialogBody {...props} />;
}

function RecommendDialogBody({ onClose, count, total, onSubmit }: RecommendDialogProps) {
  const [comments, setComments] = useState('');
  const { submitting, error, run } = useSubmit(onClose);
  const id = useId();
  return (
    <FinanceDialog
      open
      onClose={onClose}
      busy={submitting}
      title="Recommend for payment"
      description="You confirm these amounts were checked against the incentive policy. Recommended lines can then be grouped into a payment batch."
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={submitting} className={ui.btnSecondary}>Back</button>
          <button type="submit" form={`${id}-form`} disabled={submitting || count === 0} className={ui.btnPrimary}>
            {submitting ? 'Recommending…' : `Recommend ${count} line${count === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    >
      <form
        id={`${id}-form`}
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); void run(() => onSubmit(comments.trim() || undefined)); }}
      >
        <SelectionSummary count={count} total={total} />
        <div>
          <label htmlFor={`${id}-comments`} className={fieldLabel}>
            Comment <span className="font-normal text-stone-500 dark:text-gray-400">(optional)</span>
          </label>
          <textarea
            id={`${id}-comments`}
            rows={3}
            maxLength={2000}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="e.g. Verified against Scopus indexing and policy 2026"
            className={textarea}
          />
        </div>
        <InlineError message={error} />
      </form>
    </FinanceDialog>
  );
}

// ─── Adjust amount ──────────────────────────────────────────────────────────

export interface AdjustDialogProps {
  open: boolean;
  onClose: () => void;
  payeeName: string;
  calculatedAmount: number;
  approvedAmount: number;
  onSubmit: (amount: number, reason: string) => Promise<unknown>;
}

export function AdjustDialog(props: AdjustDialogProps) {
  if (!props.open) return null;
  return <AdjustDialogBody {...props} />;
}

function AdjustDialogBody({ onClose, payeeName, calculatedAmount, approvedAmount, onSubmit }: AdjustDialogProps) {
  const [amount, setAmount] = useState(String(approvedAmount ?? ''));
  const [reason, setReason] = useState('');
  const { submitting, error, run } = useSubmit(onClose);
  const id = useId();
  const value = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isFinite(value) && value >= 0;
  const changed = amountValid && Math.round(value * 100) !== Math.round(approvedAmount * 100);
  const reasonValid = reason.trim().length >= MIN_REASON_LENGTH;
  const diff = amountValid ? value - calculatedAmount : 0;

  return (
    <FinanceDialog
      open
      onClose={onClose}
      busy={submitting}
      title="Adjust amount"
      description={`Change what ${payeeName} will be paid. The line goes back to “Awaiting verification” and must be recommended again.`}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={submitting} className={ui.btnSecondary}>Back</button>
          <button
            type="submit"
            form={`${id}-form`}
            disabled={!amountValid || !changed || !reasonValid || submitting}
            className={`${ui.btnPrimary} disabled:cursor-not-allowed`}
          >
            {submitting ? 'Saving…' : 'Save adjustment'}
          </button>
        </>
      )}
    >
      <form
        id={`${id}-form`}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (amountValid && changed && reasonValid) void run(() => onSubmit(Math.round(value * 100) / 100, reason.trim()));
        }}
      >
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-stone-200 px-3 py-2.5 dark:border-gray-700">
            <dt className={ui.label}>Calculated by policy</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-stone-900 dark:text-white">{formatINR(calculatedAmount)}</dd>
          </div>
          <div className="rounded-lg border border-stone-200 px-3 py-2.5 dark:border-gray-700">
            <dt className={ui.label}>Currently approved</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-stone-900 dark:text-white">{formatINR(approvedAmount)}</dd>
          </div>
        </dl>
        <div>
          <label htmlFor={`${id}-amount`} className={fieldLabel}>
            New amount (₹) <span className="text-red-600" aria-hidden="true">*</span>
          </label>
          <input
            id={`${id}-amount`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-describedby={`${id}-amount-hint`}
            className={`mt-1.5 w-full ${ui.input}`}
          />
          <p id={`${id}-amount-hint`} className="mt-1 text-xs text-stone-500 dark:text-gray-400">
            {!amountValid
              ? 'Enter an amount of zero or more.'
              : !changed
                ? 'Enter a different amount to make an adjustment.'
                : diff === 0
                  ? 'Matches the policy amount.'
                  : `${diff > 0 ? '+' : '−'}${formatINR(Math.abs(diff))} against the policy amount.`}
          </p>
        </div>
        <div>
          <label htmlFor={`${id}-reason`} className={fieldLabel}>
            Reason <span className="text-red-600" aria-hidden="true">*</span>
          </label>
          <textarea
            id={`${id}-reason`}
            rows={3}
            maxLength={2000}
            required
            aria-required="true"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Journal quartile corrected from Q1 to Q2"
            className={textarea}
          />
          <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">Required. Recorded in the audit trail.</p>
        </div>
        <InlineError message={error} />
      </form>
    </FinanceDialog>
  );
}

// ─── Create batch from selected ─────────────────────────────────────────────

export interface CreateBatchDialogProps {
  open: boolean;
  onClose: () => void;
  count: number;
  total: number;
  onSubmit: (title?: string) => Promise<unknown>;
}

export function CreateBatchDialog(props: CreateBatchDialogProps) {
  if (!props.open) return null;
  return <CreateBatchDialogBody {...props} />;
}

function CreateBatchDialogBody({ onClose, count, total, onSubmit }: CreateBatchDialogProps) {
  const [title, setTitle] = useState('');
  const { submitting, error, run } = useSubmit(onClose);
  const id = useId();
  return (
    <FinanceDialog
      open
      onClose={onClose}
      busy={submitting}
      title="Create payment batch"
      description="The batch is created as a draft. Someone who did not prepare it and did not recommend any of its lines must approve it before payment."
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={submitting} className={ui.btnSecondary}>Back</button>
          <button type="submit" form={`${id}-form`} disabled={submitting || count === 0} className={ui.btnPrimary}>
            {submitting ? 'Creating…' : 'Create batch'}
          </button>
        </>
      )}
    >
      <form id={`${id}-form`} className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(() => onSubmit(title.trim() || undefined)); }}>
        <SelectionSummary count={count} total={total} />
        <div>
          <label htmlFor={`${id}-title`} className={fieldLabel}>
            Title <span className="font-normal text-stone-500 dark:text-gray-400">(optional)</span>
          </label>
          <input
            id={`${id}-title`}
            type="text"
            maxLength={256}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. October 2026 payroll — research incentives"
            className={`mt-1.5 w-full ${ui.input}`}
          />
        </div>
        <InlineError message={error} />
      </form>
    </FinanceDialog>
  );
}
