'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, X, Edit2, Copy } from 'lucide-react';
import { useFeeStructure } from '../hooks/useFeeStructure';
import { FeeStructure } from '../services/feeStructure.service';

interface Props {
  type: 'TRANSPORT' | 'HOSTEL';
}

interface HeadRow {
  headName: string;
  amount: string;
}

export default function TransportHostelTab({ type }: Props) {
  const { list, loading, saving, error, fetchAll, create, update, remove } = useFeeStructure();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [batchYear, setBatchYear] = useState(new Date().getFullYear());
  const [heads, setHeads] = useState<HeadRow[]>([{ headName: '', amount: '' }]);

  useEffect(() => {
    fetchAll({ type });
  }, [type, fetchAll]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setBatchYear(new Date().getFullYear());
    setHeads([{ headName: '', amount: '' }]);
  };

  const startEdit = (fs: FeeStructure) => {
    setEditingId(fs.id);
    setBatchYear(fs.batchYear);
    setHeads(fs.heads.map(h => ({ headName: h.headName, amount: String(h.amount) })));
    setShowForm(true);
  };

  // Clone: copy fee heads from an existing structure into a fresh New form
  const startClone = (fs: FeeStructure) => {
    setEditingId(null);
    setBatchYear(new Date().getFullYear());
    setHeads(fs.heads.map(h => ({ headName: h.headName, amount: String(h.amount) })));
    setShowForm(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const addRow = () => setHeads(prev => [...prev, { headName: '', amount: '' }]);
  const removeRow = (i: number) => setHeads(prev => prev.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof HeadRow, value: string) =>
    setHeads(prev => prev.map((h, idx) => idx === i ? { ...h, [field]: value } : h));

  const handleSubmit = async () => {
    const validHeads = heads.filter(h => h.headName.trim() && Number(h.amount) > 0);
    if (validHeads.length === 0) return;
    try {
      if (editingId) {
        await update(editingId, { heads: validHeads.map(h => ({ headName: h.headName.trim(), amount: Number(h.amount) })) });
      } else {
        await create({ type, batchYear, heads: validHeads.map(h => ({ headName: h.headName.trim(), amount: Number(h.amount) })) });
      }
      resetForm();
      fetchAll({ type });
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fee structure?')) return;
    try { await remove(id); fetchAll({ type }); } catch {}
  };

  const totalAmount = (fs: FeeStructure) =>
    fs.heads.reduce((s, h) => s + Number(h.amount), 0);

  const label = type === 'TRANSPORT' ? 'Transport' : 'Hostel';

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{label} Fee Structures</h3>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Add {label} Fee
          </button>
        )}
      </div>
      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        <p><strong>Amount is monthly.</strong> Enter per-month {label.toLowerCase()} charge here.</p>
        <p className="mt-1">Loan letter printing rule: for each academic year block, selected one semester = 6 months, selected both semesters = 11 months.</p>
      </div>

      {error && <div className="mb-4 rounded-lg p-3 bg-red-50 text-red-700 text-sm">{error}</div>}

      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-gray-900">{editingId ? 'Edit' : 'New'} {label} Fee Structure</h4>
              {!editingId && (
                <p className="mt-0.5 text-xs text-gray-500">
                  Use the <Copy className="inline w-3 h-3 mx-0.5" /> button on any existing row to clone its fee heads here.
                </p>
              )}
            </div>
            <button onClick={resetForm} className="shrink-0 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>

          {!editingId && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Year</label>
              <input
                type="number"
                value={batchYear}
                onChange={e => setBatchYear(Number(e.target.value))}
                className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                min={2020}
                max={2050}
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Fee Heads</label>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Head Name</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 w-44">Monthly Amount (₹)</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {heads.map((h, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          placeholder="e.g. Transport Department"
                          value={h.headName}
                          onChange={e => updateRow(i, 'headName', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          placeholder="0"
                          value={h.amount}
                          onChange={e => updateRow(i, 'amount', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          min={0}
                          step="1"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {heads.length > 1 && (
                          <button
                            onClick={() => removeRow(i)}
                            className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800 tabular-nums">
                      ₹{heads.reduce((s, h) => s + (Number(h.amount) || 0), 0).toLocaleString('en-IN')}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <button
              onClick={addRow}
              className="mt-2 flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              <Plus className="w-3.5 h-3.5" /> Add Head
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Fee Structure'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No {label.toLowerCase()} fee structures configured yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-[640px] w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Batch Year</th>
                <th className="px-4 py-3 font-medium text-gray-600">Fee Heads</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Total Monthly Amount</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {list.map(fs => (
                <tr key={fs.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{fs.batchYear}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {fs.heads.map((h, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                          {h.headName}
                          <span className="font-medium text-gray-400">₹{Number(h.amount).toLocaleString('en-IN')}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                    ₹{totalAmount(fs).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      fs.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {fs.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startClone(fs)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Clone into new fee structure"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => startEdit(fs)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(fs.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
