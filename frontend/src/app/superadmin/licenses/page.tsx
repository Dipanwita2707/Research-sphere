'use client';

import React, { useEffect, useState } from 'react';
import { superadminService, LicenseRecord, IssueLicensePayload } from '@/shared/services/superadmin.service';
import {
  Shield,
  Key,
  Laptop,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Plus,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Clock,
  Trash2,
  Cpu,
  Power,
  PlayCircle,
  HelpCircle,
} from 'lucide-react';

interface ConfirmModalState {
  isOpen: boolean;
  type: 'revoke' | 'reset' | 'delete' | 'reactivate';
  license: LicenseRecord | null;
}

export default function SuperadminLicensesPage() {
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // New License Form State
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newLicense, setNewLicense] = useState<IssueLicensePayload>({
    assignedTo: '',
    notes: '',
    requiresApproval: true,
    preAuthorizedHardwareId: '',
  });

  // Action states
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Custom in-page Confirmation Modal state (no glitchy browser popups)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    type: 'revoke',
    license: null,
  });

  const fetchLicenses = async () => {
    try {
      const data = await superadminService.listLicenses();
      setLicenses(data);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load software licenses.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLicenses();
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleIssueLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLicense.assignedTo.trim()) return;

    setIsSubmitting(true);
    setError('');
    try {
      await superadminService.issueLicense(newLicense);
      setSuccessMsg(`License successfully issued for "${newLicense.assignedTo}"`);
      setIsCreating(false);
      setNewLicense({
        assignedTo: '',
        notes: '',
        requiresApproval: true,
        preAuthorizedHardwareId: '',
      });
      await fetchLicenses();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to issue license.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveHardware = async (license: LicenseRecord) => {
    setActionInProgress(`approve-${license.id}`);
    try {
      await superadminService.approveHardware(license.id);
      setSuccessMsg(`Hardware approved for "${license.assignedTo}"! Machine is now authorized to run the backend.`);
      await fetchLicenses();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to approve hardware.');
    } finally {
      setActionInProgress(null);
    }
  };

  const executeConfirmedAction = async () => {
    const { type, license } = confirmModal;
    if (!license) return;

    setConfirmModal({ isOpen: false, type: 'revoke', license: null });
    setActionInProgress(`${type}-${license.id}`);

    try {
      if (type === 'revoke') {
        await superadminService.revokeLicense(license.id);
        setSuccessMsg(`Access revoked for "${license.assignedTo}". Kill switch is now ACTIVE.`);
      } else if (type === 'reactivate') {
        await superadminService.reactivateLicense(license.id);
        setSuccessMsg(`Access reactivated for "${license.assignedTo}".`);
      } else if (type === 'reset') {
        await superadminService.resetHardware(license.id);
        setSuccessMsg(`Hardware binding reset for "${license.assignedTo}".`);
      } else if (type === 'delete') {
        await superadminService.deleteLicense(license.id);
        setSuccessMsg(`License for "${license.assignedTo}" permanently deleted.`);
      }
      await fetchLicenses();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || `Failed to perform ${type} action.`);
    } finally {
      setActionInProgress(null);
    }
  };

  const activeCount = licenses.filter((l) => l.isActive && l.status === 'ACTIVE').length;
  const pendingCount = licenses.filter((l) => l.pendingHardwareId && l.status === 'PENDING_APPROVAL').length;
  const revokedCount = licenses.filter((l) => !l.isActive).length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 text-wine animate-spin" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">Loading software licenses & device security...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-wine/10 dark:bg-wine/20 text-wine">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                Software Protection & Node-Locking
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Manage hardware-bound licenses, approve device authorizations, and execute remote kill switches.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh licenses"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-wine hover:bg-wine-dark text-white font-medium shadow-md shadow-wine/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>Issue New License</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 text-sm flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Authorized Devices</p>
            <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1">{activeCount}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        <div className={`p-6 rounded-2xl border shadow-sm flex items-center justify-between transition-colors ${
          pendingCount > 0 
            ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60' 
            : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'
        }`}>
          <div>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Pending Device Approvals
            </p>
            <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</p>
            {pendingCount > 0 && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mt-1">
                ⚠️ Action required in table below
              </p>
            )}
          </div>
          <div className="p-3.5 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Revoked Licenses</p>
            <p className="text-3xl font-extrabold text-gray-500 dark:text-gray-400 mt-1">{revokedCount}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500">
            <XCircle className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Create License Modal / Card */}
      {isCreating && (
        <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Key className="h-5 w-5 text-wine" />
              Issue New Software License Key
            </h2>
            <button
              onClick={() => setIsCreating(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-medium"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleIssueLicense} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Assigned User / Machine Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sourav MacBook Pro / Dell XPS"
                  value={newLicense.assignedTo}
                  onChange={(e) => setNewLicense({ ...newLicense, assignedTo: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-wine/20 focus:border-wine transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Pre-Authorized Hardware ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave empty to approve when they start the app"
                  value={newLicense.preAuthorizedHardwareId || ''}
                  onChange={(e) => setNewLicense({ ...newLicense, preAuthorizedHardwareId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-wine/20 focus:border-wine transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Notes & Terms
              </label>
              <input
                type="text"
                placeholder="e.g. Authorized deployment for internal review"
                value={newLicense.notes || ''}
                onChange={(e) => setNewLicense({ ...newLicense, notes: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-wine/20 focus:border-wine transition-all"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 flex items-start gap-3">
              <input
                type="checkbox"
                id="requiresApproval"
                checked={newLicense.requiresApproval}
                onChange={(e) => setNewLicense({ ...newLicense, requiresApproval: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-wine focus:ring-wine mt-0.5"
              />
              <div>
                <label htmlFor="requiresApproval" className="text-sm font-semibold text-gray-900 dark:text-white cursor-pointer">
                  Require Manual Admin Approval on First Connect (Recommended)
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  When enabled, you must click &quot;Approve Device&quot; on this dashboard before their computer can boot the app. If unchecked, the first device to connect binds automatically.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-wine hover:bg-wine-dark text-white font-medium shadow-md shadow-wine/20 transition-all disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Generate License Key</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Licenses Table */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active & Registered Licenses</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              {licenses.length}
            </span>
          </div>
          <button
            onClick={handleRefresh}
            className="text-xs font-medium text-wine hover:underline flex items-center gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh list
          </button>
        </div>

        {licenses.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">No licenses issued yet</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Click &quot;Issue New License&quot; above to create a hardware-bound license key for your senior.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/75 dark:bg-gray-950/50 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-4">Assigned To / Notes</th>
                  <th className="px-6 py-4">License Key</th>
                  <th className="px-6 py-4">Bound Hardware Fingerprint</th>
                  <th className="px-6 py-4">Security Status</th>
                  <th className="px-6 py-4 text-right">Actions & Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {licenses.map((license) => {
                  const isRevoked = !license.isActive;
                  const isPending = license.status === 'PENDING_APPROVAL' || Boolean(license.pendingHardwareId && !license.hardwareId);

                  return (
                    <tr
                      key={license.id}
                      className={`transition-colors ${
                        isPending 
                          ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/60 dark:hover:bg-amber-950/30' 
                          : isRevoked
                          ? 'bg-red-50/20 dark:bg-red-950/10 hover:bg-red-50/40 dark:hover:bg-red-950/20'
                          : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/40'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <Laptop className="h-4 w-4 text-wine shrink-0" />
                          <span>{license.assignedTo}</span>
                        </div>
                        {license.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{license.notes}</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-1">
                          Created: {new Date(license.createdAt).toLocaleDateString()}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-mono text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg w-fit">
                          <span>{license.licenseKey.substring(0, 18)}...</span>
                          <button
                            onClick={() => handleCopyKey(license.licenseKey)}
                            className="text-gray-500 hover:text-wine transition-colors p-1"
                            title="Copy full license key"
                          >
                            {copiedKey === license.licenseKey ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {license.hardwareId ? (
                          <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md w-fit border border-emerald-200 dark:border-emerald-900/40">
                            <Cpu className="h-3.5 w-3.5" />
                            <span>{license.hardwareId}</span>
                          </div>
                        ) : license.pendingHardwareId ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-xs font-mono text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 px-2.5 py-1 rounded-md w-fit border border-amber-300 dark:border-amber-800">
                              <Clock className="h-3.5 w-3.5 text-amber-600" />
                              <span>Req: {license.pendingHardwareId}</span>
                            </div>
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                              ⚡ Pending approval click below
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No device connected yet</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isRevoked ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 w-fit">
                              <XCircle className="h-3.5 w-3.5" />
                              ACCESS REVOKED
                            </span>
                            <span className="text-[11px] text-red-500 font-medium">Kill switch active</span>
                          </div>
                        ) : isPending ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 w-fit animate-pulse">
                              <Clock className="h-3.5 w-3.5" />
                              ACTION REQUIRED
                            </span>
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              Device waiting for approval
                            </span>
                          </div>
                        ) : license.hardwareId ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 w-fit">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              BOUND & ACTIVE
                            </span>
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Node-locked to machine
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 w-fit">
                              <Shield className="h-3.5 w-3.5" />
                              READY FOR SETUP
                            </span>
                            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                              {license.requiresApproval ? 'Manual approval on connect' : 'Auto-bind on connect'}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Approve Device Button (Prominent when pending) */}
                          {isPending && (
                            <button
                              onClick={() => handleApproveHardware(license)}
                              disabled={actionInProgress === `approve-${license.id}`}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                            >
                              {actionInProgress === `approve-${license.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              <span>Approve Device</span>
                            </button>
                          )}

                          {/* Reactivate Access (If Revoked) */}
                          {isRevoked && (
                            <button
                              onClick={() => setConfirmModal({ isOpen: true, type: 'reactivate', license })}
                              disabled={actionInProgress === `reactivate-${license.id}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition-colors disabled:opacity-50"
                              title="Restore access for this license"
                            >
                              {actionInProgress === `reactivate-${license.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <PlayCircle className="h-3.5 w-3.5" />
                              )}
                              <span>Reactivate</span>
                            </button>
                          )}

                          {/* Reset Hardware Binding Button */}
                          {license.hardwareId && !isRevoked && (
                            <button
                              onClick={() => setConfirmModal({ isOpen: true, type: 'reset', license })}
                              disabled={actionInProgress === `reset-${license.id}`}
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              title="Unbind machine hardware ID (allow re-activation on new laptop)"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}

                          {/* Kill Switch (Revoke) Button */}
                          {!isRevoked && (
                            <button
                              onClick={() => setConfirmModal({ isOpen: true, type: 'revoke', license })}
                              disabled={actionInProgress === `revoke-${license.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400 text-xs font-semibold border border-red-200 dark:border-red-900/50 transition-colors disabled:opacity-50"
                              title="Kill switch: Revoke software access immediately"
                            >
                              Revoke Access
                            </button>
                          )}

                          {/* Delete License */}
                          <button
                            onClick={() => setConfirmModal({ isOpen: true, type: 'delete', license })}
                            disabled={actionInProgress === `delete-${license.id}`}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="Delete license record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* In-Page Confirmation Modal (Custom React Component, No Browser Native Flash) */}
      {confirmModal.isOpen && confirmModal.license && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${
                confirmModal.type === 'revoke' || confirmModal.type === 'delete'
                  ? 'bg-red-100 dark:bg-red-950/50 text-red-600'
                  : confirmModal.type === 'reactivate'
                  ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600'
                  : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600'
              }`}>
                {confirmModal.type === 'revoke' && <Power className="h-6 w-6" />}
                {confirmModal.type === 'reactivate' && <PlayCircle className="h-6 w-6" />}
                {confirmModal.type === 'reset' && <RotateCcw className="h-6 w-6" />}
                {confirmModal.type === 'delete' && <Trash2 className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {confirmModal.type === 'revoke' && 'Execute Kill Switch?'}
                  {confirmModal.type === 'reactivate' && 'Reactivate License?'}
                  {confirmModal.type === 'reset' && 'Reset Hardware Binding?'}
                  {confirmModal.type === 'delete' && 'Delete License Record?'}
                </h3>
                <p className="text-xs text-gray-500">
                  Target: <span className="font-semibold text-gray-800 dark:text-gray-200">{confirmModal.license.assignedTo}</span>
                </p>
              </div>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-300">
              {confirmModal.type === 'revoke' && (
                <p>
                  This will <strong>instantly revoke</strong> this license. The user’s backend application will fail verification and refuse to start.
                </p>
              )}
              {confirmModal.type === 'reactivate' && (
                <p>
                  This will restore access for <strong>{confirmModal.license.assignedTo}</strong>, allowing their machine to boot the backend again.
                </p>
              )}
              {confirmModal.type === 'reset' && (
                <p>
                  This will unbind the current hardware ID, allowing the user to migrate their license to a new laptop or device.
                </p>
              )}
              {confirmModal.type === 'delete' && (
                <p>
                  This will permanently delete this license key from your system. This action cannot be undone.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, type: 'revoke', license: null })}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedAction}
                className={`px-4 py-2 rounded-xl text-white font-semibold shadow-md transition-all ${
                  confirmModal.type === 'revoke' || confirmModal.type === 'delete'
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                    : confirmModal.type === 'reactivate'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                }`}
              >
                {confirmModal.type === 'revoke' && 'Revoke Access'}
                {confirmModal.type === 'reactivate' && 'Confirm Reactivation'}
                {confirmModal.type === 'reset' && 'Reset Hardware'}
                {confirmModal.type === 'delete' && 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

