'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { IndianRupee, Loader2, Plus, Trash2, X } from 'lucide-react';
import api from '@/shared/api/api';
import { extractErrorMessage } from '@/shared/types/api.types';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';

interface Receipt {
  id: string;
  amount: number;
  receivedDate: string;
  financialYear: string;
  reference: string | null;
  notes: string | null;
  recordedBy: string | null;
}

interface FundingData {
  sanction: { sanctionedAmount: number | null; sanctionDate: string | null; sanctionOrderNumber: string | null };
  receipts: Receipt[];
  totalsByFinancialYear: Array<{ financialYear: string; total: number; count: number }>;
  totalReceived: number;
  canManage: boolean;
}

interface Props {
  grantId: string;
  /** Only approved / completed grants carry sanction and receipt data. */
  status: string;
}

const inr = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-wine focus:border-wine';
const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';

/** "Sanction & funds received" panel for an approved grant (NAAC 3.1 / NIRF). */
export default function GrantFundingPanel({ grantId, status }: Props) {
  const { toast } = useToast();
  const { confirmAction } = useConfirm();
  const [data, setData] = useState<FundingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sanctionForm, setSanctionForm] = useState({ sanctionedAmount: '', sanctionDate: '', sanctionOrderNumber: '' });
  const [editingSanction, setEditingSanction] = useState(false);
  const [savingSanction, setSavingSanction] = useState(false);

  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ amount: '', receivedDate: '', reference: '', notes: '' });
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const fundable = status === 'approved' || status === 'completed';

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await api.get<{ success: boolean; data: FundingData }>(`/grants/${grantId}/fund-receipts`);
      const d = response.data.data;
      setData(d);
      setSanctionForm({
        sanctionedAmount: d.sanction.sanctionedAmount !== null ? String(d.sanction.sanctionedAmount) : '',
        sanctionDate: d.sanction.sanctionDate || '',
        sanctionOrderNumber: d.sanction.sanctionOrderNumber || '',
      });
    } catch (err: unknown) {
      setLoadError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [grantId]);

  useEffect(() => {
    if (fundable) load();
  }, [fundable, load]);

  if (!fundable) return null;

  const saveSanction = async () => {
    setSavingSanction(true);
    try {
      await api.patch(`/grants/${grantId}/sanction`, {
        sanctionedAmount: sanctionForm.sanctionedAmount,
        sanctionDate: sanctionForm.sanctionDate,
        sanctionOrderNumber: sanctionForm.sanctionOrderNumber || null,
      });
      toast({ type: 'success', message: 'Sanction details saved' });
      setEditingSanction(false);
      await load();
    } catch (err: unknown) {
      toast({ type: 'error', message: extractErrorMessage(err) });
    } finally {
      setSavingSanction(false);
    }
  };

  const addReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setReceiptError(null);
    const amount = Number(receiptForm.amount);
    if (!(amount > 0)) { setReceiptError('Amount must be greater than 0'); return; }
    if (!receiptForm.receivedDate) { setReceiptError('Received date is required'); return; }
    if (receiptForm.receivedDate > todayIso()) { setReceiptError('Received date cannot be in the future'); return; }
    setSavingReceipt(true);
    try {
      await api.post(`/grants/${grantId}/fund-receipts`, {
        amount: receiptForm.amount,
        receivedDate: receiptForm.receivedDate,
        reference: receiptForm.reference || null,
        notes: receiptForm.notes || null,
      });
      toast({ type: 'success', message: 'Fund receipt recorded' });
      setShowReceiptDialog(false);
      setReceiptForm({ amount: '', receivedDate: '', reference: '', notes: '' });
      await load();
    } catch (err: unknown) {
      setReceiptError(extractErrorMessage(err));
    } finally {
      setSavingReceipt(false);
    }
  };

  const deleteReceipt = async (r: Receipt) => {
    const ok = await confirmAction('Delete fund receipt', `Delete the receipt of ${inr(r.amount)} received on ${fmtDate(r.receivedDate)}?`);
    if (!ok) return;
    const reason = typeof window !== 'undefined' ? window.prompt('Reason for deleting (optional)') : null;
    try {
      await api.delete(`/grants/${grantId}/fund-receipts/${r.id}`, { data: { reason: reason || undefined } });
      toast({ type: 'success', message: 'Fund receipt deleted' });
      await load();
    } catch (err: unknown) {
      toast({ type: 'error', message: extractErrorMessage(err) });
    }
  };

  const canManage = Boolean(data?.canManage);
  const sanction = data?.sanction;
  const balance = sanction?.sanctionedAmount !== null && sanction?.sanctionedAmount !== undefined && data
    ? Math.round((sanction.sanctionedAmount - data.totalReceived) * 100) / 100
    : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6" data-testid="grant-funding-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <IndianRupee className="w-5 h-5 mr-2 text-wine dark:text-wine-200" aria-hidden="true" />
          Sanction &amp; funds received
        </h3>
        {canManage && (
          <button
            type="button"
            onClick={() => { setReceiptError(null); setShowReceiptDialog(true); }}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium text-wine-fg bg-wine hover:bg-wine-dark"
          >
            <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Add receipt
          </button>
        )}
      </div>

      {loading && !data ? (
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…</div>
      ) : loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : data && (
        <>
          {/* Sanction details */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sanction</h4>
              {canManage && !editingSanction && (
                <button type="button" onClick={() => setEditingSanction(true)} className="text-xs font-medium text-wine dark:text-wine-200 hover:underline">
                  {sanction?.sanctionedAmount !== null ? 'Edit' : 'Record sanction'}
                </button>
              )}
            </div>
            {editingSanction ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass} htmlFor="sanctionedAmount">Sanctioned amount (₹)</label>
                  <input id="sanctionedAmount" type="number" min="0.01" step="0.01" className={inputClass}
                    value={sanctionForm.sanctionedAmount} onChange={(e) => setSanctionForm({ ...sanctionForm, sanctionedAmount: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="sanctionDate">Sanction date</label>
                  <input id="sanctionDate" type="date" max={todayIso()} className={inputClass}
                    value={sanctionForm.sanctionDate} onChange={(e) => setSanctionForm({ ...sanctionForm, sanctionDate: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="sanctionOrderNumber">Sanction order no.</label>
                  <input id="sanctionOrderNumber" type="text" maxLength={128} className={inputClass}
                    value={sanctionForm.sanctionOrderNumber} onChange={(e) => setSanctionForm({ ...sanctionForm, sanctionOrderNumber: e.target.value })} />
                </div>
                <div className="md:col-span-3 flex gap-2">
                  <button type="button" onClick={saveSanction} disabled={savingSanction}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium text-wine-fg bg-wine hover:bg-wine-dark disabled:opacity-50">
                    {savingSanction && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save
                  </button>
                  <button type="button" onClick={() => setEditingSanction(false)}
                    className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div><dt className="text-gray-500 dark:text-gray-400">Sanctioned amount</dt><dd className="font-medium text-gray-900 dark:text-white">{inr(sanction?.sanctionedAmount)}</dd></div>
                <div><dt className="text-gray-500 dark:text-gray-400">Sanction date</dt><dd className="font-medium text-gray-900 dark:text-white">{fmtDate(sanction?.sanctionDate ?? null)}</dd></div>
                <div><dt className="text-gray-500 dark:text-gray-400">Order no.</dt><dd className="font-medium text-gray-900 dark:text-white">{sanction?.sanctionOrderNumber || '-'}</dd></div>
              </dl>
            )}
          </div>

          {/* Totals */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="rounded-lg bg-wine/5 dark:bg-wine/20 px-4 py-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total received</div>
              <div className="text-lg font-semibold text-wine dark:text-wine-200">{inr(data.totalReceived)}</div>
            </div>
            {balance !== null && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 px-4 py-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">{balance >= 0 ? 'Yet to be received' : 'Received above sanction'}</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">{inr(Math.abs(balance))}</div>
              </div>
            )}
            {data.totalsByFinancialYear.map((fy) => (
              <div key={fy.financialYear} className="rounded-lg bg-gray-50 dark:bg-gray-700/50 px-4 py-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">FY {fy.financialYear} ({fy.count})</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">{inr(fy.total)}</div>
              </div>
            ))}
          </div>

          {/* Receipts table */}
          {data.receipts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">No funds recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-4">Received on</th>
                    <th className="py-2 pr-4">FY</th>
                    <th className="py-2 pr-4 text-right">Amount</th>
                    <th className="py-2 pr-4">Reference</th>
                    <th className="py-2 pr-4">Notes</th>
                    <th className="py-2 pr-4">Recorded by</th>
                    {canManage && <th className="py-2" aria-label="Actions" />}
                  </tr>
                </thead>
                <tbody>
                  {data.receipts.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 dark:border-gray-700/60 text-gray-800 dark:text-gray-200">
                      <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(r.receivedDate)}</td>
                      <td className="py-2 pr-4">{r.financialYear}</td>
                      <td className="py-2 pr-4 text-right font-medium">{inr(r.amount)}</td>
                      <td className="py-2 pr-4">{r.reference || '-'}</td>
                      <td className="py-2 pr-4 max-w-xs truncate" title={r.notes || undefined}>{r.notes || '-'}</td>
                      <td className="py-2 pr-4">{r.recordedBy || '-'}</td>
                      {canManage && (
                        <td className="py-2 text-right">
                          <button type="button" onClick={() => deleteReceipt(r)} aria-label="Delete receipt"
                            className="p-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add-receipt dialog */}
      {showReceiptDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="add-receipt-title">
          <form onSubmit={addReceipt} className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 id="add-receipt-title" className="text-lg font-semibold text-gray-900 dark:text-white">Add fund receipt</h4>
              <button type="button" onClick={() => setShowReceiptDialog(false)} aria-label="Close" className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div>
              <label className={labelClass} htmlFor="receiptAmount">Amount received (₹)</label>
              <input id="receiptAmount" type="number" min="0.01" step="0.01" required className={inputClass}
                value={receiptForm.amount} onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })} />
            </div>
            <div>
              <label className={labelClass} htmlFor="receiptDate">Received on</label>
              <input id="receiptDate" type="date" required max={todayIso()} className={inputClass}
                value={receiptForm.receivedDate} onChange={(e) => setReceiptForm({ ...receiptForm, receivedDate: e.target.value })} />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">The financial year is worked out from this date.</p>
            </div>
            <div>
              <label className={labelClass} htmlFor="receiptReference">Reference (UTR / cheque / letter no.)</label>
              <input id="receiptReference" type="text" maxLength={128} className={inputClass}
                value={receiptForm.reference} onChange={(e) => setReceiptForm({ ...receiptForm, reference: e.target.value })} />
            </div>
            <div>
              <label className={labelClass} htmlFor="receiptNotes">Notes</label>
              <textarea id="receiptNotes" rows={2} maxLength={2000} className={inputClass}
                value={receiptForm.notes} onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })} />
            </div>
            {receiptError && <p className="text-sm text-red-600 dark:text-red-400">{receiptError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowReceiptDialog(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                Cancel
              </button>
              <button type="submit" disabled={savingReceipt}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-wine-fg bg-wine hover:bg-wine-dark disabled:opacity-50">
                {savingReceipt && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save receipt
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
