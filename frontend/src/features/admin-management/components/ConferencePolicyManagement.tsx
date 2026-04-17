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
  Mic,
  Calendar,
  Info,
  Globe,
  Trophy,
} from 'lucide-react';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { 
  conferencePolicyService, 
  ConferenceIncentivePolicy, 
  ConferenceSubType,
  CONFERENCE_SUB_TYPES,
  QuartileIncentive,
  RolePercentage
} from '@/features/admin-management/services/conferencePolicy.service';

// Only First Author and Corresponding Author percentages are defined
// Co-Author percentage is automatically calculated as remainder
const AUTHOR_ROLES = [
  { value: 'first_author', label: 'First Author', defaultPercentage: 35 },
  { value: 'corresponding_author', label: 'Corresponding Author', defaultPercentage: 30 },
];

const DEFAULT_QUARTILE_INCENTIVES: QuartileIncentive[] = [
  { quartile: 'Top 1%', incentiveAmount: 60000, points: 60 },
  { quartile: 'Top 5%', incentiveAmount: 50000, points: 50 },
  { quartile: 'Q1', incentiveAmount: 40000, points: 40 },
  { quartile: 'Q2', incentiveAmount: 25000, points: 25 },
  { quartile: 'Q3', incentiveAmount: 12000, points: 12 },
  { quartile: 'Q4', incentiveAmount: 5000, points: 5 },
];

const DEFAULT_ROLE_PERCENTAGES: RolePercentage[] = [
  { role: 'first_author', percentage: 35 },
  { role: 'corresponding_author', percentage: 30 },
];

const DEFAULT_FLAT_INCENTIVES: Record<string, { incentiveAmount: number; points: number }> = {
  'paper_not_indexed': { incentiveAmount: 15000, points: 15 },
  'keynote_speaker_invited_talks': { incentiveAmount: 20000, points: 20 },
  'organizer_coordinator_member': { incentiveAmount: 10000, points: 10 },
};

interface FormData {
  policyName: string;
  conferenceSubType: ConferenceSubType;
  quartileIncentives: QuartileIncentive[];
  rolePercentages: RolePercentage[];
  flatIncentiveAmount: number;
  flatPoints: number;
  splitPolicy: 'equal' | 'percentage_based';
  internationalBonus: number;
  bestPaperAwardBonus: number;
  effectiveFrom: string;
  effectiveTo: string;
}

