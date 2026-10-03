'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarRange, ExternalLink, Pencil, Plus, ScrollText, Trash2 } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import { useToast } from '@/shared/ui-components/Toast';
import FinanceDialog from '../../components/FinanceDialog';
import { Badge, EmptyState, ErrorState, InlineError, TableSkeleton, btnDangerOutline } from '../../components/FinanceStates';
import { formatDate, formatINR, toFinanceError } from '../../utils/format';
import { useCyclePolicies, useDeleteCycle, useSaveCycle } from '../useBudget';
import type { CycleList, CycleRef, IncentiveCycle } from '../types';

/** "1 Apr 2026 – 31 Mar 2027" */
export const cycleRange = (c: Pick<IncentiveCycle, 'startDate' | 'endDate'>) => `${formatDate(c.startDate)} – ${formatDate(c.endDate)}`;

/** Cycle picker for the page header. */
export function CycleSelect({
  cycles, value, onChange, tone = 'default',
}: { cycles: IncentiveCycle[]; value: string; onChange: (id: string) => void; tone?: 'default' | 'hero' }) {
  const id = useId();
  const heroCls =
    'h-9 max-w-[16rem] rounded-lg border border-white/30 bg-white/10 px-3 text-sm font-medium text-white outline-none backdrop-blur-sm transition focus:ring-2 focus:ring-white/40 [&>option]:text-stone-900';
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className={tone === 'hero' ? 'text-xs font-medium text-white/80' : 'text-xs font-medium text-stone-600 dark:text-gray-300'}>
        Cycle
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={tone === 'hero' ? heroCls : ui.input}>
        {cycles.map((c) => (
          <option key={c.id} value={c.id}>{c.name}{c.isCurrent ? ' (current)' : ''}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Create / edit ──────────────────────────────────────────────────────────

function CycleForm({
  cycle, suggestion, onSaved, onCancel,
}: { cycle: IncentiveCycle | null; suggestion: CycleList['suggestion']; onSaved: (c: IncentiveCycle) => void; onCancel: () => void }) {
  const id = useId();
  const toast = useToast();
  const save = useSaveCycle(cycle?.id || null);
  const [name, setName] = useState(cycle?.name ?? suggestion.name);
  const [startDate, setStartDate] = useState(cycle?.startDate ?? suggestion.startDate);
  const [endDate, setEndDate] = useState(cycle?.endDate ?? suggestion.endDate);
  const [notes, setNotes] = useState(cycle?.notes ?? '');
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const errors = {
    name: !name.trim() ? 'Give the cycle a name.' : name.trim().length > 64 ? 'At most 64 characters.' : undefined,
    startDate: !startDate ? 'Pick a start date.' : undefined,
    endDate: !endDate ? 'Pick an end date.' : startDate && endDate < startDate ? 'The end date must be on or after the start date.' : undefined,
  };
  const invalid = Object.values(errors).some(Boolean);
  const datesMoved = !!cycle && (cycle.startDate !== startDate || cycle.endDate !== endDate);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerError(null);
    if (invalid) return;
    try {
      const saved = await save.mutateAsync({ name: name.trim(), startDate, endDate, notes: notes.trim() || null });
      const moved = saved.relinkedPayoutLines ? ` ${saved.relinkedPayoutLines} payout line${saved.relinkedPayoutLines === 1 ? '' : 's'} re-linked by policy date.` : '';
      toast.success(`${cycle ? 'Cycle updated' : 'Cycle created'}: ${saved.name}.${moved}`);
      onSaved(saved);
    } catch (err) {
      setServerError(toFinanceError(err, 'Could not save the cycle.').message);
    }
  };

  const field = (key: 'name' | 'startDate' | 'endDate') => (touched && errors[key]
    ? <p id={`${id}-${key}-err`} className="mt-1 text-xs text-red-700 dark:text-red-300">{errors[key]}</p>
    : null);
  const labelCls = 'mb-1 block text-xs font-medium text-stone-700 dark:text-gray-300';

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor={`${id}-name`} className={labelCls}>Name<span aria-hidden="true"> *</span></label>
        <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={64} placeholder="FY 2027-28"
          aria-invalid={touched && !!errors.name} aria-describedby={touched && errors.name ? `${id}-name-err` : undefined} className={`w-full ${ui.input}`} />
        {field('name')}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-start`} className={labelCls}>Starts<span aria-hidden="true"> *</span></label>
          <input id={`${id}-start`} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            aria-invalid={touched && !!errors.startDate} aria-describedby={touched && errors.startDate ? `${id}-startDate-err` : undefined} className={`w-full ${ui.input}`} />
          {field('startDate')}
        </div>
        <div>
          <label htmlFor={`${id}-end`} className={labelCls}>Ends<span aria-hidden="true"> *</span></label>
          <input id={`${id}-end`} type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)}
            aria-invalid={touched && !!errors.endDate} aria-describedby={touched && errors.endDate ? `${id}-endDate-err` : undefined} className={`w-full ${ui.input}`} />
          {field('endDate')}
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-notes`} className={labelCls}>Notes (optional)</label>
        <textarea id={`${id}-notes`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`w-full py-2 ${ui.input} h-auto`} />
      </div>
      <p className="text-xs text-stone-500 dark:text-gray-400">
        Incentive policies and the research budget share this cycle. A payout line is charged to the cycle containing the date that selected its policy
        (publication date, grant sanction date, IPR publication), so the policy that priced it and the budget that pays it are always the same cycle.
      </p>
      {datesMoved && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Moving the dates re-links payout lines to whichever cycle now contains their policy date, which changes this cycle&apos;s committed and paid figures.
        </p>
      )}
      <InlineError message={serverError} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={ui.btnSecondary}>Cancel</button>
        <button type="submit" disabled={save.isPending} className={ui.btnPrimary}>{save.isPending ? 'Saving…' : cycle ? 'Save cycle' : 'Create cycle'}</button>
      </div>
    </form>
  );
}

