'use client';

import React, { useId, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Save } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import { useToast } from '@/shared/ui-components/Toast';
import { InlineError } from '../../components/FinanceStates';
import { formatINR, toFinanceError } from '../../utils/format';
import {
  BUDGET_CATEGORIES, CATEGORY_LABELS, distributionRemainder, orderDistributionWrites, parseAmountInput, sumCategories, toPaise,
  validateAllocation,
} from '../budgetTree';
import { useSaveAllocation, useSaveBudget } from '../useBudget';
import type { BudgetCategory, BudgetNode, CategoryAllocations, CycleRef, ResearchBudget } from '../types';

const amountText = (n: number | undefined | null) => (n ? String(n) : '');

export function AmountField({
  id, label, value, onChange, error, hint, required, compact,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string; hint?: React.ReactNode; required?: boolean; compact?: boolean;
}) {
  const parsed = parseAmountInput(value);
  return (
    <div>
      <label htmlFor={id} className={compact ? 'sr-only' : 'mb-1 block text-xs font-medium text-stone-700 dark:text-gray-300'}>
        {label}{required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400" aria-hidden="true">₹</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={`w-full pl-7 text-right tabular-nums ${ui.input} ${error ? '!border-red-400 focus:!ring-red-200' : ''}`}
        />
      </div>
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-stone-500 dark:text-gray-400">{hint}</p>
      ) : parsed !== null && !Number.isNaN(parsed) && !compact ? (
        <p className="mt-1 text-xs tabular-nums text-stone-500 dark:text-gray-400">{formatINR(parsed)}</p>
      ) : null}
    </div>
  );
}

function CategorySplitFields({ idPrefix, values, onChange, error }: {
  idPrefix: string; values: Record<string, string>; onChange: (k: BudgetCategory, v: string) => void; error?: string;
}) {
  const total = sumCategories(parsedCategories(values));
  return (
    <fieldset className="rounded-lg border border-stone-200 p-3 dark:border-gray-700">
      <legend className="px-1 text-xs font-medium text-stone-700 dark:text-gray-300">Split by category (optional)</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BUDGET_CATEGORIES.map((k) => (
          <AmountField key={k} id={`${idPrefix}-${k}`} label={CATEGORY_LABELS[k]} value={values[k] || ''} onChange={(v) => onChange(k, v)} />
        ))}
      </div>
      <p className={`mt-2 text-xs tabular-nums ${error ? 'text-red-700 dark:text-red-300' : 'text-stone-500 dark:text-gray-400'}`}>
        {error || `Categories total ${formatINR(total)}. Leave blank to not split.`}
      </p>
    </fieldset>
  );
}

function parsedCategories(values: Record<string, string>): CategoryAllocations {
  const out: CategoryAllocations = {};
  for (const k of BUDGET_CATEGORIES) {
    const v = parseAmountInput(values[k] || '');
    if (v !== null) out[k] = v;
  }
  return out;
}

const catText = (cats: CategoryAllocations | undefined) =>
  Object.fromEntries(BUDGET_CATEGORIES.map((k) => [k, amountText(cats?.[k])]));

