'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FileStack } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import { FinancePageShell, FinancialYearSelect } from '../components/FinanceShell';
import { BatchStatusBadge, EmptyState, ErrorState, TableSkeleton } from '../components/FinanceStates';
import { useBatches } from '../hooks/useFinance';
import ApprovalRuleCard from '../components/ApprovalRuleCard';
import { formatDate, formatINR, formatINRCompact, formatNumber, isForbidden, toFinanceError } from '../utils/format';
import type { BatchStatus } from '../types';

type Tab = BatchStatus | 'all';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'draft', label: 'Awaiting approval' },
  { key: 'approved', label: 'Awaiting payment' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];
const EMPTY: Record<Tab, string> = {
  draft: 'No batches are waiting for approval. Create one from recommended lines in the verification queue.',
  approved: 'No approved batches are waiting for payment.',
  paid: 'No batches have been paid for this filter.',
  cancelled: 'No cancelled batches.',
  all: 'No payment batches yet. Create one from recommended lines in the verification queue.',
};

export default function BatchListView() {
  const params = useSearchParams();
  const initial = params?.get('status') as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && TABS.some((t) => t.key === initial) ? initial : 'draft');
  const [fy, setFy] = useState('');
  // One request per FY; tabs filter locally so every tab count is exact.
  const q = useBatches({ financialYear: fy || undefined });
  const all = useMemo(() => q.data ?? [], [q.data]);

  const counts = useMemo(() => {
    const c: Record<Tab, { count: number; amount: number }> = {
      draft: { count: 0, amount: 0 }, approved: { count: 0, amount: 0 }, paid: { count: 0, amount: 0 }, cancelled: { count: 0, amount: 0 }, all: { count: 0, amount: 0 },
    };
    for (const b of all) {
      c[b.status].count += 1;
      c[b.status].amount += b.totalAmount;
      c.all.count += 1;
      if (b.status !== 'cancelled') c.all.amount += b.totalAmount;
    }
    return c;
  }, [all]);
  const rows = tab === 'all' ? all : all.filter((b) => b.status === tab);

  return (
    <FinancePageShell
      title="Payment batches"
      description="Recommended lines are grouped into batches. Each batch is approved (by a second person unless your university allows self-approval), then finance records the payroll or bank reference once paid."
      forbidden={isForbidden(q.error)}
      actions={<FinancialYearSelect value={fy} onChange={setFy} tone="hero" allowAll />}
      chips={[
        { label: `Awaiting approval (${counts.draft.count})`, value: q.data ? formatINRCompact(counts.draft.amount) : '—' },
        { label: `Awaiting payment (${counts.approved.count})`, value: q.data ? formatINRCompact(counts.approved.amount) : '—' },
        { label: `Paid (${counts.paid.count})`, value: q.data ? formatINRCompact(counts.paid.amount) : '—' },
        { label: 'Batches', value: q.data ? formatNumber(counts.all.count) : '—' },
      ]}
    >
      <ApprovalRuleCard />

      <section className={`overflow-hidden ${ui.card}`}>
        <div role="tablist" aria-label="Batch status" className="flex gap-1 overflow-x-auto border-b border-stone-100 px-3 pt-2 dark:border-gray-700">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="batch-table"
                onClick={() => setTab(t.key)}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 ${
                  active ? 'border-wine text-wine dark:border-amber dark:text-amber' : 'border-transparent text-stone-600 hover:text-stone-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                {t.label}
                <span className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-center text-[11px] tabular-nums ${active ? 'bg-wine/10 text-wine dark:bg-amber/20 dark:text-amber' : 'bg-stone-100 text-stone-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                  {q.data ? counts[t.key].count : '·'}
                </span>
              </button>
            );
          })}
        </div>

        <div id="batch-table" role="tabpanel" aria-busy={q.isFetching}>
          {q.isLoading ? (
            <TableSkeleton rows={6} cols={6} label="Loading batches" />
          ) : q.isError ? (
            <ErrorState title="Couldn't load batches" message={toFinanceError(q.error).message} onRetry={() => q.refetch()} retrying={q.isFetching} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<FileStack />}
              title="No batches here"
              description={EMPTY[tab]}
              action={tab === 'draft' || tab === 'all' ? <Link href="/finance/payouts?status=recommended" className={ui.btnSecondary}>Open recommended lines</Link> : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <caption className="sr-only">Payment batches</caption>
                <thead className="bg-stone-50/70 dark:bg-gray-900/40">
                  <tr>
                    <th scope="col" className={ui.th}>Batch</th>
                    <th scope="col" className={ui.th}>FY</th>
                    <th scope="col" className={ui.th}>Status</th>
                    <th scope="col" className={`${ui.th} text-right`}>Lines</th>
                    <th scope="col" className={`${ui.th} text-right`}>Total</th>
                    <th scope="col" className={ui.th}>Prepared</th>
                    <th scope="col" className={ui.th}>Approved / paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                  {rows.map((b) => (
                    <tr key={b.id} className="hover:bg-stone-50/70 dark:hover:bg-gray-700/30">
                      <td className={ui.td}>
                        <Link href={`/finance/batches/${b.id}`} className="font-medium text-stone-900 hover:text-wine hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 dark:text-white dark:hover:text-amber">
                          {b.batchNumber}
                        </Link>
                        {b.title && <div className="max-w-xs truncate text-xs text-stone-500 dark:text-gray-400">{b.title}</div>}
                      </td>
                      <td className={`${ui.td} tabular-nums`}>{b.financialYear}</td>
                      <td className={ui.td}><BatchStatusBadge status={b.status} /></td>
                      <td className={`${ui.td} text-right tabular-nums`}>{formatNumber(b.lineCount)}</td>
                      <td className={`${ui.td} text-right font-semibold tabular-nums text-stone-900 dark:text-white`}>{formatINR(b.totalAmount)}</td>
                      <td className={`${ui.td} whitespace-nowrap`}>{formatDate(b.createdAt)}</td>
                      <td className={`${ui.td} whitespace-nowrap`}>
                        {b.status === 'paid' ? (
                          <>
                            <div>Paid {formatDate(b.paymentDate || b.paidAt)}</div>
                            {b.paymentReference && <div className="text-xs text-stone-500 dark:text-gray-400">Ref {b.paymentReference}</div>}
                          </>
                        ) : b.approvedAt ? `Approved ${formatDate(b.approvedAt)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </FinancePageShell>
  );
}