/** Create the first cycle, or list / edit / delete cycles. */
export function CycleManagerDialog({
  open, onClose, data, initialMode = 'list', onCreated,
}: { open: boolean; onClose: () => void; data: CycleList | undefined; initialMode?: 'list' | 'new'; onCreated?: (c: IncentiveCycle) => void }) {
  const toast = useToast();
  const remove = useDeleteCycle();
  const [mode, setMode] = useState<{ kind: 'list' } | { kind: 'new' } | { kind: 'edit'; cycle: IncentiveCycle }>({ kind: initialMode });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const cycles = data?.cycles || [];
  const suggestion = data?.suggestion || { name: '', startDate: '', endDate: '' };

  const close = () => { setMode({ kind: initialMode }); setDeleteError(null); onClose(); };
  const doDelete = async (c: IncentiveCycle) => {
    setDeleteError(null);
    if (!window.confirm(`Delete the cycle "${c.name}"?`)) return;
    try {
      await remove.mutateAsync(c.id);
      toast.success(`Deleted ${c.name}.`);
    } catch (err) {
      setDeleteError(toFinanceError(err, 'Could not delete the cycle.').message);
    }
  };

  const title = mode.kind === 'new' ? 'New incentive cycle' : mode.kind === 'edit' ? `Edit ${mode.cycle.name}` : 'Incentive cycles';
  return (
    <FinanceDialog open={open} onClose={close} title={title} description="The period that incentive policies and the research budget share." size="lg">
      {mode.kind === 'list' ? (
        <div className="space-y-4">
          <InlineError message={deleteError} />
          {cycles.length === 0 ? (
            <EmptyState icon={<CalendarRange />} title="No cycles yet" description="Create the first cycle to set a research budget." />
          ) : (
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 dark:divide-gray-700 dark:border-gray-700">
              {cycles.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-stone-900 dark:text-white">
                      {c.name} {c.isCurrent && <Badge tone="emerald">Current</Badge>}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-gray-400">
                      {cycleRange(c)} · {c.budget ? `Budget ${c.budget.totalAmount != null ? formatINR(c.budget.totalAmount) : 'set'}` : 'No budget'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setMode({ kind: 'edit', cycle: c })} className={ui.btnSecondary} aria-label={`Edit ${c.name}`}>
                      <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
                    </button>
                    {!c.budget && (
                      <button type="button" onClick={() => doDelete(c)} disabled={remove.isPending} className={btnDangerOutline} aria-label={`Delete ${c.name}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={() => setMode({ kind: 'new' })} className={ui.btnPrimary}>
              <Plus className="h-4 w-4" aria-hidden="true" /> New cycle
            </button>
          </div>
        </div>
      ) : (
        <CycleForm
          key={mode.kind === 'edit' ? mode.cycle.id : 'new'}
          cycle={mode.kind === 'edit' ? mode.cycle : null}
          suggestion={suggestion}
          onSaved={(c) => {
            if (mode.kind === 'new') onCreated?.(c);
            if (initialMode === 'new') close();
            else setMode({ kind: 'list' });
          }}
          onCancel={() => (initialMode === 'new' ? close() : setMode({ kind: 'list' }))}
        />
      )}
    </FinanceDialog>
  );
}

// ─── Policies in the cycle ──────────────────────────────────────────────────

/** The incentive policies in force during the cycle, next to its budget. */
export function CyclePoliciesPanel({ cycle }: { cycle: CycleRef }) {
  const q = useCyclePolicies(cycle.id);
  const d = q.data;
  const outside = d?.items.filter((p) => !p.fitsCycle).length || 0;
  return (
    <section aria-labelledby="cycle-policies-title" className={ui.card}>
      <div className={ui.cardHeader}>
        <div>
          <h2 id="cycle-policies-title" className={`${ui.title} inline-flex items-center gap-1.5`}>
            <ScrollText className="h-4 w-4" aria-hidden="true" /> Incentive policies in {cycle.name}
          </h2>
          <p className={ui.subtitle}>
            {cycleRange(cycle)}. Payouts priced by these policies draw on this cycle&apos;s budget; each work&apos;s amount is split among its authors by the policy&apos;s role percentages.
          </p>
        </div>
      </div>
      <div className="px-5 py-4">
        {q.isLoading ? (
          <TableSkeleton rows={4} cols={4} label="Loading policies" />
        ) : q.isError || !d ? (
          <ErrorState title="Couldn't load the policies" message={toFinanceError(q.error).message} onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : d.items.length === 0 ? (
          <EmptyState
            icon={<ScrollText />}
            title="No enabled policies in this cycle"
            description="Works approved under this cycle fall back to the built-in default amounts. An admin sets the policies under Admin → incentive policies, with dates inside this cycle."
          />
        ) : (
          <div className="space-y-4">
            {outside > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {outside} polic{outside === 1 ? 'y runs' : 'ies run'} past this cycle&apos;s dates (set before cycles existed). Works they price are still charged by date to the cycle they fall in. Give them dates inside one cycle when you next edit them.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {d.byType.map((t) => (
                <span key={t.type} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-700 dark:border-gray-600 dark:text-gray-200">
                  {t.label} <span className="font-semibold tabular-nums">{t.count}</span>
                </span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <caption className="sr-only">Enabled incentive policies during {cycle.name}</caption>
                <thead className="border-b border-stone-100 dark:border-gray-700">
                  <tr>
                    <th scope="col" className={ui.th}>Policy</th>
                    <th scope="col" className={ui.th}>Type</th>
                    <th scope="col" className={`${ui.th} text-right`}>Base amount</th>
                    <th scope="col" className={ui.th}>In force</th>
                    <th scope="col" className={ui.th}><span className="sr-only">Manage</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                  {d.items.map((p) => (
                    <tr key={`${p.type}-${p.id}`}>
                      <td className={ui.td}>
                        <span className="font-medium text-stone-900 dark:text-white">{p.name}</span>
                        {p.key && <span className="block text-xs text-stone-500 dark:text-gray-400">{p.key.replace(/_/g, ' ')}</span>}
                      </td>
                      <td className={ui.td}>{p.typeLabel}</td>
                      <td className={`${ui.td} text-right tabular-nums`}>{p.amount == null ? '—' : formatINR(p.amount)}</td>
                      <td className={`${ui.td} whitespace-nowrap`}>
                        {formatDate(p.effectiveFrom)} – {p.effectiveTo ? formatDate(p.effectiveTo) : 'open-ended'}
                        {!p.fitsCycle && <span className="ml-2"><Badge tone="amber">Outside cycle</Badge></span>}
                      </td>
                      <td className={`${ui.td} text-right`}>
                        <Link href={p.href} className="inline-flex items-center gap-1 text-xs font-medium text-wine hover:underline dark:text-amber">
                          Manage <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
