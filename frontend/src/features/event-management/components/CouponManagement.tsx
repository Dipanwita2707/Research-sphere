'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Tag, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Loader2, AlertCircle, Copy, Check, Calendar,
  Percent, IndianRupee, Users, X, CheckCircle2, Info,
} from 'lucide-react';
import { eventService } from '../services/event.service';
import type { EventCoupon, CouponFormData, CouponDiscountType } from '../types/event.types';

// ─────────────────────────────────────────────
// Design constants
// ─────────────────────────────────────────────
const CARD = 'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt';
const INPUT = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 outline-none transition-all';
const LABEL = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
const BTN_PRIMARY = 'inline-flex items-center gap-2 px-4 py-2 bg-sgt-600 text-white text-sm font-medium rounded-lg hover:bg-sgt-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SECONDARY = 'inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────
const EmptyState = ({ onAdd }: { onAdd: () => void }) => (
  <div className="text-center py-16">
    <div className="w-16 h-16 bg-sgt-50 dark:bg-sgt-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
      <Tag className="w-8 h-8 text-sgt-600 dark:text-sgt-400" />
    </div>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Coupons Yet</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
      Create discount coupons for participants registering for this event.
    </p>
    <button onClick={onAdd} className={BTN_PRIMARY}>
      <Plus className="w-4 h-4" /> Create First Coupon
    </button>
  </div>
);

// ─────────────────────────────────────────────
// Coupon Form Modal
// ─────────────────────────────────────────────
interface CouponFormModalProps {
  coupon?: EventCoupon | null;
  onClose: () => void;
  onSave: (data: CouponFormData) => Promise<void>;
}

const defaultForm = (): CouponFormData => ({
  code: '',
  discountType: 'percentage',
  discountValue: 10,
  maxDiscountCap: null,
  minAmount: null,
  maxUses: null,
  maxUsesPerUser: 1,
  expiresAt: null,
  isActive: true,
  description: null,
});

