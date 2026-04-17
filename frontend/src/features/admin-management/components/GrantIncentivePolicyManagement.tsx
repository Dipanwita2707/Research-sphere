'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  DollarSign,
  Award,
  Coins,
  Users,
  FileText,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Globe,
  Building2,
  Briefcase,
} from 'lucide-react';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import grantPolicyService from '@/features/research-management/services/grantPolicy.service';

// Define types
interface RolePercentage {
  role: string;
  percentage: number;
}

interface GrantIncentivePolicy {
  id: string;
  policyName: string;
  projectCategory: 'govt' | 'non_govt' | 'industry';
  projectType: 'indian' | 'international';
  baseIncentiveAmount: number;
  basePoints: number;
  splitPolicy: 'equal' | 'percentage_based';
  rolePercentages?: RolePercentage[];
  fundingAmountMultiplier?: any;
  internationalBonus?: number;
  consortiumBonus?: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
}

const PROJECT_CATEGORIES = [
  { value: 'govt', label: 'Government Funded' },
  { value: 'non_govt', label: 'Non-Government Funded' },
  { value: 'industry', label: 'Industry Funded' },
];

const PROJECT_TYPES = [
  { value: 'indian', label: 'Indian (Domestic)' },
  { value: 'international', label: 'International' },
];

const ROLE_OPTIONS = [
  { value: 'pi', label: 'Principal Investigator (PI)', defaultPercentage: 50 },
  { value: 'co_pi', label: 'Co-Principal Investigator (Co-PI)', defaultPercentage: 50 },
];

const DEFAULT_ROLE_PERCENTAGES: RolePercentage[] = [
  { role: 'pi', percentage: 50 },
  { role: 'co_pi', percentage: 50 },
];

interface FormData {
  policyName: string;
  projectCategory: 'govt' | 'non_govt' | 'industry';
  projectType: 'indian' | 'international';
  baseIncentiveAmount: number;
  basePoints: number;
  splitPolicy: 'equal' | 'percentage_based';
  rolePercentages: RolePercentage[];
  internationalBonus: number;
  consortiumBonus: number;
  effectiveFrom: string;
  effectiveTo: string;
}

