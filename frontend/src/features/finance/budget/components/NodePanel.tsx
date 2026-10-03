'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, History, Landmark } from 'lucide-react';
import { AnalyticsBarChart } from '@/components/analytics';
import { ui } from '@/components/analytics/theme';
import FinanceDialog from '../../components/FinanceDialog';
import { EmptyState, ErrorState, PayoutStatusBadge, TableSkeleton } from '../../components/FinanceStates';
import {
  formatDate, formatDateTime, formatINR, formatINRCompact, formatMonth, personName, toFinanceError, workTypeLabel,
} from '../../utils/format';
import { BudgetStatusBadge, BURN_COLORS, Figure, UtilisationBar } from './BudgetBits';
import { AllocationEditor, BudgetSettingsForm, DistributeEditor } from './BudgetEditors';
import { CATEGORY_LABELS, nodeKey, parentOf } from '../budgetTree';
import { useBudgetNode } from '../useBudget';
import type { BudgetEvent, BudgetNode, BudgetTreeResponse, CategoryRow, CycleRef } from '../types';
import type { PayoutStatus } from '../../types';

type Tab = 'overview' | 'allocate' | 'history';
const LEVEL: Record<string, string> = { university: 'University', school: 'School', department: 'Department', unassigned: 'Unassigned lines' };

const ACTION_LABEL: Record<string, string> = {
  budget_created: 'Budget created',
  budget_updated: 'Budget updated',
  allocation_created: 'Allocation set',
  allocation_updated: 'Allocation changed',
  over_budget_warning: 'Over-budget warning',
  over_budget_blocked: 'Approval blocked (over budget)',
  cycle_dates_changed: 'Cycle dates changed',
};

function CategorySplit({ rows }: { rows: CategoryRow[] }) {
  const visible = rows.filter((r) => r.allocated > 0 || r.consumed > 0 || r.pending > 0);
  if (!visible.length) return <p className="text-sm text-stone-500 dark:text-gray-400">No allocation or spending by category yet.</p>;
  const max = Math.max(1, ...visible.map((r) => Math.max(r.allocated, r.consumed)));
  return (
    <ul className="space-y-3">
      {visible.map((r) => {
        const over = r.allocated > 0 && r.consumed > r.allocated;
        return (
          <li key={r.category} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-stone-700 dark:text-gray-200">{CATEGORY_LABELS[r.category]}</span>
              <span className="text-xs tabular-nums text-stone-600 dark:text-gray-300">
                <span className="font-semibold text-stone-900 dark:text-white">{formatINRCompact(r.consumed)}</span>
                {r.allocated > 0 ? ` of ${formatINRCompact(r.allocated)}` : ' · not split'}
                {over && <span className="ml-1 font-medium text-red-700 dark:text-red-300">over</span>}
              </span>
            </div>
            <div className="relative mt-1 h-2 rounded-full bg-stone-100 dark:bg-gray-700" aria-hidden="true">
              <div className="absolute inset-y-0 left-0 flex gap-[2px] overflow-hidden rounded-full" style={{ width: `${(r.consumed / max) * 100}%` }}>
                <div style={{ flex: r.utilised || 0.0001, backgroundColor: BURN_COLORS.utilised }} />
                {r.committed > 0 && <div style={{ flex: r.committed, backgroundColor: BURN_COLORS.committed }} />}
              </div>
              {r.allocated > 0 && <div className="absolute -top-1 h-4 w-0.5 rounded bg-stone-700 dark:bg-gray-200" style={{ left: `calc(${(r.allocated / max) * 100}% - 1px)` }} title="Allocated" />}
            </div>
          </li>
        );
      })}
      <li className="text-[11px] text-stone-500 dark:text-gray-400">Dark tick = category allocation. Pending verification is not counted.</li>
    </ul>
  );
}

