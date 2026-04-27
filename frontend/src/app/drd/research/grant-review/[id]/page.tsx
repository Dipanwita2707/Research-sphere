'use client';

import { useState, useEffect } from 'react';
import { getFileUrl } from '@/shared/api/api';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, FileText, Users, Calendar, DollarSign, Clock, 
  Building, Globe, User, CheckCircle, XCircle, AlertCircle,
  Loader2, Eye, MessageSquare, Award, ExternalLink, Edit3, Trash2, Save, Coins
} from 'lucide-react';
import { researchService } from '@/features/research-management/services/research.service';
import { permissionManagementService } from '@/features/admin-management/services/permissionManagement.service';
import { useAuthStore } from '@/shared/auth/authStore';
import grantPolicyService, { GrantIncentivePolicy } from '@/features/research-management/services/grantPolicy.service';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: FileText },
  submitted: { label: 'Submitted', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Clock },
  under_review: { label: 'Under Review', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Eye },
  changes_required: { label: 'Changes Required', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: AlertCircle },
  resubmitted: { label: 'Resubmitted', color: 'text-purple-600', bgColor: 'bg-purple-100', icon: FileText },
  recommended: { label: 'Recommended', color: 'text-indigo-600', bgColor: 'bg-indigo-100', icon: Award },
  approved: { label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle },
  completed: { label: 'Completed', color: 'text-indigo-600', bgColor: 'bg-indigo-100', icon: CheckCircle },
};

const ROLE_LABELS: Record<string, string> = {
  pi: 'Principal Investigator (PI)',
  co_pi: 'Co-Principal Investigator (Co-PI)',
};

const SDG_GOALS = [
  { value: 'sdg1', label: 'SDG 1: No Poverty' },
  { value: 'sdg2', label: 'SDG 2: Zero Hunger' },
  { value: 'sdg3', label: 'SDG 3: Good Health and Well-being' },
  { value: 'sdg4', label: 'SDG 4: Quality Education' },
  { value: 'sdg5', label: 'SDG 5: Gender Equality' },
  { value: 'sdg6', label: 'SDG 6: Clean Water and Sanitation' },
  { value: 'sdg7', label: 'SDG 7: Affordable and Clean Energy' },
  { value: 'sdg8', label: 'SDG 8: Decent Work and Economic Growth' },
  { value: 'sdg9', label: 'SDG 9: Industry, Innovation and Infrastructure' },
  { value: 'sdg10', label: 'SDG 10: Reduced Inequalities' },
  { value: 'sdg11', label: 'SDG 11: Sustainable Cities and Communities' },
  { value: 'sdg12', label: 'SDG 12: Responsible Consumption and Production' },
  { value: 'sdg13', label: 'SDG 13: Climate Action' },
  { value: 'sdg14', label: 'SDG 14: Life Below Water' },
  { value: 'sdg15', label: 'SDG 15: Life on Land' },
  { value: 'sdg16', label: 'SDG 16: Peace, Justice and Strong Institutions' },
  { value: 'sdg17', label: 'SDG 17: Partnerships for the Goals' },
];

const EDITABLE_GRANT_FIELDS = [
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'agencyName', label: 'Agency Name', type: 'text' },
  { key: 'submittedAmount', label: 'Submitted Amount', type: 'number' },
  { key: 'projectDurationMonths', label: 'Duration (months)', type: 'number' },
  { key: 'projectStartDate', label: 'Project Start Date', type: 'date' },
  { key: 'projectEndDate', label: 'Project End Date', type: 'date' },
  { key: 'fundingAgencyName', label: 'Funding Agency Name', type: 'text' },
  { key: 'totalInvestigators', label: 'Total Investigators', type: 'number' },
  { key: 'projectStatus', label: 'Project Status', type: 'select', options: ['submitted', 'approved'] },
  { key: 'projectCategory', label: 'Project Category', type: 'select', options: ['govt', 'non_govt', 'industry'] },
  { key: 'fundingAgencyType', label: 'Funding Agency Type', type: 'select', options: ['DBT', 'DST', 'ICMR', 'CSIR', 'Other'] },
  { key: 'sdgGoals', label: 'SDG Goals', type: 'multiselect', options: SDG_GOALS.map(sdg => sdg.value) },
];

interface FieldSuggestion {
  fieldName: string;
  originalValue: string;
  suggestedValue: string;
  note?: string;
}

