'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, Clock3, FileStack, Hourglass, IndianRupee, PauseCircle, RefreshCw, Users,
} from 'lucide-react';
import { AnalyticsBarChart, AnalyticsPanel, AnalyticsPipelineChart, KpiCardGrid } from '@/components/analytics';
import { seriesColors, ui } from '@/components/analytics/theme';
import { FinancePageShell, FinancialYearSelect } from '../components/FinanceShell';
import { BlockSkeleton, EmptyState, ErrorState, TableSkeleton } from '../components/FinanceStates';
import { useBatches, useFinanceDashboard, usePayouts } from '../hooks/useFinance';
import { useBudgetAnalytics, useCycles } from '../budget/useBudget';
import BudgetDashboardSection from '../budget/components/BudgetDashboardSection';
import {
  financialYearOf, formatDate, formatINR, formatINRCompact, formatMonth, formatNumber, isForbidden, monthsOfFinancialYear,
  toFinanceError, workTypeLabel,
} from '../utils/format';
import type { FinanceDashboard } from '../types';

function WorkTypeBreakdown({ rows }: { rows: FinanceDashboard['byWorkType'] }) {
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((s, r) => s + r.amount, 0);
  const colors = seriesColors(sorted.map((r) => r.workType));
  if (!sorted.length) {
    return <EmptyState title="No payout lines this year" description="Lines appear here once DRD approves a work with an incentive." />;
  }
  return (
    <div className="space-y-4">
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700" role="img" aria-label="Share of amount by work type">
        {total > 0 && sorted.map((r) => (r.amount > 0 ? (
          <div key={r.workType} style={{ width: `${(r.amount / total) * 100}%`, backgroundColor: colors[r.workType] }} />
        ) : null))}
      </div>
      <ul className="space-y-3">
        {sorted.map((r) => {
          const share = total > 0 ? (r.amount / total) * 100 : 0;
          return (
            <li key={r.workType} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-stone-700 dark:text-gray-300">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colors[r.workType] }} aria-hidden="true" />
                <span className="truncate">{workTypeLabel(r.workType)}</span>
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700">
                <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: colors[r.workType] }} />
              </div>
              <span className="text-right tabular-nums">
                <span className="font-semibold text-stone-900 dark:text-white">{formatINR(r.amount)}</span>
                <span className="ml-1.5 text-xs text-stone-500 dark:text-gray-400">{formatNumber(r.count)} line{r.count === 1 ? '' : 's'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AttentionSection({
  title, count, href, linkLabel, children, loading, error, onRetry, empty,
}: {
  title: string; count?: number; href: string; linkLabel: string; children: React.ReactNode;
  loading: boolean; error: unknown; onRetry: () => void; empty: string;
}) {
  return (
    <section aria-label={title} className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-gray-400">
          {title}{typeof count === 'number' ? ` · ${count}` : ''}
        </h3>
        <Link href={href} className="inline-flex items-center gap-1 rounded text-xs font-medium text-wine hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 dark:text-amber">
          {linkLabel} <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-stone-200 dark:border-gray-700">
        {loading ? <TableSkeleton rows={3} cols={2} /> : error ? (
          <ErrorState title="Couldn't load" message={toFinanceError(error).message} onRetry={onRetry} />
        ) : count === 0 ? (
          <p className="flex items-center gap-2 px-3 py-4 text-sm text-stone-500 dark:text-gray-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" /> {empty}
          </p>
        ) : children}
      </div>
    </section>
  );
}

export default function FinanceDashboardView() {
  const [fy, setFy] = useState(() => financialYearOf());
  const dash = useFinanceDashboard(fy);
  // Research budgets are per incentive cycle: show the current cycle for the current FY, else the cycle containing 1 April of the FY.
  const cyclesQ = useCycles();
  const budgetCycle = useMemo(() => {
    const list = cyclesQ.data?.cycles || [];
    const fyStart = `${fy.slice(0, 4)}-04-01`;
    return (fy === financialYearOf() ? list.find((c) => c.isCurrent) : undefined)
      || list.find((c) => c.startDate <= fyStart && fyStart <= c.endDate) || null;
  }, [cyclesQ.data, fy]);
  const budget = useBudgetAnalytics(budgetCycle?.id || '', !!budgetCycle);
  const onHold = usePayouts({ status: ['on_hold'], limit: 5 });
  const drafts = useBatches({ status: 'draft' });
  const approved = useBatches({ status: 'approved' });
  const d = dash.data;

  const months = useMemo(() => {
    const paid = new Map((d?.paidByMonth || []).map((m) => [m.month, m.amount]));
    return monthsOfFinancialYear(fy).map((m) => ({ label: formatMonth(m), values: { paid: Math.round(paid.get(m) || 0) } }));
  }, [d?.paidByMonth, fy]);
  const anyPaid = months.some((m) => m.values.paid > 0);

  const pipeline = d ? [
    { key: 'pending', label: 'Awaiting verification', count: d.totals.awaitingVerification.count, color: '', textColor: '' },
    { key: 'recommended', label: 'Recommended', count: d.totals.recommended.count, color: '', textColor: '' },
    { key: 'on_hold', label: 'On hold', count: d.totals.onHold.count, color: '', textColor: '' },
    { key: 'approved', label: 'Approved', count: d.totals.approved.count, color: '', textColor: '' },
    { key: 'paid', label: 'Paid', count: d.totals.paid.count, color: '', textColor: '' },
  ] : [];

  const draftCount = drafts.data?.length ?? 0;

  return (
    <FinancePageShell
      title="Finance dashboard"
      description="Incentive liability, verification workload and payments for research, grants and IPR across the university."
      forbidden={isForbidden(dash.error)}
      actions={(
        <>
          <FinancialYearSelect value={fy} onChange={setFy} tone="hero" />
          <button type="button" onClick={() => { void dash.refetch(); void cyclesQ.refetch(); if (budgetCycle) void budget.refetch(); void onHold.refetch(); void drafts.refetch(); void approved.refetch(); }} disabled={dash.isFetching} className={ui.btnSecondary}>
            <RefreshCw className={`h-4 w-4 ${dash.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </>
      )}
      chips={[
        { label: 'Outstanding liability', value: d ? formatINRCompact(d.totals.liability) : '—' },
        { label: `Awaiting verification${d ? ` (${formatNumber(d.totals.awaitingVerification.count)})` : ''}`, value: d ? formatINRCompact(d.totals.awaitingVerification.amount) : '—' },
        { label: 'Approved, not paid', value: d ? formatINRCompact(d.totals.approved.amount) : '—' },
        { label: `Paid in FY ${fy}`, value: d ? formatINRCompact(d.totals.paid.amount) : '—' },
      ]}
    >
      {dash.isLoading ? (
        <div className="space-y-6" role="status" aria-label="Loading dashboard">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <BlockSkeleton key={i} className="h-24" />)}
          </div>
          <div className="grid gap-6 xl:grid-cols-2"><BlockSkeleton className="h-80" /><BlockSkeleton className="h-80" /></div>
        </div>
      ) : dash.isError || !d ? (
        <div className={ui.card}>
          <ErrorState title="Couldn't load the finance dashboard" message={toFinanceError(dash.error).message} onRetry={() => dash.refetch()} retrying={dash.isFetching} />
        </div>
      ) : (
        <>
          <KpiCardGrid
            cards={[
              { label: 'Lines awaiting verification', value: d.totals.awaitingVerification.count, icon: <Hourglass /> },
              { label: 'Recommended', value: formatINR(d.totals.recommended.amount), icon: <BadgeCheck /> },
              { label: 'On hold', value: d.totals.onHold.count, icon: <PauseCircle /> },
              { label: 'Approved for payment', value: formatINR(d.totals.approved.amount), icon: <CheckCircle2 /> },
              { label: 'Paid lines', value: d.totals.paid.count, icon: <IndianRupee /> },
              { label: 'Batches awaiting approval', value: d.batches.draft?.count ?? 0, icon: <FileStack /> },
            ]}
          />

          <div className="grid gap-6 xl:grid-cols-2">
            {anyPaid ? (
              <AnalyticsBarChart
                title="Paid by month"
                subtitle={`Amount paid (₹) in FY ${fy}, by month of payment`}
                data={months}
                keys={[{ key: 'paid', label: 'Paid' }]}
                height={280}
              />
            ) : (
              <AnalyticsPanel title="Paid by month" subtitle={`Amount paid (₹) in FY ${fy}`}>
                <EmptyState title="No payments recorded yet" description="Monthly totals appear once a batch is marked paid." />
              </AnalyticsPanel>
            )}
            <AnalyticsPipelineChart
              title="Status pipeline"
              subtitle={`Payout lines in FY ${fy} by stage (excluding cancelled)`}
              stages={pipeline}
            />
          </div>

          <BudgetDashboardSection cycle={budgetCycle} cyclesQuery={cyclesQ} query={budget} />

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <AnalyticsPanel title="Amount by work type" subtitle={`Approved amount in FY ${fy}, excluding cancelled lines`} icon={<FileStack />}>
              <WorkTypeBreakdown rows={d.byWorkType} />
            </AnalyticsPanel>

            <AnalyticsPanel title="Needs attention" subtitle="Across all financial years" icon={<AlertTriangle />}>
              <div className="space-y-5">
                <AttentionSection
                  title="On hold"
                  count={onHold.data?.total}
                  href="/finance/payouts?status=on_hold"
                  linkLabel="Open queue"
                  loading={onHold.isLoading}
                  error={onHold.error}
                  onRetry={() => onHold.refetch()}
                  empty="No lines on hold."
                >
                  <ul className="divide-y divide-stone-100 dark:divide-gray-700">
                    {onHold.data?.items.map((l) => (
                      <li key={l.id} className="px-3 py-2.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <Link href={`/finance/payouts?status=on_hold&line=${l.id}`} className="min-w-0 truncate text-sm font-medium text-stone-800 hover:text-wine hover:underline dark:text-gray-100 dark:hover:text-amber">
                            {l.payeeName} — {l.title}
                          </Link>
                          <span className="shrink-0 text-sm tabular-nums text-stone-700 dark:text-gray-200">{formatINR(l.approvedAmount)}</span>
                        </div>
                        {l.holdReason && <p className="mt-0.5 line-clamp-2 text-xs text-stone-500 dark:text-gray-400">{l.holdReason}</p>}
                      </li>
                    ))}
                  </ul>
                </AttentionSection>

                <AttentionSection
                  title="Batches awaiting approval"
                  count={drafts.data?.length}
                  href="/finance/batches?status=draft"
                  linkLabel="All drafts"
                  loading={drafts.isLoading}
                  error={drafts.error}
                  onRetry={() => drafts.refetch()}
                  empty="No batches waiting for approval."
                >
                  <BatchMiniList batches={(drafts.data || []).slice(0, 4)} more={Math.max(0, draftCount - 4)} />
                </AttentionSection>

                <AttentionSection
                  title="Approved, awaiting payment"
                  count={approved.data?.length}
                  href="/finance/batches?status=approved"
                  linkLabel="All approved"
                  loading={approved.isLoading}
                  error={approved.error}
                  onRetry={() => approved.refetch()}
                  empty="Nothing waiting to be paid."
                >
                  <BatchMiniList batches={(approved.data || []).slice(0, 4)} more={Math.max(0, (approved.data?.length ?? 0) - 4)} />
                </AttentionSection>
              </div>
            </AnalyticsPanel>
          </div>

          <AnalyticsPanel title="Top payees" subtitle={`Highest total incentive in FY ${fy}, excluding cancelled lines`} icon={<Users />}>
            {d.topPayees.length === 0 ? (
              <EmptyState title="No payees yet" description="Payees appear once payout lines exist for this financial year." />
            ) : (
              <div className="-mx-5 -my-5 overflow-x-auto">
                <table className="min-w-full">
                  <caption className="sr-only">Top payees in FY {fy}</caption>
                  <thead className="bg-stone-50/70 dark:bg-gray-900/40">
                    <tr>
                      <th scope="col" className={`${ui.th} w-10`}>#</th>
                      <th scope="col" className={ui.th}>Payee</th>
                      <th scope="col" className={ui.th}>Employee ID</th>
                      <th scope="col" className={`${ui.th} text-right`}>Lines</th>
                      <th scope="col" className={`${ui.th} text-right`}>Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                    {d.topPayees.map((p, i) => (
                      <tr key={`${p.userId}-${i}`}>
                        <td className={`${ui.td} tabular-nums text-stone-400`}>{i + 1}</td>
                        <td className={`${ui.td} font-medium text-stone-900 dark:text-white`}>
                          <Link href={`/finance/payouts?status=all&search=${encodeURIComponent(p.employeeId || p.name)}&fy=${fy}`} className="hover:text-wine hover:underline dark:hover:text-amber">
                            {p.name}
                          </Link>
                        </td>
                        <td className={`${ui.td} tabular-nums`}>{p.employeeId || '—'}</td>
                        <td className={`${ui.td} text-right tabular-nums`}>{formatNumber(p.count)}</td>
                        <td className={`${ui.td} text-right font-semibold tabular-nums text-stone-900 dark:text-white`}>{formatINR(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AnalyticsPanel>
        </>
      )}
    </FinancePageShell>
  );
}

function BatchMiniList({ batches, more }: { batches: Array<{ id: string; batchNumber: string; title: string | null; totalAmount: number; lineCount: number; createdAt: string; approvedAt: string | null }>; more: number }) {
  return (
    <ul className="divide-y divide-stone-100 dark:divide-gray-700">
      {batches.map((b) => (
        <li key={b.id}>
          <Link href={`/finance/batches/${b.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-stone-800 dark:text-gray-100">{b.batchNumber}</span>
              <span className="block truncate text-xs text-stone-500 dark:text-gray-400">
                {b.title ? `${b.title} · ` : ''}{b.lineCount} line{b.lineCount === 1 ? '' : 's'} · <Clock3 className="inline h-3 w-3 align-[-1px]" aria-hidden="true" /> {formatDate(b.approvedAt || b.createdAt)}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-900 dark:text-white">{formatINR(b.totalAmount)}</span>
          </Link>
        </li>
      ))}
      {more > 0 && <li className="px-3 py-2 text-xs text-stone-500 dark:text-gray-400">and {more} more</li>}
    </ul>
  );
}
