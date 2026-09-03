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
} from 'lucide-react';
import Link from 'next/link';

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
      setSuccessMsg(`Hardware approved for ${license.assignedTo}! Application can now boot.`);
      await fetchLicenses();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to approve hardware.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRevokeLicense = async (license: LicenseRecord) => {
    if (!confirm(`Are you sure you want to execute the KILL SWITCH and revoke access for "${license.assignedTo}"?`)) {
      return;
    }

    setActionInProgress(`revoke-${license.id}`);
    try {
      await superadminService.revokeLicense(license.id);
      setSuccessMsg(`License for "${license.assignedTo}" has been revoked.`);
      await fetchLicenses();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to revoke license.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleResetHardware = async (license: LicenseRecord) => {
    if (!confirm(`Clear hardware binding for "${license.assignedTo}" to allow activation on a new device?`)) {
      return;
    }

    setActionInProgress(`reset-${license.id}`);
    try {
      await superadminService.resetHardware(license.id);
      setSuccessMsg(`Hardware binding reset for "${license.assignedTo}".`);
      await fetchLicenses();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to reset hardware.');
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

        <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Device Approvals</p>
            <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
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
                  Assigned User / Laptop Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Laptop (MacBook Pro / Dell XPS)"
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
                  placeholder="Leave empty to approve on first launch"
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
                placeholder="e.g. Authorized deployment for internal review only"
                value={newLicense.notes || ''}
                onChange={(e) => setNewLicense({ ...newLicense, notes: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-wine/20 focus:border-wine transition-all"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="requiresApproval"
                checked={newLicense.requiresApproval}
                onChange={(e) => setNewLicense({ ...newLicense, requiresApproval: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-wine focus:ring-wine"
              />
              <label htmlFor="requiresApproval" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Require my explicit manual approval before this device can boot the application
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active & Registered Licenses</h2>
          <span className="text-xs font-medium text-gray-500">Total: {licenses.length}</span>
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
                  <th className="px-6 py-4">Bound Hardware</th>
                  <th className="px-6 py-4">Security Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {licenses.map((license) => {
                  const isRevoked = !license.isActive;
                  const isPending = license.status === 'PENDING_APPROVAL' || Boolean(license.pendingHardwareId && !license.hardwareId);

                  return (
                    <tr key={license.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
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
                          <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md w-fit">
                            <Cpu className="h-3.5 w-3.5" />
                            <span>{license.hardwareId}</span>
                          </div>
                        ) : license.pendingHardwareId ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-xs font-mono text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-md w-fit">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Req: {license.pendingHardwareId}</span>
                            </div>
                            <span className="text-[11px] text-amber-600 font-medium">Awaiting your approval</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No device connected yet</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {isRevoked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400">
                            <XCircle className="h-3.5 w-3.5" />
                            REVOKED
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 animate-pulse">
                            <Clock className="h-3.5 w-3.5" />
                            PENDING APPROVAL
                          </span>
                        ) : license.hardwareId ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            ACTIVE & LOCKED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
                            READY FOR SETUP
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Approve Device Button */}
                          {isPending && (
                            <button
                              onClick={() => handleApproveHardware(license)}
                              disabled={actionInProgress === `approve-${license.id}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                            >
                              {actionInProgress === `approve-${license.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              <span>Approve Device</span>
                            </button>
                          )}

                          {/* Reset Hardware Binding Button */}
                          {license.hardwareId && !isRevoked && (
                            <button
                              onClick={() => handleResetHardware(license)}
                              disabled={actionInProgress === `reset-${license.id}`}
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              title="Reset hardware binding"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}

                          {/* Kill Switch (Revoke) Button */}
                          {!isRevoked && (
                            <button
                              onClick={() => handleRevokeLicense(license)}
                              disabled={actionInProgress === `revoke-${license.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400 text-xs font-semibold border border-red-200 dark:border-red-900/50 transition-colors"
                              title="Kill switch: Revoke software access immediately"
                            >
                              Revoke Access
                            </button>
                          )}
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
    </div>
  );
}
