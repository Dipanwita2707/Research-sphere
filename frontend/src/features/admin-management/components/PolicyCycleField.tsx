'use client';

import React, { useId } from 'react';
import { AlertTriangle, CalendarRange } from 'lucide-react';
import { useCycles } from '@/features/finance/budget/useBudget';
import type { IncentiveCycle } from '@/features/finance/budget/types';

/**
 * Incentive cycle + effective dates for every incentive-policy form.
 *
 * A cycle (Finance → Research budget → Cycles) is the period that incentive policies and the
 * research budget share. Picking a cycle sets the policy's dates to the whole cycle; the dates can
 * then be narrowed but never leave it (the server enforces the same rule). Payouts this policy
 * prices draw on that cycle's budget.
 *
 * Without cycles (none created yet, or the viewer cannot read them) it falls back to plain dates.
 * Dates are YYYY-MM-DD strings, as the forms already hold them.
 */

export interface PolicyDates {
  effectiveFrom: string;
  effectiveTo: string;
}

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const cycleOf = (cycles: IncentiveCycle[], day: string) =>
  (day ? cycles.find((c) => c.startDate <= day && day <= c.endDate) : undefined);

/** Dates for a new policy: the current cycle (else the first upcoming one), or today when there are no cycles. */
export function defaultPolicyDates(cycles: IncentiveCycle[] | undefined): PolicyDates {
  const today = new Date().toISOString().slice(0, 10);
  const pick = cycles?.find((c) => c.isCurrent) || [...(cycles || [])].reverse().find((c) => c.startDate > today);
  return pick ? { effectiveFrom: pick.startDate, effectiveTo: pick.endDate } : { effectiveFrom: today, effectiveTo: '' };
}

export default function PolicyCycleField({
  value, onChange, inputClassName = 'w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
}: {
  value: PolicyDates;
  onChange: (next: PolicyDates) => void;
  inputClassName?: string;
}) {
  const id = useId();
  const q = useCycles();
  const cycles = q.data?.cycles || [];
  const hasCycles = cycles.length > 0;
  const cycle = cycleOf(cycles, value.effectiveFrom);
  const endsOutside = !!cycle && (!value.effectiveTo || value.effectiveTo > cycle.endDate);
  const labelCls = 'block text-sm font-medium text-gray-700 mb-2';

  const pickCycle = (cycleId: string) => {
    const c = cycles.find((x) => x.id === cycleId);
    if (c) onChange({ effectiveFrom: c.startDate, effectiveTo: c.endDate });
  };

  if (q.isLoading) {
    return <div className="h-24 animate-pulse rounded-xl bg-gray-100" aria-label="Loading incentive cycles" />;
  }

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 border-t border-gray-200 pt-5">
      <div>
        <h3 id={`${id}-title`} className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <CalendarRange className="h-5 w-5 text-blue-600" aria-hidden="true" /> Cycle and validity period
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          The policy prices works whose policy date (publication, grant sanction or IPR publication date) falls in this period.
        </p>
      </div>
      {hasCycles && (
        <div>
          <label htmlFor={`${id}-cycle`} className={labelCls}>
            Incentive cycle <span className="text-red-500">*</span>
          </label>
          <select id={`${id}-cycle`} value={cycle?.id || ''} onChange={(e) => pickCycle(e.target.value)} className={inputClassName}>
            {!cycle && <option value="">Choose a cycle…</option>}
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({fmt(c.startDate)} – {fmt(c.endDate)}){c.isCurrent ? ' · current' : ''}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-gray-500">
            The policy and the research budget share this cycle: payouts this policy prices draw on the cycle&apos;s budget.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={`${id}-from`} className={labelCls}>
            Effective from <span className="text-red-500">*</span>
          </label>
          <input
            id={`${id}-from`}
            type="date"
            value={value.effectiveFrom}
            min={cycle?.startDate}
            max={cycle?.endDate}
            onChange={(e) => onChange({ ...value, effectiveFrom: e.target.value })}
            className={inputClassName}
            required
          />
        </div>
        <div>
          <label htmlFor={`${id}-to`} className={labelCls}>
            Effective to {hasCycles ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optional)</span>}
          </label>
          <input
            id={`${id}-to`}
            type="date"
            value={value.effectiveTo}
            min={value.effectiveFrom || cycle?.startDate}
            max={cycle?.endDate}
            onChange={(e) => onChange({ ...value, effectiveTo: e.target.value })}
            className={inputClassName}
          />
          {!hasCycles && <p className="mt-1 text-xs text-gray-500">Leave empty for no end date.</p>}
        </div>
      </div>

      {hasCycles && !cycle && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          No incentive cycle covers {value.effectiveFrom ? fmt(value.effectiveFrom) : 'this start date'}. Choose a cycle above, or ask finance to create the cycle on the Research budget page.
        </p>
      )}
      {cycle && endsOutside && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {value.effectiveTo
            ? `This runs past the end of ${cycle.name} (${fmt(cycle.endDate)}). End it by then and create a separate policy for the next cycle.`
            : `With no end date, the policy will close on ${fmt(cycle.endDate)}, the last day of ${cycle.name}.`}
        </p>
      )}
    </section>
  );
}

/** One line for policy cards and lists: the policy's cycle and dates, the same on every policy page. */
export function PolicyPeriod({ effectiveFrom, effectiveTo, className = '' }: { effectiveFrom?: string | null; effectiveTo?: string | null; className?: string }) {
  const q = useCycles();
  const from = (effectiveFrom || '').slice(0, 10);
  const to = (effectiveTo || '').slice(0, 10);
  const cycles = q.data?.cycles || [];
  const cycle = cycleOf(cycles, from);
  const outside = cycles.length > 0 && (!cycle || !to || to > cycle.endDate);
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-gray-600 ${className}`}>
      <CalendarRange className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      {cycle && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{cycle.name}</span>}
      <span>{from ? fmt(from) : '—'} – {to ? fmt(to) : 'open-ended'}</span>
      {outside && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">{cycle ? 'Runs past its cycle' : 'No cycle'}</span>}
    </span>
  );
}