const CouponFormModal: React.FC<CouponFormModalProps> = ({ coupon, onClose, onSave }) => {
  const [form, setForm] = useState<CouponFormData>(() => {
    if (!coupon) return defaultForm();
    return {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountCap: coupon.maxDiscountCap ?? null,
      minAmount: coupon.minAmount ?? null,
      maxUses: coupon.maxUses ?? null,
      maxUsesPerUser: coupon.maxUsesPerUser ?? null,
      expiresAt: coupon.expiresAt
        ? new Date(coupon.expiresAt).toISOString().slice(0, 16)
        : null,
      isActive: coupon.isActive,
      description: coupon.description ?? null,
    };
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof CouponFormData>(key: K, val: CouponFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = 'Coupon code is required';
    else if (!/^[A-Za-z0-9_-]+$/.test(form.code)) errs.code = 'Only letters, digits, - and _ allowed';
    if (!form.discountValue || form.discountValue < 1)
      errs.discountValue = form.discountType === 'percentage' ? 'Minimum discount is 1%' : 'Minimum discount is ₹1';
    if (form.discountType === 'percentage' && form.discountValue > 100) errs.discountValue = 'Percentage cannot exceed 100';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        code: form.code.trim().toUpperCase(),
        maxDiscountCap: form.discountType === 'percentage' ? (form.maxDiscountCap || null) : null,
        expiresAt: form.expiresAt || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl">
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sgt-50 dark:bg-sgt-900/20 rounded-lg">
              <Tag className="w-4 h-4 text-sgt-600 dark:text-sgt-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {coupon ? 'Edit Coupon' : 'Create Coupon'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-3 space-y-3">
          {/* Code */}
          <div>
            <label className={LABEL}>
              Coupon Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="e.g. EARLYBIRD20"
              className={`${INPUT} font-mono ${errors.code ? 'border-red-400 focus:ring-red-400' : ''}`}
            />
            {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code}</p>}
            <p className="mt-1 text-xs text-gray-400">Letters, digits, hyphens and underscores only.</p>
          </div>

          {/* Discount Type + Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Discount Type <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                {(['percentage', 'fixed'] as CouponDiscountType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('discountType', t)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm rounded-lg border-2 transition-all ${
                      form.discountType === t
                        ? 'border-sgt-500 bg-sgt-50 text-sgt-700 dark:bg-sgt-900/20 dark:text-sgt-300 font-semibold'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {t === 'percentage' ? <Percent className="w-3.5 h-3.5" /> : <IndianRupee className="w-3.5 h-3.5" />}
                    {t === 'percentage' ? '%' : '₹ Fixed'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={LABEL}>
                Discount Value <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {form.discountType === 'percentage' ? '%' : '₹'}
                </span>
                <input
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => set('discountValue', parseFloat(e.target.value) || 0)}
                  min={1}
                  max={form.discountType === 'percentage' ? 100 : undefined}
                  step="any"
                  className={`${INPUT} pl-7 ${errors.discountValue ? 'border-red-400 focus:ring-red-400' : ''}`}
                />
              </div>
              {errors.discountValue && <p className="mt-1 text-xs text-red-500">{errors.discountValue}</p>}
            </div>
          </div>

          {/* Max Discount Cap (percentage only) */}
          {form.discountType === 'percentage' && (
            <div>
              <label className={LABEL}>
                Max Discount Cap (₹) <span className="text-xs font-normal text-gray-400 ml-1">optional</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                <input
                  type="number"
                  value={form.maxDiscountCap ?? ''}
                  onChange={(e) => set('maxDiscountCap', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="No cap"
                  min={0}
                  className={`${INPUT} pl-7`}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">Maximum ₹ discount regardless of percentage.</p>
            </div>
          )}

          {/* Min Amount + Usage Limits + Expiry */}
          <div className="grid grid-cols-[2fr_1.5fr_1.5fr_3fr] gap-3 items-end">
            <div>
              <label className={`${LABEL} whitespace-nowrap`}>
                Min (₹) <span className="text-xs font-normal text-gray-400">opt</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                <input
                  type="number"
                  value={form.minAmount ?? ''}
                  onChange={(e) => set('minAmount', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Any"
                  min={0}
                  className={`${INPUT} pl-7`}
                />
              </div>
            </div>
            <div>
              <label className={`${LABEL} whitespace-nowrap`}>
                Uses <span className="text-xs font-normal text-gray-400">opt</span>
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="number"
                  value={form.maxUses ?? ''}
                  onChange={(e) => set('maxUses', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="∞"
                  min={1}
                  className={`${INPUT} pl-9`}
                />
              </div>
            </div>
            <div>
              <label className={`${LABEL} whitespace-nowrap`}>
                Per-User <span className="text-xs font-normal text-gray-400">opt</span>
              </label>
              <input
                type="number"
                value={form.maxUsesPerUser ?? ''}
                onChange={(e) => set('maxUsesPerUser', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="∞"
                min={1}
                className={INPUT}
              />
            </div>
            <div>
              <label className={`${LABEL} whitespace-nowrap`}>
                Expiry <span className="text-xs font-normal text-gray-400">opt</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="datetime-local"
                  value={form.expiresAt ?? ''}
                  onChange={(e) => set('expiresAt', e.target.value || null)}
                  className={`${INPUT} pl-9`}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={LABEL}>
              Description <span className="text-xs font-normal text-gray-400 ml-1">optional</span>
            </label>
            <input
              type="text"
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value || null)}
              placeholder="e.g. Early bird discount — valid for the first 50 registrations"
              className={INPUT}
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Participants can apply this coupon</p>
            </div>
            <button
              type="button"
              onClick={() => set('isActive', !form.isActive)}
              className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${form.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`inline-block w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button type="button" onClick={onClose} className={BTN_SECONDARY} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={BTN_PRIMARY} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {coupon ? 'Save Changes' : 'Create Coupon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Coupon Card
// ─────────────────────────────────────────────
const CouponCard: React.FC<{
  coupon: EventCoupon;
  onEdit: (c: EventCoupon) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  deleting: string | null;
  toggling: string | null;
}> = ({ coupon, onEdit, onDelete, onToggle, deleting, toggling }) => {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(coupon.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
  const isExhausted = coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses;
  const statusLabel = !coupon.isActive ? 'Inactive' : isExpired ? 'Expired' : isExhausted ? 'Exhausted' : 'Active';
  const statusColor = !coupon.isActive || isExpired || isExhausted
    ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40'
    : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40';

  return (
    <div className={`${CARD} p-5 flex flex-col gap-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2.5 rounded-lg shrink-0 ${coupon.discountType === 'percentage' ? 'bg-violet-50 dark:bg-violet-900/20' : 'bg-sgt-50 dark:bg-sgt-900/20'}`}>
            {coupon.discountType === 'percentage'
              ? <Percent className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              : <IndianRupee className="w-4 h-4 text-sgt-600 dark:text-sgt-400" />
            }
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-gray-900 dark:text-white text-base tracking-wide truncate">
                {coupon.code}
              </span>
              <button onClick={copyCode} className="shrink-0 p-1 text-gray-400 hover:text-sgt-600 transition-colors" title="Copy code">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            {coupon.description && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{coupon.description}</p>
            )}
          </div>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${statusColor}`}>
          {coupon.isActive && !isExpired && !isExhausted && <CheckCircle2 className="w-3 h-3" />}
          {statusLabel}
        </span>
      </div>

      {/* Discount Details */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2.5">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Discount</p>
          <p className="font-semibold text-gray-800 dark:text-gray-200">
            {coupon.discountType === 'percentage'
              ? `${coupon.discountValue}%${coupon.maxDiscountCap ? ` (max ₹${coupon.maxDiscountCap})` : ''}`
              : `₹${coupon.discountValue}`
            }
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2.5">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Total Usage</p>
          <p className="font-semibold text-gray-800 dark:text-gray-200">
            {coupon.usedCount}{coupon.maxUses !== null && coupon.maxUses !== undefined ? ` / ${coupon.maxUses}` : ''} <span className="text-xs font-normal text-gray-400">used</span>
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2.5">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Per User Limit</p>
          <p className="font-semibold text-gray-800 dark:text-gray-200">
            {coupon.maxUsesPerUser != null ? coupon.maxUsesPerUser : '∞'}
          </p>
        </div>
        {coupon.minAmount !== null && coupon.minAmount !== undefined && (
          <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2.5">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Min Amount</p>
            <p className="font-semibold text-gray-800 dark:text-gray-200">₹{coupon.minAmount}</p>
          </div>
        )}
        {coupon.expiresAt && (
          <div className={`rounded-lg px-3 py-2.5 ${isExpired ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700/40'}`}>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Expires</p>
            <p className={`font-semibold text-sm ${isExpired ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>
              {new Date(coupon.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end pt-1 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {/* Toggle Active */}
          <button
            onClick={() => onToggle(coupon.id, !coupon.isActive)}
            disabled={toggling === coupon.id}
            className={`p-1.5 transition-colors rounded ${coupon.isActive ? 'text-emerald-500 hover:text-emerald-700' : 'text-gray-400 hover:text-gray-600'}`}
            title={coupon.isActive ? 'Deactivate' : 'Activate'}
          >
            {toggling === coupon.id
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : coupon.isActive
                ? <ToggleRight className="w-5 h-5" />
                : <ToggleLeft className="w-5 h-5" />
            }
          </button>
          {/* Edit */}
          <button
            onClick={() => onEdit(coupon)}
            className="p-1.5 text-gray-400 hover:text-sgt-600 dark:hover:text-sgt-400 transition-colors rounded"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          {/* Delete */}
          <button
            onClick={() => onDelete(coupon.id)}
            disabled={deleting === coupon.id}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded disabled:opacity-50"
            title="Delete"
          >
            {deleting === coupon.id
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Trash2 className="w-4 h-4" />
            }
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Main CouponManagement Component
// ─────────────────────────────────────────────
interface CouponManagementProps {
  eventId: string;
  isPaidEvent: boolean;
  onToast: (opts: { type: 'success' | 'error'; message: string }) => void;
}

const CouponManagement: React.FC<CouponManagementProps> = ({ eventId, isPaidEvent, onToast }) => {
  const [coupons, setCoupons] = useState<EventCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<EventCoupon | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await eventService.listCoupons(eventId);
      setCoupons(data);
    } catch (err: any) {
      onToast({ type: 'error', message: err?.response?.data?.message || 'Failed to load coupons' });
    } finally {
      setLoading(false);
    }
  }, [eventId, onToast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: CouponFormData) => {
    try {
      if (editingCoupon) {
        const updated = await eventService.updateCoupon(eventId, editingCoupon.id, data);
        setCoupons((prev) => prev.map((c) => c.id === updated.id ? updated : c));
        onToast({ type: 'success', message: 'Coupon updated' });
      } else {
        const created = await eventService.createCoupon(eventId, data);
        setCoupons((prev) => [created, ...prev]);
        onToast({ type: 'success', message: 'Coupon created' });
      }
    } catch (err: any) {
      onToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save coupon' });
      throw err;
    }
  };

  const handleDelete = async (couponId: string) => {
    if (!window.confirm('Delete this coupon? Existing registrations with this coupon will not be affected.')) return;
    setDeletingId(couponId);
    try {
      await eventService.deleteCoupon(eventId, couponId);
      setCoupons((prev) => prev.filter((c) => c.id !== couponId));
      onToast({ type: 'success', message: 'Coupon deleted' });
    } catch (err: any) {
      onToast({ type: 'error', message: err?.response?.data?.message || 'Failed to delete coupon' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (couponId: string, isActive: boolean) => {
    setTogglingId(couponId);
    try {
      const updated = await eventService.updateCoupon(eventId, couponId, { isActive });
      setCoupons((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      onToast({ type: 'success', message: isActive ? 'Coupon activated' : 'Coupon deactivated' });
    } catch (err: any) {
      onToast({ type: 'error', message: err?.response?.data?.message || 'Failed to toggle coupon' });
    } finally {
      setTogglingId(null);
    }
  };

  const openCreate = () => { setEditingCoupon(null); setShowModal(true); };
  const openEdit = (c: EventCoupon) => { setEditingCoupon(c); setShowModal(true); };

  // ── Non-paid event warning ──
  if (!isPaidEvent) {
    return (
      <div className={`${CARD} p-8 text-center`}>
        <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Info className="w-7 h-7 text-amber-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Free Event</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
          Coupons are only available for paid events. This event has no registration fee.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-sgt-600" />
            Coupon Management
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Create and manage discount coupons for event registration.
          </p>
        </div>
        {coupons.length > 0 && (
          <button onClick={openCreate} className={BTN_PRIMARY}>
            <Plus className="w-4 h-4" /> New Coupon
          </button>
        )}
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/15 border border-blue-100 dark:border-blue-900/30 rounded-lg">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Coupons are <strong>event-specific</strong> — one coupon per registration. Usage is tracked atomically to prevent over-redemption even during concurrent registrations.
        </p>
      </div>

      {/* Stats row */}
      {coupons.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Coupons', value: coupons.length },
            { label: 'Active', value: coupons.filter((c) => c.isActive && (!c.expiresAt || new Date(c.expiresAt) >= new Date())).length },
            { label: 'Total Redeemed', value: coupons.reduce((s, c) => s + c.usedCount, 0) },
            { label: 'Inactive / Expired', value: coupons.filter((c) => !c.isActive || (c.expiresAt && new Date(c.expiresAt) < new Date())).length },
          ].map(({ label, value }) => (
            <div key={label} className={`${CARD} px-4 py-3`}>
              <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-sgt-500" />
        </div>
      ) : coupons.length === 0 ? (
        <div className={CARD}>
          <EmptyState onAdd={openCreate} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {coupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              onEdit={openEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
              deleting={deletingId}
              toggling={togglingId}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <CouponFormModal
          coupon={editingCoupon}
          onClose={() => { setShowModal(false); setEditingCoupon(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default CouponManagement;