export default function ConferencePolicyManagement() {
  const { confirmDelete } = useConfirm();
  const [policies, setPolicies] = useState<ConferenceIncentivePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<ConferenceIncentivePolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState<FormData>({
    policyName: '',
    conferenceSubType: 'paper_indexed_scopus',
    quartileIncentives: [...DEFAULT_QUARTILE_INCENTIVES],
    rolePercentages: [...DEFAULT_ROLE_PERCENTAGES],
    flatIncentiveAmount: 15000,
    flatPoints: 15,
    splitPolicy: 'percentage_based',
    internationalBonus: 5000,
    bestPaperAwardBonus: 5000,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const data = await conferencePolicyService.getAllPolicies();
      setPolicies(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (policy?: ConferenceIncentivePolicy) => {
    if (policy) {
      setEditingPolicy(policy);
      const isScopus = policy.conferenceSubType ===
   'paper_indexed_scopus';
      setFormData({
        policyName: policy.policyName,
        conferenceSubType: policy.conferenceSubType,
        quartileIncentives: policy.quartileIncentives || [...DEFAULT_QUARTILE_INCENTIVES],
        rolePercentages: policy.rolePercentages || [...DEFAULT_ROLE_PERCENTAGES],
        flatIncentiveAmount: Number(policy.flatIncentiveAmount) || DEFAULT_FLAT_INCENTIVES[policy.conferenceSubType]?.incentiveAmount || 15000,
        flatPoints: policy.flatPoints || DEFAULT_FLAT_INCENTIVES[policy.conferenceSubType]?.points || 15,
        splitPolicy: (policy.splitPolicy as 'equal' | 'percentage_based') || (isScopus ? 'percentage_based' : 'equal'),
        internationalBonus: Number(policy.internationalBonus) || 5000,
        bestPaperAwardBonus: Number(policy.bestPaperAwardBonus) || 5000,
        effectiveFrom: policy.effectiveFrom ? new Date(policy.effectiveFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        effectiveTo: policy.effectiveTo ? new Date(policy.effectiveTo).toISOString().split('T')[0] : '',
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        policyName: '',
        conferenceSubType: 'paper_indexed_scopus',
        quartileIncentives: [...DEFAULT_QUARTILE_INCENTIVES],
        rolePercentages: [...DEFAULT_ROLE_PERCENTAGES],
        flatIncentiveAmount: 15000,
        flatPoints: 15,
        splitPolicy: 'percentage_based',
        internationalBonus: 5000,
        bestPaperAwardBonus: 5000,
        effectiveFrom: new Date().toISOString().split('T')[0],
        effectiveTo: '',
      });
    }
    setShowModal(true);
  };

  const handleSubTypeChange = (subType: ConferenceSubType) => {
    const isScopus = subType ===
   'paper_indexed_scopus';
    setFormData({
      ...formData,
      conferenceSubType: subType,
      splitPolicy: isScopus ? 'percentage_based' : 'equal',
      flatIncentiveAmount: DEFAULT_FLAT_INCENTIVES[subType]?.incentiveAmount || 15000,
      flatPoints: DEFAULT_FLAT_INCENTIVES[subType]?.points || 15,
    });
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
        setError('Please provide an effective from date');
        return;
      }

      const isScopus = formData.conferenceSubType ===
   'paper_indexed_scopus';

      // Validate role percentages for Scopus type
      if (isScopus) {
        const firstAuthorPct = formData.rolePercentages.find(rp => rp.role ===
   'first_author')?.percentage || 0;
        const correspondingAuthorPct = formData.rolePercentages.find(rp => rp.role ===
   'corresponding_author')?.percentage || 0;
        const totalDefinedPct = firstAuthorPct + correspondingAuthorPct;
        
        if (totalDefinedPct > 100) {
          setError(`First Author (${firstAuthorPct}%) + Corresponding Author (${correspondingAuthorPct}%) cannot exceed 100%`);
          return;
        }

        if (firstAuthorPct <= 0 || correspondingAuthorPct <= 0) {
          setError('First Author and Corresponding Author percentages must be greater than 0');
          return;
        }
      }

      const policyData = {
        policyName: formData.policyName,
        conferenceSubType: formData.conferenceSubType,
        splitPolicy: formData.splitPolicy,
        internationalBonus: formData.internationalBonus,
        bestPaperAwardBonus: formData.bestPaperAwardBonus,
        effectiveFrom: new Date(formData.effectiveFrom).toISOString(),
        effectiveTo: formData.effectiveTo ? new Date(formData.effectiveTo).toISOString() : null,
        ...(isScopus ? {
          quartileIncentives: formData.quartileIncentives,
          rolePercentages: formData.rolePercentages,
        } : {
          flatIncentiveAmount: formData.flatIncentiveAmount,
          flatPoints: formData.flatPoints,
        }),
      };

      if (editingPolicy) {
        await conferencePolicyService.updatePolicy(editingPolicy.id, policyData);
        setSuccess('Policy updated successfully');
      } else {
        await conferencePolicyService.createPolicy(policyData);
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

  const handleDelete = async (policy: ConferenceIncentivePolicy) => {
    const confirmed = await confirmDelete('Delete Policy', `Are you sure you want to delete "${policy.policyName}"?`);
    if (!confirmed) return;

    try {
      await conferencePolicyService.deletePolicy(policy.id);
      setSuccess('Policy deleted successfully');
      fetchPolicies();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete policy');
    }
  };

  const getSubTypeInfo = (subType: string) => {
    return CONFERENCE_SUB_TYPES.find((t: any) => t.value ===
   subType) || { value: subType, label: subType, description: '' };
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount ===
   undefined) return '₹0';
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
          <p className="text-gray-500 mt-3">Loading policies...</p>
        </div>
      </div>
    );
  }

  const isScopus = formData.conferenceSubType ===
   'paper_indexed_scopus';
  const coAuthorPct = 100 - 
    (formData.rolePercentages.find(rp => rp.role ===
   'first_author')?.percentage || 0) - 
    (formData.rolePercentages.find(rp => rp.role ===
   'corresponding_author')?.percentage || 0);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Mic className="w-7 h-7 text-purple-600" />
            Conference Incentive Policies
          </h1>
          <p className="text-gray-500 mt-1">
            Configure incentive policies for 4 conference sub-types
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Policy
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-purple-800">
          <p className="font-semibold mb-1">Conference Policy Types:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Paper in Conference indexed in Scopus:</strong> Uses quartile-based incentives (similar to research papers)</li>
            <li><strong>Papers not Indexed / Seminars / Workshops:</strong> Flat incentive amount</li>
            <li><strong>Keynote Speaker / Session Chair / Invited Talks:</strong> Flat incentive amount</li>
            <li><strong>Organizer / Coordinator / Member:</strong> Flat incentive amount</li>
          </ul>
          <p className="font-semibold mt-2 mb-1">Bonuses:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>International Bonus:</strong> Added for international conferences</li>
            <li><strong>Best Paper Award Bonus:</strong> Added when best paper award is received</li>
          </ul>
        </div>
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

      {/* Policies List */}
      <div className="space-y-4">
        {policies.length ===
   0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <Mic className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No conference policies configured yet.</p>
            <button
              onClick={() => handleOpenModal()}
              className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
            >
              Create your first policy
            </button>
          </div>
        ) : (
          policies.map((policy) => {
            const subTypeInfo = getSubTypeInfo(policy.conferenceSubType);
            const isScopusPolicy = policy.conferenceSubType ===
   'paper_indexed_scopus';
            
            return (
              <div
                key={policy.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                        <Mic className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{policy.policyName}</h3>
                        <p className="text-sm text-purple-600 font-medium">{subTypeInfo.label}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(policy.effectiveFrom)} - {policy.effectiveTo ? formatDate(policy.effectiveTo) : 'Ongoing'}
                          </span>
                          {policy.isActive && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenModal(policy)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Policy"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(policy)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Policy"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Policy Details */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {isScopusPolicy ? (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Quartile Incentives:</p>
                        <div className="grid grid-cols-6 gap-2">
                          {(policy.quartileIncentives || []).map((q: any) => (
                            <div key={q.quartile} className="text-center p-2 bg-gray-50 rounded-lg">
                              <div className="text-xs font-medium text-gray-500">{q.quartile}</div>
                              <div className="text-sm font-semibold text-gray-900">{formatCurrency(q.incentiveAmount)}</div>
                              <div className="text-xs text-gray-500">{q.points} pts</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-gray-600">Incentive:</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(policy.flatIncentiveAmount)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-600">Points:</span>
                          <span className="font-semibold text-gray-900">{policy.flatPoints}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-6 mt-3">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-purple-600" />
                        <span className="text-sm text-gray-600">International Bonus:</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(policy.internationalBonus)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-600" />
                        <span className="text-sm text-gray-600">Best Paper Award:</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(policy.bestPaperAwardBonus)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPolicy ? 'Edit Conference Policy' : 'New Conference Policy'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Policy Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Policy Name *
                </label>
                <input
                  type="text"
                  value={formData.policyName}
                  onChange={(e) => setFormData({ ...formData, policyName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., Conference Scopus Policy 2024"
                />
              </div>

              {/* Conference Sub-Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Conference Sub-Type *
                </label>
                <select
                  value={formData.conferenceSubType}
                  onChange={(e) => handleSubTypeChange(e.target.value as ConferenceSubType)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  disabled={!!editingPolicy}
                >
                  {CONFERENCE_SUB_TYPES.map((type: any) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  {getSubTypeInfo(formData.conferenceSubType).description}
                </p>
              </div>

              {/* Quartile Incentives (for Scopus type) */}
              {isScopus && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Quartile-Based Incentives *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {formData.quartileIncentives.map((qi, index) => (
                      <div key={qi.quartile} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="w-16 text-center">
                          <span className="text-sm font-semibold text-purple-600">{qi.quartile}</span>
                        </div>
                        <div className="flex-1">
                          <input
                            type="number"
                            value={qi.incentiveAmount}
                            onChange={(e) => {
                              const updated = [...formData.quartileIncentives];
                              updated[index] = { ...qi, incentiveAmount: parseInt(e.target.value) || 0 };
                              setFormData({ ...formData, quartileIncentives: updated });
                            }}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                            placeholder="Amount"
                          />
                        </div>
                        <div className="w-20">
                          <input
                            type="number"
                            value={qi.points}
                            onChange={(e) => {
                              const updated = [...formData.quartileIncentives];
                              updated[index] = { ...qi, points: parseInt(e.target.value) || 0 };
                              setFormData({ ...formData, quartileIncentives: updated });
                            }}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                            placeholder="Points"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Role Percentages (for Scopus type) */}
              {isScopus && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Author Role Percentages
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {AUTHOR_ROLES.map((role) => {
                      const currentRole = formData.rolePercentages.find(rp => rp.role ===
   role.value);
                      return (
                        <div key={role.value} className="flex items-center gap-3">
                          <label className="text-sm text-gray-600 w-40">{role.label}</label>
                          <div className="flex-1 relative">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={currentRole?.percentage || role.defaultPercentage}
                              onChange={(e) => {
                                const newPct = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                const updated = formData.rolePercentages.map(rp =>
                                  rp.role ===
   role.value ? { ...rp, percentage: newPct } : rp
                                );
                                setFormData({ ...formData, rolePercentages: updated });
                              }}
                              className="w-full px-3 py-1.5 pr-8 border border-gray-300 rounded-lg text-sm"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg col-span-2">
                      <label className="text-sm text-gray-600 w-40">Co-Authors (auto)</label>
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-700">{coAuthorPct}%</span>
                        <span className="text-xs text-gray-500 ml-2">(split equally among internal co-authors)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Flat Incentive (for non-Scopus types) */}
              {!isScopus && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Incentive Amount (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.flatIncentiveAmount}
                      onChange={(e) => setFormData({ ...formData, flatIncentiveAmount: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="15000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Points *
                    </label>
                    <input
                      type="number"
                      value={formData.flatPoints}
                      onChange={(e) => setFormData({ ...formData, flatPoints: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="15"
                    />
                  </div>
                </div>
              )}

              {/* Bonuses */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-600" />
                    International Bonus (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.internationalBonus}
                    onChange={(e) => setFormData({ ...formData, internationalBonus: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="5000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-600" />
                    Best Paper Award Bonus (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.bestPaperAwardBonus}
                    onChange={(e) => setFormData({ ...formData, bestPaperAwardBonus: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="5000"
                  />
                </div>
              </div>

              {/* Effective Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Effective To (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {editingPolicy ? 'Update Policy' : 'Create Policy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
