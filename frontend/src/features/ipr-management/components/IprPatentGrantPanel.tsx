'use client';

import React, { useEffect, useState } from 'react';
import { Award, Loader2 } from 'lucide-react';
import api from '@/shared/api/api';
import { extractErrorMessage } from '@/shared/types/api.types';
import { useAuthStore } from '@/shared/auth/authStore';
import { permissionManagementService } from '@/features/admin-management/services/permissionManagement.service';
import { logger } from '@/shared/utils/logger';

/** Statuses at which the backend accepts PATCH /ipr/:id/granted (published or later). */
export const PATENT_GRANTABLE_STATUSES = ['published', 'under_finance_review', 'finance_approved', 'finance_rejected', 'completed'];

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Small "Granted" badge for headers and lists. */
export function PatentGrantedBadge({ grantedAt, patentNumber }: { grantedAt?: string | null; patentNumber?: string | null }) {
  if (!grantedAt) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
      title={`Granted on ${fmtDate(grantedAt)}${patentNumber ? `, patent no. ${patentNumber}` : ''}`}
    >
      <Award className="w-3.5 h-3.5" aria-hidden="true" /> Granted
    </span>
  );
}

interface Props {
  applicationId: string;
  iprType: string;
  status: string;
  grantedAt?: string | null;
  patentNumber?: string | null;
  onUpdated?: (next: { grantedAt: string | null; patentNumber: string | null }) => void;
}

/** Sidebar card: patent grant details, and "Mark as granted" for DRD IPR approvers / admins. */
export default function IprPatentGrantPanel({ applicationId, iprType, status, grantedAt, patentNumber, onUpdated }: Props) {
  const { user } = useAuthStore();
  const [hasApprovePermission, setHasApprovePermission] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ grantedAt: '', patentNumber: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible = iprType === 'patent' && PATENT_GRANTABLE_STATUSES.includes(status);
  const isAdminUser = Boolean(user && (user.userType === 'admin' || user.role?.name === 'admin' || user.role?.name === 'superadmin'));
  const canManage = isAdminUser || hasApprovePermission;

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !eligible || isAdminUser) return undefined;
    permissionManagementService.getUserPermissions(user.id)
      .then((response) => {
        const allowed = response.data.centralDepartments.some(
          (d) => d.permissions?.ipr_approve === true || d.permissions?.drd_ipr_approve === true,
        );
        if (!cancelled) setHasApprovePermission(allowed);
      })
      .catch((err: unknown) => logger.debug('Permission lookup failed', err));
    return () => { cancelled = true; };
  }, [user?.id, isAdminUser, eligible]);

  if (iprType !== 'patent' || (!eligible && !grantedAt)) return null;
  if (!grantedAt && !canManage) return null;

  const startEdit = () => {
    setForm({ grantedAt: grantedAt ? String(grantedAt).slice(0, 10) : '', patentNumber: patentNumber || '' });
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!form.grantedAt) { setError('Grant date is required'); return; }
    if (form.grantedAt > todayIso()) { setError('Grant date cannot be in the future'); return; }
    if (!form.patentNumber.trim()) { setError('Patent number is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const response = await api.patch(`/ipr/${applicationId}/granted`, { grantedAt: form.grantedAt, patentNumber: form.patentNumber.trim() });
      const d = response.data?.data || {};
      onUpdated?.({ grantedAt: d.grantedAt ?? form.grantedAt, patentNumber: d.patentNumber ?? form.patentNumber.trim() });
      setEditing(false);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6" data-testid="patent-grant-panel">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Patent grant</h2>
        <PatentGrantedBadge grantedAt={grantedAt} patentNumber={patentNumber} />
      </div>

      {!editing && grantedAt && (
        <dl className="space-y-2 text-sm">
          <div><dt className="text-xs text-gray-500 dark:text-gray-400">Granted on</dt><dd className="text-gray-900 dark:text-white">{fmtDate(grantedAt)}</dd></div>
          <div><dt className="text-xs text-gray-500 dark:text-gray-400">Patent number</dt><dd className="text-gray-900 dark:text-white font-medium">{patentNumber || '-'}</dd></div>
        </dl>
      )}
      {!editing && !grantedAt && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Not granted yet.</p>
      )}

      {canManage && eligible && !editing && (
        <button
          type="button"
          onClick={startEdit}
          className="mt-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-wine-fg bg-wine hover:bg-wine-dark"
        >
          {grantedAt ? 'Edit grant details' : 'Mark as granted'}
        </button>
      )}

      {editing && (
        <div className="space-y-3">
          <div>
            <label htmlFor="patentGrantedAt" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Grant date</label>
            <input id="patentGrantedAt" type="date" max={todayIso()} value={form.grantedAt}
              onChange={(e) => setForm({ ...form, grantedAt: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-wine" />
          </div>
          <div>
            <label htmlFor="patentNumber" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Patent number</label>
            <input id="patentNumber" type="text" maxLength={64} value={form.patentNumber}
              onChange={(e) => setForm({ ...form, patentNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-wine" />
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={saving}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium text-wine-fg bg-wine hover:bg-wine-dark disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
