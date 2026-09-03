'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { researchService, GrantApplication } from '@/features/research-management/services/research.service';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import grantPolicyService, { GrantIncentivePolicy } from '@/features/research-management/services/grantPolicy.service';
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  DollarSign, 
  Users, 
  Building2, 
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Send,
  RefreshCw,
  MessageSquare,
  Check,
  X,
  Sparkles,
  Award,
  Coins
} from 'lucide-react';
import Link from 'next/link';

interface EditSuggestion {
  id: string;
  fieldName: string;
  fieldPath?: string;
  originalValue: string;
  suggestedValue: string;
  suggestionNote?: string;
  status: 'pending' | 'accepted' | 'rejected';
  reviewerId: string;
  reviewer?: { uid: string; employeeDetails?: { displayName: string } };
  createdAt: string;
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', icon: FileText, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
  submitted: { label: 'Submitted', icon: Send, color: 'text-[#7d1a34]', bgColor: 'bg-[#fdf5ec]', borderColor: 'border-[#f0e2d2]' },
  under_review: { label: 'Under Review', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  changes_required: { label: 'Changes Required', icon: AlertCircle, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  resubmitted: { label: 'Resubmitted', icon: RefreshCw, color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
  recommended: { label: 'Recommended', icon: Sparkles, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
};

const ROLE_LABELS: Record<string, string> = {
  pi: 'Principal Investigator (PI)',
  co_pi: 'Co-Principal Investigator (Co-PI)',
};

export default function GrantDetailPage() {
  const params = useParams() as Record<string, string>;
  const router = useRouter();
  const { toast } = useToast();
  const [grant, setGrant] = useState<GrantApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState<string | null>(null);
  const [editSuggestions, setEditSuggestions] = useState<EditSuggestion[]>([]);
  const [activePolicy, setActivePolicy] = useState<GrantIncentivePolicy | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchGrant(params.id as string);
    }
  }, [params.id]);
  
  // Fetch active grant policy when grant data is loaded
  useEffect(() => {
    const fetchPolicy = async () => {
      if (!grant?.projectCategory || !grant?.projectType) return;
      
      try {
        const policy = await grantPolicyService.getActivePolicy(
          grant.projectCategory,
          grant.projectType
        );
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

  const fetchGrant = async (id: string) => {
    try {
      setLoading(true);
      const response = await researchService.getGrantApplicationById(id);
      logger.debug('Grant fetched:', response.data);
      logger.debug('Edit suggestions:', response.data.editSuggestions);
      setGrant(response.data);
      if (response.data.editSuggestions) {
        logger.debug('Setting edit suggestions:', response.data.editSuggestions);
        setEditSuggestions(response.data.editSuggestions);
      } else {
        logger.debug('No edit suggestions in response');
      }
    } catch (err: unknown) {
      logger.error('Error fetching grant:', err);
      setError(extractErrorMessage(err));
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
    // External investigators get ZERO
    if (investigatorCategory !== 'Internal') {
      return { incentive: 0, points: 0 };
    }

    // No policy loaded yet
    if (!activePolicy || !grant) {
      return { incentive: 0, points: 0 };
    }

    // Calculate total base amount with bonuses
    let totalIncentive = Number(activePolicy.baseIncentiveAmount);
    const totalPoints = Number(activePolicy.basePoints);

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
      (inv: any) => inv.isInternal !== false && 
                    (inv.investigatorCategory ===
   'Internal' || inv.isInternal ===
   true)
    ) || [];
    
    // Count total internal investigators (including applicant if internal)
    const totalInternalCount = (applicantIsInternal ? 1 : 0) + internalTeamMembers.length;
    
    if (totalInternalCount ===
   0) {
      return { incentive: 0, points: 0 };
    }

    // Calculate based on split policy
    if (activePolicy.splitPolicy ===
   'equal') {
      // Equal split among all internal investigators (use floor to prevent exceeding total)
      const perPersonIncentive = Math.floor(totalIncentive / totalInternalCount);
      const perPersonPoints = Math.floor(totalPoints / totalInternalCount);
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

  const handleAcceptSuggestion = async (suggestion: EditSuggestion) => {
    try {
      setSuggestionLoading(suggestion.id);
      await researchService.respondToGrantSuggestion(suggestion.id, true);
      // Refresh grant data to get updated suggestions
      await fetchGrant(params.id as string);
    } catch (error: unknown) {
      logger.error('Error accepting suggestion:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setSuggestionLoading(null);
    }
  };

  const handleRejectSuggestion = async (suggestion: EditSuggestion) => {
    try {
      setSuggestionLoading(suggestion.id);
      await researchService.respondToGrantSuggestion(suggestion.id, false);
      await fetchGrant(params.id as string);
    } catch (error: unknown) {
      logger.error('Error rejecting suggestion:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setSuggestionLoading(null);
    }
  };

  const pendingSuggestions = editSuggestions.filter(s => s.status ===
   'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#7d1a34] mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading grant application...</p>
        </div>
      </div>
    );
  }

  if (error || !grant) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Grant</h3>
          <p className="text-red-700 mb-4">{error || 'Grant application not found'}</p>
          <Link
            href="/research/my-contributions"
            className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Contributions
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[grant.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/research/my-contributions"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to My Contributions
        </Link>
        
        {(grant.status ===
   'draft' || grant.status ===
   'changes_required') && (
          <Link
            href={`/research/apply-grant?edit=${grant.id}`}
            className="inline-flex items-center px-4 py-2 bg-[#7d1a34] hover:bg-[#5e1024] text-white rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4 mr-2" />
            {grant.status ===
   'changes_required' ? 'Edit & Resubmit' : 'Edit Draft'}
          </Link>
        )}
      </div>

      {/* Suggestions Summary */}
      {grant.status ===
   'changes_required' && pendingSuggestions.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 mb-1">
                {pendingSuggestions.length} Pending Suggestion{pendingSuggestions.length > 1 ? 's' : ''} from Reviewer
              </h3>
              <p className="text-sm text-orange-700 mb-4">
                The reviewer has suggested changes to specific fields. Review each suggestion below and either accept (auto-fills the field) or reject it.
              </p>
              
              {/* Suggestions List */}
              <div className="space-y-3">
                {pendingSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="bg-white border border-orange-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center text-sm font-medium text-orange-700 mb-2">
                          <MessageSquare className="w-4 h-4 mr-1.5" />
                          <span className="capitalize">{suggestion.fieldName.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start">
                              <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0 font-medium">Current:</span>
                            <span className="text-red-600 line-through bg-red-50 px-2 py-0.5 rounded flex-1">
                              {suggestion.originalValue || '(empty)'}
                            </span>
                          </div>
                          <div className="flex items-start">
                              <span className="text-gray-500 dark:text-gray-400 w-24 flex-shrink-0 font-medium">Suggested:</span>
                            <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded flex-1">
                              {suggestion.suggestedValue || '(empty)'}
                            </span>
                          </div>
                        </div>
                        {suggestion.suggestionNote && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Note:</span> {suggestion.suggestionNote}
                            </p>
                          </div>
                        )}
                        {suggestion.reviewer?.employeeDetails?.displayName && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Suggested by: {suggestion.reviewer.employeeDetails.displayName}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleAcceptSuggestion(suggestion)}
                          disabled={suggestionLoading ===
   suggestion.id}
                          className="flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                          title="Accept and apply this suggestion"
                        >
                          {suggestionLoading ===
   suggestion.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Apply
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleRejectSuggestion(suggestion)}
                          disabled={suggestionLoading ===
   suggestion.id}
                          className="flex items-center px-3 py-1.5 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
                          title="Reject this suggestion"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {grant.status ===
   'changes_required' && editSuggestions.length > 0 && pendingSuggestions.length ===
   0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-green-900">All Suggestions Resolved</h3>
              <p className="text-sm text-green-700 mt-1">
                You've responded to all reviewer suggestions. Click "Edit & Resubmit" above to make any additional changes and resubmit your application.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header Section */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-[#fdf5ec] to-indigo-50 dark:from-gray-800 dark:to-gray-800">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Application #{grant.applicationNumber || 'Draft'}</span>
                <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${statusConfig.borderColor} ${statusConfig.bgColor} ${statusConfig.color}`}>
                  <StatusIcon className="w-3.5 h-3.5 mr-1.5" />
                  {statusConfig.label}
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{grant.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                {grant.agencyName && (
                  <span className="inline-flex items-center">
                    <Building2 className="w-4 h-4 mr-1.5" />
                    {grant.agencyName}
                  </span>
                )}
                <span className="inline-flex items-center">
                  <Calendar className="w-4 h-4 mr-1.5" />
                  {new Date(grant.dateOfSubmission || grant.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 space-y-6">
          {/* Incentives Summary */}
          {activePolicy && grant && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border-2 border-green-200">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Award className="w-5 h-5 mr-2 text-emerald-600" />
                Estimated Incentives & Points
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-200">
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Total Incentive</label>
                  <p className="text-2xl font-bold text-green-600 flex items-center">
                    <Coins className="w-6 h-6 mr-2" />
                    ₹{(() => {
                      const applicantIsInternal = !(grant.isPIExternal && grant.myRole ===
   'pi');
                      const applicantCalc = calculateInvestigatorIncentive(
                        grant.myRole,
                        applicantIsInternal ? 'Internal' : 'External'
                      );
                      const teamTotal = grant.investigators?.filter(
                        (inv: any) => inv.investigatorCategory ===
   'Internal' || inv.isInternal ===
   true
                      ).reduce((sum: number, inv: any) => {
                        const calc = calculateInvestigatorIncentive(inv.roleType, inv.investigatorCategory || (inv.isInternal ? 'Internal' : 'External'));
                        return sum + calc.incentive;
                      }, 0) || 0;
                      return (applicantCalc.incentive + teamTotal).toLocaleString();
                    })()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">For all internal investigators</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-[#f0e2d2]">
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-2">Total Points</label>
                  <p className="text-2xl font-bold text-[#7d1a34] flex items-center">
                    <Award className="w-6 h-6 mr-2" />
                    {(() => {
                      const applicantIsInternal = !(grant.isPIExternal && grant.myRole ===
   'pi');
                      const applicantCalc = calculateInvestigatorIncentive(
                        grant.myRole,
                        applicantIsInternal ? 'Internal' : 'External'
                      );
                      const teamTotal = grant.investigators?.filter(
                        (inv: any) => inv.investigatorCategory ===
   'Internal' || inv.isInternal ===
   true
                      ).reduce((sum: number, inv: any) => {
                        const calc = calculateInvestigatorIncentive(inv.roleType, inv.investigatorCategory || (inv.isInternal ? 'Internal' : 'External'));
                        return sum + calc.points;
                      }, 0) || 0;
                      return applicantCalc.points + teamTotal;
                    })()} pts
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Research points earned</p>
                </div>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {grant.submittedAmount && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Submitted Amount</label>
                  <p className="font-semibold text-gray-900 dark:text-white flex items-center">
                    <DollarSign className="w-4 h-4 mr-1" />
                    ₹{Number(grant.submittedAmount).toLocaleString()}
                  </p>
                </div>
              )}
              
              {grant.projectType && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Project Type</label>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {grant.projectType ===
   'indian' ? 'Indian Project' : 'International Project'}
                  </p>
                </div>
              )}
              
              {grant.projectStatus && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Project Status</label>
                  <p className="font-semibold text-gray-900 dark:text-white capitalize">{grant.projectStatus}</p>
                </div>
              )}
              
              {grant.projectCategory && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Project Category</label>
                  <p className="font-semibold text-gray-900 dark:text-white capitalize">{grant.projectCategory}</p>
                </div>
              )}
              
              {grant.fundingAgencyType && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Funding Agency Type</label>
                  <p className="font-semibold text-gray-900 dark:text-white uppercase">{grant.fundingAgencyType}</p>
                </div>
              )}

              {grant.fundingAgencyName && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Funding Agency Name</label>
                  <p className="font-semibold text-gray-900 dark:text-white">{grant.fundingAgencyName}</p>
                </div>
              )}
              
              {grant.myRole && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">My Role in Project</label>
                  <p className="font-semibold text-gray-900 dark:text-white capitalize">
                    {grant.myRole ===
   'pi' ? 'Principal Investigator (PI)' : 'Co-Principal Investigator (Co-PI)'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SDGs */}
          {grant.sdgGoals && grant.sdgGoals.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Sustainable Development Goals</h3>
              <div className="flex flex-wrap gap-2">
                {grant.sdgGoals.map((sdg: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                  >
                    SDG {sdg}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Consortium Organizations */}
          {grant.consortiumOrganizations && grant.consortiumOrganizations.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Consortium Organizations
              </h3>
              <div className="space-y-3">
                {grant.consortiumOrganizations.map((org, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Organization Name</label>
                        <p className="font-medium text-gray-900 dark:text-white">{org.organizationName}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Country</label>
                        <p className="font-medium text-gray-900 dark:text-white">{org.country}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Members</label>
                        <p className="font-medium text-gray-900 dark:text-white">{org.numberOfMembers}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Investigators */}
          {grant.investigators && grant.investigators.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Project Team ({grant.investigators.length + 1})
              </h3>
              <div className="space-y-3">
                {/* Applicant (You) */}
                <div className="bg-gradient-to-r from-[#fdf5ec] to-indigo-50 rounded-lg p-4 border-2 border-[#f0e2d2]">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Name</label>
                      <p className="font-semibold text-gray-900 dark:text-white">You (Applicant)</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Role</label>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                        grant.myRole ===
   'pi' 
                          ? 'bg-[#fbe2e8] text-[#7d1a34]' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {ROLE_LABELS[grant.myRole] || grant.myRole}
                      </span>
                    </div>
                    {activePolicy && (
                      <>
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Est. Incentive</label>
                          <p className="font-semibold text-green-600 flex items-center">
                            <Coins className="w-4 h-4 mr-1" />
                            ₹{(() => {
                              const applicantIsInternal = !(grant.isPIExternal && grant.myRole ===
   'pi');
                              const calc = calculateInvestigatorIncentive(
                                grant.myRole,
                                applicantIsInternal ? 'Internal' : 'External'
                              );
                              return calc.incentive.toLocaleString();
                            })()}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Est. Points</label>
                          <p className="font-semibold text-[#7d1a34] flex items-center">
                            <Award className="w-4 h-4 mr-1" />
                            {(() => {
                              const applicantIsInternal = !(grant.isPIExternal && grant.myRole ===
   'pi');
                              const calc = calculateInvestigatorIncentive(
                                grant.myRole,
                                applicantIsInternal ? 'Internal' : 'External'
                              );
                              return calc.points;
                            })()} pts
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Team Members */}
                {grant.investigators.map((inv, index) => {
                  const isInternal = inv.investigatorType ===
   'Internal' || inv.isInternal ===
   true;
                  const calc = activePolicy ? calculateInvestigatorIncentive(
                    inv.roleType,
                    isInternal ? 'Internal' : 'External'
                  ) : { incentive: 0, points: 0 };
                  
                  return (
                    <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Name</label>
                          <p className="font-medium text-gray-900 dark:text-white">{inv.name}</p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Role</label>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                              inv.roleType ===
   'pi' 
                                ? 'bg-[#fbe2e8] text-[#7d1a34]' 
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {ROLE_LABELS[inv.roleType] || inv.roleType}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                              isInternal ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {isInternal ? 'Internal' : 'External'}
                            </span>
                          </div>
                        </div>
                        {activePolicy && (
                          <>
                            <div>
                              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Est. Incentive</label>
                              <p className={`font-semibold flex items-center ${
                                calc.incentive > 0 ? 'text-green-600' : 'text-gray-400'
                              }`}>
                                <Coins className="w-4 h-4 mr-1" />
                                ₹{calc.incentive.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Est. Points</label>
                              <p className={`font-semibold flex items-center ${
                                calc.points > 0 ? 'text-[#7d1a34]' : 'text-gray-400'
                              }`}>
                                <Award className="w-4 h-4 mr-1" />
                                {calc.points} pts
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status History */}
          {grant.statusHistory && grant.statusHistory.length > 0 && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Status History
              </h3>
              <div className="space-y-3">
                {grant.statusHistory.map((history: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="w-10 h-10 bg-[#fbe2e8] rounded-full flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-[#7d1a34]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {history.fromStatus} → {history.toStatus}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                          {new Date(history.changedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {history.comments && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{history.comments}</p>
                      )}
                      {history.changedBy && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          By: {history.changedBy.employeeDetails?.displayName || history.changedBy.uid}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <span className="font-medium">Created:</span>{' '}
                {new Date(grant.createdAt).toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              {grant.updatedAt && grant.updatedAt !== grant.createdAt && (
                <div>
                  <span className="font-medium">Last Updated:</span>{' '}
                  {new Date(grant.updatedAt).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
