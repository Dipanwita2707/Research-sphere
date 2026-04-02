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
  BookOpen,
  Mic,
  Gift,
  Percent,
  Calendar,
  Info,
  Hash,
  DollarSign,
} from 'lucide-react';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { researchPolicyService, ResearchIncentivePolicy, IndexingBonuses, QuartileBonuses, DistributionMethod, PositionPercentage, INDEXING_CATEGORIES } from '@/features/admin-management/services/researchPolicy.service';

const PUBLICATION_TYPES = [
  { value: 'research_paper', label: 'Research Paper', icon: '📄' },
  { value: 'book', label: 'Book', icon: '📚' },
  { value: 'book_chapter', label: 'Book Chapter', icon: '📖' },
  { value: 'conference_paper', label: 'Conference Paper', icon: '🎤' },
  { value: 'grant', label: 'Grant / Funding', icon: '💰' },
];

const SPLIT_POLICIES = [
  { value: 'percentage_based', label: 'Percentage Based', description: 'Distribute based on author role percentages' },
];

// Distribution methods determine how incentives are split
const DISTRIBUTION_METHODS = [
  { value: 'author_role_based', label: 'Author Role Based', description: 'First Author, Corresponding Author, Co-Authors' },
  { value: 'author_position_based', label: 'Author Position Based', description: '1st, 2nd, 3rd, 4th, 5th author (6th+ gets 0%)' },
];

// Only First Author and Corresponding Author percentages are defined
// Co-Author percentage is automatically calculated as remainder (100% - first - corresponding)
// If same person is both First & Corresponding, they get both percentages combined
const AUTHOR_ROLES = [
  { value: 'first_author', label: 'First Author', defaultPercentage: 35 },
  { value: 'corresponding_author', label: 'Corresponding Author', defaultPercentage: 30 },
  // co_author percentage = 100 - first_author - corresponding_author (auto-calculated, split equally among co-authors)
];

// Author positions (1-5) for position-based distribution
const AUTHOR_POSITIONS = [
  { position: 1, label: '1st Author', defaultPercentage: 40 },
  { position: 2, label: '2nd Author', defaultPercentage: 25 },
  { position: 3, label: '3rd Author', defaultPercentage: 15 },
  { position: 4, label: '4th Author', defaultPercentage: 12 },
  { position: 5, label: '5th Author', defaultPercentage: 8 },
  // 6th+ position authors get 0% - no incentives
];

// Quartile-based incentive structure (mandatory)
interface QuartileIncentive {
  quartile: 'Top 1%' | 'Top 5%' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
  incentiveAmount: number;
  points: number;
}

// SJR range-based incentive structure (optional)
interface SJRRange {
  id: string;
  minSJR: number;
  maxSJR: number;
  incentiveAmount: number;
  points: number;
}

interface RolePercentage {
  role: string;
  percentage: number;
}

const DEFAULT_QUARTILE_INCENTIVES: QuartileIncentive[] = [
  { quartile: 'Top 1%', incentiveAmount: 75000, points: 75 },
  { quartile: 'Top 5%', incentiveAmount: 60000, points: 60 },
  { quartile: 'Q1', incentiveAmount: 50000, points: 50 },
  { quartile: 'Q2', incentiveAmount: 30000, points: 30 },
  { quartile: 'Q3', incentiveAmount: 15000, points: 15 },
  { quartile: 'Q4', incentiveAmount: 5000, points: 5 },
];

// Default role percentages - only First Author and Corresponding Author
// Co-Author gets the remainder (100 - 35 - 30 = 35%), split equally among all co-authors
const DEFAULT_ROLE_PERCENTAGES: RolePercentage[] = [
  { role: 'first_author', percentage: 35 },
  { role: 'corresponding_author', percentage: 30 },
];

// Default position percentages - 1st through 5th author (6th+ gets 0%)
const DEFAULT_POSITION_PERCENTAGES: PositionPercentage[] = [
  { position: 1, percentage: 40 },
  { position: 2, percentage: 25 },
  { position: 3, percentage: 15 },
  { position: 4, percentage: 12 },
  { position: 5, percentage: 8 },
];

