'use client';

import React, { useId, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import { useAuthStore } from '@/shared/auth/authStore';
import { useToast } from '@/shared/ui-components/Toast';
import FinanceDialog from './FinanceDialog';
import { InlineError } from './FinanceStates';
import { fieldLabel, textarea } from './PayoutActionDialogs';
import { isFinanceAdmin } from '../hooks/useFinancePermissions';
import { useFinanceSettings, useUpdateFinanceSettings } from '../hooks/useFinance';
import { formatDateTime, personName, toFinanceError } from '../utils/format';

/**
 * Batch approval rule for this university: two-person (default) or self-approval allowed for
 * small finance teams. Everyone with finance access sees it; only a tenant admin can change it,
 * with a reason that is recorded in the payout audit trail.
 */
export default function ApprovalRuleCard() {
  const id = useId();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const admin = isFinanceAdmin(user);
  const q = useFinanceSettings();
  const save = useUpdateFinanceSettings();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (q.isLoading || q.isError || !q.data) return null;
  const allow = q.data.allowSelfApproval;
  const next = !allow;
  const reasonError = reason.trim().length < 10 ? 'Give a reason of at least 10 characters.' : null;

  const close = () => { setOpen(false); setReason(''); setTouched(false); setError(null); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (reasonError) return;
    try {
      await save.mutateAsync({ allowSelfApproval: next, reason: reason.trim() });
      toast.success(next ? 'Self-approval allowed. Each self-approval asks for a reason.' : 'Two-person approval restored.');
      close();
    } catch (err) {
      setError(toFinanceError(err, 'Could not change the approval rule.').message);
    }
  };

  const Icon = allow ? ShieldAlert : ShieldCheck;
  return (
    <section aria-label="Batch approval rule" className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${ui.card}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${allow ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`} aria-hidden="true" />
        <div>
          <p className={ui.title}>{allow ? 'Self-approval allowed' : 'Two-person approval'}</p>
          <p className={ui.subtitle}>
            {allow
              ? 'Whoever prepared a batch or recommended its lines may also approve it, giving a reason. The batch is marked self-approved.'
              : 'A batch must be approved by someone who neither prepared it nor recommended any of its lines.'}
            {q.data.updatedAt && ` Changed ${formatDateTime(q.data.updatedAt)}${personName(q.data.updatedBy) ? ` by ${personName(q.data.updatedBy)}` : ''}.`}
          </p>
        </div>
      </div>
      {admin && (
        <button type="button" onClick={() => setOpen(true)} className={`${ui.btnSecondary} shrink-0`}>
          {allow ? 'Require two people' : 'Allow self-approval'}
        </button>
      )}

      <FinanceDialog
        open={open}
        onClose={close}
        busy={save.isPending}
        title={next ? 'Allow self-approval?' : 'Require two-person approval?'}
        description={next
          ? 'For universities with a single finance officer. The preparer or recommender of a batch may approve it, giving a reason each time; every such approval is marked and logged.'
          : 'From now on a batch must be approved by someone who neither prepared it nor recommended its lines.'}
        footer={(
          <>
            <button type="button" onClick={close} disabled={save.isPending} className={ui.btnSecondary}>Cancel</button>
            <button type="submit" form={`${id}-form`} disabled={save.isPending} className={ui.btnPrimary}>
              {save.isPending ? 'Saving…' : next ? 'Allow self-approval' : 'Require two people'}
            </button>
          </>
        )}
      >
        <form id={`${id}-form`} onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor={`${id}-reason`} className={fieldLabel}>Reason <span aria-hidden="true">*</span></label>
            <textarea
              id={`${id}-reason`}
              rows={3}
              maxLength={1900}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={touched && !!reasonError}
              aria-describedby={touched && reasonError ? `${id}-reason-err` : undefined}
              placeholder={next ? 'e.g. Only one finance officer until the new hire joins in January' : 'e.g. Second finance officer has joined'}
              className={textarea}
            />
            {touched && reasonError && <p id={`${id}-reason-err`} className="mt-1 text-xs text-red-700 dark:text-red-300">{reasonError}</p>}
          </div>
          <InlineError message={error} />
        </form>
      </FinanceDialog>
    </section>
  );
}
