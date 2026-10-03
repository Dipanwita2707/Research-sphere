'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileStack, History, Info } from 'lucide-react';
import { AnalyticsPanel } from '@/components/analytics';
import { ui } from '@/components/analytics/theme';
import { useAuthStore } from '@/shared/auth/authStore';
import { useToast } from '@/shared/ui-components/Toast';
import { FinancePageShell } from '../components/FinanceShell';
import { BatchStatusBadge, BlockSkeleton, ErrorState, PayoutStatusBadge, TableSkeleton } from '../components/FinanceStates';
import BatchActions from '../components/BatchActions';
import { ApproveBatchDialog, RecordPaymentDialog, SeparationOfDutiesNote, approvalBlockReason, approvalConflict } from '../components/BatchDialogs';
import { ReasonDialog } from '../components/PayoutActionDialogs';
import { EventTimeline } from '../components/EventTimeline';
import PayoutDetailDrawer from '../components/PayoutDetailDrawer';
import { useApproveBatch, useBatch, useCancelBatch, useFinanceSettings, usePayBatch } from '../hooks/useFinance';
import { useFinancePermissions } from '../hooks/useFinancePermissions';
import { financeService } from '../services/finance.service';
import {
  BATCH_STATUS_META, formatDate, formatDateTime, formatINR, formatINRCompact, formatNumber, isForbidden, personName, toFinanceError, workTypeLabel,
  budgetWarningText,
} from '../utils/format';

type DialogKind = 'approve' | 'pay' | 'cancel' | null;

