'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CircleDollarSign, HandCoins, IndianRupee, OctagonAlert, PiggyBank, Wallet } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { AnalyticsBarChart, AnalyticsPanel, KpiCardGrid } from '@/components/analytics';
import { ui } from '@/components/analytics/theme';
import { BlockSkeleton, EmptyState, ErrorState } from '../../components/FinanceStates';
import { formatINR, formatINRCompact, isForbidden, toFinanceError } from '../../utils/format';
import type { BudgetAnalytics, CycleList, IncentiveCycle } from '../types';

/** Finance dashboard: research budget utilisation KPIs and the school-wise budget vs spend chart, for one incentive cycle. */
export default function BudgetDashboardSection({
  cycle, cyclesQuery, query,
}: { cycle: IncentiveCycle | null; cyclesQuery: UseQueryResult<CycleList, unknown>; query: UseQueryResult<BudgetAnalytics, unknown> }) {
  const router = useRouter();
  const href = cycle ? `/finance/budgets?cycle=${cycle.id}` : '/finance/budgets';
  if (cyclesQuery.isLoading || (cycle && query.isLoading)) return <BlockSkeleton className="h-72" />;
  if (isForbidden(query.error) || isForbidden(cyclesQuery.error)) return null;
  if (!cycle) {
    return (
      <AnalyticsPanel title="Research budget" subtitle="No incentive cycle for this year" icon={<PiggyBank />}>
        <EmptyState
          icon={<PiggyBank />}
          title="No incentive cycle covers this year"
          description="Research budgets are set per incentive cycle, the period the incentive policies share. Create the cycle on the Research budget page."
          action={<Link href={href} className={ui.btnPrimary}>Open research budget</Link>}
        />
      </AnalyticsPanel>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className={ui.card}>
        <ErrorState title="Couldn't load the research budget" message={toFinanceError(query.error).message} onRetry={() => query.refetch()} retrying={query.isFetching} />
      </div>
    );
  }
  const a = query.data;
  const link = (
    <Link href={href} className="inline-flex items-center gap-1 rounded text-xs font-medium text-wine hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 dark:text-amber">
      Open research budget <ArrowRight className="h-3 w-3" aria-hidden="true" />
    </Link>
  );
  if (!a.hasBudget) {
    return (
      <AnalyticsPanel title="Research budget" subtitle={cycle.name} icon={<PiggyBank />} actions={link}>
        <EmptyState
          icon={<PiggyBank />}
          title={`No research budget set for ${cycle.name}`}
          description="Set a university total and distribute it to schools and departments to see utilisation against the payout ledger."
          action={<Link href={href} className={ui.btnPrimary}>Set up budget</Link>}
        />
      </AnalyticsPanel>
    );
  }
  const s = a.summary;
  const overCount = a.byNode.filter((n) => n.status === 'over').length;
  const schools = a.bySchool.filter((n) => n.allocated > 0 || n.consumed > 0);
  const chartData = schools.map((n) => ({
    label: n.code || n.name,
    values: { utilised: Math.round(n.utilised), committed: Math.round(n.committed), allocated: Math.round(n.allocated) },
  }));
  return (
    <section aria-label="Research budget" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-900 dark:text-white">Research budget · {cycle.name}</h2>
        {link}
      </div>
      <KpiCardGrid
        cards={[
          { label: 'Budget', value: formatINRCompact(s.total), icon: <Wallet />, trendValue: `${formatINRCompact(s.unallocated)} unallocated` },
          { label: 'Committed', value: formatINRCompact(s.committed), icon: <HandCoins /> },
          { label: 'Utilised (paid)', value: formatINRCompact(s.utilised), icon: <IndianRupee /> },
          { label: 'Available', value: formatINRCompact(s.available), icon: <CircleDollarSign /> },
          { label: 'Utilisation', value: s.utilisationPct == null ? '—' : `${s.utilisationPct}%`, icon: <PiggyBank /> },
          { label: 'Units over budget', value: overCount, icon: <OctagonAlert /> },
        ]}
      />
      {chartData.length ? (
        <AnalyticsBarChart
          title="Budget vs utilised by school"
          subtitle={`Allocated, committed and paid (₹) in ${cycle.name}. Select a school to open the budget.`}
          data={chartData}
          keys={[{ key: 'utilised', label: 'Utilised (paid)' }, { key: 'committed', label: 'Committed' }, { key: 'allocated', label: 'Allocated' }]}
          height={280}
          onBarClick={() => router.push(href)}
        />
      ) : (
        <AnalyticsPanel title="Budget vs utilised by school" subtitle={cycle.name}>
          <EmptyState title="Nothing allocated to schools yet" description={`The ${formatINR(s.total)} budget has not been distributed across schools.`} />
        </AnalyticsPanel>
      )}
    </section>
  );
}