function HistoryList({ events }: { events: BudgetEvent[] }) {
  if (!events.length) return <EmptyState title="No changes yet" description="Allocation changes and over-budget warnings for this unit appear here." icon={<History />} />;
  return (
    <ol className="space-y-3">
      {events.map((e) => {
        const warn = e.action.startsWith('over_budget');
        return (
          <li key={e.id} className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm dark:border-gray-700">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className={`font-medium ${warn ? 'text-red-700 dark:text-red-300' : 'text-stone-900 dark:text-white'}`}>{ACTION_LABEL[e.action] || e.action}</span>
              <time className="text-xs text-stone-500 dark:text-gray-400" dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
            </div>
            {!warn && (e.oldAmount != null || e.newAmount != null) && (
              <p className="mt-0.5 tabular-nums text-stone-700 dark:text-gray-200">
                {e.oldAmount != null ? `${formatINR(e.oldAmount)} → ` : ''}{e.newAmount != null ? formatINR(e.newAmount) : ''}
              </p>
            )}
            {warn && <p className="mt-0.5 tabular-nums text-stone-700 dark:text-gray-200">{formatINR(e.newAmount || 0)} committed or paid against {formatINR(e.oldAmount || 0)}</p>}
            {!warn && e.reason && <p className="mt-0.5 text-stone-600 dark:text-gray-300">“{e.reason}”</p>}
            <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">by {personName(e.actor) || 'unknown user'}</p>
          </li>
        );
      })}
    </ol>
  );
}

