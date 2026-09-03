'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { iprService } from '@/features/ipr-management/services/ipr.service';
import api from '@/shared/api/api';
import IPRStatusUpdates from './IPRStatusUpdates';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  FolderOpen,
  Send,
  Search,
  Eye,
  ThumbsUp,
  Ban,
  Edit3,
  Plus,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  MessageSquare,
  Check,
  X,
  ArrowRight,
  CheckSquare,
  Square,
  History,
  Sparkles,
  AlertTriangle,
  Award,
  Coins,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { IPR_STATUS, SUGGESTION_STATUS } from '@/shared/constants';

// Incentive Policy - Expected rewards based on IPR type
const INCENTIVE_POLICY: Record<string, { basePoints: number; baseIncentive: number; description: string }> = {
  patent: { basePoints: 50, baseIncentive: 50000, description: 'Patent Filing' },
  copyright: { basePoints: 20, baseIncentive: 15000, description: 'Copyright Registration' },
  trademark: { basePoints: 15, baseIncentive: 10000, description: 'Trademark Registration' },
  design: { basePoints: 25, baseIncentive: 20000, description: 'Design Registration' },
};

// Enum options for display labels
const ENUM_LABELS: Record<string, Record<string, string>> = {
  iprType: {
    patent: 'Patent',
    copyright: 'Copyright',
    trademark: 'Trademark',
    design: 'Design',
  },
  projectType: {
    phd: 'PhD Research',
    pg_project: 'PG Project',
    ug_project: 'UG Project',
    faculty_research: 'Faculty Research',
    industry_collaboration: 'Industry Collaboration',
    any_other: 'Any Other',
  },
  filingType: {
    provisional: 'Provisional',
    complete: 'Complete',
  },
};

// Valid enum values for validation
const ENUM_VALUES: Record<string, string[]> = {
  iprType: ['patent', 'copyright', 'trademark', 'design'],
  projectType: ['phd', 'pg_project', 'ug_project', 'faculty_research', 'industry_collaboration', 'any_other'],
  filingType: ['provisional', 'complete'],
};

// Helper to check if a value is valid for an enum field
const isValidEnumValue = (fieldName: string, value: string): boolean => {
  if (!ENUM_VALUES[fieldName]) return true; // Not an enum field
  return ENUM_VALUES[fieldName].includes(value);
};

// Helper to get display label for enum value
const getEnumLabel = (fieldName: string, value: string): string => {
  return ENUM_LABELS[fieldName]?.[value] || value;
};

interface EditSuggestion {
  id: string;
  fieldName: string;
  fieldPath?: string;
  originalValue?: string;
  suggestedValue: string;
  suggestionNote?: string;
  status: 'pending' | 'accepted' | 'rejected';
  applicantResponse?: string;
  createdAt: string;
  reviewer: {
    uid: string;
    employeeDetails?: {
      displayName?: string;
      firstName?: string;
    };
  };
}

interface SuggestionResponse {
  action: 'accept' | 'reject';
  response?: string;
}

