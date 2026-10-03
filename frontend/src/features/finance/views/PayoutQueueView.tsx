'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, FileStack, Search, ThumbsUp, X } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import { FinancePageShell, FinancialYearSelect } from '../components/FinanceShell';
import { EmptyState, ErrorState, PayoutStatusBadge, TableSkeleton } from '../components/FinanceStates';
import PayoutDetailDrawer from '../components/PayoutDetailDrawer';
import { allowedActions, usePayoutActions } from '../components/usePayoutActions';
import { usePayouts } from '../hooks/useFinance';
import { useBudgetTree, useCycles } from '../budget/useBudget';
import { useFinancePermissions } from '../hooks/useFinancePermissions';
import {
  WORK_TYPE_LABELS, financialYearOf, financialYearOptions, formatINR, formatINRCompact, formatNumber,
  isForbidden, toFinanceError, workTypeLabel,
} from '../utils/format';
import type { PayoutLine, PayoutStatus } from '../types';

const PAGE_SIZE = 25;
const STATUSES: PayoutStatus[] = ['pending_verification', 'recommended', 'on_hold', 'approved', 'paid', 'cancelled'];
type Tab = PayoutStatus | 'all';
const TAB_LABEL: Record<Tab, string> = {
  pending_verification: 'Awaiting verification',
  recommended: 'Recommended',
  on_hold: 'On hold',
  approved: 'Approved',
  paid: 'Paid',
  cancelled: 'Cancelled',
  all: 'All',
};
const TABS: Tab[] = [...STATUSES, 'all'];
const EMPTY_SELECTION = new Map<string, PayoutLine>();

