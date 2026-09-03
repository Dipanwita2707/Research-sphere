'use client';

import React, { useEffect, useState } from 'react';
import { superadminService, SaaSTier, SaaSGlobalStats } from '@/shared/services/superadmin.service';
import { 
  CreditCard, 
  DollarSign, 
  Plus, 
  Edit3, 
  Check, 
  Loader2, 
  AlertTriangle, 
  CheckCircle,
  HelpCircle,
  Eye
} from 'lucide-react';

export default function BillingManagement() {
  const [stats, setStats] = useState<SaaSGlobalStats | null>(null);
  const [tiers, setTiers] = useState<SaaSTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Tier Modal Fields
  const [showModal, setShowModal] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [yearlyPrice, setYearlyPrice] = useState(0);
  const [maxUsers, setMaxUsers] = useState(-1);
  const [maxApiCalls, setMaxApiCalls] = useState(-1);
  const [maxStorageGb, setMaxStorageGb] = useState(10);
  const [overageRate, setOverageRate] = useState(10);
  const [isPublic, setIsPublic] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [features, setFeatures] = useState<Record<string, boolean>>({
    audit_logs: true,
    custom_domain: false,
    sso: false
  });

  const fetchData = async () => {
    try {
      const [statsData, tiersData] = await Promise.all([
        superadminService.getGlobalStats(),
        superadminService.getAllTiers()
      ]);
      setStats(statsData);
      setTiers(tiersData);
    } catch (err) {
      setError('Failed to fetch billing insights.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingTierId(null);
    setName('');
    setDisplayName('');
    setMonthlyPrice(0);
    setYearlyPrice(0);
    setMaxUsers(-1);
    setMaxApiCalls(-1);
    setMaxStorageGb(10);
    setOverageRate(10);
    setIsPublic(true);
    setSortOrder(0);
    setFeatures({
      audit_logs: true,
      custom_domain: false,
      sso: false
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (tier: SaaSTier) => {
    setEditingTierId(tier.id);
    setName(tier.name);
    setDisplayName(tier.displayName);
    setMonthlyPrice(tier.monthlyPriceCents / 100);
    setYearlyPrice(tier.yearlyPriceCents / 100);
    setMaxUsers(tier.maxUsers);
    setMaxApiCalls(tier.maxApiCallsPerMonth);
    setMaxStorageGb(tier.maxStorageGb);
    setOverageRate(tier.overagePer1kCalls);
    setIsPublic(tier.isPublic);
    setSortOrder(tier.sortOrder);
    setFeatures(tier.features || {});
    setShowModal(true);
  };

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    const payload = {
      name,
      displayName,
      monthlyPriceCents: Math.round(monthlyPrice * 100),
      yearlyPriceCents: Math.round(yearlyPrice * 100),
      maxUsers,
      maxApiCallsPerMonth: maxApiCalls,
      maxStorageGb,
      overagePer1kCalls: overageRate,
      isPublic,
      sortOrder,
      features
    };

    try {
      if (editingTierId) {
        await superadminService.updateTier(editingTierId, payload);
        setSuccess('Pricing tier updated successfully.');
      } else {
        await superadminService.createTier(payload);
        setSuccess('New pricing tier deployed successfully.');
      }
      setShowModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save tier settings.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-10 w-10 text-red-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400">Loading billing engine stats...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 mb-3">
            <DollarSign className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">SaaS Billing Console</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Billing &amp; Subscriptions</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Configure pricing models and monitor SaaS subscription metrics.</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-[#4A0F26] hover:from-red-700 hover:to-[#3a0c1e] text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-red-600/20 hover:shadow-red-600/30 transition-all text-center justify-center"
        >
          <Plus className="h-4 w-4" />
          Create New Tier
        </button>
      </div>

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl text-emerald-700 dark:text-emerald-400 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 rounded-xl text-red-700 dark:text-red-400 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="relative bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br from-red-100 to-transparent dark:from-red-950/30" />
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-[#4A0F26] flex items-center justify-center shadow-md shadow-red-600/20 mb-4">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">MRR Estimate</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-950 dark:text-white">
                {formatCurrency(stats?.monthlyRecurringRevenueCents || 0)}
              </span>
              <span className="text-sm font-semibold text-gray-400">/ month</span>
            </div>
          </div>
        </div>

        <div className="relative bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-transparent dark:from-emerald-950/30" />
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-md shadow-emerald-600/20 mb-4">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Subscriptions</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-950 dark:text-white">
                {stats?.activeSubscriptions || 0}
              </span>
              <span className="text-sm font-semibold text-gray-400">universities</span>
            </div>
          </div>
        </div>

        <div className="relative bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br from-amber-100 to-transparent dark:from-amber-950/30" />
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-600/20 mb-4">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Average Ticket</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-950 dark:text-white">
                {stats?.activeSubscriptions && stats.activeSubscriptions > 0
                  ? formatCurrency(Math.round(stats.monthlyRecurringRevenueCents / stats.activeSubscriptions))
                  : '₹0'}
              </span>
              <span className="text-sm font-semibold text-gray-400">/ tenant</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Tiers Table */}
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Deployed Pricing Plans</h2>
            <p className="text-xs text-gray-400 mt-0.5">{tiers.length} tier{tiers.length === 1 ? '' : 's'} configured</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
            <CreditCard className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-900/80 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4">Plan Name</th>
                <th className="px-6 py-4">Monthly</th>
                <th className="px-6 py-4">Yearly</th>
                <th className="px-6 py-4">Seats</th>
                <th className="px-6 py-4">API Limit</th>
                <th className="px-6 py-4">Storage</th>
                <th className="px-6 py-4">Overage</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {tiers.map((tier) => (
                <tr key={tier.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-900/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-950 dark:text-white">{tier.displayName}</div>
                    <div className="text-xs text-gray-400 mt-0.5 font-mono">{tier.name}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(tier.monthlyPriceCents)}
                  </td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300 font-medium">
                    {formatCurrency(tier.yearlyPriceCents)}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-medium">
                    {tier.maxUsers === -1 ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" />Unlimited</span> : `${tier.maxUsers}`}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-600 dark:text-gray-400">
                    {tier.maxApiCallsPerMonth === -1 ? 'Unlimited' : `${(tier.maxApiCallsPerMonth / 1000000).toFixed(1)}M / mo`}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-medium">
                    {tier.maxStorageGb} GB
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    ₹{(tier.overagePer1kCalls / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      tier.isPublic
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tier.isPublic ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {tier.isPublic ? 'Public' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleOpenEditModal(tier)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Configure
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configure Tier Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-950 z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-950 dark:text-white">
                  {editingTierId ? 'Configure Pricing Plan' : 'Add Pricing Plan'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Define the quota, rate, and feature set for this tier</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-lg">&times;</button>
            </div>

            <form onSubmit={handleSaveTier} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Internal Slug</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingTierId}
                    placeholder="e.g. enterprise"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Enterprise Tier"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Monthly Rate (INR)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(parseFloat(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Yearly Discounted Rate (INR)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={yearlyPrice}
                    onChange={(e) => setYearlyPrice(parseFloat(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Seat Quota limit</label>
                  <input
                    type="number"
                    required
                    min="-1"
                    placeholder="-1 for unlimited"
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">API Monthly quota (Limit)</label>
                  <input
                    type="number"
                    required
                    min="-1"
                    placeholder="-1 for unlimited"
                    value={maxApiCalls}
                    onChange={(e) => setMaxApiCalls(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Disk Storage Limit (GB)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={maxStorageGb}
                    onChange={(e) => setMaxStorageGb(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Overage Rate (Paisa per 1k calls)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={overageRate}
                    onChange={(e) => setOverageRate(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 outline-none text-sm focus:border-red-600 font-semibold"
                  />
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="space-y-4 border-t border-gray-100 dark:border-gray-850 pt-4">
                <span className="block text-xs font-bold text-gray-400 uppercase">Features Included</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.keys(features).map((feat) => (
                    <label key={feat} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={features[feat]}
                        onChange={(e) => setFeatures({ ...features, [feat]: e.target.checked })}
                        className="h-4 w-4 rounded accent-red-600"
                      />
                      <span className="text-sm font-semibold capitalize text-gray-700 dark:text-gray-300">
                        {feat.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-850 pt-4 mt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-4 w-4 rounded accent-red-600"
                  />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Visible to Public</span>
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-red-600 to-[#4A0F26] hover:from-red-700 hover:to-[#3a0c1e] text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-red-600/20 transition-all flex items-center gap-2 disabled:opacity-60"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Pricing Plan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