export default function NodePanel({
  cycle, data, node, onClose, initialTab = 'overview',
}: { cycle: CycleRef; data: BudgetTreeResponse; node: BudgetNode | null; onClose: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const detail = useBudgetNode(cycle.id, node?.nodeType || null, node ? node.id : null);
  const d = detail.data;
  const canEdit = data.access.canEdit && !!data.budget && node?.nodeType !== 'unassigned';
  const warnPct = data.summary.warnThresholdPct;

  const months = useMemo(() => (d?.monthly || []).map((m) => ({
    label: formatMonth(m.month),
    values: { utilised: Math.round(m.utilised), committed: Math.round(m.committed) },
  })), [d?.monthly]);
  const anyMonthly = months.some((m) => m.values.utilised > 0 || m.values.committed > 0);

  if (!node) return null;
  const parent = node.nodeType === 'university' ? null : parentOf(data.tree, nodeKey(node));
  const siblingsTotal = parent ? parent.children.filter((c) => c.id !== node.id && c.nodeType === node.nodeType).reduce((s, c) => s + c.allocated, 0) : 0;
  const queueHref = `/finance/payouts?status=all&cycle=${cycle.id}${node.nodeType === 'school' ? `&school=${node.id}` : node.nodeType === 'department' ? `&department=${node.id}` : node.nodeType === 'unassigned' ? '&school=unassigned' : ''}`;
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'overview', label: 'Overview' },
    ...(canEdit ? [{ key: 'allocate' as Tab, label: node.nodeType === 'department' ? 'Edit allocation' : 'Allocate' }] : []),
    ...(node.nodeType !== 'unassigned' && data.budget ? [{ key: 'history' as Tab, label: 'History' }] : []),
  ];
  const activeTab = tabs.some((t) => t.key === tab) ? tab : 'overview';

  return (
    <FinanceDialog
      open
      onClose={onClose}
      variant="drawer"
      size="lg"
      title={node.name}
      description={<span>{LEVEL[node.nodeType]}{node.code ? ` · ${node.code}` : ''} · {cycle.name}</span>}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <BudgetStatusBadge status={node.status} warnPct={warnPct} />
          {node.utilisationPct != null && <span className="text-xs tabular-nums text-stone-500 dark:text-gray-400">{node.utilisationPct}% of allocation committed or paid</span>}
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {node.nodeType !== 'unassigned' && <Figure label="Allocated" value={node.allocated} compact={false} />}
          <Figure label="Committed" value={node.committed} compact={false} />
          <Figure label="Utilised (paid)" value={node.utilised} compact={false} />
          <Figure label="Pending verification" value={node.pending} compact={false} />
          {node.nodeType !== 'unassigned' && <Figure label="Available" value={node.available} tone={node.available < 0 ? 'negative' : undefined} compact={false} />}
          <Figure label="External funding received" value={node.externalFunding.amount} compact={false} />
        </dl>
        {node.nodeType !== 'unassigned' && <UtilisationBar figures={node} />}
        {node.nodeType === 'unassigned' && (
          <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600 dark:bg-gray-900/50 dark:text-gray-300">
            Payout lines whose payee has no school or department on record. They count against the university total only. Set the payee&apos;s primary school/department to attribute future lines.
          </p>
        )}

        {tabs.length > 1 && (
          <div role="tablist" aria-label="Budget unit sections" className="flex gap-1 border-b border-stone-200 dark:border-gray-700">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 ${activeTab === t.key ? 'border-wine text-wine dark:border-amber dark:text-amber' : 'border-transparent text-stone-600 hover:text-stone-900 dark:text-gray-400 dark:hover:text-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'allocate' && canEdit && (
          <div className="space-y-6">
            {node.nodeType === 'university' && data.budget && (
              <section aria-label="University budget" className="space-y-3">
                <h3 className={ui.title}>University budget</h3>
                <BudgetSettingsForm key={`settings-${data.budget.updatedAt}`} cycle={cycle} budget={data.budget} childrenAllocated={node.childrenAllocated || 0} />
              </section>
            )}
            {node.nodeType !== 'university' && (
              <section aria-label="Allocation" className="space-y-3">
                <h3 className={ui.title}>Allocation</h3>
                <AllocationEditor
                  key={`alloc-${node.id}-${node.updatedAt}`}
                  cycle={cycle}
                  node={node}
                  parentAmount={parent?.allocated || 0}
                  siblingsTotal={siblingsTotal}
                  parentLabel={parent?.nodeType === 'university' ? 'the university budget' : parent?.name || 'the school'}
                />
              </section>
            )}
            {(node.nodeType === 'university' || node.nodeType === 'school') && (
              <section aria-label={`Distribute across ${node.nodeType === 'university' ? 'schools' : 'departments'}`} className="space-y-3 border-t border-stone-100 pt-5 dark:border-gray-700">
                <h3 className={ui.title}>Distribute across {node.nodeType === 'university' ? 'schools' : 'departments'}</h3>
                <DistributeEditor key={`dist-${node.id}-${node.allocated}-${node.childrenAllocated}`} cycle={cycle} parent={node} />
              </section>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          detail.isLoading ? <TableSkeleton rows={4} cols={2} /> : <HistoryList events={d?.history || []} />
        )}

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <section aria-label="By category" className="space-y-2">
              <h3 className={ui.title}>By category</h3>
              <CategorySplit rows={node.categories} />
            </section>

            {detail.isLoading ? (
              <TableSkeleton rows={6} cols={3} label="Loading details" />
            ) : detail.isError || !d ? (
              <ErrorState title="Couldn't load details" message={toFinanceError(detail.error).message} onRetry={() => detail.refetch()} retrying={detail.isFetching} />
            ) : (
              <>
                <section aria-label="Monthly burn" className="space-y-2">
                  <h3 className={ui.title}>Monthly burn</h3>
                  {anyMonthly ? (
                    <AnalyticsBarChart data={months} keys={[{ key: 'utilised', label: 'Utilised' }, { key: 'committed', label: 'Committed' }]} stacked height={220} />
                  ) : (
                    <p className="text-sm text-stone-500 dark:text-gray-400">Nothing committed or paid in {cycle.name} yet.</p>
                  )}
                  <p className="text-xs tabular-nums text-stone-500 dark:text-gray-400">
                    Burn rate {formatINR(d.burnRate.avgMonthly)} a month over {d.burnRate.monthsElapsed} month{d.burnRate.monthsElapsed === 1 ? '' : 's'}
                    {d.burnRate.monthsElapsed > 0 ? ` · at this pace ${formatINR(d.burnRate.projectedCycleEnd)} by the end of the cycle${d.burnRate.projectedPct != null ? ` (${d.burnRate.projectedPct}% of allocation)` : ''}` : ''}.
                  </p>
                </section>

                <section aria-label="Payout lines" className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className={ui.title}>Payout lines behind these figures <span className="font-normal text-stone-500 dark:text-gray-400">· {d.lines.total}</span></h3>
                    {!data.access.scoped && d.lines.total > 0 && (
                      <Link href={queueHref} className="inline-flex items-center gap-1 text-xs font-medium text-wine hover:underline dark:text-amber">
                        Open in verification queue <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                  {d.lines.items.length === 0 ? (
                    <p className="text-sm text-stone-500 dark:text-gray-400">No payout lines in {cycle.name}.</p>
                  ) : (
                    <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 dark:divide-gray-700 dark:border-gray-700">
                      {d.lines.items.map((l) => (
                        <li key={l.id} className="px-3 py-2.5">
                          <div className="flex items-baseline justify-between gap-3">
                            {data.access.scoped ? (
                              <span className="min-w-0 truncate text-sm font-medium text-stone-800 dark:text-gray-100">{l.payeeName} — {l.title}</span>
                            ) : (
                              <Link href={`/finance/payouts?status=all&cycle=${cycle.id}&line=${l.id}`} className="min-w-0 truncate text-sm font-medium text-stone-800 hover:text-wine hover:underline dark:text-gray-100 dark:hover:text-amber">
                                {l.payeeName} — {l.title}
                              </Link>
                            )}
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-900 dark:text-white">{formatINR(l.approvedAmount)}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-gray-400">
                            <PayoutStatusBadge status={l.status as PayoutStatus} />
                            <span>{workTypeLabel(l.workType)}</span>
                            {l.paidAt && <span>paid {formatDate(l.paidAt)}</span>}
                          </div>
                        </li>
                      ))}
                      {d.lines.total > d.lines.items.length && (
                        <li className="px-3 py-2 text-xs text-stone-500 dark:text-gray-400">Largest {d.lines.items.length} of {d.lines.total} shown.</li>
                      )}
                    </ul>
                  )}
                </section>

                <section aria-label="External funding received" className="space-y-2">
                  <h3 className={ui.title}>External funding received <span className="font-normal text-stone-500 dark:text-gray-400">· {formatINR(d.externalFunding.amount)}</span></h3>
                  <p className="text-xs text-stone-500 dark:text-gray-400">Grant money received from funding agencies during {cycle.name}. Shown next to spending; not counted against the budget.</p>
                  {d.externalFunding.receipts.length === 0 ? (
                    <p className="text-sm text-stone-500 dark:text-gray-400">No grant receipts recorded in {cycle.name}.</p>
                  ) : (
                    <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 dark:divide-gray-700 dark:border-gray-700">
                      {d.externalFunding.receipts.map((r) => (
                        <li key={r.id} className="flex items-baseline justify-between gap-3 px-3 py-2.5 text-sm">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-stone-800 dark:text-gray-100">{r.grantTitle || 'Grant'}</span>
                            <span className="block text-xs text-stone-500 dark:text-gray-400">{[r.agency, r.applicationNumber, formatDate(r.receivedDate)].filter(Boolean).join(' · ')}</span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-stone-900 dark:text-white">{formatINR(r.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
            {node.nodeType === 'university' && !data.access.scoped && data.budget?.notes && (
              <section aria-label="Notes" className="space-y-1">
                <h3 className={`${ui.title} inline-flex items-center gap-1.5`}><Landmark className="h-4 w-4" aria-hidden="true" />Notes</h3>
                <p className="whitespace-pre-line text-sm text-stone-700 dark:text-gray-200">{data.budget.notes}</p>
              </section>
            )}
          </div>
        )}
      </div>
    </FinanceDialog>
  );
}