function ReasonField({ id, value, onChange, error, required }: { id: string; value: string; onChange: (v: string) => void; error?: string; required: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-stone-700 dark:text-gray-300">
        Reason for the change{required ? <span aria-hidden="true"> *</span> : ' (optional)'}
      </label>
      <textarea
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        placeholder="e.g. Mid-year revision approved by the Finance Committee"
        className={`w-full py-2 ${ui.input} h-auto ${error ? '!border-red-400' : ''}`}
      />
      {error && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

// ─── University budget (total + settings) ───────────────────────────────────

export function BudgetSettingsForm({
  cycle, budget, childrenAllocated, onSaved, onCancel,
}: { cycle: CycleRef; budget: ResearchBudget | null; childrenAllocated: number; onSaved?: () => void; onCancel?: () => void }) {
  const id = useId();
  const toast = useToast();
  const save = useSaveBudget(cycle.id);
  const [total, setTotal] = useState(amountText(budget?.totalAmount));
  const [warnPct, setWarnPct] = useState(String(budget?.warnThresholdPct ?? 80));
  const [enforce, setEnforce] = useState(!!budget?.enforceLimit);
  const [notes, setNotes] = useState(budget?.notes || '');
  const [cats, setCats] = useState<Record<string, string>>(catText(budget?.categoryAllocations));
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const amount = parseAmountInput(total);
  const check = validateAllocation({
    amount,
    categories: parsedCategories(cats),
    parentAmount: 9_999_999_999_999,
    siblingsTotal: 0,
    childrenTotal: childrenAllocated,
    existing: budget ? { amount: budget.totalAmount, categories: budget.categoryAllocations } : null,
    reason,
    labels: { node: 'The university budget', children: 'schools' },
  });
  const pct = Number(warnPct);
  const pctError = !Number.isInteger(pct) || pct < 1 || pct > 100 ? 'Use a whole number from 1 to 100.' : undefined;
  const ok = check.ok && !pctError;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerError(null);
    if (!ok || amount === null) return;
    try {
      await save.mutateAsync({
        totalAmount: amount,
        categoryAllocations: parsedCategories(cats),
        notes: notes.trim() || null,
        enforceLimit: enforce,
        warnThresholdPct: pct,
        reason: reason.trim() || undefined,
      });
      toast.success(budget ? `${cycle.name} budget updated.` : `${cycle.name} budget created. Now distribute it across schools.`);
      onSaved?.();
    } catch (err) {
      setServerError(toFinanceError(err, 'Could not save the budget.').message);
    }
  };

  const show = (msg?: string) => (touched ? msg : undefined);
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <AmountField
        id={`${id}-total`}
        label={`Total research budget for ${cycle.name}`}
        required
        value={total}
        onChange={setTotal}
        error={show(check.errors.amount)}
        hint={childrenAllocated > 0 ? `${formatINR(childrenAllocated)} is already allocated to schools.` : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-pct`} className="mb-1 block text-xs font-medium text-stone-700 dark:text-gray-300">Flag a unit as near its limit at (%)</label>
          <input id={`${id}-pct`} inputMode="numeric" value={warnPct} onChange={(e) => setWarnPct(e.target.value)} className={`w-full ${ui.input}`} aria-invalid={!!pctError} />
          {touched && pctError && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{pctError}</p>}
        </div>
        <div className="flex items-start gap-2 pt-5">
          <input id={`${id}-enforce`} type="checkbox" checked={enforce} onChange={(e) => setEnforce(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-stone-300 text-wine focus:ring-wine/30" />
          <label htmlFor={`${id}-enforce`} className="text-sm text-stone-700 dark:text-gray-200">
            Enforce limits
            <span className="block text-xs text-stone-500 dark:text-gray-400">Refuse batch approvals that would leave a school or department over budget. Off: warn only.</span>
          </label>
        </div>
      </div>
      <CategorySplitFields idPrefix={`${id}-cat`} values={cats} onChange={(k, v) => setCats((c) => ({ ...c, [k]: v }))} error={show(check.errors.categories)} />
      <div>
        <label htmlFor={`${id}-notes`} className="mb-1 block text-xs font-medium text-stone-700 dark:text-gray-300">Notes (optional)</label>
        <textarea id={`${id}-notes`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className={`h-auto w-full py-2 ${ui.input}`} />
      </div>
      {budget && <ReasonField id={`${id}-reason`} value={reason} onChange={setReason} error={show(check.errors.reason)} required={check.changed} />}
      <InlineError message={serverError} />
      <div className="flex justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} className={ui.btnSecondary}>Cancel</button>}
        <button type="submit" disabled={save.isPending} className={ui.btnPrimary}>
          <Save className="h-4 w-4" aria-hidden="true" /> {save.isPending ? 'Saving…' : budget ? 'Save budget' : 'Create budget'}
        </button>
      </div>
    </form>
  );
}

// ─── One school or department ───────────────────────────────────────────────

export function AllocationEditor({
  cycle, node, parentAmount, siblingsTotal, parentLabel, onSaved,
}: { cycle: CycleRef; node: BudgetNode; parentAmount: number; siblingsTotal: number; parentLabel: string; onSaved?: () => void }) {
  const id = useId();
  const toast = useToast();
  const save = useSaveAllocation(cycle.id);
  const [value, setValue] = useState(amountText(node.allocated));
  const [cats, setCats] = useState<Record<string, string>>(catText(node.categoryAllocations));
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const amount = parseAmountInput(value);
  const check = validateAllocation({
    amount,
    categories: parsedCategories(cats),
    parentAmount,
    siblingsTotal,
    childrenTotal: node.childrenAllocated || 0,
    existing: node.hasAllocation ? { amount: node.allocated, categories: node.categoryAllocations } : null,
    reason,
    labels: { node: `${node.name}'s allocation`, parent: parentLabel, children: 'departments' },
  });
  const show = (msg?: string) => (touched ? msg : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerError(null);
    if (!check.ok || amount === null || !check.changed) return;
    try {
      await save.mutateAsync({
        nodeType: node.nodeType as 'school' | 'department',
        nodeId: node.id,
        amount,
        categoryAllocations: parsedCategories(cats),
        reason: reason.trim() || undefined,
      });
      toast.success(`${node.name}: allocation saved.`);
      setReason('');
      setTouched(false);
      onSaved?.();
    } catch (err) {
      setServerError(toFinanceError(err, 'Could not save the allocation.').message);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <AmountField
        id={`${id}-amount`}
        label={`Allocation for ${cycle.name}`}
        required
        value={value}
        onChange={setValue}
        error={show(check.errors.amount)}
        hint={`Up to ${formatINR(check.maxAllowed)} is available in ${parentLabel}.`}
      />
      <CategorySplitFields idPrefix={`${id}-cat`} values={cats} onChange={(k, v) => setCats((c) => ({ ...c, [k]: v }))} error={show(check.errors.categories)} />
      {node.hasAllocation && <ReasonField id={`${id}-reason`} value={reason} onChange={setReason} error={show(check.errors.reason)} required={check.changed} />}
      <InlineError message={serverError} />
      <div className="flex items-center justify-end gap-3">
        {!check.changed && <span className="text-xs text-stone-500 dark:text-gray-400">No changes</span>}
        <button type="submit" disabled={save.isPending || !check.changed} className={ui.btnPrimary}>
          <Save className="h-4 w-4" aria-hidden="true" /> {save.isPending ? 'Saving…' : 'Save allocation'}
        </button>
      </div>
    </form>
  );
}

// ─── Distribute a parent across its children ────────────────────────────────

/**
 * University → schools, or school → departments: one amount per child, a live
 * "unallocated remainder", the same rules as the backend, then saves only the changed rows
 * (decreases first, so the parent is never over-allocated part-way).
 */
export function DistributeEditor({ cycle, parent, onSaved }: { cycle: CycleRef; parent: BudgetNode; onSaved?: () => void }) {
  const id = useId();
  const toast = useToast();
  const save = useSaveAllocation(cycle.id);
  const children = useMemo(() => parent.children.filter((c) => c.nodeType === 'school' || c.nodeType === 'department'), [parent]);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(children.map((c) => [c.id, amountText(c.allocated)])));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const childNoun = parent.nodeType === 'university' ? 'schools' : 'departments';

  if (!children.length) {
    return <p className="text-sm text-stone-500 dark:text-gray-400">{parent.name} has no {childNoun} to distribute to.</p>;
  }
  if (parent.nodeType === 'school' && !parent.hasAllocation) {
    return <p className="text-sm text-stone-500 dark:text-gray-400">Allocate a budget to {parent.name} first, then distribute it across its departments.</p>;
  }

  const values = children.map((c) => parseAmountInput(drafts[c.id] || '0'));
  const remainder = distributionRemainder(parent.allocated, values);
  const rowErrors: Record<string, string> = {};
  children.forEach((c, i) => {
    const v = values[i];
    if (v === null) return;
    if (Number.isNaN(v) || v < 0) rowErrors[c.id] = 'Enter 0 or more';
    else if (c.childrenAllocated && toPaise(v) < toPaise(c.childrenAllocated)) rowErrors[c.id] = `Its departments hold ${formatINR(c.childrenAllocated)}`;
    else if (toPaise(v) < toPaise(sumCategories(c.categoryAllocations))) rowErrors[c.id] = `Its category split is ${formatINR(sumCategories(c.categoryAllocations))}`;
  });
  const changes = children
    .map((c, i) => ({ node: c, amount: values[i] ?? 0, previous: c.allocated }))
    .filter((r) => !Number.isNaN(r.amount) && (toPaise(r.amount) !== toPaise(r.previous) || (!r.node.hasAllocation && r.amount > 0)));
  const needsReason = changes.some((r) => r.node.hasAllocation);
  const reasonError = needsReason && reason.trim().length < 3 ? 'Give a reason for changing existing allocations.' : undefined;
  const over = toPaise(remainder) < 0;
  const ok = !over && !Object.keys(rowErrors).length && !reasonError && changes.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerError(null);
    if (!ok) return;
    setBusy(true);
    let done = 0;
    try {
      for (const r of orderDistributionWrites(changes)) {
        await save.mutateAsync({
          nodeType: r.node.nodeType as 'school' | 'department',
          nodeId: r.node.id,
          amount: r.amount,
          categoryAllocations: r.node.categoryAllocations,
          reason: r.node.hasAllocation ? reason.trim() : reason.trim() || undefined,
        });
        done += 1;
      }
      toast.success(`Saved ${done} allocation${done === 1 ? '' : 's'} across ${childNoun}.`);
      setReason('');
      setTouched(false);
      onSaved?.();
    } catch (err) {
      setServerError(`${done ? `${done} saved, then: ` : ''}${toFinanceError(err, 'Could not save the allocations.').message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm ${over ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40' : 'border-stone-200 bg-stone-50 dark:border-gray-700 dark:bg-gray-900/50'}`} aria-live="polite">
        <span className="flex items-center gap-2 text-stone-700 dark:text-gray-200">
          {over ? <AlertTriangle className="h-4 w-4" style={{ color: 'var(--viz-critical)' }} aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--viz-good)' }} aria-hidden="true" />}
          {over ? 'Over-allocated by' : 'Unallocated remainder'}
        </span>
        <span className={`font-semibold tabular-nums ${over ? 'text-red-700 dark:text-red-300' : 'text-stone-900 dark:text-white'}`}>{formatINR(Math.abs(remainder))}</span>
      </div>
      <p className="text-xs text-stone-500 dark:text-gray-400">{parent.name}: {formatINR(parent.allocated)} to distribute across {children.length} {childNoun}.</p>
      <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 dark:divide-gray-700 dark:border-gray-700">
        {children.map((c) => (
          <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_9.5rem] items-center gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <label htmlFor={`${id}-${c.id}`} className="block truncate text-sm font-medium text-stone-800 dark:text-gray-100" title={c.name}>{c.name}</label>
              <p className="truncate text-xs tabular-nums text-stone-500 dark:text-gray-400">
                {formatINR(c.consumed)} committed or paid{c.hasAllocation ? ` · now ${formatINR(c.allocated)}` : ' · not allocated yet'}
              </p>
              {rowErrors[c.id] && <p className="text-xs text-red-700 dark:text-red-300">{rowErrors[c.id]}</p>}
            </div>
            <AmountField id={`${id}-${c.id}`} label={`Allocation for ${c.name}`} compact value={drafts[c.id] || ''} onChange={(v) => setDrafts((d) => ({ ...d, [c.id]: v }))} />
          </li>
        ))}
      </ul>
      {needsReason && <ReasonField id={`${id}-reason`} value={reason} onChange={setReason} error={touched ? reasonError : undefined} required />}
      <InlineError message={serverError} />
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-stone-500 dark:text-gray-400">{changes.length ? `${changes.length} change${changes.length === 1 ? '' : 's'}` : 'No changes'}</span>
        <button type="submit" disabled={busy || !changes.length || over} className={ui.btnPrimary}>
          <Save className="h-4 w-4" aria-hidden="true" /> {busy ? 'Saving…' : 'Save distribution'}
        </button>
      </div>
    </form>
  );
}
