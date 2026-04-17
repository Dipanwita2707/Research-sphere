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
  BookOpen,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  Info,
} from 'lucide-react';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import api from '@/shared/api/api';

interface BookIncentivePolicy {
  id: string;
  publicationType: 'book' | 'book_chapter';
  policyName: string;
  authoredIncentiveAmount: number;
  authoredPoints: number;
  editedIncentiveAmount: number;
  editedPoints: number;
  splitPolicy: string;
  indexingBonuses: {
    scopus_indexed: number;
    non_indexed: number;
    sgt_publication_house: number;
  };
  internationalBonus: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
}

const PUBLICATION_TYPES = [
  { value: 'book', label: 'Book', icon: '📚' },
  { value: 'book_chapter', label: 'Book Chapter', icon: '📖' },
];

const SPLIT_POLICIES = [
  { value: 'equal', label: 'Equal Split', description: 'Divide incentive equally among all authors' },
  { value: 'weighted', label: 'Weighted Split', description: 'Apply custom weights per author' },
];

export default function BookChapterPolicyManagement() {
  const { confirmDelete } = useConfirm();
  const [policies, setPolicies] = useState<BookIncentivePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<BookIncentivePolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState<{
    publicationType: 'book' | 'book_chapter';
    policyName: string;
    authoredIncentiveAmount: string;
    authoredPoints: string;
    editedIncentiveAmount: string;
    editedPoints: string;
    splitPolicy: string;
    scopusIndexedBonus: string;
    nonIndexedBonus: string;
    sgtPublicationHouseBonus: string;
    internationalBonus: string;
    effectiveFrom: string;
    effectiveTo: string;
  }>({
    publicationType: 'book',
    policyName: '',
    authoredIncentiveAmount: '30000',
    authoredPoints: '30',
    editedIncentiveAmount: '25000',
    editedPoints: '25',
    splitPolicy: 'equal',
    scopusIndexedBonus: '5000',
    nonIndexedBonus: '0',
    sgtPublicationHouseBonus: '1000',
    internationalBonus: '3000',
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const response = await api.get('/book-chapter-policies');
      setPolicies(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (policy?: BookIncentivePolicy) => {
    if (policy) {
      setEditingPolicy(policy);
      setFormData({
        publicationType: 'book_chapter',
        policyName: policy.policyName,
        authoredIncentiveAmount: policy.authoredIncentiveAmount.toString(),
        authoredPoints: policy.authoredPoints.toString(),
        editedIncentiveAmount: policy.editedIncentiveAmount.toString(),
        editedPoints: policy.editedPoints.toString(),
        splitPolicy: policy.splitPolicy,
        scopusIndexedBonus: policy.indexingBonuses.scopus_indexed?.toString() || '0',
        nonIndexedBonus: policy.indexingBonuses.non_indexed?.toString() || '0',
        sgtPublicationHouseBonus: policy.indexingBonuses.sgt_publication_house?.toString() || '0',
        internationalBonus: policy.internationalBonus.toString(),
        effectiveFrom: policy.effectiveFrom ? new Date(policy.effectiveFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        effectiveTo: policy.effectiveTo ? new Date(policy.effectiveTo).toISOString().split('T')[0] : '',
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        publicationType: 'book_chapter',
        policyName: '',
        authoredIncentiveAmount: '30000',
        authoredPoints: '30',
        editedIncentiveAmount: '25000',
        editedPoints: '25',
        splitPolicy: 'equal',
        scopusIndexedBonus: '5000',
        nonIndexedBonus: '0',
        sgtPublicationHouseBonus: '1000',
        internationalBonus: '3000',
        effectiveFrom: new Date().toISOString().split('T')[0],
        effectiveTo: '',
      });
    }
    setShowModal(true);
    setError('');
    setSuccess('');
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

      const payload = {
        policyName: formData.policyName.trim(),
        authoredIncentiveAmount: parseFloat(formData.authoredIncentiveAmount),
        authoredPoints: parseInt(formData.authoredPoints),
        editedIncentiveAmount: parseFloat(formData.editedIncentiveAmount),
        editedPoints: parseInt(formData.editedPoints),
        splitPolicy: formData.splitPolicy,
        indexingBonuses: {
          scopus_indexed: parseFloat(formData.scopusIndexedBonus),
          non_indexed: parseFloat(formData.nonIndexedBonus),
          sgt_publication_house: parseFloat(formData.sgtPublicationHouseBonus),
        },
        internationalBonus: parseFloat(formData.internationalBonus),
        effectiveFrom: formData.effectiveFrom,
        effectiveTo: formData.effectiveTo || null,
      };

      if (editingPolicy) {
        await api.put(`/book-chapter-policies/${editingPolicy.id}`, payload);
        setSuccess('Policy updated successfully');
      } else {
        await api.post('/book-chapter-policies', payload);
        setSuccess('Policy created successfully');
      }

      await fetchPolicies();
      setTimeout(() => {
        setShowModal(false);
        setSuccess('');
      }, 1500);
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
      await api.delete(`/book-chapter-policies/${id}`);
      setSuccess('Policy deleted successfully');
      await fetchPolicies();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete policy');
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-blue-600" />
              Book Chapter Incentive Policies
            </h1>
            <p className="mt-2 text-gray-600">
              Manage incentive structures for book chapter publications
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Policy
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {error && !showModal && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Policies List */}
      <div className="space-y-4">
        {policies.length ===
   0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No policies found</h3>
            <p className="text-gray-600 mb-4">Create your first book chapter incentive policy to get started</p>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Policy
            </button>
          </div>
        ) : (
          policies.map((policy) => (
            <div
              key={policy.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">{policy.policyName}</h3>
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-700">
                      {PUBLICATION_TYPES.find(t => t.value ===
   policy.publicationType)?.label}
                    </span>
                    {policy.isActive && (
                      <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-700">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                    {/* Authored Book */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-700">Authored Book</h4>
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-green-600" />
                        <span className="text-lg font-semibold text-green-600">
                          ₹{policy.authoredIncentiveAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-purple-600" />
                        <span className="text-lg font-semibold text-purple-600">
                          {policy.authoredPoints} points
                        </span>
                      </div>
                    </div>

                    {/* Edited Book */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-700">Edited Book</h4>
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-green-600" />
                        <span className="text-lg font-semibold text-green-600">
                          ₹{policy.editedIncentiveAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-purple-600" />
                        <span className="text-lg font-semibold text-purple-600">
                          {policy.editedPoints} points
                        </span>
                      </div>
                    </div>

                    {/* Bonuses */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-700">Bonuses</h4>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Scopus Indexed:</span>
                          <span className="font-medium">₹{policy.indexingBonuses.scopus_indexed.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">SGT Publication:</span>
                          <span className="font-medium">₹{policy.indexingBonuses.sgt_publication_house.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">International:</span>
                          <span className="font-medium">₹{policy.internationalBonus.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Effective: {new Date(policy.effectiveFrom).toLocaleDateString()}
                    </div>
                    {policy.effectiveTo && (
                      <div>
                        to {new Date(policy.effectiveTo).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleOpenModal(policy)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit policy"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(policy.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete policy"
                  >
                    <Trash2 className="w-5 h-5" />
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
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingPolicy ? 'Edit Policy' : 'Create New Policy'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Basic Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Publication Type *
                    </label>
                    <select
                      value={formData.publicationType}
                      onChange={(e) => setFormData({ ...formData, publicationType: e.target.value as 'book' | 'book_chapter' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!!editingPolicy}
                    >
                      {PUBLICATION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Policy Name *
                    </label>
                    <input
                      type="text"
                      value={formData.policyName}
                      onChange={(e) => setFormData({ ...formData, policyName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., FY 2026 Book Policy"
                    />
                  </div>
                </div>
              </div>

              {/* Authored Book Incentives */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Authored Book Incentives</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Incentive Amount (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.authoredIncentiveAmount}
                      onChange={(e) => setFormData({ ...formData, authoredIncentiveAmount: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      step="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Points *
                    </label>
                    <input
                      type="number"
                      value={formData.authoredPoints}
                      onChange={(e) => setFormData({ ...formData, authoredPoints: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Edited Book Incentives */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Edited Book Incentives</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Incentive Amount (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.editedIncentiveAmount}
                      onChange={(e) => setFormData({ ...formData, editedIncentiveAmount: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      step="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Points *
                    </label>
                    <input
                      type="number"
                      value={formData.editedPoints}
                      onChange={(e) => setFormData({ ...formData, editedPoints: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Split Policy */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Distribution Policy</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Split Policy *
                  </label>
                  <select
                    value={formData.splitPolicy}
                    onChange={(e) => setFormData({ ...formData, splitPolicy: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {SPLIT_POLICIES.map((policy) => (
                      <option key={policy.value} value={policy.value}>
                        {policy.label} - {policy.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Indexing Bonuses */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Indexing Bonuses</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Scopus Indexed (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.scopusIndexedBonus}
                      onChange={(e) => setFormData({ ...formData, scopusIndexedBonus: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      step="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Non-Indexed (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.nonIndexedBonus}
                      onChange={(e) => setFormData({ ...formData, nonIndexedBonus: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      step="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SGT Publication House (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.sgtPublicationHouseBonus}
                      onChange={(e) => setFormData({ ...formData, sgtPublicationHouseBonus: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      step="1000"
                    />
                  </div>
                </div>
              </div>

              {/* International Bonus */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Additional Bonuses</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    International Publication Bonus (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.internationalBonus}
                    onChange={(e) => setFormData({ ...formData, internationalBonus: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    step="1000"
                  />
                </div>
              </div>

              {/* Effective Dates */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Effective Period</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Effective From *
                    </label>
                    <input
                      type="date"
                      value={formData.effectiveFrom}
                      onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Effective To (Optional)
                    </label>
                    <input
                      type="date"
                      value={formData.effectiveTo}
                      onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Policy
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