const EMPTY_TEXT: Record<Tab, string> = {
  pending_verification: 'Nothing is waiting for verification. New lines arrive when DRD approves a work with an incentive.',
  recommended: 'No recommended lines. Recommend lines from “Awaiting verification” to batch them for payment.',
  on_hold: 'No lines are on hold.',
  approved: 'No approved lines are waiting for payment.',
  paid: 'No lines have been paid for these filters.',
  cancelled: 'No cancelled lines.',
  all: 'No payout lines match these filters.',
};

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function PayoutQueueView() {
  const router = useRouter();
  const params = useSearchParams();
  const perms = useFinancePermissions();

  const initialTab = (params?.get('status') as Tab | null) || 'pending_verification';
  const initialFy = params?.get('fy');
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab) ? initialTab : 'pending_verification');
  const [fy, setFy] = useState<string>(initialFy ?? '');
  const [cycleId, setCycleId] = useState(params?.get('cycle') || '');
  const [workType, setWorkType] = useState(params?.get('workType') || '');
  const [schoolId, setSchoolId] = useState(params?.get('school') || '');
  const [departmentId, setDepartmentId] = useState(params?.get('department') || '');
  const [searchInput, setSearchInput] = useState(params?.get('search') || '');
  const search = useDebounced(searchInput.trim());
  const [drawerId, setDrawerId] = useState<string | null>(params?.get('line') ?? null);

  const filters = {
    financialYear: fy || undefined, cycleId: cycleId || undefined, workType: workType || undefined, search: search || undefined,
    schoolId: schoolId || undefined, departmentId: departmentId || undefined,
  };
  // School / department options come from the org tree served with the research budget.
  const org = useBudgetTree(cycleId && cycleId !== 'none' ? cycleId : 'current');
  const cycleList = useCycles().data?.cycles || [];
  const schoolOptions = useMemo(() => (org.data?.tree.children || []).filter((c) => c.nodeType === 'school'), [org.data]);
  const departmentOptions = useMemo(() => {
    const pool = schoolId && schoolId !== 'unassigned' ? schoolOptions.filter((s2) => s2.id === schoolId) : schoolOptions;
    return pool.flatMap((s2) => s2.children);
  }, [schoolOptions, schoolId]);
  // Page and selection belong to one tab + filter combination; changing either starts afresh.
  const filterKey = JSON.stringify([tab, filters]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const [selState, setSelState] = useState({ key: filterKey, lines: new Map<string, PayoutLine>() });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const selected = selState.key === filterKey ? selState.lines : EMPTY_SELECTION;
  const setPage = (fn: (p: number) => number) => setPageState({ key: filterKey, page: fn(page) });
  const setSelected = (next: Map<string, PayoutLine> | ((prev: Map<string, PayoutLine>) => Map<string, PayoutLine>)) =>
    setSelState((prev) => {
      const base = prev.key === filterKey ? prev.lines : EMPTY_SELECTION;
      return { key: filterKey, lines: typeof next === 'function' ? next(base) : next };
    });

  // One request returns the page and the per-status tab badges for the same filters.
  const list = usePayouts({ ...filters, status: tab === 'all' ? undefined : [tab], page, limit: PAGE_SIZE, withStatusCounts: true });
  const counts = useMemo(() => {
    const byStatus = list.data?.statusCounts;
    if (!byStatus) return {} as Partial<Record<PayoutStatus, { count: number; amount: number }>>;
    return Object.fromEntries(STATUSES.map((s) => [s, byStatus[s] || { count: 0, amount: 0 }])) as Partial<Record<PayoutStatus, { count: number; amount: number }>>;
  }, [list.data?.statusCounts]);
  const allCount = STATUSES.every((s) => counts[s]) ? STATUSES.reduce((n, s) => n + (counts[s]?.count || 0), 0) : undefined;

  const actions = usePayoutActions({
    onDone: () => setSelected(new Map()),
    onBatchCreated: (b) => router.push(`/finance/batches/${b.id}`),
  });

  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const selectable = (l: PayoutLine) => {
    const a = allowedActions(l);
    return perms.canReview && (a.recommend || a.batch);
  };
  const pageSelectable = items.filter(selectable);
  const allOnPageSelected = pageSelectable.length > 0 && pageSelectable.every((l) => selected.has(l.id));
  const someOnPageSelected = pageSelectable.some((l) => selected.has(l.id));
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someOnPageSelected && !allOnPageSelected;
  }, [someOnPageSelected, allOnPageSelected]);

  const selectedLines = [...selected.values()];
  const selectedTotal = selectedLines.reduce((s, l) => s + l.approvedAmount, 0);
  const recommendable = selectedLines.filter((l) => allowedActions(l).recommend);
  const batchable = selectedLines.filter((l) => allowedActions(l).batch);

  const toggle = (l: PayoutLine) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(l.id)) next.delete(l.id);
      else next.set(l.id, l);
      return next;
    });
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (allOnPageSelected) pageSelectable.forEach((l) => next.delete(l.id));
      else pageSelectable.forEach((l) => next.set(l.id, l));
      return next;
    });

  const total = list.data?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showChecks = perms.canReview && items.some(selectable);

  const fyOptions = financialYearOptions();
  const currentFy = financialYearOf();

  return (
    <FinancePageShell
      title="Verification queue"
      description="Check each payout line against the incentive policy, then recommend, hold, adjust or cancel it. Recommended lines are grouped into payment batches."
      forbidden={isForbidden(list.error)}
      chips={[
        { label: 'Awaiting verification', value: counts.pending_verification ? formatNumber(counts.pending_verification.count) : '—' },
        { label: 'Recommended', value: counts.recommended ? formatINRCompact(counts.recommended.amount) : '—' },
        { label: 'On hold', value: counts.on_hold ? formatNumber(counts.on_hold.count) : '—' },
        { label: 'Approved, not paid', value: counts.approved ? formatINRCompact(counts.approved.amount) : '—' },
      ]}
    >
      <section className={`overflow-hidden ${ui.card}`}>
        {/* Status tabs */}
        <div role="tablist" aria-label="Payout status" className="flex gap-1 overflow-x-auto border-b border-stone-100 px-3 pt-2 dark:border-gray-700">
          {TABS.map((t) => {
            const c = t === 'all' ? allCount : counts[t]?.count;
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="payout-table"
                onClick={() => setTab(t)}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 ${
                  active
                    ? 'border-wine text-wine dark:border-amber dark:text-amber'
                    : 'border-transparent text-stone-600 hover:text-stone-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                {TAB_LABEL[t]}
                <span className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-center text-[11px] tabular-nums ${active ? 'bg-wine/10 text-wine dark:bg-amber/20 dark:text-amber' : 'bg-stone-100 text-stone-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                  {c === undefined ? '·' : formatNumber(c)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-stone-100 px-4 py-3 dark:border-gray-700 2xl:flex-row 2xl:items-center">
          <div className="relative flex-1 2xl:min-w-[18rem]">
            <label htmlFor="payout-search" className="sr-only">Search payout lines</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
            <input
              id="payout-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title, payee, employee ID or reference"
              className={`w-full pl-9 ${ui.input}`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="payout-fy" className="text-xs font-medium text-stone-600 dark:text-gray-300">Financial year</label>
              <select id="payout-fy" value={fy} onChange={(e) => setFy(e.target.value)} className={ui.input}>
                <option value="">All years</option>
                {fyOptions.map((y) => <option key={y} value={y}>FY {y}{y === currentFy ? ' (current)' : ''}</option>)}
              </select>
            </div>
            {cycleList.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="payout-cycle" className="text-xs font-medium text-stone-600 dark:text-gray-300">Budget cycle</label>
                <select id="payout-cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)} className={`max-w-[12rem] ${ui.input}`}>
                  <option value="">All cycles</option>
                  {cycleList.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isCurrent ? ' (current)' : ''}</option>)}
                  <option value="none">Outside every cycle</option>
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label htmlFor="payout-type" className="text-xs font-medium text-stone-600 dark:text-gray-300">Work type</label>
              <select id="payout-type" value={workType} onChange={(e) => setWorkType(e.target.value)} className={ui.input}>
                <option value="">All types</option>
                {Object.entries(WORK_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="payout-school" className="text-xs font-medium text-stone-600 dark:text-gray-300">School</label>
              <select id="payout-school" value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setDepartmentId(''); }} className={`max-w-[14rem] ${ui.input}`}>
                <option value="">All schools</option>
                {schoolOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                <option value="unassigned">Unassigned (no school)</option>
              </select>
            </div>
            {schoolId !== 'unassigned' && (
              <div className="flex items-center gap-2">
                <label htmlFor="payout-dept" className="text-xs font-medium text-stone-600 dark:text-gray-300">Department</label>
                <select id="payout-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={`max-w-[14rem] ${ui.input}`}>
                  <option value="">All departments</option>
                  {departmentOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  {departmentId && !departmentOptions.some((o) => o.id === departmentId) && <option value={departmentId}>Selected department</option>}
                </select>
              </div>
            )}
            {(fy || cycleId || workType || searchInput || schoolId || departmentId) && (
              <button type="button" onClick={() => { setFy(''); setCycleId(''); setWorkType(''); setSearchInput(''); setSchoolId(''); setDepartmentId(''); }} className="text-xs font-medium text-wine hover:underline dark:text-amber">
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Selection toolbar */}
        {selected.size > 0 && (
          <div className="flex flex-col gap-3 border-b border-wine/15 bg-rose-50/70 px-4 py-3 dark:border-wine/30 dark:bg-wine/15 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
            <p className="text-sm text-stone-800 dark:text-gray-100">
              <span className="font-semibold">{selected.size}</span> selected · <span className="font-semibold tabular-nums">{formatINR(selectedTotal)}</span>
              <button type="button" onClick={() => setSelected(new Map())} className="ml-3 inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white">
                <X className="h-3 w-3" aria-hidden="true" /> Clear
              </button>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={recommendable.length === 0}
                title={recommendable.length === 0 ? 'Only lines awaiting verification or on hold can be recommended' : recommendable.length < selected.size ? `${selected.size - recommendable.length} selected line(s) are already recommended and will be skipped` : undefined}
                onClick={() => actions.open('recommend', recommendable)}
                className={`${ui.btnPrimary} disabled:cursor-not-allowed`}
              >
                <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                Recommend{recommendable.length ? ` ${recommendable.length}` : ''}
              </button>
              <button
                type="button"
                disabled={batchable.length === 0}
                title={batchable.length === 0 ? 'Only recommended lines that are not in a batch can be batched' : batchable.length < selected.size ? `${selected.size - batchable.length} selected line(s) are not recommended and will be left out` : undefined}
                onClick={() => actions.open('batch', batchable)}
                className={`${ui.btnSecondary} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <FileStack className="h-4 w-4" aria-hidden="true" />
                Create batch{batchable.length ? ` from ${batchable.length}` : ''}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div id="payout-table" role="tabpanel" aria-label={TAB_LABEL[tab]} aria-busy={list.isFetching}>
          {list.isLoading ? (
            <TableSkeleton rows={8} cols={6} label="Loading payout lines" />
          ) : list.isError ? (
            <ErrorState title="Couldn't load payout lines" message={toFinanceError(list.error).message} onRetry={() => list.refetch()} retrying={list.isFetching} />
          ) : items.length === 0 ? (
            <EmptyState title={`No ${tab === 'all' ? '' : `${TAB_LABEL[tab].toLowerCase()} `}lines`} description={EMPTY_TEXT[tab]} />
          ) : (
            <div className={`overflow-x-auto transition-opacity ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
              <table className="min-w-[860px] w-full">
                <caption className="sr-only">{TAB_LABEL[tab]} payout lines, {from} to {to} of {total}</caption>
                <thead className="bg-stone-50/70 dark:bg-gray-900/40">
                  <tr>
                    {showChecks && (
                      <th scope="col" className="w-10 px-4 py-2.5">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={togglePage}
                          disabled={pageSelectable.length === 0}
                          aria-label="Select all actionable lines on this page"
                          className="h-4 w-4 rounded border-stone-300 text-wine focus:ring-wine/30"
                        />
                      </th>
                    )}
                    <th scope="col" className={ui.th}>Payee</th>
                    <th scope="col" className={ui.th}>Work</th>
                    <th scope="col" className={ui.th}>FY</th>
                    <th scope="col" className={ui.th}>Status</th>
                    <th scope="col" className={`${ui.th} text-right`}>Amount</th>
                    <th scope="col" className={`${ui.th} text-right`}><span className="sr-only">Details</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                  {items.map((l) => {
                    const can = selectable(l);
                    const isSel = selected.has(l.id);
                    const adjusted = Math.round(l.calculatedAmount * 100) !== Math.round(l.approvedAmount * 100);
                    return (
                      <tr key={l.id} className={`${isSel ? 'bg-rose-50/60 dark:bg-wine/10' : 'hover:bg-stone-50/70 dark:hover:bg-gray-700/30'}`}>
                        {showChecks && (
                          <td className="px-4 py-3 align-top">
                            {can && (
                              <input
                                type="checkbox"
                                checked={isSel}
                                onChange={() => toggle(l)}
                                aria-label={`Select ${l.payeeName}, ${l.title}`}
                                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-wine focus:ring-wine/30"
                              />
                            )}
                          </td>
                        )}
                        <td className={`${ui.td} align-top`}>
                          <div className="font-medium text-stone-900 dark:text-white">{l.payeeName}</div>
                          <div className="text-xs text-stone-500 dark:text-gray-400">{l.payeeEmployeeId || 'No employee ID'}</div>
                          <div className="text-xs text-stone-500 dark:text-gray-400">{l.department?.departmentName || l.school?.facultyName || 'No school or department'}</div>
                        </td>
                        <td className={`${ui.td} max-w-md align-top`}>
                          <button
                            type="button"
                            onClick={() => setDrawerId(l.id)}
                            className="line-clamp-2 text-left font-medium text-stone-800 hover:text-wine hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 dark:text-gray-100 dark:hover:text-amber"
                          >
                            {l.title}
                          </button>
                          <div className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">
                            {workTypeLabel(l.workType)}{l.referenceNumber ? ` · ${l.referenceNumber}` : ''}
                          </div>
                        </td>
                        <td className={`${ui.td} whitespace-nowrap align-top tabular-nums`}>{l.financialYear}</td>
                        <td className={`${ui.td} align-top`}>
                          <PayoutStatusBadge status={l.status} />
                          {l.batch && <div className="mt-1 text-xs text-stone-500 dark:text-gray-400">{l.batch.batchNumber}</div>}
                          {l.status === 'on_hold' && l.holdReason && (
                            <div className="mt-1 line-clamp-2 max-w-[14rem] text-xs text-stone-500 dark:text-gray-400" title={l.holdReason}>{l.holdReason}</div>
                          )}
                        </td>
                        <td className={`${ui.td} whitespace-nowrap text-right align-top`}>
                          <div className="font-semibold tabular-nums text-stone-900 dark:text-white">{formatINR(l.approvedAmount)}</div>
                          {adjusted && (
                            <div className="text-xs text-stone-500 dark:text-gray-400">
                              policy <span className="line-through">{formatINR(l.calculatedAmount)}</span>
                            </div>
                          )}
                        </td>
                        <td className={`${ui.td} text-right align-top`}>
                          <button type="button" onClick={() => setDrawerId(l.id)} className="rounded-md px-2 py-1 text-xs font-medium text-wine hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 dark:text-amber dark:hover:bg-gray-700" aria-label={`View details for ${l.payeeName}, ${l.title}`}>
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer: totals + pagination */}
        {!list.isLoading && !list.isError && total > 0 && (
          <div className="flex flex-col gap-3 border-t border-stone-100 px-4 py-3 text-sm dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-stone-600 dark:text-gray-300">
              Showing <span className="tabular-nums">{from}–{to}</span> of <span className="tabular-nums">{formatNumber(total)}</span> ·
              {' '}total <span className="font-semibold tabular-nums text-stone-900 dark:text-white">{formatINR(list.data?.totalAmount ?? 0)}</span>
            </p>
            <nav aria-label="Pagination" className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={`${ui.btnSecondary} disabled:opacity-50`}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
              </button>
              <span className="text-xs tabular-nums text-stone-500 dark:text-gray-400">Page {page} of {pages}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className={`${ui.btnSecondary} disabled:opacity-50`}>
                Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </nav>
          </div>
        )}
      </section>

      {!perms.canReview && (
        <p className="text-xs text-stone-500 dark:text-gray-400">
          You can view payout lines. Recommending, holding, adjusting and batching need the <strong>Verify &amp; Recommend Payouts</strong> permission.
        </p>
      )}

      <PayoutDetailDrawer
        id={drawerId}
        onClose={() => setDrawerId(null)}
        canReview={perms.canReview}
        onAction={(kind, line) => actions.open(kind, [line])}
      />
      {actions.dialogs}
    </FinancePageShell>
  );
}
