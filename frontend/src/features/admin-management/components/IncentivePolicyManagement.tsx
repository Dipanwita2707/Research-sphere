'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Award,
  Coins,
  Users,
  FileText,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { incentivePolicyService, IncentivePolicy } from '@/features/admin-management/services/incentivePolicy.service';
import PolicyCycleField, { PolicyPeriod, defaultPolicyDates } from './PolicyCycleField';
import { useCycles } from '@/features/finance/budget/useBudget';

const IPR_TYPES = [
  { value: 'patent', label: 'Patent', icon: '📜' },
  { value: 'copyright', label: 'Copyright', icon: '©️' },
  { value: 'trademark', label: 'Trademark', icon: '™️' },
  { value: 'design', label: 'Design', icon: '🎨' },
];

const SPLIT_POLICIES = [
  { value: 'equal', label: 'Equal Split', description: 'Divide equally among all inventors' },
  { value: 'primary_inventor', label: 'Primary Inventor Priority', description: 'Primary inventor gets larger share' },
  { value: 'weighted', label: 'Weighted by Contribution', description: 'Based on contribution percentage' },
];

const FILING_TYPES = ['provisional', 'complete'];
const PROJECT_TYPES = ['phd', 'pg_project', 'ug_project', 'faculty_research', 'industry_collaboration', 'any_other'];