export default function MyIprApplications() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [applications, setApplications] = useState<any[]>([]);
  const [contributedApplications, setContributedApplications] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'action_required' | 'draft' | 'in_progress' | 'completed' | 'contributed'>('all');
  
  // Expanded application for inline actions
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, EditSuggestion[]>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState<string | null>(null);
  
  // Batch response state
  const [selectedResponses, setSelectedResponses] = useState<Record<string, SuggestionResponse>>({});
  const [responseNotes, setResponseNotes] = useState<Record<string, string>>({});
  const [submittingBatch, setSubmittingBatch] = useState(false);

  // Helper function to calculate stats from both own and contributed applications
  const calculateCombinedStats = useCallback((ownApps: any[], contribApps: any[], baseStats: any) => {
    const validOwnApps = ownApps.filter((app: any) => app && app.id);
    // Filter contributed apps to exclude own applications (prevent double counting)
    const validContribApps = contribApps.filter((app: any) => 
      app && app.id && !validOwnApps.some(own => own.id ===
   app.id)
    );
    
    // Calculate action required count (own apps only)
    const actionRequired = validOwnApps.filter((app: any) => 
      app.status ===
   'changes_required' || app.status ===
   'draft'
    ).length;
    
    // Calculate total incentives and points earned (from published/completed applications)
    const publishedStatuses = ['published', 'completed', 'under_finance_review', 'finance_approved'];
    
    // Own published applications
    const ownCompletedApps = validOwnApps.filter((app: any) => 
      publishedStatuses.includes(app.status)
    );
    
    // Contributed published applications
    const contribCompletedApps = validContribApps.filter((app: any) => 
      publishedStatuses.includes(app.status)
    );
    
    // Calculate incentives from own applications
    const ownIncentives = ownCompletedApps.reduce((sum: number, app: any) => {
      const incentive = Number(app.incentiveAmount) || 0;
      return sum + incentive;
    }, 0);
    
    const ownPoints = ownCompletedApps.reduce((sum: number, app: any) => {
      const points = Number(app.pointsAwarded) || 0;
      return sum + points;
    }, 0);
    
    // Calculate incentives from contributed applications (these are already per-inventor shares)
    const contribIncentives = contribCompletedApps.reduce((sum: number, app: any) => {
      const incentive = Number(app.incentiveAmount) || 0;
      return sum + incentive;
    }, 0);
    
    const contribPoints = contribCompletedApps.reduce((sum: number, app: any) => {
      const points = Number(app.pointsAwarded) || 0;
      return sum + points;
    }, 0);
    
    // Total combined
    const totalIncentives = ownIncentives + contribIncentives;
    const totalPoints = ownPoints + contribPoints;
    const publishedCount = ownCompletedApps.length + contribCompletedApps.length;
    
    return {
      ...baseStats,
      action_required: actionRequired,
      in_progress: (baseStats?.submitted || 0) + (baseStats?.under_review || 0),
      completed: (baseStats?.approved || 0) + (baseStats?.rejected || 0),
      totalIncentives,
      totalPoints,
      publishedCount,
      // Store breakdown for display
      ownIncentives,
      ownPoints,
      ownPublishedCount: ownCompletedApps.length,
      contribIncentives,
      contribPoints,
      contribPublishedCount: contribCompletedApps.length,
    };
  }, []);

  const fetchAllApplications = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch both own and contributed applications in parallel
      const [ownData, contribResponse] = await Promise.all([
        iprService.getMyApplications(),
        api.get('/ipr/contributed').catch(() => ({ data: { success: false, data: [] } }))
      ]);
      
      const validOwnApps = (ownData.data || []).filter((app: any) => app && app.id);
      const validContribApps = contribResponse.data?.success ? (contribResponse.data.data || []) : [];
      
      setApplications(validOwnApps);
      setContributedApplications(validContribApps);
      
      // Calculate combined stats
      const combinedStats = calculateCombinedStats(validOwnApps, validContribApps, ownData.stats);
      setStats(combinedStats);
      
    } catch (error: unknown) {
      logger.error('Error fetching applications:', error);
      setApplications([]);
      setContributedApplications([]);
      setStats({});
    } finally {
      setLoading(false);
    }
  }, [calculateCombinedStats]);

  useEffect(() => {
    fetchAllApplications();
  }, [fetchAllApplications]);

  const fetchSuggestions = async (appId: string) => {
    if (suggestions[appId]) return;
    
    try {
      setLoadingSuggestions(appId);
      const response = await api.get(`/collaborative-editing/${appId}/suggestions`);
      setSuggestions(prev => ({
        ...prev,
        [appId]: response.data.data?.suggestions || []
      }));
    } catch (error: unknown) {
      logger.error('Failed to fetch suggestions:', error);
    } finally {
      setLoadingSuggestions(null);
    }
  };

  const handleExpandApp = async (appId: string) => {
    if (expandedApp ===
   appId) {
      setExpandedApp(null);
      setSelectedResponses({});
      setResponseNotes({});
    } else {
      setExpandedApp(appId);
      setSelectedResponses({});
      setResponseNotes({});
      await fetchSuggestions(appId);
    }
  };

  // Toggle selection for a suggestion
  const handleSelectResponse = (suggestionId: string, action: 'accept' | 'reject') => {
    setSelectedResponses(prev => {
      const current = prev[suggestionId];
      if (current?.action ===
   action) {
        const { [suggestionId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [suggestionId]: { action, response: responseNotes[suggestionId] }
      };
    });
  };

  const handleResponseNote = (suggestionId: string, note: string) => {
    setResponseNotes(prev => ({
      ...prev,
      [suggestionId]: note
    }));
  };

  const handleSelectAll = (appId: string, action: 'accept' | 'reject') => {
    const pending = getPendingSuggestions(appId);
    const newResponses: Record<string, SuggestionResponse> = {};
    let skippedCount = 0;
    
    pending.forEach(s => {
      const isEnumField = s.fieldName in ENUM_LABELS;
      const isInvalid = isEnumField && !isValidEnumValue(s.fieldName, s.suggestedValue);
      
      // If trying to accept an invalid enum value, skip it or mark as reject
      if (action ===
   'accept' && isInvalid) {
        skippedCount++;
        // Don't include in accept selection - leave it for user to reject manually
        return;
      }
      
      newResponses[s.id] = { action, response: responseNotes[s.id] };
    });
    
    setSelectedResponses(newResponses);
    
    // Notify user if some were skipped
    if (skippedCount > 0) {
      toast({ type: 'warning', message: `${skippedCount} suggestion(s) with invalid values were skipped. Invalid values cannot be accepted - please reject them manually.` });
    }
  };

  const handleClearSelection = () => {
    setSelectedResponses({});
  };

  const handleSubmitBatchResponses = async (appId: string) => {
    const pendingSuggestions = getPendingSuggestions(appId);
    const selectedCount = Object.keys(selectedResponses).length;
    
    if (selectedCount ===
   0) {
      toast({ type: 'warning', message: 'Please select at least one suggestion to respond to.' });
      return;
    }

    const allResponded = pendingSuggestions.every(s => selectedResponses[s.id]);
    if (!allResponded) {
      const proceed = await confirm({
        title: 'Partial Submission',
        message: `You have selected ${selectedCount} out of ${pendingSuggestions.length} suggestions. Do you want to submit responses for the selected ones only?`,
        type: 'warning',
        confirmText: 'Submit Selected'
      });
      if (!proceed) return;
    }

    try {
      setSubmittingBatch(true);
      
      const responses = Object.entries(selectedResponses).map(([suggestionId, data]) => ({
        suggestionId,
        action: data.action,
        response: responseNotes[suggestionId] || ''
      }));

      await api.post(`/collaborative-editing/${appId}/suggestions/batch-respond`, { responses });
      
      setSelectedResponses({});
      setResponseNotes({});
      
      const response = await api.get(`/collaborative-editing/${appId}/suggestions`);
      setSuggestions(prev => ({
        ...prev,
        [appId]: response.data.data?.suggestions || []
      }));
      
      await fetchAllApplications();
      toast({ type: 'success', message: 'All responses submitted successfully!' });
    } catch (error: unknown) {
      logger.error('Failed to submit batch responses:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setSubmittingBatch(false);
    }
  };

  // Enhanced status badge with better color coding
  const getStatusBadge = (status: string, hasPendingSuggestions: boolean = false) => {
    const statusConfig: any = {
      draft: { 
        color: 'bg-slate-100 text-slate-700 ring-1 ring-slate-300', 
        icon: Edit3, 
        label: 'Draft',
        description: 'Not yet submitted'
      },
      pending_mentor_approval: { 
        color: 'bg-orange-100 text-orange-700 ring-1 ring-orange-300', 
        icon: Clock, 
        label: 'Pending Mentor Approval',
        description: 'Awaiting mentor approval'
      },
      submitted: { 
        color: 'bg-[#fbe2e8] text-[#7d1a34] ring-1 ring-blue-300', 
        icon: Send, 
        label: 'Submitted',
        description: 'Awaiting review'
      },
      under_drd_review: { 
        color: 'bg-amber-100 text-amber-700 ring-1 ring-amber-300', 
        icon: Search, 
        label: 'Under Review',
        description: 'Being reviewed by DRD'
      },
      recommended_to_head: { 
        color: 'bg-purple-100 text-purple-700 ring-1 ring-purple-300', 
        icon: ArrowRight, 
        label: 'With DRD Head',
        description: 'Awaiting head approval'
      },
      changes_required: { 
        color: hasPendingSuggestions 
          ? 'bg-orange-500 text-white ring-2 ring-orange-300 shadow-lg shadow-orange-200' 
          : 'bg-orange-100 text-orange-700 ring-1 ring-orange-300', 
        icon: AlertTriangle, 
        label: hasPendingSuggestions ? 'Action Required!' : 'Changes Requested',
        description: hasPendingSuggestions ? 'Pending your response' : 'Review changes'
      },
      resubmitted: { 
        color: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300', 
        icon: RefreshCw, 
        label: 'Resubmitted',
        description: 'Under re-review'
      },
      drd_head_approved: { 
        color: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300', 
        icon: CheckCircle, 
        label: 'DRD Approved',
        description: 'Proceeding to govt filing'
      },
      submitted_to_govt: { 
        color: 'bg-[#fbe2e8] text-[#7d1a34] ring-1 ring-blue-300', 
        icon: Send, 
        label: 'Submitted to Govt',
        description: 'Filed with government'
      },
      govt_application_filed: { 
        color: 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-300', 
        icon: FileText, 
        label: 'Govt Filed',
        description: 'Awaiting publication'
      },
      published: { 
        color: 'bg-green-500 text-white ring-2 ring-green-300', 
        icon: Award, 
        label: 'Published',
        description: 'Successfully published & incentives credited'
      },
      // Kept for backward compatibility with old records
      under_finance_review: { 
        color: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300', 
        icon: Clock, 
        label: 'Published',
        description: 'Incentives credited'
      },
      finance_approved: { 
        color: 'bg-green-500 text-white ring-2 ring-green-300', 
        icon: CheckCircle, 
        label: 'Completed',
        description: 'Incentives processed'
      },
      completed: { 
        color: 'bg-green-500 text-white ring-2 ring-green-300', 
        icon: ThumbsUp, 
        label: 'Completed',
        description: 'Successfully filed'
      },
      drd_rejected: { 
        color: 'bg-red-100 text-red-700 ring-1 ring-red-300', 
        icon: Ban, 
        label: 'Rejected',
        description: 'Application rejected'
      },
      // Note: finance_rejected kept for backward compatibility with old records
      finance_rejected: { 
        color: 'bg-red-100 text-red-700 ring-1 ring-red-300', 
        icon: Ban, 
        label: 'Rejected',
        description: 'Application rejected'
      },
      cancelled: { 
        color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 ring-1 ring-gray-300 dark:ring-gray-600', 
        icon: XCircle, 
        label: 'Cancelled',
        description: 'Application cancelled'
      },
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300', icon: FileText, label: status };
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${config.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };

  // Get application card styling based on status
  const getApplicationCardStyle = (app: any, pendingSuggestions: EditSuggestion[]) => {
    const hasPending = pendingSuggestions.length > 0;
    
    if (app.status ===
   'changes_required' && hasPending) {
      return 'border-orange-400 ring-2 ring-orange-200 bg-gradient-to-r from-orange-50 to-white';
    }
    if (app.status ===
   IPR_STATUS.DRAFT) {
      return 'border-slate-300 bg-gradient-to-r from-slate-50 to-white';
    }
    if (app.status ===
   IPR_STATUS.COMPLETED || app.status ===
   'published') {
      return 'border-green-300 bg-gradient-to-r from-green-50 to-white';
    }
    if (app.status ===
   IPR_STATUS.DRD_REJECTED) {
      return 'border-red-200 bg-gradient-to-r from-red-50 to-white';
    }
    return 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600';
  };

  const getApplicationsToDisplay = () => {
    switch (activeTab) {
      case 'action_required':
        return applications.filter(app => app.status ===
   IPR_STATUS.CHANGES_REQUIRED || app.status ===
   IPR_STATUS.DRAFT);
      case 'in_progress':
        return applications.filter(app => 
          [IPR_STATUS.SUBMITTED, IPR_STATUS.UNDER_DRD_REVIEW, 'recommended_to_head', IPR_STATUS.RESUBMITTED, 'drd_head_approved', 'submitted_to_govt', 'govt_application_filed'].includes(app.status)
        );
      case 'completed':
        return applications.filter(app => 
          [IPR_STATUS.COMPLETED, 'published', IPR_STATUS.DRD_REJECTED, 'cancelled'].includes(app.status)
        );
      case 'draft':
        return applications.filter(app => app.status ===
   IPR_STATUS.DRAFT);
      case 'contributed':
        return contributedApplications;
      default:
        return applications;
    }
  };

  const getPendingSuggestions = (appId: string) => {
    return (suggestions[appId] || []).filter(s => s.status ===
   SUGGESTION_STATUS.PENDING);
  };

  const getRespondedSuggestions = (appId: string) => {
    return (suggestions[appId] || []).filter(s => s.status !== SUGGESTION_STATUS.PENDING);
  };

  const getReviewerName = (suggestion: EditSuggestion) => {
    return suggestion.reviewer?.employeeDetails?.displayName || 
           suggestion.reviewer?.employeeDetails?.firstName || 
           suggestion.reviewer?.uid || 'Reviewer';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-[#fdf5ec] dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-[#f0e2d2] dark:border-[#5e1024] rounded-full animate-spin border-t-blue-600 mx-auto"></div>
            <FolderOpen className="w-8 h-8 text-[#7d1a34] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-6 text-gray-600 dark:text-gray-400 font-medium">Loading your applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Hero Header - LMS Style */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#005b96] rounded-xl flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">My IPR Applications</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Track and manage your intellectual property filings</p>
            </div>
          </div>
          
          <Link
            href="/ipr/apply"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#005b96] text-white rounded-xl hover:bg-[#03396c] transition-all font-medium group shadow-sm"
          >
            <Plus className="w-5 h-5" />
            New Application
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        
        {/* Stats Row */}
        <div className="flex items-center gap-3 mt-6 flex-wrap">
          <div className="flex items-center gap-2 bg-[#e6f2fa] text-[#005b96] px-4 py-2 rounded-xl">
            <FileText className="w-4 h-4" />
            <span className="font-semibold">{stats.total || 0}</span>
            <span className="text-sm">Total</span>
          </div>
          {stats.action_required > 0 && (
            <div className="flex items-center gap-2 bg-[#f39c12] text-white px-4 py-2 rounded-xl">
              <AlertCircle className="w-4 h-4" />
              <span className="font-semibold">{stats.action_required}</span>
              <span className="text-sm">Need Action</span>
            </div>
          )}
          {stats.in_progress > 0 && (
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl">
              <Clock className="w-4 h-4" />
              <span className="font-semibold">{stats.in_progress}</span>
              <span className="text-sm">In Progress</span>
            </div>
          )}
        </div>
      </div>

      {/* Incentives & Points Summary Table */}
      {(stats.totalIncentives > 0 || stats.totalPoints > 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-[#005b96] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">IPR Earnings Summary</h2>
                <p className="text-blue-100 text-sm">Your total incentives and research points earned</p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Published IPRs</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Total Incentive (₹)</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Total Points</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Summary Row */}
                  <tr className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-b-2 border-emerald-200 dark:border-emerald-800">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                          <TrendingUp className="w-5 h-5 text-emerald-600" />
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white">Total Earnings</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-10 bg-emerald-100 text-emerald-700 font-bold rounded-full text-lg">
                        {stats.publishedCount || 0}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Coins className="w-5 h-5 text-amber-500" />
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">₹{(stats.totalIncentives || 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Award className="w-5 h-5 text-purple-500" />
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalPoints || 0}</span>
                      </div>
                    </td>
                  </tr>
                  
                  {/* My Applications Earnings */}
                  {(stats.ownIncentives > 0 || stats.ownPoints > 0) && (
                    <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-[#fdf5ec] dark:hover:bg-[#5e1024]/10 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-[#fbe2e8] dark:bg-[#7d1a34]/20 rounded-lg">
                            <FileText className="w-4 h-4 text-[#7d1a34]" />
                          </div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">My Applications</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{stats.ownPublishedCount || 0}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold text-[#7d1a34]">₹{(stats.ownIncentives || 0).toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold text-[#7d1a34]">{stats.ownPoints || 0}</span>
                      </td>
                    </tr>
                  )}
                  
                  {/* Contributed Applications Earnings */}
                  {(stats.contribIncentives > 0 || stats.contribPoints > 0) && (
                    <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <ThumbsUp className="w-4 h-4 text-green-600" />
                          </div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">As Contributor</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{stats.contribPublishedCount || 0}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold text-green-600">₹{(stats.contribIncentives || 0).toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold text-green-600">{stats.contribPoints || 0}</span>
                      </td>
                    </tr>
                  )}
                  
                  {/* Breakdown by IPR Type - combined from both own and contributed */}
                  {(() => {
                    const publishedStatuses = ['published', 'completed', 'under_finance_review', 'finance_approved'];
                    const allPublishedApps = [
                      ...applications.filter((app: any) => publishedStatuses.includes(app.status)),
                      ...contributedApplications
                        .filter((app: any) => publishedStatuses.includes(app.status))
                        .filter((app: any) => !applications.some(own => own.id ===
   app.id))
                    ];
                    
                    return allPublishedApps
                      .reduce((acc: any[], app: any) => {
                        const type = app.iprType?.toLowerCase() || 'other';
                        const existing = acc.find(item => item.type ===
   type);
                        const incentive = Number(app.incentiveAmount) || 0;
                        const points = Number(app.pointsAwarded) || 0;
                        
                        if (existing) {
                          existing.count++;
                          existing.incentive += incentive;
                          existing.points += points;
                        } else {
                          acc.push({ type, count: 1, incentive, points });
                        }
                        return acc;
                      }, [])
                      .map((item: any) => (
                        <tr key={item.type} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium uppercase">
                                {item.type}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{item.count}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-semibold text-amber-600">₹{item.incentive.toLocaleString()}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-semibold text-purple-600">{item.points}</span>
                          </td>
                        </tr>
                      ));
                  })()}
                </tbody>
              </table>
            </div>
            
            {/* Info Note */}
            <div className="mt-4 p-3 bg-[#fdf5ec] dark:bg-[#7d1a34]/10 rounded-lg border border-[#f0e2d2] dark:border-[#5e1024]">
              <p className="text-xs text-[#7d1a34] dark:text-[#c8973f] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Incentives and points are automatically credited when your IPR application receives a publication ID. 
                  For applications with multiple inventors, incentives are split equally among all contributors.
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="border-b border-gray-100 dark:border-gray-700 p-2">
          <nav className="flex gap-1 overflow-x-auto">
            {[
              { key: 'all', label: 'All Applications', count: stats.total || 0, icon: FileText },
              { key: 'action_required', label: 'Action Required', count: stats.action_required || 0, highlight: true, icon: AlertCircle },
              { key: 'in_progress', label: 'In Progress', count: stats.in_progress || 0, icon: Clock },
              { key: 'completed', label: 'Completed', count: stats.completed || 0, icon: CheckCircle },
              { key: 'contributed', label: 'As Contributor', count: contributedApplications.length, icon: ThumbsUp, special: true },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-xl whitespace-nowrap transition-all ${activeTab ===
   tab.key
                      ? tab.special
                        ? 'bg-[#27ae60] text-white shadow-sm'
                        : tab.highlight 
                        ? 'bg-[#f39c12] text-white shadow-sm' 
                        : 'bg-[#005b96] text-white shadow-sm'
                      : tab.highlight && tab.count > 0
                      ? 'text-[#f39c12] bg-[#fef5e7] hover:bg-[#fdeacd]'
                      : tab.special && tab.count > 0
                      ? 'text-[#27ae60] bg-[#e8f8ef] hover:bg-[#d4f1e0]'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${activeTab ===
   tab.key 
                      ? 'bg-white/25' 
                      : tab.highlight && tab.count > 0
                      ? 'bg-[#fef5e7] text-[#f39c12]'
                      : tab.special && tab.count > 0
                      ? 'bg-[#e8f8ef] text-[#27ae60]'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {getApplicationsToDisplay().length ===
   0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-16 text-center">
            <div className="w-24 h-24 bg-[#e6f2fa] dark:bg-[#005b96]/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-12 h-12 text-[#005b96]" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">No Applications Found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
              {activeTab ===
   'action_required' 
                ? "Great news! You have no pending actions. All your applications are up to date." 
                : "Get started by submitting your first IPR application to protect your intellectual property."}
            </p>
            <Link
              href="/ipr/apply"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#005b96] text-white rounded-xl hover:bg-[#03396c] hover:shadow-md transition-all font-semibold"
            >
              <Plus className="w-5 h-5" />
              Submit New Application
            </Link>
          </div>
        ) : (
          getApplicationsToDisplay().map((app: any) => {
            const isExpanded = expandedApp ===
   app.id;
            const pendingSuggestions = getPendingSuggestions(app.id);
            const respondedSuggestions = getRespondedSuggestions(app.id);
            const hasActions = app.status ===
   'changes_required' || app.status ===
   'draft';
            const selectedCount = Object.keys(selectedResponses).length;
            const cardStyle = getApplicationCardStyle(app, pendingSuggestions);
            
            return (
              <div 
                key={app.id} 
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 transition-all duration-300 ${cardStyle}`}
              >
                {/* Application Header */}
                <div 
                  className={`p-5 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors ${isExpanded ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}
                  onClick={() => handleExpandApp(app.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        {/* Application ID - Always show */}
                        <span className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm rounded-lg font-bold tracking-wide shadow-sm">
                          {app.applicationNumber || `ID: ${app.id.slice(0, 8).toUpperCase()}`}
                        </span>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">{app.title}</h3>
                        {getStatusBadge(app.status, pendingSuggestions.length > 0)}
                        
                        {/* Fresh indicator for pending suggestions */}
                        {app.status ===
   'changes_required' && pendingSuggestions.length > 0 && (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full text-xs font-bold shadow-md animate-pulse">
                            <Sparkles className="w-3.5 h-3.5" />
                            {pendingSuggestions.length} New Change{pendingSuggestions.length > 1 ? 's' : ''}
                          </span>
                        )}
                        
                        {/* Reviewed indicator */}
                        {respondedSuggestions.length > 0 && (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 rounded-full text-xs font-medium border border-emerald-200">
                            <History className="w-3.5 h-3.5" />
                            {respondedSuggestions.length} Reviewed
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          {new Date(app.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                        <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium uppercase tracking-wide">
                          {getEnumLabel('iprType', app.iprType)}
                        </span>
                        
                        {/* Show actual credited incentive & points for published/completed applications */}
                        {['published', 'completed', 'under_finance_review', 'finance_approved'].includes(app.status) && (app.incentiveAmount || app.pointsAwarded) && (
                          <>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-lg text-xs font-semibold border border-green-200">
                              <Coins className="w-3.5 h-3.5" />
                              ₹{Number(app.incentiveAmount || 0).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200">
                              <Award className="w-3.5 h-3.5" />
                              {Number(app.pointsAwarded || 0)} pts
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {hasActions && !isExpanded && pendingSuggestions.length > 0 && (
                        <span className="px-4 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold shadow-md animate-bounce">
                          Respond Now
                        </span>
                      )}
                      <div className={`p-2 rounded-full transition-all ${isExpanded ? 'bg-[#fbe2e8] dark:bg-[#7d1a34]/20 rotate-180' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        <ChevronDown className={`w-5 h-5 ${isExpanded ? 'text-[#7d1a34]' : 'text-gray-400'}`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-6 bg-gradient-to-b from-gray-50/50 dark:from-gray-700/30 to-white dark:to-gray-800">
                    {loadingSuggestions ===
   app.id ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <RefreshCw className="w-8 h-8 text-[#7d1a34] animate-spin mx-auto" />
                          <p className="text-gray-500 dark:text-gray-400 mt-3">Loading review details...</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Credited Incentive & Points Card - Show only for published/completed with actual values */}
                        {['published', 'completed', 'under_finance_review', 'finance_approved'].includes(app.status) && (app.incentiveAmount || app.pointsAwarded) && (
                          <div className="rounded-xl p-5 mb-5 border bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                              <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                                  <TrendingUp className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900 dark:text-white">Incentives Credited</h4>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Successfully processed and credited to your account
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-6">
                                <div className="text-center">
                                  <div className="flex items-center gap-1.5 text-green-700">
                                    <Coins className="w-5 h-5" />
                                    <span className="text-2xl font-bold">
                                      ₹{Number(app.incentiveAmount || 0).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Incentive Amount</p>
                                </div>
                                <div className="w-px h-10 bg-gray-200 dark:bg-gray-600" />
                                <div className="text-center">
                                  <div className="flex items-center gap-1.5 text-purple-700">
                                    <Award className="w-5 h-5" />
                                    <span className="text-2xl font-bold">
                                      {Number(app.pointsAwarded || 0)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Research Points</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Split Info for multiple inventors */}
                            {app.contributors && app.contributors.filter((c: any) => c.contributorType ===
   'inventor').length > 1 && (
                              <div className="mt-3 pt-3 border-t border-green-200/50 dark:border-green-800/50 text-xs text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Note:</span> Incentives equally split among {app.contributors.filter((c: any) => c.contributorType ===
   'inventor').length} inventors (this is your share)
                              </div>
                            )}
                          </div>
                        )}

                        {/* Quick Actions for Draft */}
                        {app.status ===
   'draft' && (
                          <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-xl p-5 border border-slate-200 dark:border-slate-600 mb-5">
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                              <Edit3 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                              Draft Application
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                              This application is saved as a draft. Complete and submit it to begin the review process.
                            </p>
                            <Link
                              href={`/ipr/applications/${app.id}/edit`}
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#7d1a34] to-indigo-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all"
                            >
                              <Edit3 className="w-4 h-4" />
                              Continue Editing
                            </Link>
                          </div>
                        )}

                        {/* Quick Actions for Pending Mentor Approval - Waiting only, no edit */}
                        {app.status ===
   'pending_mentor_approval' && (
                          <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-5 border border-orange-200 dark:border-orange-800 mb-5">
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                              <Clock className="w-5 h-5 text-orange-600" />
                              Awaiting Mentor Approval
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Your application has been submitted and is waiting for mentor approval. You will be notified once your mentor reviews it.
                            </p>
                          </div>
                        )}

                        {/* NEW: Pending Suggestions Section - Highlighted */}
                        {pendingSuggestions.length > 0 && (
                          <div className="mb-6">
                            {/* Section Header */}
                            <div className="flex items-center justify-between mb-4 p-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl text-white shadow-lg">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                  <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-lg">New Changes Requested</h4>
                                  <p className="text-orange-100 text-sm">{pendingSuggestions.length} change{pendingSuggestions.length > 1 ? 's' : ''} need{pendingSuggestions.length ===
   1 ? 's' : ''} your response</p>
                                </div>
                              </div>
                              
                              {/* Quick Actions */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSelectAll(app.id, 'accept'); }}
                                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                                >
                                  <CheckSquare className="w-4 h-4" />
                                  Accept All
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSelectAll(app.id, 'reject'); }}
                                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject All
                                </button>
                              </div>
                            </div>

                            {/* Pending Suggestion Cards */}
                            <div className="space-y-3">
                              {pendingSuggestions.map((suggestion, index) => {
                                const isEnumField = suggestion.fieldName in ENUM_LABELS;
                                const isInvalidEnumValue = isEnumField && !isValidEnumValue(suggestion.fieldName, suggestion.suggestedValue);
                                const displayValue = isEnumField 
                                  ? getEnumLabel(suggestion.fieldName, suggestion.suggestedValue)
                                  : suggestion.suggestedValue;
                                const displayOriginal = isEnumField && suggestion.originalValue
                                  ? getEnumLabel(suggestion.fieldName, suggestion.originalValue)
                                  : suggestion.originalValue;
                                const isSelected = selectedResponses[suggestion.id];
                                const selectedAction = selectedResponses[suggestion.id]?.action;
                                
                                return (
                                  <div 
                                    key={suggestion.id} 
                                    className={`bg-white rounded-xl p-5 border-2 transition-all duration-200 ${
                                      isInvalidEnumValue
                                        ? 'border-yellow-400 bg-yellow-50/50 shadow-yellow-100 shadow-md'
                                        : selectedAction ===
   'accept' 
                                        ? 'border-green-400 bg-green-50/50 shadow-green-100 shadow-md' 
                                        : selectedAction ===
   'reject'
                                        ? 'border-red-400 bg-red-50/50 shadow-red-100 shadow-md'
                                        : 'border-orange-200 hover:border-orange-300 hover:shadow-md'
                                    }`}
                                  >
                                    <div className="flex items-start gap-4">
                                      {/* Selection Checkbox */}
                                      <div className="pt-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (isSelected) {
                                              handleClearSelection();
                                            }
                                          }}
                                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                                            isSelected 
                                              ? selectedAction ===
   'accept'
                                                ? 'bg-green-500 text-white'
                                                : 'bg-red-500 text-white'
                                              : 'bg-gray-100 hover:bg-gray-200'
                                          }`}
                                        >
                                          {isSelected ? (
                                            <Check className="w-4 h-4" />
                                          ) : (
                                            <span className="text-xs text-gray-400 font-bold">{index + 1}</span>
                                          )}
                                        </button>
                                      </div>

                                      <div className="flex-1">
                                        {/* Field Name & Meta */}
                                        <div className="flex items-center justify-between mb-3">
                                          <div>
                                            <span className="text-sm font-bold text-orange-600 uppercase tracking-wide">
                                              {suggestion.fieldName.replace(/([A-Z])/g, ' $1').trim()}
                                            </span>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                              Suggested by {getReviewerName(suggestion)} • {new Date(suggestion.createdAt).toLocaleDateString()}
                                            </p>
                                          </div>
                                          {isSelected && (
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                              selectedAction ===
   'accept'
                                                ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                                                : 'bg-red-100 text-red-700 ring-1 ring-red-300'
                                            }`}>
                                              {selectedAction ===
   'accept' ? '✓ Will Accept' : '✕ Will Reject'}
                                            </span>
                                          )}
                                        </div>

                                        {/* Change Details */}
                                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-3 space-y-2">
                                          {displayOriginal && (
                                            <div className="flex items-start gap-3">
                                              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase w-16 pt-0.5">Current</span>
                                              <span className="line-through text-gray-400 dark:text-gray-500 flex-1">{displayOriginal}</span>
                                            </div>
                                          )}
                                          <div className="flex items-start gap-3">
                                            <span className="text-xs font-medium text-green-600 uppercase w-16 pt-0.5">New</span>
                                            <span className="font-semibold text-gray-900 dark:text-white flex-1">{displayValue}</span>
                                          </div>
                                        </div>

                                        {/* Reviewer Note */}
                                        {suggestion.suggestionNote && (
                                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                                            <p className="text-sm text-amber-800 italic">
                                              <span className="font-medium not-italic">Reviewer note: </span>
                                              &quot;{suggestion.suggestionNote}&quot;
                                            </p>
                                          </div>
                                        )}

                                        {/* Invalid Value Warning */}
                                        {isInvalidEnumValue && (
                                          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-3">
                                            <div className="flex items-center gap-2">
                                              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                                              <div>
                                                <p className="text-sm font-medium text-yellow-800">
                                                  Invalid Value - Cannot Accept
                                                </p>
                                                <p className="text-xs text-yellow-700 mt-0.5">
                                                  The suggested value &quot;{suggestion.suggestedValue}&quot; is not a valid option for {suggestion.fieldName}. 
                                                  Please reject this suggestion and ask the reviewer to submit a valid value.
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Response Note Input */}
                                        <textarea
                                          placeholder="Add your response note (optional)..."
                                          value={responseNotes[suggestion.id] || ''}
                                          onChange={(e) => handleResponseNote(suggestion.id, e.target.value)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-[#7d1a34] focus:border-[#7d1a34] resize-none dark:bg-gray-700 dark:text-gray-100"
                                          rows={2}
                                        />

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-3">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (!isInvalidEnumValue) {
                                                handleSelectResponse(suggestion.id, 'accept');
                                              }
                                            }}
                                            disabled={isInvalidEnumValue}
                                            title={isInvalidEnumValue ? 'Cannot accept: Invalid value for this field' : 'Accept this change'}
                                            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                                              isInvalidEnumValue
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : selectedAction ===
   'accept'
                                                ? 'bg-green-500 text-white ring-4 ring-green-200 shadow-lg'
                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                            }`}
                                          >
                                            <Check className="w-5 h-5" />
                                            {isInvalidEnumValue ? 'Cannot Accept' : 'Accept Change'}
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleSelectResponse(suggestion.id, 'reject');
                                            }}
                                            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                                              selectedAction ===
   'reject'
                                                ? 'bg-red-500 text-white ring-4 ring-red-200 shadow-lg'
                                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                                            }`}
                                          >
                                            <X className="w-5 h-5" />
                                            Reject Change
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Submit Button */}
                            {selectedCount > 0 && (
                              <div className="mt-4 flex items-center justify-between p-5 bg-gradient-to-r from-[#fdf5ec] to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-[#f0e2d2] dark:border-[#5e1024]">
                                <div>
                                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    <span className="text-[#7d1a34] font-bold text-lg">{selectedCount}</span> of {pendingSuggestions.length} changes selected
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Click submit to send your responses</p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSubmitBatchResponses(app.id);
                                  }}
                                  disabled={submittingBatch}
                                  className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#7d1a34] to-indigo-600 text-white rounded-xl font-bold hover:shadow-xl disabled:opacity-50 transition-all"
                                >
                                  {submittingBatch ? (
                                    <>
                                      <RefreshCw className="w-5 h-5 animate-spin" />
                                      Submitting...
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-5 h-5" />
                                      Submit Responses
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* REVIEWED: History Section - Muted */}
                        {respondedSuggestions.length > 0 && (
                          <div className="mb-5">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                              <History className="w-5 h-5 text-gray-400" />
                              <h4 className="font-semibold text-gray-700 dark:text-gray-300">Review History</h4>
                              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                                {respondedSuggestions.length} resolved
                              </span>
                            </div>
                            
                            <div className="space-y-2">
                              {respondedSuggestions.map((suggestion) => {
                                const isEnumField = suggestion.fieldName in ENUM_LABELS;
                                const displayValue = isEnumField 
                                  ? getEnumLabel(suggestion.fieldName, suggestion.suggestedValue)
                                  : suggestion.suggestedValue;
                                const isAccepted = suggestion.status ===
   'accepted';
                                
                                return (
                                  <div 
                                    key={suggestion.id} 
                                    className={`rounded-lg p-3 border transition-all ${
                                      isAccepted 
                                        ? 'bg-green-50/50 border-green-200' 
                                        : 'bg-red-50/50 border-red-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-full ${isAccepted ? 'bg-green-100' : 'bg-red-100'}`}>
                                          {isAccepted ? (
                                            <Check className="w-4 h-4 text-green-600" />
                                          ) : (
                                            <X className="w-4 h-4 text-red-600" />
                                          )}
                                        </div>
                                        <div>
                                          <span className="text-sm font-medium text-gray-700">
                                            {suggestion.fieldName.replace(/([A-Z])/g, ' $1').trim()}
                                          </span>
                                          <span className="mx-2 text-gray-400">→</span>
                                          <span className="text-sm text-gray-900">{displayValue}</span>
                                        </div>
                                      </div>
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                        isAccepted
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-red-100 text-red-700'
                                      }`}>
                                        {isAccepted ? 'Accepted' : 'Rejected'}
                                      </span>
                                    </div>
                                    {suggestion.applicantResponse && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-10 italic">
                                        Your response: &quot;{suggestion.applicantResponse}&quot;
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* No Actions State */}
                        {!hasActions && pendingSuggestions.length ===
   0 && (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                              <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 font-medium">
                              {app.status ===
   'completed' || app.status ===
   'published'
                                ? 'Application completed successfully! Incentives have been credited.'
                                : 'No pending actions. Your application is being processed.'}
                            </p>
                          </div>
                        )}

                        {/* Status Updates Section */}
                        <div className="mt-6 mb-5">
                          <IPRStatusUpdates applicationId={app.id} isDRD={false} />
                        </div>

                        {/* View Full Details */}
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                          <Link
                            href={`/ipr/applications/${app.id}`}
                            className="inline-flex items-center gap-2 text-[#7d1a34] hover:text-[#7d1a34] text-sm font-semibold group"
                          >
                            <Eye className="w-4 h-4" />
                            View Full Application Details
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Mobile FAB */}
      <div className="fixed bottom-6 right-6 md:hidden z-40">
        <Link
          href="/ipr/apply"
          className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#7d1a34] to-indigo-600 text-white rounded-full shadow-xl hover:shadow-2xl transition-all"
        >
          <Plus className="w-7 h-7" />
        </Link>
      </div>
    </div>
  );
}
