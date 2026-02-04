'use client';

import React, { useState, useEffect } from 'react';
import { getFileUrl, getResearchDocumentDownloadUrl } from '@/shared/api/api';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ArrowLeft,
  User,
  Users,
  Building,
  Calendar,
  Globe,
  Award,
  Coins,
  ExternalLink,
  Edit,
  Edit3,
  RefreshCw,
  Trash2,
  Send,
  Loader2,
  BookOpen,
  Presentation,
  DollarSign,
  MessageSquare,
  History,
  Check,
  X,
  ChevronRight,
  School,
  Mail,
  BookMarked,
  Target,
  TrendingUp,
  GraduationCap,
  Info
} from 'lucide-react';
import { researchService, ResearchContribution, ResearchPublicationType } from '@/features/research-management/services/research.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  draft: { label: 'Draft', icon: Edit, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
  submitted: { label: 'Submitted', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  pending_mentor_approval: { label: 'Pending Mentor Approval', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  under_review: { label: 'Under Review', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  changes_required: { label: 'Changes Required', icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  resubmitted: { label: 'Resubmitted', icon: RefreshCw, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
};

const PUBLICATION_TYPE_CONFIG: Record<ResearchPublicationType, { label: string; icon: React.ElementType; gradientFrom: string; gradientTo: string }> = {
  research_paper: { label: 'Research Paper', icon: FileText, gradientFrom: 'from-blue-500', gradientTo: 'to-blue-600' },
  book: { label: 'Book', icon: BookOpen, gradientFrom: 'from-green-500', gradientTo: 'to-green-600' },
  book_chapter: { label: 'Book Chapter', icon: BookOpen, gradientFrom: 'from-emerald-500', gradientTo: 'to-emerald-600' },
  conference_paper: { label: 'Conference Paper', icon: Presentation, gradientFrom: 'from-purple-500', gradientTo: 'to-purple-600' },
  grant_proposal: { label: 'Grant Proposal', icon: DollarSign, gradientFrom: 'from-orange-500', gradientTo: 'to-orange-600' },
};

const TARGETED_RESEARCH_LABELS: Record<string, string> = {
  scopus: 'Scopus Indexed',
  wos: 'Web of Science (SCI/SCIE)',
  both: 'Scopus & WoS',
};

const INDEXING_CATEGORY_LABELS: Record<string, string> = {
  nature_science_lancet_cell_nejm: 'Nature/Science/The Lancet/Cell/NEJM',
  subsidiary_if_above_20: 'Subsidiary Journals (IF > 20)',
  scopus: 'SCOPUS',
  scie_wos: 'SCIE/SCI (WOS)',
  pubmed: 'PubMed',
  naas_rating_6_plus: 'NAAS (Rating ≥ 6)',
  abdc_scopus_wos: 'ABDC Journals (SCOPUS/WOS)',
  sgtu_in_house: 'SGTU In-House Journal',
  case_centre_uk: 'The Case Centre UK',
  other_indexed: 'Other Indexed Journals',
  non_indexed_reputed: 'Non-Indexed Reputed Journals',
};

const AUTHOR_ROLE_LABELS: Record<string, string> = {
  first_author: 'First Author',
  corresponding_author: 'Corresponding Author',
  first_and_corresponding_author: 'First & Corresponding Author',
  co_author: 'Co-Author',
  senior_author: 'Senior Author',
};

const QUARTILE_LABELS: Record<string, { label: string; color: string }> = {
  top1: { label: 'Top 1%', color: 'text-emerald-600 bg-emerald-50' },
  top5: { label: 'Top 5%', color: 'text-green-600 bg-green-50' },
  q1: { label: 'Q1 - Top 25%', color: 'text-green-600 bg-green-50' },
  q2: { label: 'Q2 - Top 50%', color: 'text-blue-600 bg-blue-50' },
  q3: { label: 'Q3 - Top 75%', color: 'text-yellow-600 bg-yellow-50' },
  q4: { label: 'Q4 - Bottom 25%', color: 'text-orange-600 bg-orange-50' },
};

interface EditSuggestion {
  id: string;
  fieldName: string;
  fieldPath: string;
  originalValue: string;
  suggestedValue: string;
  suggestionNote?: string;
  status: 'pending' | 'accepted' | 'rejected';
  reviewerId: string;
  reviewer?: { uid: string; employeeDetails?: { displayName: string } };
  createdAt: string;
}

// Helper to parse manuscript file path (can be string or JSON object)
interface ManuscriptFileInfo {
  s3Key: string;
  name: string;
  size?: number;
  mimetype?: string;
}

const parseManuscriptFilePath = (filePath: unknown): ManuscriptFileInfo | null => {
  if (!filePath) return null;
  
  // If it's already an object with s3Key
  if (typeof filePath === 'object' && filePath !== null && 's3Key' in filePath) {
    const obj = filePath as ManuscriptFileInfo;
    return {
      s3Key: obj.s3Key,
      name: obj.name || obj.s3Key.split('/').pop() || 'document',
      size: obj.size,
      mimetype: obj.mimetype
    };
  }
  
  // If it's a string, try to parse as JSON first
  if (typeof filePath === 'string') {
    try {
      const parsed = JSON.parse(filePath);
      if (parsed && typeof parsed === 'object' && 's3Key' in parsed) {
        return {
          s3Key: parsed.s3Key,
          name: parsed.name || parsed.s3Key.split('/').pop() || 'document',
          size: parsed.size,
          mimetype: parsed.mimetype
        };
      }
    } catch {
      // It's a plain string (old format: just the S3 key)
      return {
        s3Key: filePath,
        name: filePath.split('/').pop() || 'document'
      };
    }
  }
  
  return null;
};

export default function ContributionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { confirmDelete, confirmAction } = useConfirm();
  const id = params.id as string;
  
  const [contribution, setContribution] = useState<ResearchContribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'authors' | 'suggestions' | 'history'>('details');
  const [editSuggestions, setEditSuggestions] = useState<EditSuggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchContribution();
    }
  }, [id]);

  const fetchContribution = async () => {
    try {
      setLoading(true);
      const response = await researchService.getContributionById(id);
      setContribution(response.data);
      
      // Extract edit suggestions
      if (response.data?.editSuggestions) {
        setEditSuggestions(response.data.editSuggestions);
      }
    } catch (error: unknown) {
      logger.error('Error fetching contribution:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const confirmed = await confirmAction('Confirm Submission', 'Submit this contribution for review? You will not be able to edit it until the review is complete.');
    if (!confirmed) return;
    
    try {
      setActionLoading(true);
      await researchService.submitContribution(id);
      fetchContribution();
    } catch (error: unknown) {
      logger.error('Error submitting:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async () => {
    const confirmed = await confirmAction('Confirm Resubmission', 'Resubmit this contribution with the changes?');
    if (!confirmed) return;
    
    try {
      setActionLoading(true);
      await researchService.resubmitContribution(id);
      fetchContribution();
    } catch (error: unknown) {
      logger.error('Error resubmitting:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmDelete('Delete Draft', 'Are you sure you want to delete this draft? This action cannot be undone.');
    if (!confirmed) return;
    
    try {
      setActionLoading(true);
      await researchService.deleteContribution(id);
      router.push('/research/my-contributions');
    } catch (error: unknown) {
      logger.error('Error deleting:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptSuggestion = async (suggestionId: string) => {
    try {
      setSuggestionLoading(suggestionId);
      await researchService.acceptSuggestion(id, suggestionId);
      fetchContribution();
    } catch (error: unknown) {
      logger.error('Error accepting suggestion:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setSuggestionLoading(null);
    }
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    try {
      setSuggestionLoading(suggestionId);
      await researchService.rejectSuggestion(id, suggestionId);
      fetchContribution();
    } catch (error: unknown) {
      logger.error('Error rejecting suggestion:', error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setSuggestionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading contribution details...</p>
        </div>
      </div>
    );
  }

  if (!contribution) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Contribution Not Found</h2>
          <p className="text-gray-500 mb-4">The research contribution you're looking for doesn't exist or has been removed.</p>
          <Link 
            href="/research/my-contributions" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Contributions
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[contribution.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  const pubTypeConfig = PUBLICATION_TYPE_CONFIG[contribution.publicationType];
  const PubTypeIcon = pubTypeConfig?.icon || FileText;
  const isOwner = contribution.applicantUserId === user?.id;
  const canEdit = isOwner && ['draft', 'changes_required'].includes(contribution.status);
  const pendingSuggestions = editSuggestions.filter(s => s.status === 'pending');

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm text-gray-500 mb-6">
        <Link href="/research" className="hover:text-gray-700">Research</Link>
        <ChevronRight className="w-4 h-4 mx-2" />
        <Link href="/research/my-contributions" className="hover:text-gray-700">My Contributions</Link>
        <ChevronRight className="w-4 h-4 mx-2" />
        <span className="text-gray-900 font-medium truncate max-w-[200px]">{contribution.title}</span>
      </nav>

      {/* Hero Section */}
      <div className={`bg-gradient-to-r ${pubTypeConfig?.gradientFrom || 'from-blue-500'} ${pubTypeConfig?.gradientTo || 'to-blue-600'} rounded-2xl p-6 mb-6 text-white`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <PubTypeIcon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-white/80 text-sm">{pubTypeConfig?.label || 'Research Contribution'}</span>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-white/90">{contribution.applicationNumber || 'Draft'}</span>
                </div>
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{contribution.title}</h1>
            {contribution.journalName && (
              <p className="text-white/80 flex items-center">
                <BookMarked className="w-4 h-4 mr-2" />
                {contribution.journalName}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end space-y-3">
            <div className={`px-4 py-2 rounded-full font-medium flex items-center bg-white/20 backdrop-blur`}>
              <StatusIcon className="w-4 h-4 mr-2" />
              {statusConfig.label}
            </div>
            {canEdit && (
              <Link
                href={`/research/apply?type=${contribution.publicationType}&edit=${id}`}
                className="px-4 py-2 bg-white/20 backdrop-blur rounded-lg hover:bg-white/30 flex items-center transition-colors"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Changes Required Alert */}
      {contribution.status === 'changes_required' && pendingSuggestions.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900">Changes Required</h3>
              <p className="text-orange-700 text-sm mt-1">
                The reviewer has requested {pendingSuggestions.length} change{pendingSuggestions.length > 1 ? 's' : ''} to your submission.
                Please review and accept/reject the suggestions, then resubmit.
              </p>
              <Link
                href={`/research/contribution/${id}/edit`}
                className="inline-block mt-3 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
              >
                Review & Edit ({pendingSuggestions.length})
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Incentive Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">My Incentive</span>
            <Coins className="w-5 h-5 text-green-500" />
          </div>
          {(() => {
            // Find current user's author record
            const currentUserAuthor = contribution.authors?.find((a: any) => a.userId === user?.id);
            const myIncentive = currentUserAuthor?.incentiveShare || 0;
            const isApprovedOrCompleted = ['approved', 'completed'].includes(contribution.status);
            
            if (myIncentive > 0) {
              return (
                <div>
                  <p className={`text-2xl font-bold ${isApprovedOrCompleted ? 'text-green-600' : 'text-blue-600'}`}>
                    ₹{Number(myIncentive).toLocaleString()}
                  </p>
                  <p className={`text-xs mt-1 ${isApprovedOrCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                    {isApprovedOrCompleted ? '✓ Credited' : 'Estimated'}
                  </p>
                </div>
              );
            } else if (contribution.calculatedIncentiveAmount) {
              // Fallback: If no author share calculated yet, show total with note
              return (
                <div>
                  <p className="text-2xl font-bold text-gray-400">-</p>
                  <p className="text-xs text-gray-500 mt-1">Pending calculation</p>
                </div>
              );
            } else {
              return <p className="text-2xl font-bold text-gray-400">-</p>;
            }
          })()}
        </div>

        {/* Points Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">My Points</span>
            <Award className="w-5 h-5 text-purple-500" />
          </div>
          {(() => {
            // Find current user's author record
            const currentUserAuthor = contribution.authors?.find((a: any) => a.userId === user?.id);
            const myPoints = currentUserAuthor?.pointsShare || 0;
            const isApprovedOrCompleted = ['approved', 'completed'].includes(contribution.status);
            
            if (myPoints > 0) {
              return (
                <div>
                  <p className={`text-2xl font-bold ${isApprovedOrCompleted ? 'text-purple-600' : 'text-indigo-600'}`}>
                    {myPoints}
                  </p>
                  <p className={`text-xs mt-1 ${isApprovedOrCompleted ? 'text-purple-600' : 'text-gray-500'}`}>
                    {isApprovedOrCompleted ? '✓ Credited' : 'Estimated'}
                  </p>
                </div>
              );
            } else if (contribution.calculatedPoints) {
              // Fallback: If no author share calculated yet, show pending
              return (
                <div>
                  <p className="text-2xl font-bold text-gray-400">-</p>
                  <p className="text-xs text-gray-500 mt-1">Pending calculation</p>
                </div>
              );
            } else {
              return <p className="text-2xl font-bold text-gray-400">-</p>;
            }
          })()}
        </div>

        {/* Authors Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Authors</span>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{contribution.totalAuthors || contribution.authors?.length || 1}</p>
          <p className="text-xs text-gray-500 mt-1">
            {contribution.sgtAffiliatedAuthors || contribution.totalInternalAuthors || 1} from SGT
          </p>
        </div>

        {/* Indexing Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Indexing Categories</span>
            <Target className="w-5 h-5 text-orange-500" />
          </div>
          {(contribution as any).indexingCategories && (contribution as any).indexingCategories.length > 0 ? (
            <div className="space-y-1">
              {(contribution as any).indexingCategories.map((cat: string) => (
                <div key={cat} className="text-sm font-medium text-gray-700">
                  • {INDEXING_CATEGORY_LABELS[cat] || cat}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Not specified</p>
          )}
          {contribution.quartile && QUARTILE_LABELS[contribution.quartile] && (
            <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${QUARTILE_LABELS[contribution.quartile].color}`}>
              {QUARTILE_LABELS[contribution.quartile].label}
            </span>
          )}
        </div>
      </div>

      {/* Warning for Missing Indexing Categories */}
      {contribution.publicationType === 'research_paper' && 
       (!(contribution as any).indexingCategories || (contribution as any).indexingCategories.length === 0) && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-red-800 mb-1">No Indexing Categories Selected</h3>
              <p className="text-sm text-red-700 mb-2">
                This research contribution has no indexing categories selected, which is why the incentive shows ₹0. 
                Indexing categories are required to calculate incentives based on the research impact.
              </p>
              <p className="text-xs text-red-600">
                <strong>Action Required:</strong> Please edit this contribution and select at least one indexing category 
                (e.g., SCOPUS, PubMed, NAAS, etc.) from the available 11 categories to enable incentive calculation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Incentive Calculation Breakdown - Only for Research Papers */}
      {contribution.publicationType === 'research_paper' && 
       (contribution as any).indexingCategories && 
       (contribution as any).indexingCategories.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
            Incentive Calculation Details
          </h3>
          <div className="space-y-4">
            {/* Base Categories */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Indexing Categories:</h4>
              <div className="flex flex-wrap gap-2">
                {(contribution as any).indexingCategories.map((cat: string) => (
                  <span key={cat} className="px-3 py-1.5 bg-white border border-blue-200 text-blue-800 rounded-lg text-sm font-medium shadow-sm">
                    {INDEXING_CATEGORY_LABELS[cat] || cat}
                  </span>
                ))}
              </div>
            </div>

            {/* Category-Specific Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {contribution.quartile && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <span className="text-xs text-gray-500">Quartile</span>
                  <p className="font-semibold text-gray-900">{QUARTILE_LABELS[contribution.quartile]?.label}</p>
                </div>
              )}
              {contribution.impactFactor && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <span className="text-xs text-gray-500">Impact Factor</span>
                  <p className="font-semibold text-gray-900">{contribution.impactFactor}</p>
                </div>
              )}
              {contribution.sjr && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <span className="text-xs text-gray-500">SJR</span>
                  <p className="font-semibold text-gray-900">{contribution.sjr}</p>
                </div>
              )}
              {(contribution as any).naasRating && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <span className="text-xs text-gray-500">NAAS Rating</span>
                  <p className="font-semibold text-gray-900">{(contribution as any).naasRating}</p>
                </div>
              )}
              {(contribution as any).subsidiaryImpactFactor && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <span className="text-xs text-gray-500">Subsidiary IF</span>
                  <p className="font-semibold text-gray-900">{(contribution as any).subsidiaryImpactFactor}</p>
                </div>
              )}
            </div>

            {/* Distribution Method */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">Distribution Method: Role-Based</p>
                  <p className="text-xs text-gray-600">
                    Incentives are distributed based on author roles (First Author, Corresponding Author, Co-Author). 
                    First and corresponding authors receive higher percentages. Internal faculty/employees receive both 
                    incentives and points, while students receive only incentives.
                  </p>
                </div>
              </div>
            </div>

            {/* Total Pool */}
            {(contribution.calculatedIncentiveAmount || contribution.calculatedPoints) && (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Total Pool (Incentive)</span>
                    <p className="text-xl font-bold text-green-600">
                      ₹{Number(contribution.calculatedIncentiveAmount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Total Pool (Points)</span>
                    <p className="text-xl font-bold text-purple-600">
                      {contribution.calculatedPoints || 0} pts
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {[
              { key: 'details', label: 'Details', icon: FileText },
              { key: 'authors', label: 'Authors', icon: Users, count: contribution.authors?.length },
              { key: 'suggestions', label: 'Edit Suggestions', icon: Edit3, count: pendingSuggestions.length },
              { key: 'history', label: 'History', icon: History, count: contribution.statusHistory?.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Applicant Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2 text-indigo-500" />
                  Applicant Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <DetailItem 
                    label="Name" 
                    value={contribution.applicantUser?.employeeDetails?.displayName || 
                           contribution.applicantUser?.employee?.displayName || 
                           `${contribution.applicantUser?.firstName || ''} ${contribution.applicantUser?.lastName || ''}`.trim() || 
                           'N/A'} 
                  />
                  <DetailItem 
                    label="UID" 
                    value={contribution.applicantUser?.uid || 'N/A'} 
                  />
                  <DetailItem 
                    label="Email" 
                    value={contribution.applicantUser?.email || 'N/A'} 
                  />
                </div>
              </div>
              
              {/* Research/Book Details Grid */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-500" />
                  {contribution.publicationType === 'book' ? 'Book Information' :
                   contribution.publicationType === 'book_chapter' ? 'Book Chapter Information' :
                   'Research Information'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailItem label="Publication Type" value={pubTypeConfig?.label} />
                  {/* Research Paper Specific Fields */}
                  {contribution.publicationType === 'research_paper' && (
                    <>
                      {(contribution as any).indexingCategories && (contribution as any).indexingCategories.length > 0 && (
                        <div className="col-span-full">
                          <div className="text-sm text-gray-600 mb-2">Indexing Categories</div>
                          <div className="flex flex-wrap gap-2">
                            {(contribution as any).indexingCategories.map((cat: string) => (
                              <span key={cat} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                                {INDEXING_CATEGORY_LABELS[cat] || cat}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(contribution as any).interdisciplinaryFromSgt !== undefined && (
                        <DetailItem label="Interdisciplinary (SGT)" value={(contribution as any).interdisciplinaryFromSgt ? 'Yes' : 'No'} />
                      )}
                      {contribution.quartile && (
                        <DetailItem label="Quartile" value={QUARTILE_LABELS[contribution.quartile]?.label} />
                      )}
                      {contribution.impactFactor && (
                        <DetailItem label="Impact Factor" value={contribution.impactFactor} />
                      )}
                      {(contribution as any).subsidiaryImpactFactor && (
                        <DetailItem label="Subsidiary Impact Factor" value={(contribution as any).subsidiaryImpactFactor} />
                      )}
                      {contribution.sjr && (
                        <DetailItem label="SJR" value={contribution.sjr} />
                      )}
                      {(contribution as any).naasRating && (
                        <DetailItem label="NAAS Rating" value={(contribution as any).naasRating} />
                      )}
                      {contribution.journalName && (
                        <DetailItem label="Journal Name" value={contribution.journalName} />
                      )}
                      {(contribution as any).volume && (
                        <DetailItem label="Volume" value={(contribution as any).volume} />
                      )}
                      {contribution.issue && (
                        <DetailItem label="Issue" value={contribution.issue} />
                      )}
                      {contribution.pageNumbers && (
                        <DetailItem label="Pages" value={contribution.pageNumbers} />
                      )}
                      {contribution.doi && (
                        <DetailItem 
                          label="DOI" 
                          value={contribution.doi} 
                          link={`https://doi.org/${contribution.doi}`}
                        />
                      )}
                      {contribution.issn && (
                        <DetailItem label="ISSN" value={contribution.issn} />
                      )}
                      {(contribution as any).publicationDate && (
                        <DetailItem label="Publication Date" value={new Date((contribution as any).publicationDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} />
                      )}
                      {contribution.publisherName && (
                        <DetailItem 
                          label="Weblink (Publication URL)" 
                          value={contribution.publisherName} 
                          link={contribution.publisherName}
                        />
                      )}
                    </>
                  )}
                  
                  {/* Book/Book Chapter Fields */}
                  {(contribution.publicationType === 'book' || contribution.publicationType === 'book_chapter') && (
                    <>
                      {(contribution as any).bookIndexingType && (
                        <DetailItem label="Publication Type" value={(contribution as any).bookIndexingType?.replace(/_/g, ' ')?.replace(/\b\w/g, (l: string) => l.toUpperCase())} />
                      )}
                      {(contribution as any).bookPublicationType && contribution.publicationType === 'book' && (
                        <DetailItem label="Book Type" value={(contribution as any).bookPublicationType === 'authored' ? 'Authored' : 'Edited'} />
                      )}
                      {(contribution as any).communicatedWithOfficialId !== undefined && (
                        <DetailItem label="Communicated with Official ID" value={(contribution as any).communicatedWithOfficialId ? 'Yes' : 'No'} />
                      )}
                      {(contribution as any).personalEmail && (
                        <DetailItem label="Personal Email" value={(contribution as any).personalEmail} />
                      )}
                      {contribution.publicationType === 'book_chapter' && (
                        <>
                          {(contribution as any).bookTitle && (
                            <DetailItem label="Book Title" value={(contribution as any).bookTitle} />
                          )}
                          {(contribution as any).chapterNumber && (
                            <DetailItem label="Chapter Number" value={(contribution as any).chapterNumber} />
                          )}
                          {(contribution as any).pageNumbers && (
                            <DetailItem label="Page Numbers" value={(contribution as any).pageNumbers} />
                          )}
                          {(contribution as any).editors && (
                            <DetailItem label="Editors" value={(contribution as any).editors} />
                          )}
                        </>
                      )}
                      {(contribution as any).publisherName && (
                        <DetailItem label="Publisher" value={(contribution as any).publisherName} />
                      )}
                      {(contribution as any).nationalInternational && (
                        <DetailItem label="National/International" value={(contribution as any).nationalInternational?.toUpperCase()} />
                      )}
                      {(contribution as any).isbn && (
                        <DetailItem label="ISBN" value={(contribution as any).isbn} />
                      )}
                      {(contribution as any).publicationDate && (
                        <DetailItem label="Publication Date" value={new Date((contribution as any).publicationDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} />
                      )}
                      {(contribution as any).totalAuthors && (
                        <DetailItem label="Total Authors" value={(contribution as any).totalAuthors?.toString()} />
                      )}
                      {(contribution as any).sgtAffiliatedAuthors && (
                        <DetailItem label="SGT Authors" value={(contribution as any).sgtAffiliatedAuthors?.toString()} />
                      )}
                      {(contribution as any).bookLetter && (
                        <DetailItem label="Our Authorized Publications" value={(contribution as any).bookLetter === 'yes' ? 'Yes' : 'No'} />
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {/* SDG Goals */}
              {(contribution as any).sdg_goals && (contribution as any).sdg_goals.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-green-500" />
                    UN Sustainable Development Goals (SDGs)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(contribution as any).sdg_goals.map((sdg: string) => (
                      <span key={sdg} className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        SDG {sdg}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Faculty Remarks */}
              {(contribution as any).facultyRemarks && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <MessageSquare className="w-5 h-5 mr-2 text-gray-500" />
                    Faculty Remarks
                  </h3>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-700">{(contribution as any).facultyRemarks}</p>
                  </div>
                </div>
              )}

              {/* Conference Specific Details */}
              {contribution.publicationType === 'conference_paper' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Presentation className="w-5 h-5 mr-2 text-purple-500" />
                  Conference Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(contribution as any).conferenceSubType && (
                    <DetailItem label="Conference Type" value={(contribution as any).conferenceSubType?.replace(/_/g, ' ')} />
                  )}
                  {contribution.conferenceName && (
                    <DetailItem label="Conference Name" value={contribution.conferenceName} />
                  )}
                  {contribution.conferenceType && (
                    <DetailItem label="National/International" value={contribution.conferenceType} />
                  )}
                  {contribution.conferenceLocation && (
                    <DetailItem label="Location" value={contribution.conferenceLocation} />
                  )}
                  {(contribution as any).proceedingsTitle && (
                    <DetailItem label="Proceedings Title" value={(contribution as any).proceedingsTitle} />
                  )}
                  {(contribution as any).proceedingsQuartile && (
                    <DetailItem label="Proceedings Quartile" value={(contribution as any).proceedingsQuartile?.toUpperCase()} />
                  )}
                  {(contribution as any).conferenceRole && (
                    <DetailItem label="Role" value={(contribution as any).conferenceRole?.replace(/_/g, ' ')} />
                  )}
                  {(contribution as any).indexedIn && (
                    <DetailItem label="Indexed In" value={(contribution as any).indexedIn?.toUpperCase()?.replace(/_/g, ' ')} />
                  )}
                  {(contribution as any).conferenceHeldLocation && (
                    <DetailItem label="Conference Held" value={(contribution as any).conferenceHeldLocation} />
                  )}
                  {(contribution as any).venue && (
                    <DetailItem label="Venue" value={(contribution as any).venue} />
                  )}
                  {(contribution as any).topic && (
                    <DetailItem label="Topic" value={(contribution as any).topic} />
                  )}
                  {(contribution as any).eventCategory && (
                    <DetailItem label="Event Category" value={(contribution as any).eventCategory?.replace(/_/g, ' ')} />
                  )}
                  {(contribution as any).organizerRole && (
                    <DetailItem label="Organizer Role" value={(contribution as any).organizerRole?.replace(/_/g, ' ')} />
                  )}
                  {(contribution as any).virtualConference && (
                    <DetailItem label="Virtual Conference" value={(contribution as any).virtualConference} />
                  )}
                  {(contribution as any).conferenceHeldAtSgt && (
                    <DetailItem label="Held at SGT" value={(contribution as any).conferenceHeldAtSgt} />
                  )}
                  {(contribution as any).conferenceBestPaperAward && (
                    <DetailItem label="Best Paper Award" value={(contribution as any).conferenceBestPaperAward} />
                  )}
                  {(contribution as any).totalPresenters && (
                    <DetailItem label="Total Presenters" value={(contribution as any).totalPresenters?.toString()} />
                  )}
                  {(contribution as any).isPresenter && (
                    <DetailItem label="Is Presenter" value={(contribution as any).isPresenter} />
                  )}
                  {(contribution as any).fullPaper && (
                    <DetailItem label="Full Paper" value={(contribution as any).fullPaper} />
                  )}
                  {(contribution as any).paperDoi && (
                    <DetailItem label="Paper DOI" value={(contribution as any).paperDoi} />
                  )}
                  {(contribution as any).weblink && (
                    <DetailItem label="Weblink" value={(contribution as any).weblink} link={(contribution as any).weblink} />
                  )}
                  {(contribution as any).issnIsbnIssueNo && (
                    <DetailItem label="ISSN/ISBN/Issue No" value={(contribution as any).issnIsbnIssueNo} />
                  )}
                  {(contribution as any).priorityFundingArea && (
                    <DetailItem label="Priority Funding Area" value={(contribution as any).priorityFundingArea} />
                  )}
                  {contribution.conferenceDate && (
                    <DetailItem label="Conference Date" value={new Date(contribution.conferenceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                  )}
                </div>
              </div>
              )}

              {/* Research Characteristics */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Info className="w-5 h-5 mr-2 text-green-500" />
                  Research Characteristics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <CharacteristicBadge 
                    label="International Author" 
                    value={contribution.internationalAuthor || contribution.hasInternationalAuthor}
                    count={contribution.foreignCollaborationsCount}
                    icon={Globe}
                  />
                  <CharacteristicBadge 
                    label="Interdisciplinary" 
                    value={contribution.interdisciplinaryFromSgt}
                    icon={TrendingUp}
                  />
                  <CharacteristicBadge 
                    label="SGT Students" 
                    value={contribution.studentsFromSgt}
                    icon={GraduationCap}
                  />
                </div>
              </div>

              {/* School & Department */}
              {(contribution.school || contribution.department) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Building className="w-5 h-5 mr-2 text-purple-500" />
                    Affiliation
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contribution.school && (
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <School className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-500">School/Faculty</p>
                            <p className="font-medium text-gray-900">{contribution.school.name || contribution.school.facultyName}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {contribution.department && (
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Building className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-500">Department</p>
                            <p className="font-medium text-gray-900">{contribution.department.name || contribution.department.departmentName}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-gray-500" />
                  Timeline
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <DetailItem label="Created" value={new Date(contribution.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                  {contribution.submittedAt && (
                    <DetailItem label="Submitted" value={new Date(contribution.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                  )}
                  {contribution.completedAt && (
                    <DetailItem label="Completed" value={new Date(contribution.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                  )}
                  {contribution.creditedAt && (
                    <DetailItem label="Credited" value={new Date(contribution.creditedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                  )}
                </div>
              </div>

              {/* Documents */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-500" />
                  Submitted Documents
                </h3>
                {(contribution.manuscriptFilePath || (contribution.supportingDocsFilePaths as any)?.files?.length > 0) ? (
                  <div className="space-y-3">
                    {contribution.manuscriptFilePath && (() => {
                      const manuscriptInfo = parseManuscriptFilePath(contribution.manuscriptFilePath);
                      return manuscriptInfo ? (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <FileText className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  Research Document
                                </p>
                                <p className="text-sm text-gray-500">{manuscriptInfo.name}</p>
                              </div>
                            </div>
                            <a
                              href={getResearchDocumentDownloadUrl(contribution.id, 'manuscript', manuscriptInfo.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
                            >
                              <ExternalLink className="w-4 h-4" />
                              <span>Download</span>
                            </a>
                          </div>
                        </div>
                      ) : null;
                    })()}
                    
                    {(contribution.supportingDocsFilePaths as any)?.files?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Supporting Documents</p>
                        <div className="space-y-2">
                          {((contribution.supportingDocsFilePaths as any).files as Array<{name: string, path: string, s3Key?: string, size: number}>).map((doc: any, index: number) => (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-gray-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 text-sm">{doc.name}</p>
                                    <p className="text-xs text-gray-500">
                                      {doc.size ? `${(doc.size / 1024).toFixed(2)} KB` : 'Unknown size'}
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={getResearchDocumentDownloadUrl(contribution.id, 'supporting', doc.name)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 bg-gray-600 text-white rounded text-xs font-medium hover:bg-gray-700 transition-colors flex items-center space-x-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Download</span>
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 bg-gray-50 rounded-lg border border-gray-200 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No documents uploaded yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Authors Tab */}
          {activeTab === 'authors' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Authors ({contribution.authors?.length || 0})
                </h3>
                
                {/* Total Incentive Summary */}
                {contribution.authors && contribution.authors.length > 0 && (
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Total Incentive</p>
                      <p className="text-lg font-bold text-green-600">
                        ₹{contribution.authors.reduce((sum: number, a: any) => sum + (Number(a.incentiveShare) || 0), 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Total Points</p>
                      <p className="text-lg font-bold text-purple-600">
                        {contribution.authors.reduce((sum: number, a: any) => sum + (Number(a.pointsShare) || 0), 0)} pts
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Expected Total</p>
                      <p className="text-sm text-gray-600">
                        ₹{Number(contribution.calculatedIncentiveAmount || 0).toLocaleString('en-IN')} / {contribution.calculatedPoints || 0} pts
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Incentive Distribution Rules Banner */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Incentive Distribution Rules:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li><strong>Single Author:</strong> Gets 100% (automatically treated as First & Corresponding Author)</li>
                      <li><strong>Exactly 2 Authors (no co-authors):</strong> Split 50-50</li>
                      <li><strong>Same Person = First + Corresponding:</strong> Gets both percentages combined</li>
                      <li><strong>Internal Faculty/Employees:</strong> Receive Incentives (₹) and Points</li>
                      <li><strong>Internal Students:</strong> Receive Incentives only (no Points)</li>
                      <li><strong>External Authors:</strong> ₹0 / 0 pts (do not receive incentives or points)</li>
                      <li><strong>External First/Corresponding:</strong> Their share is forfeited</li>
                      <li><strong>External Co-Authors:</strong> Their share goes to Internal Co-Authors</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {contribution.authors && contribution.authors.length > 0 ? (
                <div className="space-y-3">
                  {contribution.authors.map((author: any, index: number) => (
                    <div 
                      key={author.id || index}
                      className={`p-4 rounded-xl border ${
                        author.authorType === 'first_author' || author.authorType === 'first_and_corresponding_author'
                          ? 'bg-blue-50 border-blue-200'
                          : author.isCorresponding
                          ? 'bg-purple-50 border-purple-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                            author.isInternal || author.userId ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {author.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="flex items-center flex-wrap gap-2">
                              <h4 className="font-semibold text-gray-900">{author.name}</h4>
                              {/* Author Role Badge - Show combined role properly */}
                              {author.authorRole && AUTHOR_ROLE_LABELS[author.authorRole] && (
                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                  author.authorRole === 'first_and_corresponding_author' 
                                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                                    : author.authorRole === 'first_author'
                                    ? 'bg-blue-100 text-blue-700'
                                    : author.authorRole === 'corresponding_author'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {AUTHOR_ROLE_LABELS[author.authorRole]}
                                </span>
                              )}
                              {/* Fallback to old fields for backward compatibility - Check if single author */}
                              {!author.authorRole && contribution.authors && contribution.authors.length === 1 && (
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-300 text-xs rounded-full font-medium">
                                  First & Corresponding Author
                                </span>
                              )}
                              {/* Show separate badges for legacy data with multiple authors */}
                              {!author.authorRole && contribution.authors && contribution.authors.length > 1 && (
                                <>
                                  {author.orderNumber === 1 && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                      First Author
                                    </span>
                                  )}
                                  {author.isCorresponding && (
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                                      Corresponding
                                    </span>
                                  )}
                                </>
                              )}
                              {author.userId === user?.id && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {author.authorCategory === 'faculty' ? 'Faculty' : author.authorCategory === 'student' ? 'Student' : 'External'}
                              {author.affiliation && ` • ${author.affiliation}`}
                            </p>
                            <div className="flex items-center flex-wrap gap-4 mt-2 text-sm text-gray-500">
                              {author.email && (
                                <span className="flex items-center">
                                  <Mail className="w-3.5 h-3.5 mr-1" />
                                  {author.email}
                                </span>
                              )}
                              {author.registrationNumber && (
                                <span className="flex items-center">
                                  <User className="w-3.5 h-3.5 mr-1" />
                                  {author.registrationNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="space-y-1">
                            {/* Show incentive share */}
                            {author.incentiveShare != null && author.incentiveShare !== undefined ? (
                              <div>
                                <p className="text-green-600 font-semibold">₹{Number(author.incentiveShare).toLocaleString('en-IN')}</p>
                                {author.incentivePercentage && (
                                  <p className="text-xs text-gray-500">{author.incentivePercentage}%</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-gray-400 text-sm">₹0</p>
                            )}
                            
                            {/* Show points share */}
                            {author.pointsShare != null && author.pointsShare !== undefined ? (
                              <div>
                                <p className="text-purple-600 text-sm font-medium">{author.pointsShare} pts</p>
                                {author.pointsPercentage && (
                                  <p className="text-xs text-gray-500">{author.pointsPercentage}%</p>
                                )}
                              </div>
                            ) : author.authorCategory !== 'student' && (author.isInternal || author.userId) ? (
                              <p className="text-gray-400 text-sm">0 pts</p>
                            ) : null}
                          </div>
                          
                          {(author.isInternal || author.userId) ? (
                            <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full mt-2">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Internal
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full mt-2">
                              External
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No authors found</p>
                </div>
              )}
            </div>
          )}

          {/* Edit Suggestions Tab */}
          {activeTab === 'suggestions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Suggestions
                </h3>
                {pendingSuggestions.length > 0 && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                    {pendingSuggestions.length} pending
                  </span>
                )}
              </div>

              {editSuggestions.length > 0 ? (
                <div className="space-y-4">
                  {editSuggestions.map((suggestion) => (
                    <div 
                      key={suggestion.id}
                      className={`p-4 rounded-xl border ${
                        suggestion.status === 'pending' 
                          ? 'bg-yellow-50 border-yellow-200' 
                          : suggestion.status === 'accepted'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="font-medium text-gray-900 capitalize">
                              {suggestion.fieldName.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              suggestion.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-700'
                                : suggestion.status === 'accepted'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {suggestion.status}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-start space-x-2">
                              <span className="text-sm text-gray-500 w-20 flex-shrink-0">Current:</span>
                              <span className="text-sm text-red-600 line-through bg-red-50 px-2 py-1 rounded">
                                {suggestion.originalValue || '(empty)'}
                              </span>
                            </div>
                            <div className="flex items-start space-x-2">
                              <span className="text-sm text-gray-500 w-20 flex-shrink-0">Suggested:</span>
                              <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                                {suggestion.suggestedValue || '(empty)'}
                              </span>
                            </div>
                          </div>
                          {suggestion.suggestionNote && (
                            <div className="mt-3 p-3 bg-white rounded-lg border">
                              <p className="text-sm text-gray-600">
                                <MessageSquare className="w-4 h-4 inline mr-1 text-gray-400" />
                                {suggestion.suggestionNote}
                              </p>
                            </div>
                          )}
                        </div>
                        {suggestion.status === 'pending' && canEdit && (
                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => handleAcceptSuggestion(suggestion.id)}
                              disabled={suggestionLoading === suggestion.id}
                              className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                              title="Accept suggestion"
                            >
                              {suggestionLoading === suggestion.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleRejectSuggestion(suggestion.id)}
                              disabled={suggestionLoading === suggestion.id}
                              className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                              title="Reject suggestion"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Edit3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No edit suggestions</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Edit suggestions from reviewers will appear here
                  </p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Status History</h3>
              {contribution.statusHistory && contribution.statusHistory.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  <div className="space-y-4">
                    {contribution.statusHistory.map((history: any, index: number) => {
                      const historyStatusConfig = STATUS_CONFIG[history.toStatus] || STATUS_CONFIG.draft;
                      const HistoryIcon = historyStatusConfig.icon;
                      
                      // Generate status description with user info
                      const getUserInfo = () => {
                        if (!history.changedBy) return '';
                        const name = history.changedBy.employeeDetails?.displayName || 
                                   `${history.changedBy.employeeDetails?.firstName || ''} ${history.changedBy.employeeDetails?.lastName || ''}`.trim();
                        const uid = history.changedBy.uid;
                        return name && uid ? ` by ${name} (${uid})` : '';
                      };
                      
                      const getStatusDescription = () => {
                        const userInfo = getUserInfo();
                        
                        switch(history.toStatus) {
                          case 'approved':
                            return `Approved${userInfo}`;
                          case 'under_review':
                            if (history.fromStatus === 'submitted') {
                              return `Review started${userInfo}`;
                            }
                            return `Recommended for final approval${userInfo}`;
                          case 'submitted':
                            return 'Submitted for DRD review';
                          case 'draft':
                            return `Research contribution created${userInfo}`;
                          case 'completed':
                            return `Completed${userInfo}`;
                          case 'changes_required':
                            return `Changes requested${userInfo}`;
                          case 'rejected':
                            return `Rejected${userInfo}`;
                          default:
                            return historyStatusConfig.label;
                        }
                      };
                      
                      return (
                        <div key={history.id || index} className="relative flex items-start space-x-4 pl-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${historyStatusConfig.bgColor} ${historyStatusConfig.borderColor} border-2`}>
                            <HistoryIcon className={`w-4 h-4 ${historyStatusConfig.color}`} />
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center justify-between">
                              <span className={`font-medium ${historyStatusConfig.color}`}>
                                {historyStatusConfig.label}
                              </span>
                              <span className="text-sm text-gray-500">
                                {new Date(history.changedAt || history.createdAt).toLocaleString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{getStatusDescription()}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No history available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {isOwner && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-wrap gap-3">
            {contribution.status === 'draft' && (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={actionLoading}
                  className="flex-1 min-w-[200px] px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                  Submit for Review
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="px-6 py-3 border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  <Trash2 className="w-5 h-5 mr-2" />
                  Delete Draft
                </button>
              </>
            )}
            
            {contribution.status === 'changes_required' && (
              <>
                {pendingSuggestions.length > 0 ? (
                  <>
                    <Link
                      href={`/research/contribution/${id}/edit`}
                      className="flex-1 min-w-[200px] px-6 py-3 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors flex items-center justify-center"
                    >
                      <Edit3 className="w-5 h-5 mr-2" />
                      Review & Edit ({pendingSuggestions.length} Suggestion{pendingSuggestions.length > 1 ? 's' : ''})
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/research/contribution/${id}/edit`}
                      className="flex-1 min-w-[200px] px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
                    >
                      <Edit className="w-5 h-5 mr-2" />
                      Edit Contribution
                    </Link>
                    <button
                      onClick={handleResubmit}
                      disabled={actionLoading}
                      className="flex-1 min-w-[200px] px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <RefreshCw className="w-5 h-5 mr-2" />}
                      Resubmit
                    </button>
                  </>
                )}
              </>
            )}
          </div>
          {contribution.status === 'changes_required' && pendingSuggestions.length > 0 && (
            <p className="text-sm text-orange-600 mt-3">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Accept or reject the {pendingSuggestions.length} suggestion{pendingSuggestions.length > 1 ? 's' : ''} first. Accepting a suggestion will automatically update your contribution with the suggested value.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Helper Components
function DetailItem({ label, value, link }: { label: string; value?: string | number | null; link?: string }) {
  if (!value) return null;
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      {link ? (
        <a 
          href={link} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="font-medium text-blue-600 hover:underline flex items-center"
        >
          {value}
          <ExternalLink className="w-3 h-3 ml-1" />
        </a>
      ) : (
        <p className="font-medium text-gray-900">{value}</p>
      )}
    </div>
  );
}

function CharacteristicBadge({ 
  label, 
  value, 
  icon: Icon, 
  count 
}: { 
  label: string; 
  value?: boolean; 
  icon: React.ElementType; 
  count?: number;
}) {
  return (
    <div className={`p-4 rounded-lg border ${value ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center space-x-2">
        <Icon className={`w-5 h-5 ${value ? 'text-green-600' : 'text-gray-400'}`} />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="mt-2 flex items-center space-x-2">
        {value ? (
          <span className="flex items-center text-green-600 text-sm font-medium">
            <CheckCircle className="w-4 h-4 mr-1" />
            Yes
            {count !== undefined && count > 0 && ` (${count})`}
          </span>
        ) : (
          <span className="flex items-center text-gray-500 text-sm">
            <XCircle className="w-4 h-4 mr-1" />
            No
          </span>
        )}
      </div>
    </div>
  );
}