export default function IncentivePolicyManagement() {
  const { confirmDelete } = useConfirm();
  const [policies, setPolicies] = useState<IncentivePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<IncentivePolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const cyclesQ = useCycles();
  const today = new Date().toISOString().slice(0, 10);

  // Form state
  const [formData, setFormData] = useState({
    iprType: 'patent',
    policyName: '',
    baseIncentiveAmount: 50000,
    basePoints: 50,
    splitPolicy: 'equal' as 'equal' | 'weighted' | 'primary_inventor',
    primaryInventorShare: 50,
    filingTypeMultiplier: { provisional: 0.5, complete: 1.0 } as Record<string, number>,
    projectTypeBonus: { phd: 10000, faculty_research: 5000 } as Record<string, number>,
    isActive: true,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const data = await incentivePolicyService.getAllPolicies(true);
      setPolicies(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (policy?: IncentivePolicy, iprType?: string) => {
    if (policy) {
      setEditingPolicy(policy);
      setFormData({
        iprType: policy.iprType,
        policyName: policy.policyName,
        baseIncentiveAmount: Number(policy.baseIncentiveAmount),
        basePoints: policy.basePoints,
        splitPolicy: policy.splitPolicy,
        primaryInventorShare: policy.primaryInventorShare ? Number(policy.primaryInventorShare) : 50,
        filingTypeMultiplier: policy.filingTypeMultiplier || { provisional: 0.5, complete: 1.0 },
        projectTypeBonus: policy.projectTypeBonus || {},
        isActive: policy.isActive,
        effectiveFrom: policy.effectiveFrom ? new Date(policy.effectiveFrom).toISOString().split('T')[0] : today,
        effectiveTo: policy.effectiveTo ? new Date(policy.effectiveTo).toISOString().split('T')[0] : '',
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        iprType: iprType || 'patent',
        policyName: '',
        baseIncentiveAmount: 50000,
        basePoints: 50,
        splitPolicy: 'equal',
        primaryInventorShare: 50,
        filingTypeMultiplier: { provisional: 0.5, complete: 1.0 } as Record<string, number>,
        projectTypeBonus: {} as Record<string, number>,
        isActive: true,
        ...defaultPolicyDates(cyclesQ.data?.cycles),
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      if (!formData.policyName.trim()) {
        setError('Please provide a policy name');
        return;
      }
      if (!formData.effectiveFrom) {
        setError('Please choose when the policy takes effect');
        return;
      }

      // Only the base amount and points are paid (split equally); never send other knobs.
      const { primaryInventorShare: _share, filingTypeMultiplier: _mult, projectTypeBonus: _bonus, ...rest } = formData;
      const policyData = { ...rest, effectiveTo: rest.effectiveTo || undefined, splitPolicy: 'equal' as const };

      if (editingPolicy) {
        await incentivePolicyService.updatePolicy(editingPolicy.id, policyData);
        setSuccess('Policy updated successfully');
      } else {
        await incentivePolicyService.createPolicy(policyData);
        setSuccess('Policy created successfully');
      }

      setShowModal(false);
      fetchPolicies();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (policy: IncentivePolicy) => {
    const confirmed = await confirmDelete('Delete Policy', `Are you sure you want to delete "${policy.policyName}"?`);
    if (!confirmed) return;

    try {
      await incentivePolicyService.deletePolicy(policy.id);
      setSuccess('Policy deleted successfully');
      fetchPolicies();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete policy');
    }
  };

  const getIprTypeInfo = (type: string) => {
    return IPR_TYPES.find(t => t.value ===
   type) || { value: type, label: type, icon: '📄' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-gray-500 mt-3">Loading policies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="w-7 h-7 text-blue-600" />
            IPR Incentive Policies
          </h1>
          <p className="text-gray-500 mt-1">
            Configure incentive amounts and distribution policies for IPR applications
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Policy
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Policy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {IPR_TYPES.map(iprType => {
          const enabled = policies.filter(p => p.iprType === iprType.value && p.isActive);
          const activePolicy = enabled.find(p => (p.effectiveFrom || '').slice(0, 10) <= today
            && (!p.effectiveTo || p.effectiveTo.slice(0, 10) >= today)) || enabled[0];
          const inactivePolicies = policies.filter(p => p.iprType ===
   iprType.value && !p.isActive);

          return (
            <div key={iprType.value} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{iprType.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{iprType.label}</h3>
                      <p className="text-xs text-gray-500">
                        {activePolicy ? 'Active policy configured' : 'Using default values'}
                      </p>
                    </div>
                  </div>
                  {!activePolicy && (
                    <button
                      onClick={() => handleOpenModal(undefined, iprType.value)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Add Policy
                    </button>
                  )}
                </div>
              </div>

              {/* Active Policy */}
              {activePolicy ? (
                <div className="p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{activePolicy.policyName}</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                      Active
                    </span>
                  </div>
                  <div className="mb-4">
                    <PolicyPeriod effectiveFrom={activePolicy.effectiveFrom} effectiveTo={activePolicy.effectiveTo} />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <div className="flex items-center gap-2 text-amber-700 mb-1">
                        <Coins className="w-4 h-4" />
                        <span className="text-xs font-medium">Base Incentive</span>
                      </div>
                      <p className="text-xl font-bold text-amber-800">
                        ₹{Number(activePolicy.baseIncentiveAmount).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                      <div className="flex items-center gap-2 text-purple-700 mb-1">
                        <Award className="w-4 h-4" />
                        <span className="text-xs font-medium">Base Points</span>
                      </div>
                      <p className="text-xl font-bold text-purple-800">
                        {activePolicy.basePoints} pts
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <Users className="w-4 h-4" />
                    <span>
                      Split: {SPLIT_POLICIES.find(s => s.value ===
   activePolicy.splitPolicy)?.label || activePolicy.splitPolicy}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleOpenModal(activePolicy)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(activePolicy)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5 text-center">
                  <div className="text-gray-400 mb-3">
                    <FileText className="w-10 h-10 mx-auto opacity-50" />
                  </div>
                  <p className="text-sm text-gray-500 mb-2">No custom policy</p>
                  <p className="text-xs text-gray-400">
                    Using defaults: ₹{iprType.value ===
   'patent' ? '50,000' : iprType.value ===
   'design' ? '20,000' : iprType.value ===
   'copyright' ? '15,000' : '10,000'} / {iprType.value ===
   'patent' ? '50' : iprType.value ===
   'design' ? '25' : iprType.value ===
   'copyright' ? '20' : '15'} pts
                  </p>
                </div>
              )}

              {/* Inactive Policies */}
              {inactivePolicies.length > 0 && (
                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                  <p className="text-xs text-gray-500 mb-2">{inactivePolicies.length} inactive polic{inactivePolicies.length > 1 ? 'ies' : 'y'}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingPolicy ? 'Edit Policy' : 'Create New Policy'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* IPR Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">IPR Type</label>
                <select
                  value={formData.iprType}
                  onChange={(e) => setFormData({ ...formData, iprType: e.target.value })}
                  disabled={!!editingPolicy}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  {IPR_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
                  ))}
                </select>
              </div>

              {/* Policy Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Policy Name</label>
                <input
                  type="text"
                  value={formData.policyName}
                  onChange={(e) => setFormData({ ...formData, policyName: e.target.value })}
                  placeholder="e.g., Standard Patent Incentive 2025"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Base Values */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Base Incentive (₹)</label>
                  <input
                    type="number"
                    value={formData.baseIncentiveAmount}
                    onChange={(e) => setFormData({ ...formData, baseIncentiveAmount: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Base Points</label>
                  <input
                    type="number"
                    value={formData.basePoints}
                    onChange={(e) => setFormData({ ...formData, basePoints: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Distribution: publication pays only the amount above, split equally */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-medium text-gray-900">Distribution: equal split</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  On publication, exactly the base amount and points above are divided equally among the internal inventors. No multipliers or bonuses are added.
                </p>
              </div>

              {/* Cycle and effective dates */}
              <PolicyCycleField
                value={{ effectiveFrom: formData.effectiveFrom, effectiveTo: formData.effectiveTo }}
                onChange={(d) => setFormData({ ...formData, ...d })}
              />

              {/* Active Status */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Set as active policy for this IPR type
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingPolicy ? 'Update Policy' : 'Create Policy'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