export default function GrantIncentivePolicyManagement() {
  const { confirmDelete } = useConfirm();
  const [policies, setPolicies] = useState<GrantIncentivePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<GrantIncentivePolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState<FormData>({
    policyName: '',
    projectCategory: 'govt',
    projectType: 'indian',
    baseIncentiveAmount: 25000,
    basePoints: 25,
    splitPolicy: 'percentage_based',
    rolePercentages: [...DEFAULT_ROLE_PERCENTAGES],
    internationalBonus: 10000,
    consortiumBonus: 5000,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const data = await grantPolicyService.getAllPolicies();
      setPolicies(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (policy?: GrantIncentivePolicy) => {
    if (policy) {
      setEditingPolicy(policy);
      setFormData({
        policyName: policy.policyName,
        projectCategory: policy.projectCategory,
        projectType: policy.projectType,
        baseIncentiveAmount: Number(policy.baseIncentiveAmount),
        basePoints: policy.basePoints,
        splitPolicy: policy.splitPolicy,
        rolePercentages: policy.rolePercentages || [...DEFAULT_ROLE_PERCENTAGES],
        internationalBonus: Number(policy.internationalBonus) || 10000,
        consortiumBonus: Number(policy.consortiumBonus) || 5000,
        effectiveFrom: policy.effectiveFrom ? new Date(policy.effectiveFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        effectiveTo: policy.effectiveTo ? new Date(policy.effectiveTo).toISOString().split('T')[0] : '',
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        policyName: '',
        projectCategory: 'govt',
        projectType: 'indian',
        baseIncentiveAmount: 25000,
        basePoints: 25,
        splitPolicy: 'percentage_based',
        rolePercentages: [...DEFAULT_ROLE_PERCENTAGES],
        internationalBonus: 10000,
        consortiumBonus: 5000,
        effectiveFrom: new Date().toISOString().split('T')[0],
        effectiveTo: '',
      });
    }
    setShowModal(true);
  };

  const handleRolePercentageChange = (role: string, percentage: number) => {
    // Prevent negative values and cap at 100
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;
    
    // Automatically adjust the other role to maintain 100% total
    setFormData(prev => ({
      ...prev,
      rolePercentages: prev.rolePercentages.map(rp => {
        if (rp.role ===
   role) {
          return { ...rp, percentage };
        } else {
          // Adjust other role to maintain 100% total
          return { ...rp, percentage: 100 - percentage };
        }
      }),
    }));
  };

  const calculateTotalPercentage = () => {
    return formData.rolePercentages.reduce((sum, rp) => sum + rp.percentage, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.policyName.trim()) {
      setError('Policy name is required');
      return;
    }

    if (formData.splitPolicy ===
   'percentage_based' && calculateTotalPercentage() !== 100) {
      setError('Role percentages must total 100%');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingPolicy) {
        await grantPolicyService.updatePolicy(editingPolicy.id, formData);
        setSuccess('Policy updated successfully');
      } else {
        await grantPolicyService.createPolicy(formData);
        setSuccess('Policy created successfully');
      }
      
      setShowModal(false);
      fetchPolicies();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDelete('Delete Policy', 'Are you sure you want to delete this policy?');
    if (!confirmed) return;

    try {
      await grantPolicyService.deletePolicy(id);
      setSuccess('Policy deleted successfully');
      fetchPolicies();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete policy');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <RefreshCw className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-2xl p-6 shadow-xl mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-10 h-10 text-white" />
            <div>
              <h1 className="text-2xl font-bold text-white">Grant Incentive Policies</h1>
              <p className="text-orange-100 text-sm">Manage grant and funding incentive policies</p>
            </div>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-white text-orange-600 px-4 py-2 rounded-xl hover:bg-orange-50 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            New Policy
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-700">{success}</p>
          <button onClick={() => setSuccess('')} className="ml-auto">
            <X className="w-4 h-4 text-green-600" />
          </button>
        </div>
      )}

      {/* Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {policies.length ===
   0 ? (
          <div className="col-span-full text-center py-12">
            <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No grant policies found</p>
            <p className="text-gray-400 text-sm">Create your first grant incentive policy</p>
          </div>
        ) : (
          policies.map((policy) => (
            <div key={policy.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 mb-1">{policy.policyName}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        policy.projectCategory ===
   'govt' ? 'bg-blue-100 text-blue-700' :
                        policy.projectCategory ===
   'non_govt' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        <Building2 className="w-3 h-3" />
                        {PROJECT_CATEGORIES.find(c => c.value ===
   policy.projectCategory)?.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        policy.projectType ===
   'international' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        <Globe className="w-3 h-3" />
                        {PROJECT_TYPES.find(t => t.value ===
   policy.projectType)?.label}
                      </span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    policy.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {policy.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-orange-600" />
                      <span className="text-sm font-medium text-gray-700">Base Amount</span>
                    </div>
                    <span className="font-bold text-orange-600">₹{Number(policy.baseIncentiveAmount).toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">Base Points</span>
                    </div>
                    <span className="font-bold text-blue-600">{policy.basePoints} pts</span>
                  </div>

                  {policy.splitPolicy && (
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700">Split Policy</span>
                      </div>
                      <span className="text-xs font-medium text-purple-600">{policy.splitPolicy ===
   'equal' ? 'Equal' : 'Percentage-based'}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => handleOpenModal(policy)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(policy.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-orange-700 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-8 h-8 text-white" />
                  <h2 className="text-2xl font-bold text-white">
                    {editingPolicy ? 'Edit Grant Policy' : 'Create New Grant Policy'}
                  </h2>
                </div>
                <button onClick={() => setShowModal(false)} className="text-white hover:bg-orange-600 p-2 rounded-lg transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Policy Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Policy Name *
                </label>
                <input
                  type="text"
                  value={formData.policyName}
                  onChange={(e) => setFormData({ ...formData, policyName: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., Government Grant Incentive Policy 2024"
                  required
                />
              </div>

              {/* Project Category & Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Category *
                  </label>
                  <select
                    value={formData.projectCategory}
                    onChange={(e) => setFormData({ ...formData, projectCategory: e.target.value as any })}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    {PROJECT_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Type *
                  </label>
                  <select
                    value={formData.projectType}
                    onChange={(e) => setFormData({ ...formData, projectType: e.target.value as any })}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    {PROJECT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Base Incentive Amount & Points */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base Incentive Amount (₹) *
                  </label>
                  <input
                    type="number"
                    value={formData.baseIncentiveAmount}
                    onChange={(e) => setFormData({ ...formData, baseIncentiveAmount: Number(e.target.value) })}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="0"
                    step="1000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base Points *
                  </label>
                  <input
                    type="number"
                    value={formData.basePoints}
                    onChange={(e) => setFormData({ ...formData, basePoints: Number(e.target.value) })}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="0"
                    required
                  />
                </div>
              </div>

              {/* Split Policy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Incentive Split Policy *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="equal"
                      checked={formData.splitPolicy ===
   'equal'}
                      onChange={(e) => setFormData({ ...formData, splitPolicy: 'equal' })}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>Equal Split</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="percentage_based"
                      checked={formData.splitPolicy ===
   'percentage_based'}
                      onChange={(e) => setFormData({ ...formData, splitPolicy: 'percentage_based' })}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>Percentage-based</span>
                  </label>
                </div>
              </div>

              {/* Role Percentages */}
              {formData.splitPolicy ===
   'percentage_based' && (
                <div className="border border-gray-200 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-600" />
                    Role-based Percentage Distribution
                  </h3>
                  <div className="space-y-3">
                    {ROLE_OPTIONS.map((role) => (
                      <div key={role.value} className="flex items-center gap-4">
                        <label className="flex-1 text-sm font-medium text-gray-700">{role.label}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={formData.rolePercentages.find(rp => rp.role ===
   role.value)?.percentage || 0}
                            onChange={(e) => handleRolePercentageChange(role.value, Number(e.target.value))}
                            className="w-20 p-2 border border-gray-300 rounded-lg text-center"
                            min="0"
                            max="100"
                          />
                          <span className="text-gray-600">%</span>
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t flex items-center justify-between">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className={`font-bold text-lg ${calculateTotalPercentage() ===
   100 ? 'text-green-600' : 'text-red-600'}`}>
                        {calculateTotalPercentage()}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bonuses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    International Project Bonus (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.internationalBonus}
                    onChange={(e) => setFormData({ ...formData, internationalBonus: Number(e.target.value) })}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="0"
                    step="1000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Consortium Project Bonus (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.consortiumBonus}
                    onChange={(e) => setFormData({ ...formData, consortiumBonus: Number(e.target.value) })}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="0"
                    step="1000"
                  />
                </div>
              </div>

              {/* Effective Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
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
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {editingPolicy ? 'Update Policy' : 'Create Policy'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