export default function GrantReviewPage() {
  const params = useParams() as Record<string, string>;
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { confirmDelete, confirmAction } = useConfirm();

  const [grant, setGrant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userPermissions, setUserPermissions] = useState<any>({});
  
  // Review state
  const [reviewComments, setReviewComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [fieldSuggestions, setFieldSuggestions] = useState<FieldSuggestion[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempSuggestion, setTempSuggestion] = useState<Partial<FieldSuggestion>>({});
  
  // Grant Policy for incentive calculation
  const [activePolicy, setActivePolicy] = useState<GrantIncentivePolicy | null>(null);

  useEffect(() => {
    if (id) {
      fetchGrant();
    }
    if (user?.id) {
      fetchPermissions();
    }
  }, [id, user]);
  
  // Fetch active grant policy when grant data is loaded
  useEffect(() => {
    const fetchPolicy = async () => {
      if (!grant?.projectCategory || !grant?.projectType) {
        logger.debug('Cannot fetch policy - missing data:', { 
          projectCategory: grant?.projectCategory, 
          projectType: grant?.projectType,
          grant: grant 
        });
        return;
      }
      
      logger.debug('Fetching policy for:', {
        projectCategory: grant.projectCategory,
        projectType: grant.projectType
      });

      try {
        const policy = await grantPolicyService.getActivePolicy(
          grant.projectCategory,
          grant.projectType
        );
        logger.debug('Fetched grant policy:', policy);
        setActivePolicy(policy);
      } catch (error: unknown) {
        logger.error('Error fetching grant policy:', error);
        setActivePolicy(null);
      }
    };
    
    if (grant) {
      fetchPolicy();
    }
  }, [grant?.projectCategory, grant?.projectType]);

  const fetchPermissions = async () => {
    try {
      const response = await permissionManagementService.getUserPermissions(user!.id);
      const drdPermissions: Record<string, boolean> = {};
      response.data.centralDepartments.forEach(dept => {
        if (dept.centralDept.departmentCode ===
   'DRD') {
          Object.assign(drdPermissions, dept.permissions);
        }
      });
      logger.debug('DRD Permissions:', drdPermissions);
      setUserPermissions(drdPermissions);
    } catch (error: unknown) {
      logger.error('Error fetching permissions:', error);
    }
  };

  const fetchGrant = async () => {
    try {
      setLoading(true);
      const response = await researchService.getContributionById(id);
      setGrant(response.data);
    } catch (error: unknown) {
      logger.error('Error fetching grant:', error);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Calculate incentive and points for a specific investigator based on active policy
   */
  const calculateInvestigatorIncentive = (
    roleType: string,
    investigatorCategory: string
  ): { incentive: number; points: number } => {
    logger.debug('calculateInvestigatorIncentive called:', { roleType, investigatorCategory, activePolicy, grant });
    
    // External investigators get ZERO
    if (investigatorCategory !== 'Internal') {
      logger.debug('Returning 0 - investigator is External');
      return { incentive: 0, points: 0 };
    }

    // No policy loaded yet
    if (!activePolicy || !grant) {
      logger.debug('Returning 0 - no policy or grant:', { activePolicy: !!activePolicy, grant: !!grant });
      return { incentive: 0, points: 0 };
    }

    // Calculate total base amount with bonuses
    let totalIncentive = Number(activePolicy.baseIncentiveAmount);
    const totalPoints = Number(activePolicy.basePoints);
    
    logger.debug('Base amounts:', { totalIncentive, totalPoints });

    // Add international bonus
    if (grant.projectType ===
   'international' && activePolicy.internationalBonus) {
      totalIncentive += Number(activePolicy.internationalBonus);
    }

    // Add consortium bonus
    if (grant.numberOfConsortiumOrgs > 0 && activePolicy.consortiumBonus) {
      totalIncentive += Number(activePolicy.consortiumBonus) * grant.numberOfConsortiumOrgs;
    }

    // Count internal investigators (applicant + team)
    // The applicant is always internal unless they are external AND the PI
    const applicantIsInternal = !(grant.isPIExternal && grant.myRole ===
   'pi');
    const internalTeamMembers = grant.investigators?.filter(
      (inv: any) => {
        const isInternalInv = inv.isInternal !== false && 
                              (inv.investigatorCategory ===
   'Internal' || inv.isInternal ===
   true);
        logger.debug('Checking team member:', { 
          name: inv.name, 
          investigatorCategory: inv.investigatorCategory,
          isInternal: inv.isInternal,
          result: isInternalInv 
        });
        return isInternalInv;
      }
    ) || [];
    
    logger.debug('Internal count:', { 
      applicantIsInternal, 
      isPIExternal: grant.isPIExternal,
      myRole: grant.myRole,
      internalTeamMembersCount: internalTeamMembers.length,
      totalInvestigators: grant.investigators?.length
    });
    
    // Count total internal investigators (including applicant if internal)
    const totalInternalCount = (applicantIsInternal ? 1 : 0) + internalTeamMembers.length;
    
    logger.debug('Total internal count:', totalInternalCount);
    
    if (totalInternalCount ===
   0) {
      logger.debug('Returning 0 - no internal investigators');
      return { incentive: 0, points: 0 };
    }

    // Calculate based on split policy
    if (activePolicy.splitPolicy ===
   'equal') {
      // Equal split among all internal investigators (use floor to prevent exceeding total)
      const perPersonIncentive = Math.floor(totalIncentive / totalInternalCount);
      const perPersonPoints = Math.floor(totalPoints / totalInternalCount);
      logger.debug('Equal split result:', { perPersonIncentive, perPersonPoints });
      return { incentive: perPersonIncentive, points: perPersonPoints };
    } else {
      // Percentage-based split using role percentages
      const rolePercentages = activePolicy.rolePercentages || [
        { role: 'pi', percentage: 45 },
        { role: 'co_pi', percentage: 55 }
      ];

      const piPercentage = rolePercentages.find(r => r.role ===
   'pi')?.percentage || 45;
      const coPiTotalPercentage = rolePercentages.find(r => r.role ===
   'co_pi')?.percentage || 55;

      // Count PIs and Co-PIs among ALL internal investigators (including applicant if internal)
      const allInternalInvestigators = [
        ...(applicantIsInternal ? [{ roleType: grant.myRole }] : []),
        ...internalTeamMembers.map((inv: any) => ({ roleType: inv.roleType }))
      ];
      
      const piCount = allInternalInvestigators.filter(inv => inv.roleType ===
   'pi').length;
      const coPiCount = allInternalInvestigators.filter(inv => inv.roleType ===
   'co_pi').length;

      if (roleType ===
   'pi') {
        if (piCount ===
   0) return { incentive: 0, points: 0 };
        // PIs share the PI percentage equally (use floor to prevent exceeding total)
        const piIncentive = Math.floor((totalIncentive * piPercentage) / 100 / piCount);
        const piPoints = Math.floor((totalPoints * piPercentage) / 100 / piCount);
        return { incentive: piIncentive, points: piPoints };
      } else {
        if (coPiCount ===
   0) return { incentive: 0, points: 0 };
        // Co-PIs share the Co-PI percentage equally (use floor to prevent exceeding total)
        const coPiIncentive = Math.floor((totalIncentive * coPiTotalPercentage) / 100 / coPiCount);
        const coPiPoints = Math.floor((totalPoints * coPiTotalPercentage) / 100 / coPiCount);
        return { incentive: coPiIncentive, points: coPiPoints };
      }
    }
  };

  const handleStartReview = async () => {
    try {
      setActionLoading(true);
      await researchService.startGrantReview(id);
      await fetchGrant();
    } catch (error: unknown) {
      logger.error('Error starting review:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!reviewComments.trim() && fieldSuggestions.length ===
   0) {
      toast({ type: 'warning', message: 'Please provide comments or field suggestions' });
      return;
    }

    try {
      setActionLoading(true);
      
      // Build comments string - combine review comments with field suggestions summary
      let finalComments = reviewComments.trim();
      if (fieldSuggestions.length > 0) {
        const suggestionsText = fieldSuggestions.map(s => 
          `${s.fieldName}: ${s.originalValue} → ${s.suggestedValue}${s.note ? ` (${s.note})` : ''}`
        ).join(', ');
        finalComments = finalComments 
          ? `${finalComments}\n\nField Suggestions: ${suggestionsText}`
          : `Field Suggestions: ${suggestionsText}`;
      }
      
      await researchService.requestGrantChanges(id, { 
        comments: finalComments,
        suggestions: fieldSuggestions
      });
      toast({ type: 'success', message: 'Changes requested successfully' });
      setReviewComments('');
      setFieldSuggestions([]);
      setIsEditMode(false);
      await fetchGrant();
    } catch (error: unknown) {
      logger.error('Error requesting changes:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecommend = async () => {
    const confirmed = await confirmAction('Recommend Grant', 'Recommend this grant for approval?');
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await researchService.recommendGrant(id, { comments: reviewComments || 'Recommended for approval' });
      toast({ type: 'success', message: 'Grant recommended successfully' });
      router.push('/drd/research');
    } catch (error: unknown) {
      logger.error('Error recommending grant:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    const confirmed = await confirmAction('Approve Grant', 'Approve this grant application?');
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await researchService.approveGrant(id, { comments: reviewComments || 'Approved' });
      toast({ type: 'success', message: 'Grant approved successfully' });
      router.push('/drd/research');
    } catch (error: unknown) {
      logger.error('Error approving grant:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({ type: 'warning', message: 'Please provide rejection reason' });
      return;
    }

    const confirmed = await confirmAction('Reject Grant', 'Reject this grant? This cannot be undone.');
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await researchService.rejectGrant(id, { reason: rejectReason });
      toast({ type: 'success', message: 'Grant rejected' });
      router.push('/drd/research');
    } catch (error: unknown) {
      logger.error('Error rejecting grant:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  // Edit mode functions
  const getFieldValue = (fieldName: string): string => {
    if (!grant) return '';
    const value = (grant as any)[fieldName];
    if (value ===
   null || value ===
   undefined) return '';
    // Handle array values (like sdgGoals)
    if (Array.isArray(value)) return value.join(',');
    return String(value);
  };

  const startEditingField = (fieldName: string) => {
    const originalValue = getFieldValue(fieldName);
    setEditingField(fieldName);
    setTempSuggestion({
      fieldName,
      originalValue,
      suggestedValue: originalValue,
      note: ''
    });
  };

  const saveFieldSuggestion = () => {
    if (!tempSuggestion.fieldName || !tempSuggestion.suggestedValue) return;
    
    const existingIndex = fieldSuggestions.findIndex(s => s.fieldName ===
   tempSuggestion.fieldName);
    const newSuggestion: FieldSuggestion = {
      fieldName: tempSuggestion.fieldName,
      originalValue: tempSuggestion.originalValue || '',
      suggestedValue: tempSuggestion.suggestedValue,
      note: tempSuggestion.note
    };
    
    if (existingIndex >= 0) {
      const updated = [...fieldSuggestions];
      updated[existingIndex] = newSuggestion;
      setFieldSuggestions(updated);
    } else {
      setFieldSuggestions([...fieldSuggestions, newSuggestion]);
    }
    
    setEditingField(null);
    setTempSuggestion({});
  };

  const removeSuggestion = (fieldName: string) => {
    setFieldSuggestions(fieldSuggestions.filter(s => s.fieldName !== fieldName));
  };

  // Auto-calculate duration when dates change
  const calculateDuration = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return months > 0 ? months : 0;
  };

  const handleDateChange = (fieldName: string, value: string) => {
    setTempSuggestion({ ...tempSuggestion, suggestedValue: value });
    
    // Auto-calculate duration when dates change
    if (fieldName ===
   'projectStartDate' || fieldName ===
   'projectEndDate') {
      const startDate = fieldName ===
   'projectStartDate' ? value : grant.projectStartDate;
      const endDate = fieldName ===
   'projectEndDate' ? value : grant.projectEndDate;
      
      if (startDate && endDate) {
        const duration = calculateDuration(startDate, endDate);
        if (duration > 0) {
          // Add or update duration suggestion
          const durationSuggestion: FieldSuggestion = {
            fieldName: 'projectDurationMonths',
            originalValue: String(grant.projectDurationMonths || 0),
            suggestedValue: String(duration),
            note: 'Auto-calculated from dates'
          };
          
          const existingIndex = fieldSuggestions.findIndex(s => s.fieldName ===
   'projectDurationMonths');
          if (existingIndex >= 0) {
            const updated = [...fieldSuggestions];
            updated[existingIndex] = durationSuggestion;
            setFieldSuggestions(updated);
          } else {
            setFieldSuggestions([...fieldSuggestions, durationSuggestion]);
          }
        }
      }
    }
  };

  const renderEditableField = (fieldName: string, displayValue: string | React.ReactNode, type: 'text' | 'number' | 'date' | 'select' | 'multiselect' = 'text', options?: string[]) => {
    const isEditing = editingField ===
   fieldName;
    const suggestion = fieldSuggestions.find(s => s.fieldName ===
   fieldName);
    
    if (!isEditMode) {
      return <div className="font-medium">{displayValue}</div>;
    }
    
    if (isEditing) {
      return (
        <div className="space-y-2">
          <div className="text-xs text-gray-500">Original: {tempSuggestion.originalValue || 'N/A'}</div>
          {type ===
   'multiselect' && options ? (
            <div className="space-y-2 max-h-60 overflow-y-auto border border-blue-300 rounded-lg p-3">
              {options.map(opt => {
                const isSelected = tempSuggestion.suggestedValue?.split(',').includes(opt);
                const sdgLabel = SDG_GOALS.find(sdg => sdg.value ===
   opt)?.label || opt;
                return (
                  <label key={opt} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        const currentValues = tempSuggestion.suggestedValue?.split(',').filter(Boolean) || [];
                        const newValues = e.target.checked 
                          ? [...currentValues, opt]
                          : currentValues.filter(v => v !== opt);
                        setTempSuggestion({ ...tempSuggestion, suggestedValue: newValues.join(',') });
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{sdgLabel}</span>
                  </label>
                );
              })}
            </div>
          ) : type ===
   'select' && options ? (
            <select
              value={tempSuggestion.suggestedValue || ''}
              onChange={(e) => setTempSuggestion({ ...tempSuggestion, suggestedValue: e.target.value })}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm capitalize"
            >
              <option value="">Select...</option>
              {options.map(opt => (
                <option key={opt} value={opt} className="capitalize">{opt.replace('_', ' ')}</option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              value={tempSuggestion.suggestedValue || ''}
              onChange={(e) => {
                if (type ===
   'date') {
                  handleDateChange(fieldName, e.target.value);
                } else {
                  setTempSuggestion({ ...tempSuggestion, suggestedValue: e.target.value });
                }
              }}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          )}
          <input
            type="text"
            placeholder="Add a note (optional)"
            value={tempSuggestion.note || ''}
            onChange={(e) => setTempSuggestion({ ...tempSuggestion, note: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <div className="flex gap-2">
            <button onClick={saveFieldSuggestion} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
              <CheckCircle className="w-3 h-3 inline mr-1" />
              Save
            </button>
            <button onClick={() => setEditingField(null)} className="px-3 py-1 bg-gray-400 text-white text-xs rounded hover:bg-gray-500">
              Cancel
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex items-start justify-between group hover:bg-blue-50 rounded-lg p-2 -m-2 transition-colors border border-transparent hover:border-blue-200">
        <div className="font-medium flex-1">
          {suggestion ? (
            <div className="space-y-1">
              <span className="line-through text-gray-400">{displayValue}</span>
              <span className="block text-green-600 font-semibold">{suggestion.suggestedValue}</span>
              {suggestion.note && <span className="block text-xs text-gray-500 italic">Note: {suggestion.note}</span>}
            </div>
          ) : (
            displayValue
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startEditingField(fieldName)}
            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            title="Suggest edit"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          {suggestion && (
            <button
              onClick={() => removeSuggestion(fieldName)}
              className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
              title="Remove suggestion"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="h-9 w-36 bg-gray-200 rounded-lg animate-pulse" />
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="h-7 w-2/3 bg-gray-200 rounded-lg animate-pulse mb-4" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 w-full bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i}>
                <div className="h-4 w-28 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!grant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Grant not found</h2>
          <Link href="/drd/research" className="text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[grant.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.submitted;
  const StatusIcon = statusConfig.icon;
  
  // Check if user has reviewed the current submission
  // If status is 'resubmitted', they can review again even if they reviewed before
  // If status is 'recommended' and user has approve permission, they can approve even if they reviewed (recommended) it
  const canReviewAgain = grant.status ===
   'resubmitted';
  const canApproveAfterRecommending = grant.status ===
   'recommended' && userPermissions.grant_approve;
  const userHasReviewedCurrentSubmission = (canReviewAgain || canApproveAfterRecommending) ? false : grant.reviews?.some((review: any) => review.reviewerId ===
   user?.id);

  logger.debug('Grant Status:', grant.status);
  logger.debug('Can Review Again:', canReviewAgain);
  logger.debug('Can Approve After Recommending:', canApproveAfterRecommending);
  logger.debug('User Has Reviewed Current Submission:', userHasReviewedCurrentSubmission);
  logger.debug('User Permissions:', userPermissions);
  logger.debug('User ID:', user?.id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Link
            href="/drd/research"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">{grant.title}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm text-gray-500">{grant.applicationNumber}</span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                    <StatusIcon className="w-4 h-4 mr-1.5" />
                    {statusConfig.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Edit Mode Toggle */}
        {!userHasReviewedCurrentSubmission && ['under_review', 'resubmitted', 'recommended'].includes(grant.status) && (userPermissions.grant_review || userPermissions.grant_approve) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Edit Mode</h3>
                <p className="text-sm text-gray-500">Suggest changes to grant fields</p>
              </div>
              <button
                onClick={() => {
                  setIsEditMode(!isEditMode);
                  if (isEditMode) {
                    setFieldSuggestions([]);
                    setEditingField(null);
                  }
                }}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  isEditMode ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                {isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
              </button>
            </div>
            {fieldSuggestions.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  {fieldSuggestions.length} field suggestion(s) added
                </p>
              </div>
            )}
          </div>
        )}

        {/* Grant Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Grant Application Details</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-500">Title</div>
              {renderEditableField('title', grant.title)}
            </div>
            <div>
              <div className="text-sm text-gray-500">Project Type</div>
              <div className="font-medium capitalize">{grant.projectType?.replace('_', ' ')}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Agency Name</div>
              {renderEditableField('agencyName', grant.agencyName || 'N/A')}
            </div>
            <div>
              <div className="text-sm text-gray-500">Project Duration</div>
              {renderEditableField('projectDurationMonths', `${grant.projectDurationMonths || 'N/A'} months`, 'number')}
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Project Start Date</div>
                {renderEditableField('projectStartDate', grant.projectStartDate ? new Date(grant.projectStartDate).toLocaleDateString() : 'N/A', 'date')}
              </div>
              <div>
                <div className="text-sm text-gray-500">Project End Date</div>
                {renderEditableField('projectEndDate', grant.projectEndDate ? new Date(grant.projectEndDate).toLocaleDateString() : 'N/A', 'date')}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Submitted Amount</div>
              {renderEditableField('submittedAmount', grant.submittedAmount ? `₹${parseFloat(grant.submittedAmount).toLocaleString()}` : 'N/A', 'number')}
            </div>
            <div>
              <div className="text-sm text-gray-500">Project Status</div>
              {renderEditableField('projectStatus', grant.projectStatus?.replace('_', ' ') || 'N/A', 'select', ['submitted', 'approved'])}
            </div>
            <div>
              <div className="text-sm text-gray-500">Project Category</div>
              {renderEditableField('projectCategory', grant.projectCategory?.replace('_', ' ') || 'N/A', 'select', ['govt', 'non_govt', 'industry'])}
            </div>
            {grant.fundingAgencyType && (
              <div>
                <div className="text-sm text-gray-500">Funding Agency Type</div>
                {renderEditableField('fundingAgencyType', grant.fundingAgencyType.toUpperCase() || 'N/A', 'select', ['dst', 'dbt', 'anrf', 'csir', 'icssr', 'other'])}
              </div>
            )}
            {grant.fundingAgencyName && (
              <div>
                <div className="text-sm text-gray-500">Funding Agency Name</div>
                {renderEditableField('fundingAgencyName', grant.fundingAgencyName)}
              </div>
            )}
            <div>
              <div className="text-sm text-gray-500">Total Investigators</div>
              {renderEditableField('totalInvestigators', String(grant.totalInvestigators), 'number')}
            </div>
            <div>
              <div className="text-sm text-gray-500">Internal PIs / Co-PIs</div>
              <div className="font-medium">
                {(() => {
                  // Calculate actual internal PI/Co-PI counts from investigators
                  const allInvestigators = [
                    { roleType: grant.myRole, isInternal: !grant.isPIExternal },
                    ...(grant.investigators || [])
                  ];
                  
                  const internalPIs = allInvestigators.filter(inv => 
                    inv.roleType ===
   'pi' && 
                    (inv.isInternal !== false && (inv.investigatorCategory ===
   'Internal' || inv.isInternal ===
   true || inv.uid !== null))
                  ).length;
                  
                  const internalCoPIs = allInvestigators.filter(inv => 
                    inv.roleType ===
   'co_pi' && 
                    (inv.isInternal !== false && (inv.investigatorCategory ===
   'Internal' || inv.isInternal ===
   true || inv.uid !== null))
                  ).length;
                  
                  return `${internalPIs} / ${internalCoPIs}`;
                })()}
              </div>
            </div>
          </div>

          {grant.sdgGoals && grant.sdgGoals.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-500">SDG Goals</div>
                {isEditMode && (
                  <button
                    onClick={() => startEditingField('sdgGoals')}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {renderEditableField(
                'sdgGoals', 
                <div className="flex flex-wrap gap-2">
                  {grant.sdgGoals.map((sdg: string) => (
                    <span key={sdg} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm">
                      {SDG_GOALS.find(s => s.value ===
   sdg)?.label || sdg.toUpperCase()}
                    </span>
                  ))}
                </div>,
                'multiselect',
                SDG_GOALS.map(sdg => sdg.value)
              )}
            </div>
          )}
        </div>

        {/* Incentives & Points (Approved Grants) */}
        {grant.status ===
   'approved' && (grant.calculatedIncentiveAmount || grant.incentiveAmount || grant.calculatedPoints || grant.pointsAwarded) && (
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl shadow-sm border-2 border-emerald-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Award className="w-5 h-5 mr-2 text-emerald-600" />
              Incentive Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Calculated Incentive Amount */}
              {(grant.calculatedIncentiveAmount || grant.incentiveAmount) && (
                <div className="bg-white rounded-lg p-4 border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Incentive Amount</div>
                      <div className="text-2xl font-bold text-emerald-600">
                        ₹{parseFloat(grant.incentiveAmount || grant.calculatedIncentiveAmount).toLocaleString('en-IN')}
                      </div>
                      {grant.calculatedIncentiveAmount && grant.incentiveAmount && 
                       parseFloat(grant.calculatedIncentiveAmount) !== parseFloat(grant.incentiveAmount) && (
                        <div className="text-xs text-gray-500 mt-1">
                          Originally: ₹{parseFloat(grant.calculatedIncentiveAmount).toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>
                    <DollarSign className="w-12 h-12 text-emerald-300" />
                  </div>
                </div>
              )}

              {/* Calculated Points */}
              {(grant.calculatedPoints || grant.pointsAwarded) && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Research Points</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {grant.pointsAwarded || grant.calculatedPoints} pts
                      </div>
                      {grant.calculatedPoints && grant.pointsAwarded && 
                       grant.calculatedPoints !== grant.pointsAwarded && (
                        <div className="text-xs text-gray-500 mt-1">
                          Originally: {grant.calculatedPoints} pts
                        </div>
                      )}
                    </div>
                    <Award className="w-12 h-12 text-blue-300" />
                  </div>
                </div>
              )}
            </div>
            {grant.creditedAt && (
              <div className="mt-4 text-sm text-gray-600 flex items-center">
                <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
                Incentive credited on {new Date(grant.creditedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        )}

        {/* Applicant Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-600" />
            Applicant {grant.myRole && `(${ROLE_LABELS[grant.myRole] || grant.myRole})`}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Name</div>
              <div className="font-medium">{grant.applicantUser?.employeeDetails?.displayName}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Email</div>
              <div className="font-medium">{grant.applicantUser?.email}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Faculty/School</div>
              <div className="font-medium">{grant.school?.facultyName}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Department</div>
              <div className="font-medium">{grant.department?.departmentName}</div>
            </div>
            {/* Applicant Incentive & Points */}
            {activePolicy && (
              <>
                <div>
                  <div className="text-sm text-gray-500">Est. Incentive</div>
                  <div className="font-medium">
                    {(() => {
                      // Applicant is internal unless they are external AND the PI
                      const applicantIsInternal = !(grant.isPIExternal && grant.myRole ===
   'pi');
                      const calc = calculateInvestigatorIncentive(
                        grant.myRole,
                        applicantIsInternal ? 'Internal' : 'External'
                      );
                      return (
                        <span className={`flex items-center gap-1 ${
                          calc.incentive > 0 ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          <Coins className="w-4 h-4" />
                          ₹{calc.incentive.toLocaleString()}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Est. Points</div>
                  <div className="font-medium">
                    {(() => {
                      // Applicant is internal unless they are external AND the PI
                      const applicantIsInternal = !(grant.isPIExternal && grant.myRole ===
   'pi');
                      const calc = calculateInvestigatorIncentive(
                        grant.myRole,
                        applicantIsInternal ? 'Internal' : 'External'
                      );
                      return (
                        <span className={`flex items-center gap-1 ${
                          calc.points > 0 ? 'text-blue-600' : 'text-gray-400'
                        }`}>
                          <Award className="w-4 h-4" />
                          {calc.points} pts
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Project Team (Other Investigators) */}
        {grant.investigators && grant.investigators.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-purple-600" />
              Project Team ({grant.investigators.length})
            </h2>
            <div className="space-y-3">
              {grant.investigators.map((inv: any, index: number) => {
                // Determine if investigator is internal or external
                const isInternal = inv.isInternal !== undefined ? inv.isInternal : 
                                  inv.investigatorCategory ===
   'Internal' ||
                                  inv.uid !== null;
                
                // Calculate incentive for this investigator
                const incentiveCalc = calculateInvestigatorIncentive(
                  inv.roleType,
                  isInternal ? 'Internal' : 'External'
                );
                
                return (
                  <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{inv.name}</p>
                      <p className="text-sm text-gray-500">
                        {inv.email} • {ROLE_LABELS[inv.roleType] || inv.roleType || inv.role}
                        {inv.affiliation && ` • ${inv.affiliation}`}
                      </p>
                      {inv.designation && (
                        <p className="text-xs text-gray-400">{inv.designation}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Incentive Display */}
                      {activePolicy && (
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-sm font-semibold flex items-center gap-1 ${
                            incentiveCalc.incentive > 0 ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            <Coins className="w-4 h-4" />
                            ₹{incentiveCalc.incentive.toLocaleString()}
                          </span>
                          <span className={`text-sm font-semibold flex items-center gap-1 ${
                            incentiveCalc.points > 0 ? 'text-blue-600' : 'text-gray-400'
                          }`}>
                            <Award className="w-4 h-4" />
                            {incentiveCalc.points} pts
                          </span>
                        </div>
                      )}
                      <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        isInternal ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {isInternal ? 'Internal' : 'External'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Documents */}
        {grant.proposalFilePath && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Proposal Document
            </h2>
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className="w-6 h-6 text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">Grant Proposal</div>
                  <div className="text-sm text-gray-500">Project proposal document</div>
                </div>
              </div>
              <a
                href={getFileUrl(grant.proposalFilePath)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View
              </a>
            </div>
          </div>
        )}

        {/* Review Actions */}
        {['submitted', 'under_review', 'resubmitted', 'recommended'].includes(grant.status) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Review Actions</h2>
            
            {userHasReviewedCurrentSubmission && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                <CheckCircle className="w-5 h-5 text-blue-600 inline mr-2" />
                <span className="text-blue-800 font-medium">You have already reviewed this grant</span>
              </div>
            )}

            {!userHasReviewedCurrentSubmission && grant.status ===
   'submitted' && userPermissions.grant_review && (
              <button
                onClick={handleStartReview}
                disabled={actionLoading}
                className="w-full mb-4 px-6 py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Clock className="w-5 h-5 mr-2" />}
                Start Review
              </button>
            )}

            {!userHasReviewedCurrentSubmission && ['under_review', 'resubmitted', 'recommended'].includes(grant.status) && (
              <div className="space-y-4">
                {/* Review Comments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Review Comments</label>
                  <textarea
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    rows={4}
                    placeholder="Provide your review comments..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Reviewer Actions - Only show if user has review permission but NOT approve permission, and NOT recommended */}
                {userPermissions.grant_review && !userPermissions.grant_approve && grant.status !== 'recommended' && (
                  <div className="space-y-3">
                    <div className="flex gap-4">
                      <button
                        onClick={handleRecommend}
                        disabled={actionLoading}
                        className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Award className="w-5 h-5 mr-2" />}
                        Recommend for Approval
                      </button>
                      <button
                        onClick={handleRequestChanges}
                        disabled={actionLoading || (!reviewComments.trim() && fieldSuggestions.length ===
   0)}
                        className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
                        Request Changes
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        const reason = prompt('Please provide rejection reason:');
                        if (reason) {
                          setRejectReason(reason);
                          handleReject();
                        }
                      }}
                      disabled={actionLoading}
                      className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <XCircle className="w-5 h-5 mr-2" />}
                      Reject Grant
                    </button>
                  </div>
                )}

                {/* Approver with Review Permission - Can directly approve, request changes, or reject */}
                {userPermissions.grant_review && userPermissions.grant_approve && grant.status !== 'recommended' && (
                  <div className="space-y-3">
                    <div className="flex gap-4">
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                        Approve Grant
                      </button>
                      <button
                        onClick={handleRequestChanges}
                        disabled={actionLoading || (!reviewComments.trim() && fieldSuggestions.length ===
   0)}
                        className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
                        Request Changes
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        const reason = prompt('Please provide rejection reason:');
                        if (reason) {
                          setRejectReason(reason);
                          handleReject();
                        }
                      }}
                      disabled={actionLoading}
                      className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <XCircle className="w-5 h-5 mr-2" />}
                      Reject Grant
                    </button>
                  </div>
                )}

                {/* Pure Approver Actions - Only show if user has ONLY approve permission (not review) OR status is recommended */}
                {userPermissions.grant_approve && (!userPermissions.grant_review || grant.status ===
   'recommended') && (
                  <>
                    <div className="border-t pt-4 mt-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Final Approval Actions</h3>
                      <div className="space-y-3">
                        <div className="flex gap-4">
                          <button
                            onClick={handleApprove}
                            disabled={actionLoading}
                            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                          >
                            {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                            Approve Grant
                          </button>
                          <button
                            onClick={handleRequestChanges}
                            disabled={actionLoading || (!reviewComments.trim() && fieldSuggestions.length ===
   0)}
                            className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                          >
                            {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
                            Request Changes
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            const reason = prompt('Please provide rejection reason:');
                            if (reason) {
                              setRejectReason(reason);
                              handleReject();
                            }
                          }}
                          disabled={actionLoading}
                          className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                        >
                          {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <XCircle className="w-5 h-5 mr-2" />}
                          Reject Grant
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Status History */}
        {grant.statusHistory && grant.statusHistory.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status History</h2>
            <div className="space-y-3">
              {grant.statusHistory.map((history: any, index: number) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {history.fromStatus} → {history.toStatus}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(history.changedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {history.comments && (
                      <p className="text-sm text-gray-600 mt-1">{history.comments}</p>
                    )}
                    {history.changedBy && (
                      <p className="text-xs text-gray-500 mt-1">
                        By: {history.changedBy.employeeDetails?.displayName || history.changedBy.uid}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