export default function BatchDetailView({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const perms = useFinancePermissions();
  const q = useBatch(id);
  const approve = useApproveBatch();
  const allowSelfApproval = !!useFinanceSettings().data?.allowSelfApproval;
  const pay = usePayBatch();
  const cancel = useCancelBatch();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [exporting, setExporting] = useState(false);
  const [lineId, setLineId] = useState<string | null>(null);
  const b = q.data;

  const totals = (b?.payouts || []).reduce(
    (acc, l) => ({ gross: acc.gross + l.approvedAmount, tds: acc.tds + (l.tdsAmount || 0), net: acc.net + (l.netAmount ?? l.approvedAmount) }),
    { gross: 0, tds: 0, net: 0 },
  );
  const showTds = b?.status === 'paid' && totals.tds > 0;
  const notFound = (q.error as { response?: { status?: number } } | null)?.response?.status === 404;

  const doExport = async () => {
    if (!b) return;
    setExporting(true);
    try {
      await financeService.exportBatch(b.id, `${b.batchNumber}.xlsx`);
    } catch (err) {
      toast.error(toFinanceError(err, 'Could not export the batch.').message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <FinancePageShell
      title={b ? b.batchNumber : 'Payment batch'}
      description={b ? (b.title || `Payment batch for FY ${b.financialYear}`) : 'Loading batch…'}
      eyebrow="Payment batch"
      onBack={() => router.push('/finance/batches')}
      backLabel="Back to payment batches"
      forbidden={isForbidden(q.error)}
      chips={b ? [
        { label: 'Total', value: formatINRCompact(b.totalAmount) },
        { label: 'Lines', value: formatNumber(b.lineCount) },
        { label: 'Status', value: BATCH_STATUS_META[b.status]?.label.split(' —')[0] || b.status },
        { label: b.status === 'paid' ? 'Paid on' : b.approvedAt ? 'Approved on' : 'Prepared on', value: formatDate(b.status === 'paid' ? (b.paymentDate || b.paidAt) : (b.approvedAt || b.createdAt)) },
      ] : undefined}
      actions={b ? (
        <BatchActions
          batch={b}
          userId={userId}
          canApprove={perms.canApprove}
          canReview={perms.canReview}
          canRecordPayment={perms.canRecordPayment}
          allowSelfApproval={allowSelfApproval}
          exporting={exporting}
          onApprove={() => setDialog('approve')}
          onPay={() => setDialog('pay')}
          onCancel={() => setDialog('cancel')}
          onExport={() => void doExport()}
          onDark
        />
      ) : undefined}
    >
      {q.isLoading ? (
        <div className="space-y-6" role="status" aria-label="Loading batch">
          <BlockSkeleton className="h-24" />
          <div className={ui.card}><TableSkeleton rows={6} cols={5} /></div>
        </div>
      ) : q.isError || !b ? (
        <div className={ui.card}>
          {notFound ? (
            <ErrorState title="Batch not found" message="It may have been removed, or the link is wrong." />
          ) : (
            <ErrorState title="Couldn't load this batch" message={toFinanceError(q.error).message} onRetry={() => q.refetch()} retrying={q.isFetching} />
          )}
          <div className="pb-8 text-center"><Link href="/finance/batches" className="text-sm font-medium text-wine hover:underline dark:text-amber">All payment batches</Link></div>
        </div>
      ) : (
        <>
          <div className={`flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between ${ui.card}`}>
            <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <div><dt className={ui.label}>Status</dt><dd className="mt-1"><BatchStatusBadge status={b.status} /></dd></div>
              <div><dt className={ui.label}>Prepared</dt><dd className="mt-1 text-stone-800 dark:text-gray-100">{formatDateTime(b.createdAt)}{b.createdById === userId ? ' (by you)' : personName(b.createdBy) ? ` · ${personName(b.createdBy)}` : ''}</dd></div>
              <div><dt className={ui.label}>Approved</dt><dd className="mt-1 text-stone-800 dark:text-gray-100">{b.approvedAt ? `${formatDateTime(b.approvedAt)}${b.approvedById === userId ? ' (by you)' : personName(b.approvedBy) ? ` · ${personName(b.approvedBy)}` : ''}` : '—'}</dd></div>
              <div><dt className={ui.label}>Payment</dt><dd className="mt-1 text-stone-800 dark:text-gray-100">{b.status === 'paid' ? `${formatDate(b.paymentDate || b.paidAt)} · Ref ${b.paymentReference || '—'}${personName(b.paidBy) ? ` · recorded by ${personName(b.paidBy)}` : ''}` : '—'}</dd></div>
              {b.selfApproved && (
                <div className="col-span-2 sm:col-span-4">
                  <dt className={ui.label}>Self-approved</dt>
                  <dd className="mt-1 text-amber-800 dark:text-amber-200">Approved by someone who prepared the batch or recommended its lines. The reason is in the batch history.</dd>
                </div>
              )}
              {b.approvalComments && <div className="col-span-2 sm:col-span-4"><dt className={ui.label}>Approval comment</dt><dd className="mt-1 text-stone-700 dark:text-gray-300">{b.approvalComments}</dd></div>}
              {b.cancelledReason && <div className="col-span-2 sm:col-span-4"><dt className={ui.label}>Cancelled because</dt><dd className="mt-1 text-stone-700 dark:text-gray-300">{b.cancelledReason}</dd></div>}
            </dl>
            {b.status === 'draft' && (
              <div className="lg:max-w-sm">
                <SeparationOfDutiesNote blockedReason={perms.canApprove ? approvalBlockReason(b, userId, allowSelfApproval) : null} selfApprovalAllowed={allowSelfApproval} />
              </div>
            )}
          </div>

          {b.status === 'draft' && !perms.canApprove && (
            <p className="flex items-center gap-2 text-xs text-stone-500 dark:text-gray-400">
              <Info className="h-3.5 w-3.5" aria-hidden="true" /> Approving needs the <strong>Approve Payment Batches</strong> permission.
            </p>
          )}

          <AnalyticsPanel title="Payout lines" subtitle={`${b.payouts.length} line${b.payouts.length === 1 ? '' : 's'} in this batch`} icon={<FileStack />}>
            {b.payouts.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-gray-400">
                {b.status === 'cancelled' ? 'This batch was cancelled; its lines went back to “Recommended” and can be batched again.' : 'This batch has no lines.'}
              </p>
            ) : (
              <div className="-mx-5 -my-5 overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <caption className="sr-only">Payout lines in {b.batchNumber}</caption>
                  <thead className="bg-stone-50/70 dark:bg-gray-900/40">
                    <tr>
                      <th scope="col" className={ui.th}>Payee</th>
                      <th scope="col" className={ui.th}>Work</th>
                      <th scope="col" className={ui.th}>Status</th>
                      <th scope="col" className={`${ui.th} text-right`}>Amount</th>
                      {showTds && <th scope="col" className={`${ui.th} text-right`}>TDS</th>}
                      {showTds && <th scope="col" className={`${ui.th} text-right`}>Net</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                    {b.payouts.map((l) => (
                      <tr key={l.id} className="hover:bg-stone-50/70 dark:hover:bg-gray-700/30">
                        <td className={ui.td}>
                          <div className="font-medium text-stone-900 dark:text-white">{l.payeeName}</div>
                          <div className="text-xs text-stone-500 dark:text-gray-400">{l.payeeEmployeeId || 'No employee ID'}</div>
                        </td>
                        <td className={`${ui.td} max-w-md`}>
                          <button type="button" onClick={() => setLineId(l.id)} className="line-clamp-2 text-left font-medium text-stone-800 hover:text-wine hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 dark:text-gray-100 dark:hover:text-amber">
                            {l.title}
                          </button>
                          <div className="text-xs text-stone-500 dark:text-gray-400">{workTypeLabel(l.workType)}{l.referenceNumber ? ` · ${l.referenceNumber}` : ''}</div>
                        </td>
                        <td className={ui.td}><PayoutStatusBadge status={l.status} /></td>
                        <td className={`${ui.td} text-right font-semibold tabular-nums text-stone-900 dark:text-white`}>{formatINR(l.approvedAmount)}</td>
                        {showTds && <td className={`${ui.td} text-right tabular-nums`}>{formatINR(l.tdsAmount || 0)}</td>}
                        {showTds && <td className={`${ui.td} text-right tabular-nums`}>{formatINR(l.netAmount ?? l.approvedAmount)}</td>}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-stone-200 bg-stone-50/70 dark:border-gray-600 dark:bg-gray-900/40">
                    <tr>
                      <th scope="row" colSpan={3} className={`${ui.td} text-left font-semibold`}>Total</th>
                      <td className={`${ui.td} text-right font-semibold tabular-nums text-stone-900 dark:text-white`}>{formatINR(totals.gross)}</td>
                      {showTds && <td className={`${ui.td} text-right font-semibold tabular-nums`}>{formatINR(totals.tds)}</td>}
                      {showTds && <td className={`${ui.td} text-right font-semibold tabular-nums`}>{formatINR(totals.net)}</td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </AnalyticsPanel>

          <AnalyticsPanel title="History" subtitle="Every action on this batch, oldest first" icon={<History />}>
            <EventTimeline events={b.events} emptyText="No actions recorded yet." />
          </AnalyticsPanel>

          <ApproveBatchDialog
            open={dialog === 'approve'}
            onClose={() => setDialog(null)}
            batchNumber={b.batchNumber}
            count={b.payouts.length}
            total={b.totalAmount}
            selfConflict={allowSelfApproval ? approvalConflict(b, userId) : null}
            onSubmit={async (comments, selfApprovalReason) => {
              const res = await approve.mutateAsync({ id: b.id, comments, selfApprovalReason });
              toast.success(`${b.batchNumber} approved for payment.`);
              const warning = budgetWarningText(res.budgetWarnings);
              if (warning) toast.warning(warning, 'Over research budget');
            }}
          />
          <RecordPaymentDialog
            open={dialog === 'pay'}
            onClose={() => setDialog(null)}
            batchNumber={b.batchNumber}
            lines={b.payouts}
            onSubmit={async (input) => {
              await pay.mutateAsync({ id: b.id, ...input });
              toast.success(`${b.batchNumber} marked paid.`);
            }}
          />
          <ReasonDialog
            open={dialog === 'cancel'}
            onClose={() => setDialog(null)}
            danger
            title={`Cancel ${b.batchNumber}`}
            description="The batch is closed and its lines go back to “Recommended”, ready to be batched again."
            label="Reason for cancelling"
            confirmLabel="Cancel batch"
            onSubmit={async (reason) => {
              await cancel.mutateAsync({ id: b.id, reason });
              toast.success(`${b.batchNumber} cancelled.`);
            }}
          />
          <PayoutDetailDrawer id={lineId} onClose={() => setLineId(null)} canReview={false} onAction={() => undefined} />
        </>
      )}
    </FinancePageShell>
  );
}