export default function ResearchPolicyManagement() {
  const { confirmDelete } = useConfirm();
  const [policies, setPolicies] = useState<ResearchIncentivePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<ResearchIncentivePolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Quartile type alias for nested incentives
  type QuartileValue = 'Top 1%' | 'Top 5%' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

  // Form state
  const [formData, setFormData] = useState<{
    publicationType: string;
    policyName: string;
    splitPolicy: 'percentage_based';
    distributionMethod: DistributionMethod;
    quartileIncentives: QuartileIncentive[];
    sjrRanges: SJRRange[];
    rolePercentages: RolePercentage[];
    positionPercentages: PositionPercentage[];
    indexingCategoryBonuses: { category: string; incentiveAmount: number; points: number; }[];
    // NEW: Nested category incentives
    scopusQuartileIncentives: { quartile: QuartileValue; incentiveAmount: number; points: number; }[];
    wosSjrIncentives: { minSJR: number; maxSJR: number; incentiveAmount: number; points: number; }[];
    naasRatingIncentives: { minRating: number; maxRating: number; incentiveAmount: number; points: number; }[];
    effectiveFrom: string;
    effectiveTo: string;
  }>({
    publicationType: 'research_paper',
    policyName: '',
    splitPolicy: 'percentage_based',
    distributionMethod: 'author_role_based',
    quartileIncentives: [...DEFAULT_QUARTILE_INCENTIVES],
    sjrRanges: [],
    rolePercentages: [...DEFAULT_ROLE_PERCENTAGES],
    positionPercentages: [...DEFAULT_POSITION_PERCENTAGES],
    indexingCategoryBonuses: [
      // 11 Target Research Categories (flat bonuses)
      { category: 'nature_science_lancet_cell_nejm', incentiveAmount: 200000, points: 100 },
      { category: 'subsidiary_if_above_20', incentiveAmount: 100000, points: 50 },
      { category: 'scopus', incentiveAmount: 0, points: 0 }, // Uses nested quartile incentives
      { category: 'scie_wos', incentiveAmount: 0, points: 0 }, // Uses nested SJR incentives
      { category: 'pubmed', incentiveAmount: 15000, points: 15 },
      { category: 'naas_rating_6_plus', incentiveAmount: 0, points: 0 }, // Uses nested rating incentives
      { category: 'abdc_scopus_wos', incentiveAmount: 20000, points: 20 },
      { category: 'sgtu_in_house', incentiveAmount: 5000, points: 5 },
      { category: 'case_centre_uk', incentiveAmount: 8000, points: 8 },
    ],
    // NEW: Nested incentives
    scopusQuartileIncentives: [
      { quartile: 'Top 1%', incentiveAmount: 75000, points: 75 },
      { quartile: 'Top 5%', incentiveAmount: 60000, points: 60 },
      { quartile: 'Q1', incentiveAmount: 50000, points: 50 },
      { quartile: 'Q2', incentiveAmount: 30000, points: 30 },
      { quartile: 'Q3', incentiveAmount: 15000, points: 15 },
      { quartile: 'Q4', incentiveAmount: 5000, points: 5 },
    ],
    wosSjrIncentives: [
      { minSJR: 2.0, maxSJR: 999, incentiveAmount: 50000, points: 50 },
      { minSJR: 1.0, maxSJR: 1.99, incentiveAmount: 30000, points: 30 },
      { minSJR: 0.5, maxSJR: 0.99, incentiveAmount: 15000, points: 15 },
      { minSJR: 0.0, maxSJR: 0.49, incentiveAmount: 5000, points: 5 },
    ],
    naasRatingIncentives: [
      { minRating: 10, maxRating: 20, incentiveAmount: 30000, points: 30 },
      { minRating: 8, maxRating: 9.99, incentiveAmount: 20000, points: 20 },
      { minRating: 6, maxRating: 7.99, incentiveAmount: 10000, points: 10 },
    ],
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const data = await researchPolicyService.getAllPolicies(true);
      setPolicies(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (policy?: ResearchIncentivePolicy) => {
    if (policy) {
      // Extract data from stored policy
      const quartileData = (policy.indexingBonuses as any)?.quartileIncentives || DEFAULT_QUARTILE_INCENTIVES;
      const distributionMethodData = policy.distributionMethod || 'author_role_based';
      const positionPercentagesData = (policy.indexingBonuses as any)?.positionPercentages || DEFAULT_POSITION_PERCENTAGES;
      const sjrData = (policy.indexingBonuses as any)?.sjrRanges || [];
      const rolePercentagesData = (policy.indexingBonuses as any)?.rolePercentages || DEFAULT_ROLE_PERCENTAGES;
      
      // Extract nested category incentives
      const nestedIncentives = (policy.indexingBonuses as any)?.nestedCategoryIncentives || {};
      const scopusQuartileData: { quartile: QuartileValue; incentiveAmount: number; points: number; }[] = nestedIncentives.scopusQuartileIncentives || [
        { quartile: 'Top 1%' as QuartileValue, incentiveAmount: 75000, points: 75 },
        { quartile: 'Top 5%' as QuartileValue, incentiveAmount: 60000, points: 60 },
        { quartile: 'Q1' as QuartileValue, incentiveAmount: 50000, points: 50 },
        { quartile: 'Q2' as QuartileValue, incentiveAmount: 30000, points: 30 },
        { quartile: 'Q3' as QuartileValue, incentiveAmount: 15000, points: 15 },
        { quartile: 'Q4' as QuartileValue, incentiveAmount: 5000, points: 5 },
      ];
      const wosSjrData = nestedIncentives.wosSjrIncentives || [
        { minSJR: 2.0, maxSJR: 999, incentiveAmount: 50000, points: 50 },
        { minSJR: 1.0, maxSJR: 1.99, incentiveAmount: 30000, points: 30 },
        { minSJR: 0.5, maxSJR: 0.99, incentiveAmount: 15000, points: 15 },
        { minSJR: 0.0, maxSJR: 0.49, incentiveAmount: 5000, points: 5 },
      ];
      const naasRatingData = nestedIncentives.naasRatingIncentives || [
        { minRating: 10, maxRating: 20, incentiveAmount: 30000, points: 30 },
        { minRating: 8, maxRating: 9.99, incentiveAmount: 20000, points: 20 },
        { minRating: 6, maxRating: 7.99, incentiveAmount: 10000, points: 10 },
      ];
      
      const indexingCategoryBonusesData = (policy.indexingBonuses as any)?.indexingCategoryBonuses || [
        { category: 'nature_science_lancet_cell_nejm', incentiveAmount: 200000, points: 100 },
        { category: 'subsidiary_if_above_20', incentiveAmount: 100000, points: 50 },
        { category: 'scopus', incentiveAmount: 0, points: 0 },
        { category: 'scie_wos', incentiveAmount: 0, points: 0 },
        { category: 'pubmed', incentiveAmount: 15000, points: 15 },
        { category: 'naas_rating_6_plus', incentiveAmount: 0, points: 0 },
        { category: 'abdc_scopus_wos', incentiveAmount: 20000, points: 20 },
        { category: 'sgtu_in_house', incentiveAmount: 5000, points: 5 },
        { category: 'case_centre_uk', incentiveAmount: 8000, points: 8 },
      ];
      setEditingPolicy(policy);
      setFormData({
        publicationType: policy.publicationType,
        policyName: policy.policyName,
        splitPolicy: 'percentage_based',
        distributionMethod: distributionMethodData,
        quartileIncentives: quartileData,
        sjrRanges: sjrData,
        rolePercentages: rolePercentagesData,
        positionPercentages: positionPercentagesData,
        indexingCategoryBonuses: indexingCategoryBonusesData,
        scopusQuartileIncentives: scopusQuartileData,
        wosSjrIncentives: wosSjrData,
        naasRatingIncentives: naasRatingData,
        effectiveFrom: policy.effectiveFrom ? new Date(policy.effectiveFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        effectiveTo: policy.effectiveTo ? new Date(policy.effectiveTo).toISOString().split('T')[0] : '',
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        publicationType: 'research_paper',
        policyName: '',
        splitPolicy: 'percentage_based',
        distributionMethod: 'author_role_based',
        quartileIncentives: [...DEFAULT_QUARTILE_INCENTIVES],
        sjrRanges: [],
        rolePercentages: [...DEFAULT_ROLE_PERCENTAGES],
        positionPercentages: [...DEFAULT_POSITION_PERCENTAGES],
        indexingCategoryBonuses: [
          { category: 'nature_science_lancet_cell_nejm', incentiveAmount: 200000, points: 100 },
          { category: 'subsidiary_if_above_20', incentiveAmount: 100000, points: 50 },
          { category: 'scopus', incentiveAmount: 0, points: 0 },
          { category: 'scie_wos', incentiveAmount: 0, points: 0 },
          { category: 'pubmed', incentiveAmount: 15000, points: 15 },
          { category: 'naas_rating_6_plus', incentiveAmount: 0, points: 0 },
          { category: 'abdc_scopus_wos', incentiveAmount: 20000, points: 20 },
          { category: 'sgtu_in_house', incentiveAmount: 5000, points: 5 },
          { category: 'case_centre_uk', incentiveAmount: 8000, points: 8 },
        ],
        scopusQuartileIncentives: [
          { quartile: 'Top 1%', incentiveAmount: 75000, points: 75 },
          { quartile: 'Top 5%', incentiveAmount: 60000, points: 60 },
          { quartile: 'Q1', incentiveAmount: 50000, points: 50 },
          { quartile: 'Q2', incentiveAmount: 30000, points: 30 },
          { quartile: 'Q3', incentiveAmount: 15000, points: 15 },
          { quartile: 'Q4', incentiveAmount: 5000, points: 5 },
        ],
        wosSjrIncentives: [
          { minSJR: 2.0, maxSJR: 999, incentiveAmount: 50000, points: 50 },
          { minSJR: 1.0, maxSJR: 1.99, incentiveAmount: 30000, points: 30 },
          { minSJR: 0.5, maxSJR: 0.99, incentiveAmount: 15000, points: 15 },
          { minSJR: 0.0, maxSJR: 0.49, incentiveAmount: 5000, points: 5 },
        ],
        naasRatingIncentives: [
          { minRating: 10, maxRating: 20, incentiveAmount: 30000, points: 30 },
          { minRating: 8, maxRating: 9.99, incentiveAmount: 20000, points: 20 },
          { minRating: 6, maxRating: 7.99, incentiveAmount: 10000, points: 10 },
        ],
        effectiveFrom: new Date().toISOString().split('T')[0],
        effectiveTo: '',
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
        setError('Please provide an effective from date');
        return;
      }

      // Validate role percentages only if using role-based distribution
      if (formData.distributionMethod ===
   'author_role_based') {
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

      // Validate position percentages if using position-based distribution
      if (formData.distributionMethod ===
   'author_position_based') {
        const totalPositionPct = formData.positionPercentages.reduce((sum, pp) => sum + pp.percentage, 0);
        if (totalPositionPct !== 100) {
          setError(`Position percentages must total 100%. Currently: ${totalPositionPct}%`);
          return;
        }
      }

      // Validate SJR ranges don't overlap (if any are defined)
      if (formData.sjrRanges.length > 0) {
        const sortedRanges = [...formData.sjrRanges].sort((a, b) => a.minSJR - b.minSJR);
        for (let i = 0; i < sortedRanges.length - 1; i++) {
          if (sortedRanges[i].maxSJR >= sortedRanges[i + 1].minSJR) {
            setError('SJR ranges cannot overlap');
            return;
          }
        }
      }

      // Store quartile incentives, SJR ranges, role percentages, position percentages, and indexing category bonuses in indexingBonuses field
      const indexingBonusesData = {
        quartileIncentives: formData.quartileIncentives,
        sjrRanges: formData.sjrRanges,
        rolePercentages: formData.rolePercentages,
        positionPercentages: formData.positionPercentages,
        indexingCategoryBonuses: formData.indexingCategoryBonuses,
        // NEW: Nested category incentives - ONLY NAAS (SCOPUS/WOS use quartileIncentives/sjrRanges)
        nestedCategoryIncentives: {
          naasRatingIncentives: formData.naasRatingIncentives,
        },
      };

      // Calculate base amount and points from Q1 for backward compatibility
      const q1Incentive = formData.quartileIncentives.find(q => q.quartile ===
   'Q1') || formData.quartileIncentives[0];

      const policyData = {
        publicationType: formData.publicationType,
        policyName: formData.policyName,
        baseIncentiveAmount: q1Incentive.incentiveAmount,
        basePoints: q1Incentive.points,
        splitPolicy: formData.splitPolicy,
        distributionMethod: formData.distributionMethod,
        indexingBonuses: indexingBonusesData,
        effectiveFrom: new Date(formData.effectiveFrom).toISOString(),
        effectiveTo: formData.effectiveTo ? new Date(formData.effectiveTo).toISOString() : null,
      };

      if (editingPolicy) {
        await researchPolicyService.updatePolicy(editingPolicy.id, policyData);
        setSuccess('Policy updated successfully');
      } else {
        await researchPolicyService.createPolicy(policyData);
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

  const handleDelete = async (policy: ResearchIncentivePolicy) => {
    const confirmed = await confirmDelete('Delete Policy', `Are you sure you want to delete "${policy.policyName}"?`);
    if (!confirmed) return;

    try {
      await researchPolicyService.deletePolicy(policy.id);
      setSuccess('Policy deleted successfully');
      fetchPolicies();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete policy');
    }
  };

  const getPublicationTypeInfo = (type: string) => {
    return PUBLICATION_TYPES.find(t => t.value ===
   type) || { value: type, label: type, icon: '📄' };
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
            <BookOpen className="w-7 h-7 text-blue-600" />
            Research Paper Incentive Policies
          </h1>
          <p className="text-gray-500 mt-1">
            Configure incentive amounts and points based on journal quartile (Top 1%, Top 5%, Q1-Q4) and optional SJR ranges
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

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Incentive Distribution Rules:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Quartile incentives (Top 1%, Top 5%, Q1-Q4) are <strong>mandatory</strong> for all policies</li>
            <li>SJR range incentives are <strong>optional</strong> and override quartile amounts when defined</li>
            <li><strong>First Author</strong> and <strong>Corresponding Author</strong> percentages are defined in policy</li>
            <li><strong>Co-Authors</strong> automatically share the remainder (100% - First - Corresponding), split equally among <strong>internal</strong> co-authors</li>
            <li>If same person is <strong>First + Corresponding</strong>, they get both percentages combined</li>
            <li>If <strong>single author</strong>, they get 100% of the incentive</li>
            <li>If <strong>exactly 2 authors with NO co-authors</strong> (one first, one corresponding), they <strong>split 50-50</strong></li>
          </ul>
          <p className="font-semibold mt-2 mb-1">External Author Rules:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>External authors</strong> receive <strong>₹0 incentives and 0 points</strong></li>
            <li>If <strong>External First/Corresponding Author</strong>: their share is <strong>forfeited</strong> (not redistributed)</li>
            <li>If <strong>External Co-Author</strong>: their share is <strong>redistributed to internal co-authors</strong></li>
          </ul>
          <p className="font-semibold mt-2 mb-1">Point Distribution:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Points are distributed only among <strong>employees</strong> (internal faculty/staff)</li>
            <li><strong>Students</strong> get incentives but <strong>0 points</strong></li>
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

      {/* Policies Grid */}
      <div className="grid gap-6">
        {PUBLICATION_TYPES.map(pubType => {
          const typePolicies = policies.filter(p => p.publicationType ===
   pubType.value);
          const activePolicy = typePolicies.find(p => p.isActive);

          return (
            <div key={pubType.value} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Type Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{pubType.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{pubType.label}</h3>
                      <p className="text-sm text-gray-500">
                        {activePolicy ? (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Currently Active: {activePolicy.policyName}
                          </span>
                        ) : 'No active policy for current date'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFormData(prev => ({ ...prev, publicationType: pubType.value }));
                      handleOpenModal();
                    }}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Create Policy
                  </button>
                </div>
              </div>

              {/* Active Policy */}
              {activePolicy && (
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Validity Period */}
                      <div className="mb-4 flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                          Valid: {formatDate(activePolicy.effectiveFrom)} → {formatDate(activePolicy.effectiveTo)}
                        </span>
                      </div>

                      {/* Quartile Incentives */}
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Quartile-Based Incentives</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {((activePolicy.indexingBonuses as any)?.quartileIncentives || DEFAULT_QUARTILE_INCENTIVES).map((q: QuartileIncentive) => (
                            <div key={q.quartile} className="flex items-center gap-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3">
                              <div className="flex-1">
                                <span className="text-sm font-bold text-gray-700">{q.quartile}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-base font-bold text-green-600">
                                    ₹{Number(q.incentiveAmount).toLocaleString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-blue-600 font-semibold">
                                    {q.points} pts
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* SJR Ranges (if any) */}
                      {((activePolicy.indexingBonuses as any)?.sjrRanges || []).length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">SJR-Based Incentives (Optional)</h4>
                          <div className="space-y-2">
                            {((activePolicy.indexingBonuses as any)?.sjrRanges || []).map((range: SJRRange, idx: number) => (
                              <div key={idx} className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3">
                                <div className="flex-1">
                                  <span className="text-sm font-medium text-gray-700">
                                    SJR {range.minSJR.toFixed(2)} - {range.maxSJR.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-green-600">
                                      ₹{Number(range.incentiveAmount).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm text-blue-600 font-semibold">
                                      {range.points} pts
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Distribution Method */}
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Distribution Method</h4>
                        <div className="flex items-center gap-2 bg-purple-50 rounded px-3 py-2 border border-purple-200">
                          <Hash className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-semibold text-purple-700">
                            {DISTRIBUTION_METHODS.find(m => m.value ===
   activePolicy.distributionMethod)?.label || 'Author Role Based'}
                          </span>
                        </div>
                      </div>

                      {/* Role Percentages - Only for author_role_based */}
                      {(!activePolicy.distributionMethod || activePolicy.distributionMethod ===
   'author_role_based') && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Author Role Percentages</h4>
                        <div className="space-y-2">
                          {((activePolicy.indexingBonuses as any)?.rolePercentages || DEFAULT_ROLE_PERCENTAGES).map((rp: RolePercentage) => {
                            const roleInfo = AUTHOR_ROLES.find(r => r.value ===
   rp.role);
                            return (
                              <div key={rp.role} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                                <span className="text-sm text-gray-700">{roleInfo?.label || rp.role}</span>
                                <span className="text-sm font-semibold text-blue-600">{rp.percentage}%</span>
                              </div>
                            );
                          })}
                          {/* Show calculated Co-Author percentage */}
                          {(() => {
                            const rolePercentages = (activePolicy.indexingBonuses as any)?.rolePercentages || DEFAULT_ROLE_PERCENTAGES;
                            const firstPct = rolePercentages.find((r: RolePercentage) => r.role ===
   'first_author')?.percentage || 0;
                            const corrPct = rolePercentages.find((r: RolePercentage) => r.role ===
   'corresponding_author')?.percentage || 0;
                            const coAuthorPct = 100 - firstPct - corrPct;
                            return (
                              <div className="flex items-center justify-between bg-amber-50 rounded px-3 py-2 border border-amber-200">
                                <span className="text-sm text-gray-700">Co-Authors (shared equally)</span>
                                <span className="text-sm font-semibold text-amber-600">{coAuthorPct}%</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      )}

                      {/* Position Percentages - Only for author_position_based */}
                      {activePolicy.distributionMethod ===
   'author_position_based' && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Author Position Percentages</h4>
                        <div className="space-y-2">
                          {((activePolicy.indexingBonuses as any)?.positionPercentages || DEFAULT_POSITION_PERCENTAGES).map((pp: PositionPercentage) => {
                            const positionInfo = AUTHOR_POSITIONS.find(p => p.position ===
   pp.position);
                            return (
                              <div key={pp.position} className="flex items-center justify-between bg-purple-50 rounded px-3 py-2">
                                <span className="text-sm text-gray-700">{positionInfo?.label || pp.position}</span>
                                <span className="text-sm font-semibold text-purple-600">{pp.percentage}%</span>
                              </div>
                            );
                          })}
                          <div className="flex items-center justify-between bg-gray-100 rounded px-3 py-2 border border-gray-300">
                            <span className="text-sm text-gray-500">6th Author & Above</span>
                            <span className="text-sm font-semibold text-gray-400">0% (No incentive)</span>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* Split Policy */}
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>Split Policy: <strong className="text-gray-800">{activePolicy.splitPolicy?.replace(/_/g, ' ') || 'Percentage Based'}</strong></span>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleOpenModal(activePolicy)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Policy"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(activePolicy)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Policy"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* No Active Policy Notice */}
              {!activePolicy && (
                <div className="p-6 bg-gray-50">
                  <p className="text-sm text-gray-500 text-center">
                    No active policy. Create one to set incentives for this publication type.
                  </p>
                </div>
              )}

              {/* Inactive Policies */}
              {typePolicies.filter(p => !p.isActive).length > 0 && (
                <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    {typePolicies.filter(p => !p.isActive).length} inactive policy(ies)
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPolicy ? 'Edit' : 'Create'} Research Incentive Policy
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Publication Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.publicationType}
                    onChange={(e) => {
                      const selectedType = e.target.value;
                      // Redirect to book policies page if book is selected
                      if (selectedType ===
   'book') {
                        window.location.href = '/admin/book-policies';
                        return;
                      }
                      // Redirect to book chapter policies page if book_chapter is selected
                      if (selectedType ===
   'book_chapter') {
                        window.location.href = '/admin/book-chapter-policies';
                        return;
                      }
                      setFormData({ ...formData, publicationType: selectedType });
                    }}
                    disabled={!!editingPolicy}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    {PUBLICATION_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Policy Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.policyName}
                    onChange={(e) => setFormData({ ...formData, policyName: e.target.value })}
                    placeholder="e.g., Research Paper Policy 2025"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Validity Period */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Policy Validity Period
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Incentives will be calculated based on this policy if the publication date falls within this period.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Effective From <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.effectiveFrom}
                      onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Effective To <span className="text-gray-400">(Optional)</span>
                    </label>
                    <input
                      type="date"
                      value={formData.effectiveTo}
                      onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                      min={formData.effectiveFrom}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty for no end date</p>
                  </div>
                </div>
              </div>

              {/* Quartile-Based Incentives (Mandatory) */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-green-600" />
                  Quartile-Based Incentives <span className="text-red-500 text-sm">*</span>
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Define base incentive amounts for each journal quartile (Top 1%, Top 5%, Q1, Q2, Q3, Q4). These are mandatory and applied based on publication date.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {formData.quartileIncentives.map((q) => (
                    <div key={q.quartile} className="p-4 rounded-xl border-2 border-green-200 bg-green-50/30">
                      <h4 className="font-bold text-gray-900 mb-3 text-lg">{q.quartile}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Coins className="w-4 h-4 inline mr-1 text-green-600" />
                            Incentive (₹)
                          </label>
                          <input
                            type="number"
                            value={q.incentiveAmount}
                            onChange={(e) => setFormData({
                              ...formData,
                              quartileIncentives: formData.quartileIncentives.map(qi => 
                                qi.quartile ===
   q.quartile ? { ...qi, incentiveAmount: Number(e.target.value) } : qi
                              )
                            })}
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Award className="w-4 h-4 inline mr-1 text-blue-600" />
                            Points
                          </label>
                          <input
                            type="number"
                            value={q.points}
                            onChange={(e) => setFormData({
                              ...formData,
                              quartileIncentives: formData.quartileIncentives.map(qi => 
                                qi.quartile ===
   q.quartile ? { ...qi, points: Number(e.target.value) } : qi
                              )
                            })}
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SJR-Based Incentives (Optional) */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  SJR-Based Incentive Ranges <span className="text-gray-400 text-sm">(Optional)</span>
                </h3>
                <p className="text-sm text-gray-600 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <strong>Optional:</strong> Define additional incentive amounts based on specific SJR value ranges. If not defined, quartile-based incentives will be used.
                </p>
                
                <div className="space-y-3">
                  {formData.sjrRanges.map((range, index) => (
                    <div key={range.id} className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/30">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">Range #{index + 1}</h4>
                        {formData.sjrRanges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setFormData({
                              ...formData,
                              sjrRanges: formData.sjrRanges.filter(r => r.id !== range.id)
                            })}
                            className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Min SJR
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={range.minSJR}
                            onChange={(e) => setFormData({
                              ...formData,
                              sjrRanges: formData.sjrRanges.map(r => 
                                r.id ===
   range.id ? { ...r, minSJR: Number(e.target.value) } : r
                              )
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Max SJR
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={range.maxSJR}
                            onChange={(e) => setFormData({
                              ...formData,
                              sjrRanges: formData.sjrRanges.map(r => 
                                r.id ===
   range.id ? { ...r, maxSJR: Number(e.target.value) } : r
                              )
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Coins className="w-4 h-4 inline mr-1 text-green-600" />
                            Incentive (₹)
                          </label>
                          <input
                            type="number"
                            value={range.incentiveAmount}
                            onChange={(e) => setFormData({
                              ...formData,
                              sjrRanges: formData.sjrRanges.map(r => 
                                r.id ===
   range.id ? { ...r, incentiveAmount: Number(e.target.value) } : r
                              )
                            })}
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Award className="w-4 h-4 inline mr-1 text-blue-600" />
                            Points
                          </label>
                          <input
                            type="number"
                            value={range.points}
                            onChange={(e) => setFormData({
                              ...formData,
                              sjrRanges: formData.sjrRanges.map(r => 
                                r.id ===
   range.id ? { ...r, points: Number(e.target.value) } : r
                              )
                            })}
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    sjrRanges: [
                      ...formData.sjrRanges,
                      {
                        id: Date.now().toString(),
                        minSJR: 0,
                        maxSJR: 0,
                        incentiveAmount: 5000,
                        points: 5,
                      }
                    ]
                  })}
                  className="mt-3 w-full py-2 border-2 border-dashed border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add SJR Range
                </button>
              </div>

              {/* Indexing Category Bonuses - NEW */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-green-600" />
                  Indexing Category Incentives
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Set incentives for each indexing category. These amounts are summed when multiple categories are selected.
                </p>
                
                <div className="space-y-3">
                  {INDEXING_CATEGORIES.map((cat: any) => {
                    const catBonus = formData.indexingCategoryBonuses.find(b => b.category ===
   cat.value);
                    const categoryLabel = cat.label;
                    
                    return (
                      <div key={cat.value} className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {categoryLabel}
                            </label>
                            <p className="text-xs text-gray-500">{cat.description}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              <DollarSign className="w-4 h-4 inline mr-1 text-green-600" />
                              Incentive Amount (₹)
                            </label>
                            <input
                              type="number"
                              value={catBonus?.incentiveAmount || 0}
                              onChange={(e) => setFormData({
                                ...formData,
                                indexingCategoryBonuses: formData.indexingCategoryBonuses.map(b =>
                                  b.category ===
   cat.value
                                    ? { ...b, incentiveAmount: Number(e.target.value) }
                                    : b
                                )
                              })}
                              min="0"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              <Award className="w-4 h-4 inline mr-1 text-green-600" />
                              Points
                            </label>
                            <input
                              type="number"
                              value={catBonus?.points || 0}
                              onChange={(e) => setFormData({
                                ...formData,
                                indexingCategoryBonuses: formData.indexingCategoryBonuses.map(b =>
                                  b.category ===
   cat.value
                                    ? { ...b, points: Number(e.target.value) }
                                    : b
                                )
                              })}
                              min="0"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>Note:</strong> When authors select multiple categories, the total incentive = sum of all selected categories + quartile/SJR (if applicable), then distributed by position/role.
                  </p>
                </div>
              </div>

              {/* NAAS Rating Incentives - Nested */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-orange-600" />
                  NAAS Rating Incentives
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Set incentives based on NAAS rating when NAAS category is selected. (Rating must be ≥ 6)
                </p>
                
                <div className="space-y-3">
                  {formData.naasRatingIncentives.map((nr, idx) => (
                    <div key={idx} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-center">
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Min Rating</label>
                          <input
                            type="number"
                            step="0.01"
                            value={nr.minRating}
                            onChange={(e) => setFormData({
                              ...formData,
                              naasRatingIncentives: formData.naasRatingIncentives.map((n, i) =>
                                i ===
   idx ? { ...n, minRating: Number(e.target.value) } : n
                              )
                            })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Max Rating</label>
                          <input
                            type="number"
                            step="0.01"
                            value={nr.maxRating}
                            onChange={(e) => setFormData({
                              ...formData,
                              naasRatingIncentives: formData.naasRatingIncentives.map((n, i) =>
                                i ===
   idx ? { ...n, maxRating: Number(e.target.value) } : n
                              )
                            })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Incentive (₹)</label>
                          <input
                            type="number"
                            value={nr.incentiveAmount}
                            onChange={(e) => setFormData({
                              ...formData,
                              naasRatingIncentives: formData.naasRatingIncentives.map((n, i) =>
                                i ===
   idx ? { ...n, incentiveAmount: Number(e.target.value) } : n
                              )
                            })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Points</label>
                          <input
                            type="number"
                            value={nr.points}
                            onChange={(e) => setFormData({
                              ...formData,
                              naasRatingIncentives: formData.naasRatingIncentives.map((n, i) =>
                                i ===
   idx ? { ...n, points: Number(e.target.value) } : n
                              )
                            })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Distribution Method Selection */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Hash className="w-5 h-5 text-purple-600" />
                  Distribution Method <span className="text-red-500 text-sm">*</span>
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose how incentives are distributed among authors.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {DISTRIBUTION_METHODS.map((method) => (
                    <div
                      key={method.value}
                      onClick={() => setFormData({ ...formData, distributionMethod: method.value as DistributionMethod })}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.distributionMethod ===
   method.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                          formData.distributionMethod ===
   method.value
                            ? 'border-purple-500 bg-purple-500'
                            : 'border-gray-300'
                        }`}>
                          {formData.distributionMethod ===
   method.value && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{method.label}</h4>
                          <p className="text-sm text-gray-600 mt-1">{method.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Author Role Percentages - Only shown for author_role_based */}
              {formData.distributionMethod ===
   'author_role_based' && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Percent className="w-5 h-5 text-blue-600" />
                  Author Role Percentages
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Define percentages for First Author and Corresponding Author. Co-Authors automatically share the remainder.
                </p>
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-amber-800 font-medium mb-2">Distribution Examples:</p>
                  <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                    <li>Single author → gets 100% (regardless of role)</li>
                    <li>Same person is First + Corresponding → gets both percentages combined</li>
                    <li>First (35%) + Corresponding (30%) + 2 Co-Authors → Co-authors each get 17.5%</li>
                  </ul>
                </div>
                
                <div className="space-y-3">
                  {formData.rolePercentages.map(rp => {
                    const roleInfo = AUTHOR_ROLES.find(r => r.value ===
   rp.role);
                    return (
                      <div key={rp.role} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <label className="font-medium text-gray-700">{roleInfo?.label}</label>
                        </div>
                        <div className="w-32">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={rp.percentage}
                              onChange={(e) => setFormData({
                                ...formData,
                                rolePercentages: formData.rolePercentages.map(r => 
                                  r.role ===
   rp.role ? { ...r, percentage: Number(e.target.value) } : r
                                )
                              })}
                              min="1"
                              max="99"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-gray-600 font-semibold">%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Show calculated Co-Author percentage */}
                  {(() => {
                    const firstPct = formData.rolePercentages.find(rp => rp.role ===
   'first_author')?.percentage || 0;
                    const corrPct = formData.rolePercentages.find(rp => rp.role ===
   'corresponding_author')?.percentage || 0;
                    const coAuthorPct = 100 - firstPct - corrPct;
                    return (
                      <div className="flex items-center gap-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex-1">
                          <label className="font-medium text-amber-800">Co-Authors (auto-calculated)</label>
                          <p className="text-xs text-amber-600">Split equally among all co-authors</p>
                        </div>
                        <div className="w-32">
                          <div className="flex items-center gap-2">
                            <div className="w-full px-3 py-2 bg-amber-100 rounded-lg text-amber-800 font-bold text-center">
                              {coAuthorPct}
                            </div>
                            <span className="text-amber-600 font-semibold">%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  {(() => {
                    const firstPct = formData.rolePercentages.find(rp => rp.role ===
   'first_author')?.percentage || 0;
                    const corrPct = formData.rolePercentages.find(rp => rp.role ===
   'corresponding_author')?.percentage || 0;
                    const totalDefined = firstPct + corrPct;
                    return (
                      <p className="text-sm text-blue-800">
                        <strong>First + Corresponding:</strong> {totalDefined}% 
                        {totalDefined > 100 && (
                          <span className="text-red-600 ml-2">⚠️ Cannot exceed 100%</span>
                        )}
                        {totalDefined <= 100 && (
                          <span className="text-green-600 ml-2">✓ Remaining {100 - totalDefined}% for Co-Authors</span>
                        )}
                      </p>
                    );
                  })()}
                </div>
              </div>
              )}

              {/* Author Position Percentages - Only shown for author_position_based */}
              {formData.distributionMethod ===
   'author_position_based' && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Hash className="w-5 h-5 text-purple-600" />
                  Author Position Percentages
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Define percentages based on author position (1st, 2nd, 3rd, etc.). Authors in positions 6 and above receive no incentive.
                </p>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-800 font-medium mb-2">⚠️ Important:</p>
                  <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                    <li>Authors in positions 6 and above (6th, 7th, 8th, etc.) receive <strong>no incentive</strong></li>
                    <li>Total of positions 1-5 must equal 100%</li>
                  </ul>
                </div>
                
                <div className="space-y-3">
                  {formData.positionPercentages.map(pp => {
                    const positionInfo = AUTHOR_POSITIONS.find(p => p.position ===
   pp.position);
                    return (
                      <div key={pp.position} className="flex items-center gap-4 p-3 bg-purple-50 rounded-lg">
                        <div className="flex-1">
                          <label className="font-medium text-gray-700">{positionInfo?.label}</label>
                        </div>
                        <div className="w-32">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={pp.percentage}
                              onChange={(e) => setFormData({
                                ...formData,
                                positionPercentages: formData.positionPercentages.map(p => 
                                  p.position ===
   pp.position ? { ...p, percentage: Number(e.target.value) } : p
                                )
                              })}
                              min="0"
                              max="100"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                            <span className="text-gray-600 font-semibold">%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Show 6th+ position notice */}
                  <div className="flex items-center gap-4 p-3 bg-gray-100 rounded-lg border border-gray-300">
                    <div className="flex-1">
                      <label className="font-medium text-gray-500">6th Author & Above</label>
                      <p className="text-xs text-gray-400">No incentive for positions 6+</p>
                    </div>
                    <div className="w-32">
                      <div className="flex items-center gap-2">
                        <div className="w-full px-3 py-2 bg-gray-200 rounded-lg text-gray-500 font-bold text-center">
                          0
                        </div>
                        <span className="text-gray-400 font-semibold">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  {(() => {
                    const totalPositionPct = formData.positionPercentages.reduce((sum, pp) => sum + pp.percentage, 0);
                    return (
                      <p className="text-sm text-purple-800">
                        <strong>Total (Positions 1-5):</strong> {totalPositionPct}% 
                        {totalPositionPct !== 100 && (
                          <span className="text-red-600 ml-2">⚠️ Must equal exactly 100%</span>
                        )}
                        {totalPositionPct ===
   100 && (
                          <span className="text-green-600 ml-2">✓ Perfect!</span>
                        )}
                      </p>
                    );
                  })()}
                </div>
              </div>
              )}

              {/* Split Policy */}
              <div className="border-t pt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Split Policy
                  </label>
                  <select
                    value={formData.splitPolicy}
                    onChange={(e) => setFormData({ ...formData, splitPolicy: e.target.value as 'percentage_based' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {SPLIT_POLICIES.map(policy => (
                      <option key={policy.value} value={policy.value}>
                        {policy.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {SPLIT_POLICIES.find(p => p.value ===
   formData.splitPolicy)?.description}
                  </p>
                </div>
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> Policy will be automatically active based on its effective date range. Policies with overlapping dates for the same publication type are not allowed.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
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
