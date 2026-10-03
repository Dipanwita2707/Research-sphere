'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Hourglass, PauseCircle, RefreshCw, Sparkles, Star, Wallet } from 'lucide-react';
import { AnalyticsHero, AnalyticsPanel, AnalyticsShell, KpiCardGrid } from '@/components/analytics';
import { ui } from '@/components/analytics/theme';
import { Badge, EmptyState, ErrorState, TableSkeleton } from '../components/FinanceStates';
import { useMyIncentives } from '../hooks/useFinance';
import {
  financialYearOptions, formatDate, formatINR, formatINRCompact, formatNumber, sourceHref, toFinanceError, workTypeLabel, type Tone,
} from '../utils/format';
import type { MyIncentiveLine } from '../types';

/** What an author should read for each state of their line. */
export function authorStatus(line: Pick<MyIncentiveLine, 'status' | 'holdReason' | 'paidAt' | 'paymentReference'>): { label: string; tone: Tone } {
  switch (line.status) {
    case 'pending_verification':
      return { label: 'Awaiting finance verification', tone: 'amber' };
    case 'recommended':
      return { label: 'Recommended', tone: 'sky' };
    case 'on_hold':
      return { label: line.holdReason ? `On hold — ${line.holdReason}` : 'On hold', tone: 'rose' };
    case 'approved':
      return { label: 'Approved for payment', tone: 'violet' };
    case 'paid':
      return {
        label: `Paid on ${formatDate(line.paidAt)}${line.paymentReference ? ` (ref ${line.paymentReference})` : ''}`,
        tone: 'emerald',
      };
    default:
      return { label: 'Cancelled', tone: 'stone' };
  }
}

function summarise(items: MyIncentiveLine[]) {
  const sum = (statuses: string[]) => items.filter((i) => statuses.includes(i.status)).reduce((s, i) => s + (i.approvedAmount || 0), 0);
  return {
    paid: sum(['paid']),
    inProcess: sum(['pending_verification', 'recommended', 'approved']),
    onHold: sum(['on_hold']),
    points: items.reduce((s, i) => s + (i.points || 0), 0),
  };
}

export default function MyIncentivesView() {
  const q = useMyIncentives();
  const [fy, setFy] = useState('');
  const items = useMemo(() => q.data?.items ?? [], [q.data]);

  const years = useMemo(() => {
    const set = new Set<string>(financialYearOptions());
    items.forEach((i) => set.add(i.financialYear));
    return [...set].sort().reverse();
  }, [items]);
  const rows = fy ? items.filter((i) => i.financialYear === fy) : items;
  const s = fy ? summarise(rows) : q.data?.summary ?? summarise(rows);
  const scope = fy ? `FY ${fy}` : 'All years';

  return (
    <AnalyticsShell>
      <AnalyticsHero
        title="My incentives"
        description="Incentives for your approved research papers, books, conference papers, grants and IPR, and where each payment stands."
        eyebrow="Research incentives"
        icon={<Wallet className="h-3.5 w-3.5" aria-hidden="true" />}
        actions={(
          <button type="button" onClick={() => q.refetch()} disabled={q.isFetching} className={ui.btnSecondary}>
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
          </button>
        )}
        chips={q.data ? [
          { label: `Paid · ${scope}`, value: formatINRCompact(s.paid) },
          { label: 'In process', value: formatINRCompact(s.inProcess) },
          { label: 'On hold', value: formatINRCompact(s.onHold) },
          { label: 'Points', value: formatNumber(s.points) },
        ] : undefined}
      />
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {q.data && (
          <KpiCardGrid
            cols={4}
            cards={[
              { label: 'Paid', value: formatINR(s.paid), icon: <CheckCircle2 /> },
              { label: 'In process', value: formatINR(s.inProcess), icon: <Hourglass /> },
              { label: 'On hold', value: formatINR(s.onHold), icon: <PauseCircle /> },
              { label: 'Points earned', value: s.points, icon: <Star /> },
            ]}
          />
        )}

        <AnalyticsPanel
          title="Incentive statement"
          subtitle="One line per approved work. Amounts are before TDS unless shown otherwise."
          icon={<Sparkles />}
          actions={(
            <div className="flex items-center gap-2">
              <label htmlFor="my-fy" className="text-xs font-medium text-stone-600 dark:text-gray-300">Financial year</label>
              <select id="my-fy" value={fy} onChange={(e) => setFy(e.target.value)} className={ui.input}>
                <option value="">All years</option>
                {years.map((y) => <option key={y} value={y}>FY {y}</option>)}
              </select>
            </div>
          )}
        >
          {q.isLoading ? (
            <TableSkeleton rows={5} cols={4} label="Loading your incentives" />
          ) : q.isError ? (
            <ErrorState title="Couldn't load your incentives" message={toFinanceError(q.error).message} onRetry={() => q.refetch()} retrying={q.isFetching} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={items.length ? `Nothing in FY ${fy}` : 'No incentives yet'}
              description={items.length
                ? 'Choose another financial year to see more.'
                : 'When DRD approves one of your works with an incentive, it appears here and you can follow its payment.'}
              action={!items.length ? <Link href="/research/my-contributions" className={ui.btnSecondary}>My contributions</Link> : undefined}
            />
          ) : (
            <div className="-mx-5 -my-5 overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <caption className="sr-only">Your incentive lines, {scope}</caption>
                <thead className="bg-stone-50/70 dark:bg-gray-900/40">
                  <tr>
                    <th scope="col" className={ui.th}>Work</th>
                    <th scope="col" className={ui.th}>FY</th>
                    <th scope="col" className={`${ui.th} text-right`}>Points</th>
                    <th scope="col" className={`${ui.th} text-right`}>Amount</th>
                    <th scope="col" className={ui.th}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                  {rows.map((l) => {
                    const st = authorStatus(l);
                    return (
                      <tr key={l.id}>
                        <td className={`${ui.td} max-w-md`}>
                          {sourceHref(l) ? (
                            <Link href={sourceHref(l) as string} className="line-clamp-2 font-medium text-stone-900 hover:text-wine hover:underline dark:text-white dark:hover:text-amber">{l.title}</Link>
                          ) : (
                            <div className="line-clamp-2 font-medium text-stone-900 dark:text-white">{l.title}</div>
                          )}
                          <div className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">
                            {workTypeLabel(l.workType)}{l.referenceNumber ? ` · ${l.referenceNumber}` : ''}{l.sourceApprovedAt ? ` · approved ${formatDate(l.sourceApprovedAt)}` : ''}
                          </div>
                        </td>
                        <td className={`${ui.td} whitespace-nowrap tabular-nums`}>{l.financialYear}</td>
                        <td className={`${ui.td} text-right tabular-nums`}>{formatNumber(l.points)}</td>
                        <td className={`${ui.td} whitespace-nowrap text-right`}>
                          <div className="font-semibold tabular-nums text-stone-900 dark:text-white">{formatINR(l.approvedAmount)}</div>
                          {l.status === 'paid' && (l.tdsAmount ?? 0) > 0 && (
                            <div className="text-xs text-stone-500 dark:text-gray-400">
                              TDS {formatINR(l.tdsAmount)} · net {formatINR(l.netAmount)}
                            </div>
                          )}
                        </td>
                        <td className={`${ui.td} max-w-xs`}>
                          <Badge tone={st.tone} wrap>{st.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AnalyticsPanel>
        <p className="text-xs text-stone-500 dark:text-gray-400">
          Questions about an amount or a hold? Contact the finance office and quote the reference number shown under the work.
        </p>
      </div>
    </AnalyticsShell>
  );
}
