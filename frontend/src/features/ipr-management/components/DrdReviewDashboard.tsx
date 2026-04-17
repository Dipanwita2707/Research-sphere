'use client';

import React, { useState, useEffect } from 'react';
import { getFileUrl } from '@/shared/api/api';
import { drdReviewService } from '@/features/ipr-management/services/ipr.service';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { useAuthStore } from '@/shared/auth/authStore';
import { IPR_STATUS, REVIEW_DECISION, SUGGESTION_STATUS } from '@/shared/constants';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Edit3, 
  AlertCircle, 
  Shield, 
  MessageSquare, 
  Send, 
  Building, 
  Hash, 
  Award, 
  ChevronRight, 
  User,
  Users,
  FileText,
  Sparkles,
  ArrowRight,
  Eye,
  Filter,
  Search,
  MoreHorizontal,
  Calendar,
  RefreshCcw,
  Download
} from 'lucide-react';
import CollaborativeEditor from './CollaborativeEditor';
import IPRStatusUpdates from './IPRStatusUpdates';
import api from '@/shared/api/api';

export default function DrdReviewDashboard() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false);
  const [isCollaborativeMode, setIsCollaborativeMode] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState<Record<string, number>>({});
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [reviewData, setReviewData] = useState({
    decision: REVIEW_DECISION.RECOMMENDED as 'approved' | 'rejected' | 'changes_required' | 'recommended',
    comments: '',
    edits: '',
  });
  
  // New workflow states
  const [showGovtIdModal, setShowGovtIdModal] = useState(false);
  const [showPubIdModal, setShowPubIdModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showViewDetailsModal, setShowViewDetailsModal] = useState(false);
  const [govtApplicationId, setGovtApplicationId] = useState('');
  const [publicationId, setPublicationId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'recommended' | 'govt' | 'published' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form field states for collaborative editing
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    remarks: '',
    iprType: '',
    projectType: '',
    filingType: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Permission flags - simplified 4 permission model
  // canApprove requires BOTH review AND approve permissions
  const hasReviewPermission = userPermissions.ipr_review || userPermissions.drd_ipr_review || userPermissions.drd_ipr_recommend;
  const hasApprovePermission = userPermissions.ipr_approve || userPermissions.drd_ipr_approve;
  const canApprove = hasReviewPermission && hasApprovePermission;
  const canRecommend = hasReviewPermission;
  const canAssignSchools = userPermissions.ipr_assign_school;

  useEffect(() => {
    if (user?.id) {
      fetchUserPermissions();
    }
  }, [user]);

  useEffect(() => {
    fetchPendingReviews();
  }, [activeTab]);

  const fetchUserPermissions = async () => {
    try {
      const response = await api.get('/dashboard/staff');
      const allPermissions: Record<string, boolean> = {};
      
      if (response.data.success && response.data.data.permissions) {
        response.data.data.permissions.forEach((dept: any) => {
          if (Array.isArray(dept.permissions)) {
            dept.permissions.forEach((perm: string) => {
              allPermissions[perm] = true;
              const permLower = perm.toLowerCase().replace(/\s+/g, '_');
              
              // Map to new simplified permission names
              if (permLower.includes('review') && permLower.includes('ipr')) {
                allPermissions['ipr_review'] = true;
                allPermissions['drd_ipr_review'] = true;  // Keep for backward compatibility
              }
              if (permLower.includes('approve') && permLower.includes('ipr')) {
                allPermissions['ipr_approve'] = true;
                allPermissions['drd_ipr_approve'] = true;  // Keep for backward compatibility
              }
              if (permLower.includes('recommend')) {
                allPermissions['ipr_review'] = true;  // Recommend is part of review
                allPermissions['drd_ipr_recommend'] = true;
              }
              if (permLower ===
   'ipr_assign_school' || (permLower.includes('assign') && permLower.includes('school'))) {
                allPermissions['ipr_assign_school'] = true;
              }
            });
          }
        });
      }
      
      logger.debug('DrdReviewDashboard - User permissions:', allPermissions);
      setUserPermissions(allPermissions);
    } catch (error: unknown) {
      logger.error('Error fetching permissions:', error);
    }
  };

  const fetchPendingReviews = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await drdReviewService.getPendingReviews({ page: 1, limit: 50 });
      logger.debug('Fetched applications:', data); // Debug log
      const apps = data.data || [];
      setApplications(apps);
      setPendingSuggestions(
        apps.reduce((acc: Record<string, number>, app: any) => {
          acc[app.id] = Number(app.pendingSuggestionsCount || 0);
          return acc;
        }, {})
      );
    } catch (error: unknown) {
      logger.error('Error fetching pending reviews:', error);
      setError(extractErrorMessage(error, 'Failed to fetch pending reviews. Please check your permissions.'));
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = async (app: any) => {
    try {
      setError('');
      const details = await drdReviewService.getReviewDetails(app.id);
      setSelectedApp(details);
      setIsCollaborativeMode(true);
      setShowReviewModal(true);
      // Set default decision based on permissions
      setReviewData(prev => ({
        ...prev,
        decision: canApprove ? 'approved' : 'recommended',
        comments: ''
      }));
      // Initialize form data for collaborative editing
      setFormData({
        title: details.title || '',
        description: details.description || '',
        remarks: details.remarks || '',
        iprType: details.iprType || '',
        projectType: details.projectType || '',
        filingType: details.filingType || ''
      });
    } catch (error: unknown) {
      logger.error('Error fetching application details:', error);
      toast({ type: 'error', message: extractErrorMessage(error, 'Failed to fetch application details. Please check your permissions.') });
    }
  };

  const handleTraditionalReview = async (app: any) => {
    try {
      setError('');
      const details = await drdReviewService.getReviewDetails(app.id);
      setSelectedApp(details);
      setIsCollaborativeMode(false);
      setShowReviewModal(true);
      // Set default decision based on permissions
      setReviewData(prev => ({
        ...prev,
        decision: canApprove ? 'approved' : 'recommended',
        comments: ''
      }));
    } catch (error: unknown) {
      logger.error('Error fetching application details:', error);
      toast({ type: 'error', message: extractErrorMessage(error, 'Failed to fetch application details. Please check your permissions.') });
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedApp) return;

    try {
      setSubmitting(true);
      
      if (reviewData.decision ===
   'approved') {
        // Only users with drd_ipr_approve can approve
        if (!canApprove) {
          toast({ type: 'warning', message: 'You do not have permission to approve. Please use "Recommend" instead.' });
          return;
        }
        await drdReviewService.approveReview(selectedApp.id, reviewData.comments);
        toast({ type: 'success', message: 'Application approved successfully! Incentive points have been credited.' });
      } else if (reviewData.decision ===
   'recommended') {
        // Recommend for approval - moves to DRD Head for final approval
        if (!reviewData.comments.trim()) {
          toast({ type: 'warning', message: 'Comments are required when recommending' });
          return;
        }
        await drdReviewService.recommendReview(selectedApp.id, reviewData.comments);
        toast({ type: 'success', message: 'Application recommended successfully! It will now go to DRD Head for final approval.' });
      } else if (reviewData.decision ===
   'rejected') {
        if (!reviewData.comments.trim()) {
          toast({ type: 'warning', message: 'Comments are required for rejection' });
          return;
        }
        await drdReviewService.rejectReview(selectedApp.id, reviewData.comments);
        toast({ type: 'success', message: 'Application rejected successfully!' });
      } else if (reviewData.decision ===
   'changes_required') {
        if (!reviewData.comments.trim()) {
          toast({ type: 'warning', message: 'Comments are required when requesting changes' });
          return;
        }
        const edits = reviewData.edits ? JSON.parse(reviewData.edits) : {};
        await drdReviewService.requestChanges(selectedApp.id, reviewData.comments, edits);
        toast({ type: 'success', message: 'Changes requested successfully!' });
      }

      setShowReviewModal(false);
      setSelectedApp(null);
      setReviewData({ decision: canApprove ? 'approved' : 'recommended', comments: '', edits: '' });
      fetchPendingReviews();
    } catch (error: unknown) {
      logger.error('Submit review error:', error);
      toast({ type: 'error', message: extractErrorMessage(error, 'Failed to submit review') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickApprove = async (app: any) => {
    const confirmed = await confirm({
      title: 'Approve Application',
      message: `Are you sure you want to approve "${app.title}"? This will calculate and credit incentive points.`,
      type: 'warning',
      confirmText: 'Approve'
    });
    if (!confirmed) {
      return;
    }

    try {
      const result = await drdReviewService.approveReview(app.id, 'Quick approval by DRD');
      toast({ type: 'success', message: `Application approved successfully! Points awarded: ${result.pointsAwarded || 0}, Amount: ₹${result.incentiveAmount || 0}` });
      fetchPendingReviews();
    } catch (error: unknown) {
      logger.error('Quick approve error:', error);
      toast({ type: 'error', message: extractErrorMessage(error, 'Failed to approve application') });
    }
  };

  const handleQuickReject = async (app: any) => {
    const reason = prompt(`Please provide a reason for rejecting "${app.title}":`);
    if (!reason) return;

    try {
      await drdReviewService.rejectReview(app.id, reason);
      toast({ type: 'success', message: 'Application rejected successfully!' });
      fetchPendingReviews();
    } catch (error: unknown) {
      logger.error('Quick reject error:', error);
      toast({ type: 'error', message: extractErrorMessage(error, 'Failed to reject application') });
    }
  };

  // New workflow handlers
  const handleRecommendToHead = async (app: any) => {
    const comments = prompt(`Add comments for recommending "${app.title}" to DRD Head:`);
    if (comments ===
   null) return;
    if (!comments.trim()) {
      toast({ type: 'warning', message: 'Comments are required when recommending' });
      return;
    }

    try {
      setSubmitting(true);
      await drdReviewService.recommendReview(app.id, comments);
      toast({ type: 'success', message: 'Application recommended to DRD Head successfully!' });
      fetchPendingReviews();
    } catch (error: unknown) {
      logger.error('Recommend to head error:', error);
      toast({ type: 'error', message: extractErrorMessage(error, 'Failed to recommend application') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleHeadApprove = async (app: any) => {
    const confirmed = await confirm({
      title: 'Approve and Submit to Government',
      message: `Are you sure you want to approve "${app.title}" and submit to Government?`,
      type: 'warning',
      confirmText: 'Approve & Submit'
    });
    if (!confirmed) return;

    try {
      setSubmitting(true);
      const response = await api.post(`/drd-review/head-approve/${app.id}`, { 
        comments: 'Approved by DRD Head' 
      });
      if (response.data.success) {
        toast({ type: 'success', message: 'Application approved and marked as submitted to Government!' });
        fetchPendingReviews();
      } else {
        toast({ type: 'error', message: response.data.message || 'Failed to approve application' });
      }
    } catch (error: unknown) {
      logger.error('Head approve error:', error);
      toast({ type: 'error', message: extractErrorMessage(error, 'Failed to approve application') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddGovtId = async () => {
    if (!selectedApp || !govtApplicationId.trim()) {
      toast({ type: 'warning', message: 'Please enter Government Application ID' });
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post(`/drd-review/govt-application/${selectedApp.id}`, { 
        govtApplicationId 
      });
      if (response.data.success) {
        toast({ type: 'success', message: 'Government Application ID added successfully!' });
        setShowGovtIdModal(false);
        setGovtApplicationId('');
        setSelectedApp(null);
        fetchPendingReviews();
      } else {
        toast({ type: 'error', message: response.data.message || 'Failed to add Government Application ID' });
      }
    } catch (error: unknown) {
      logger.error('Add govt ID error:', error);
      toast({ type: 'error', message: extractErrorMessage(error, 'Failed to add Government Application ID') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPublicationId = async () => {
    if (!selectedApp || !publicationId.trim()) {
      toast({ type: 'warning', message: 'Please enter Publication ID' });
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post(`/drd-review/publication/${selectedApp.id}`, { 
        publicationId 
      });
      if (response.data.success) {
        toast({ type: 'success', message: 'Publication ID added successfully! IPR marked as Published.' });
        setShowPubIdModal(false);
        setPublicationId('');
        setSelectedApp(null);
        fetchPendingReviews();
      } else {
        toast({ type: 'error', message: response.data.message || 'Failed to add Publication ID' });
      }
    } catch (error: unknown) {
      logger.error('Add publication ID error:', error);
      toast({ type: 'error', message: extractErrorMessage(error, 'Failed to add Publication ID') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAsRejected = async () => {
    if (!selectedApp || !rejectionReason.trim()) {
      toast({ type: 'warning', message: 'Please enter rejection reason' });
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post(`/drd-review/mark-govt-rejected/${selectedApp.id}`, { 
        comments: rejectionReason 
      });
      if (response.data.success) {
        toast({ type: 'success', message: 'Application marked as Government Rejected.' });
        setShowRejectModal(false);
        setRejectionReason('');
        setSelectedApp(null);
        fetchPendingReviews();
      } else {
        toast({ type: 'error', message: response.data.message || 'Failed to mark as rejected' });
      }
    } catch (error: unknown) {
      logger.error('Mark as rejected error:', error);
      toast({ type: 'error', message: extractErrorMessage(error, 'Failed to mark as rejected') });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; bg: string; ring: string }> = {
      draft: { label: 'Draft', color: 'text-gray-700', bg: 'bg-gray-100', ring: 'ring-gray-200' },
      pending_mentor_approval: { label: 'Pending Mentor', color: 'text-orange-700', bg: 'bg-orange-50', ring: 'ring-orange-200' },
      submitted: { label: 'Submitted', color: 'text-sgt-700', bg: 'bg-sgt-50', ring: 'ring-sgt-200' },
      under_drd_review: { label: 'Under Review', color: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' },
      changes_required: { label: 'Changes Required', color: 'text-orange-700', bg: 'bg-orange-50', ring: 'ring-orange-200' },
      resubmitted: { label: 'Resubmitted', color: 'text-purple-700', bg: 'bg-purple-50', ring: 'ring-purple-200' },
      recommended_to_head: { label: 'Recommended', color: 'text-indigo-700', bg: 'bg-indigo-50', ring: 'ring-indigo-200' },
      drd_approved: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
      submitted_to_govt: { label: 'Govt Submitted', color: 'text-teal-700', bg: 'bg-teal-50', ring: 'ring-teal-200' },
      govt_application_filed: { label: 'Govt Filed', color: 'text-cyan-700', bg: 'bg-cyan-50', ring: 'ring-cyan-200' },
      govt_rejected: { label: 'Govt Rejected', color: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200' },
      published: { label: 'Published', color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
      drd_rejected: { label: 'DRD Rejected', color: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200' },
      drd_head_rejected: { label: 'Head Rejected', color: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200' },
    };
    const config = statusConfig[status] || { label: status, color: 'text-gray-700', bg: 'bg-gray-100', ring: 'ring-gray-200' };
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.color} ring-1 ${config.ring}`}>
        <span className="status-dot mr-1.5" style={{ backgroundColor: 'currentColor', opacity: 0.6 }}></span>
        {config.label}
      </span>
    );
  };

  const filteredApplications = applications.filter(app => {
    // Tab filter
    let tabMatch = false;
    if (activeTab ===
   'pending') {
      tabMatch = ['submitted', 'under_drd_review', 'resubmitted', 'changes_required'].includes(app.status);
    } else if (activeTab ===
   'recommended') {
      tabMatch = ['recommended_to_head'].includes(app.status);
    } else if (activeTab ===
   'govt') {
      tabMatch = ['drd_head_approved', 'submitted_to_govt', 'govt_application_filed'].includes(app.status);
    } else if (activeTab ===
   'published') {
      tabMatch = ['published', 'completed'].includes(app.status);
    } else if (activeTab ===
   'rejected') {
      tabMatch = ['drd_rejected', 'drd_head_rejected', 'govt_rejected'].includes(app.status);
    }
    
    // Search filter
    const searchMatch = !searchQuery || 
      app.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.iprType?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return tabMatch && searchMatch;
  });

  const tabStats = {
    pending: applications.filter(a => ['submitted', 'under_drd_review', 'resubmitted', 'changes_required'].includes(a.status)).length,
    recommended: applications.filter(a => ['recommended_to_head'].includes(a.status)).length,
    govt: applications.filter(a => ['drd_head_approved', 'submitted_to_govt', 'govt_application_filed'].includes(a.status)).length,
    published: applications.filter(a => ['published', 'completed'].includes(a.status)).length,
    rejected: applications.filter(a => ['drd_rejected', 'drd_head_rejected', 'govt_rejected'].includes(a.status)).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-sgt-100 rounded-full animate-spin border-t-sgt-600"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 bg-sgt-gradient rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">Loading IPR applications...</p>
          <p className="text-sm text-gray-400 mt-1">Please wait</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-sgt-gradient rounded-3xl p-8 text-white shadow-sgt-xl">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
        </div>
        
        {/* Floating elements */}
        <div className="absolute top-8 right-16 w-3 h-3 bg-sgt-50 rounded-full animate-float opacity-60"></div>
        <div className="absolute bottom-16 right-32 w-2 h-2 bg-sgt-100 rounded-full animate-float opacity-40" style={{animationDelay: '0.5s'}}></div>
        
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center border border-white/20">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold">DRD Review Dashboard</h1>
                <p className="text-sgt-100 text-lg mt-1">Manage and review IPR applications</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={fetchPendingReviews}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl transition-all duration-200 border border-white/20"
              >
                <RefreshCcw className="w-4 h-4" />
                <span className="font-medium">Refresh</span>
              </button>
            </div>
          </div>

          {/* Workflow Progress */}
          <div className="mt-8 bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/10">
            <h3 className="text-sm font-semibold text-sgt-100 mb-4 uppercase tracking-wider">IPR Workflow Pipeline</h3>
            <div className="flex items-center justify-between overflow-x-auto">
              {[
                { icon: <Send size={16} />, label: 'Submitted', count: tabStats.pending },
                { icon: <Edit3 size={16} />, label: 'Review', count: 0 },
                { icon: <ChevronRight size={16} />, label: 'Recommended', count: tabStats.recommended },
                { icon: <CheckCircle size={16} />, label: 'Head Approved', count: 0 },
                { icon: <Building size={16} />, label: 'Govt Filing', count: tabStats.govt },
                { icon: <Award size={16} />, label: 'Published', count: tabStats.published },
              ].map((step, index, arr) => (
                <React.Fragment key={step.label}>
                  <div className="flex flex-col items-center min-w-[100px] group">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-all">
                      {step.icon}
                    </div>
                    <span className="text-xs mt-2 font-medium text-white/80">{step.label}</span>
                    {step.count > 0 && (
                      <span className="mt-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold">{step.count}</span>
                    )}
                  </div>
                  {index < arr.length - 1 && (
                    <div className="flex-1 h-0.5 bg-white/20 mx-2 min-w-[30px]" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* User Info Bar */}
      {user && (
        <div className="bg-gradient-to-r from-sgt-50 to-white rounded-2xl p-4 shadow-sm border border-sgt-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sgt-gradient rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user.employee?.displayName || user.student?.displayName || user.email}</p>
              <p className="text-xs text-gray-500">Role: {user.role?.name || 'N/A'} • UID: {user.uid}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canAssignSchools && (
              <a 
                href="/admin/drd-school-assignment"
                className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
              >
                <Building className="w-4 h-4" />
                Assign Schools
              </a>
            )}
            <span className="px-3 py-1.5 bg-sgt-100 text-sgt-700 rounded-lg text-sm font-medium">DRD Reviewer</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-800">Access Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <p className="text-xs text-red-600 mt-2">Required permissions: View All IPR, Review IPR, Edit All IPR</p>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sgt border border-gray-100 card-hover">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">Pending</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{tabStats.pending}</p>
          <p className="text-sm text-gray-500 mt-1">Awaiting Review</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sgt border border-gray-100 card-hover">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <ChevronRight className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">Recommended</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{tabStats.recommended}</p>
          <p className="text-sm text-gray-500 mt-1">To DRD Head</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sgt border border-gray-100 card-hover">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
              <Building className="w-6 h-6 text-teal-600" />
            </div>
            <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">Govt</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{tabStats.govt}</p>
          <p className="text-sm text-gray-500 mt-1">Government Filing</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sgt border border-gray-100 card-hover">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Complete</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{tabStats.published}</p>
          <p className="text-sm text-gray-500 mt-1">Published</p>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white rounded-2xl shadow-sgt border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto">
              {[
                { key: 'pending', label: 'Pending Review', icon: Clock, count: tabStats.pending },
                { key: 'recommended', label: 'Recommended', icon: ChevronRight, count: tabStats.recommended },
                { key: 'govt', label: 'Govt Filing', icon: Building, count: tabStats.govt },
                { key: 'published', label: 'Published', icon: Award, count: tabStats.published },
                { key: 'rejected', label: 'Rejected', icon: XCircle, count: tabStats.rejected },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all duration-200 ${
                    activeTab ===
   tab.key
                      ? 'bg-sgt-gradient text-white shadow-sgt'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  <span className={`ml-1 px-2 py-0.5 text-xs rounded-full font-semibold ${
                    activeTab ===
   tab.key 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full lg:w-64 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sgt-400 focus:border-sgt-400 transition-all"
              />
            </div>
          </div>
        </div>
        {/* Applications List */}
        {filteredApplications.length ===
   0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Applications Found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              {searchQuery 
                ? 'No applications match your search criteria. Try a different search term.'
                : 'There are no applications in this category at the moment.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredApplications.map((app: any) => (
              <div key={app.id} className="p-6 hover:bg-gray-50/50 transition-all duration-200 group">
                <div className="flex items-start gap-6">
                  {/* Icon */}
                  <div className="w-14 h-14 bg-sgt-gradient rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sgt group-hover:scale-105 transition-transform">
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap mb-2">
                          {app.applicationNumber && (
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg font-bold tracking-wide">
                              {app.applicationNumber}
                            </span>
                          )}
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-sgt-600 transition-colors">
                            {app.title}
                          </h3>
                          <span className="px-2.5 py-1 bg-sgt-100 text-sgt-700 text-xs rounded-lg font-semibold uppercase">
                            {app.iprType}
                          </span>
                          {getStatusBadge(app.status)}
                          {pendingSuggestions[app.id] > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-700 text-xs rounded-lg font-semibold">
                              <MessageSquare className="w-3 h-3" />
                              {pendingSuggestions[app.id]} suggestions
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm line-clamp-2">{app.description}</p>
                      </div>
                    </div>

                    {/* Government & Publication IDs - Hide for rejected applications */}
                    {(app.govtApplicationId || app.publicationId) && !['drd_rejected', 'drd_head_rejected', 'govt_rejected'].includes(app.status) && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {app.govtApplicationId && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-xl text-sm font-medium ring-1 ring-teal-100">
                            <Hash className="w-3.5 h-3.5" />
                            Govt ID: <span className="font-semibold">{app.govtApplicationId}</span>
                          </span>
                        )}
                        {app.publicationId && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium ring-1 ring-emerald-100">
                            <Award className="w-3.5 h-3.5" />
                            Publication: <span className="font-semibold">{app.publicationId}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Contributors/Inventors */}
                    {app.contributors && app.contributors.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-xl text-sm">
                          <User className="w-3.5 h-3.5" />
                          <span className="font-medium">Inventors:</span>
                          <span>
                            {app.contributors.map((c: any, i: number) => (
                              <span key={i}>{c.name}{i < app.contributors.length - 1 ? ', ' : ''}</span>
                            ))}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <User className="w-4 h-4" />
                        <span>
                          {app.applicantUser?.employeeDetails?.firstName 
                            ? `${app.applicantUser.employeeDetails.firstName} ${app.applicantUser.employeeDetails.lastName || ''}`
                            : app.applicantUser?.uid || 'External'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Building className="w-4 h-4" />
                        <span>{app.school?.facultyName || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {app.submittedAt
                            ? new Date(app.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Recently'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {/* Status Update Button - For Complete Filings (Hide when at Publication ID stage or rejected) */}
                    {app.filingType ===
   'complete' && 
                     !['govt_application_filed', 'published', 'govt_rejected', 'drd_rejected', 'drd_head_rejected', 'completed'].includes(app.status) && (
                      <button
                        onClick={() => {
                          setSelectedApp(app);
                          setShowStatusUpdateModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all duration-200 text-sm font-medium"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Status Update
                      </button>
                    )}
                    
                    {/* Pending Review Actions */}
                    {['submitted', 'under_drd_review', 'resubmitted'].includes(app.status) && (
                      <>
                        <button
                          onClick={() => handleReviewClick(app)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-sgt-gradient text-white rounded-xl hover:shadow-sgt transition-all duration-200 font-medium"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Review
                        </button>
                        <button
                          onClick={() => handleRecommendToHead(app)}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 text-sm font-medium"
                        >
                          <ArrowRight className="w-4 h-4" />
                          Recommend
                        </button>
                        <button
                          onClick={() => handleQuickReject(app)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all duration-200 text-sm font-medium"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </>
                    )}

                    {/* Recommended to Head - Head Actions (only for users with approve permission) */}
                    {app.status ===
   'recommended_to_head' && canApprove && (
                      <>
                        <button
                          onClick={async () => {
                            const details = await drdReviewService.getReviewDetails(app.id);
                            setSelectedApp(details);
                            setShowViewDetailsModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all duration-200 text-sm font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                        <button
                          onClick={() => handleHeadApprove(app)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all duration-200 font-medium"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve & Submit
                        </button>
                        <button
                          onClick={() => handleQuickReject(app)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all duration-200 text-sm font-medium"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </>
                    )}
                    
                    {/* Recommended to Head - View Only for reviewers without approve permission */}
                    {app.status ===
   'recommended_to_head' && !canApprove && (
                      <span className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-semibold ring-1 ring-indigo-200">
                        <Clock className="w-4 h-4" />
                        Awaiting Head Approval
                      </span>
                    )}

                    {/* Submitted to Govt - Add Govt ID (Only users with ipr_review permission can do this) */}
                    {app.status ===
   'submitted_to_govt' && canRecommend && (
                      <button
                        onClick={() => {
                          setSelectedApp(app);
                          setShowGovtIdModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all duration-200 font-medium"
                      >
                        <Hash className="w-4 h-4" />
                        Add Govt Filing Details
                      </button>
                    )}

                    {/* Submitted to Govt - View only for users with only ipr_approve permission */}
                    {app.status ===
   'submitted_to_govt' && canApprove && !canRecommend && (
                      <span className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 text-teal-700 rounded-xl text-sm font-semibold ring-1 ring-teal-200">
                        <Clock className="w-4 h-4" />
                        Awaiting Govt Filing
                      </span>
                    )}

                    {/* Govt Filed - Add Publication ID OR Mark as Rejected (Only users with ipr_review permission can do this) */}
                    {app.status ===
   'govt_application_filed' && canRecommend && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedApp(app);
                            setShowPubIdModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all duration-200 font-medium"
                        >
                          <Award className="w-4 h-4" />
                          Add Publication ID
                        </button>
                        <button
                          onClick={() => {
                            setSelectedApp(app);
                            setShowRejectModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200 font-medium"
                        >
                          <XCircle className="w-4 h-4" />
                          Mark as Rejected
                        </button>
                      </div>
                    )}



                    {/* Govt Filed - View only for users with only ipr_approve permission */}
                    {app.status ===
   'govt_application_filed' && canApprove && !canRecommend && (
                      <span className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-semibold ring-1 ring-emerald-200">
                        <Clock className="w-4 h-4" />
                        Awaiting Publication ID
                      </span>
                    )}

                    {/* Published - View Only */}
                    {['published', 'completed'].includes(app.status) && (
                      <span className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-semibold ring-1 ring-emerald-200">
                        <Award className="w-4 h-4" />
                        Published
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Government Application ID Modal */}
      {showGovtIdModal && selectedApp && (
        <div className="fixed inset-0 bg-sgt-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp">
            <div className="bg-sgt-gradient p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <Hash className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Government Application ID</h3>
                  <p className="text-sgt-100 text-sm">Add filing reference number</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Application</p>
                <p className="font-semibold text-gray-900">{selectedApp.title}</p>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Government Application ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={govtApplicationId}
                  onChange={(e) => setGovtApplicationId(e.target.value)}
                  placeholder="e.g., IN202341012345"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sgt-400 focus:border-sgt-400 transition-all"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowGovtIdModal(false);
                    setGovtApplicationId('');
                    setSelectedApp(null);
                  }}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddGovtId}
                  disabled={submitting || !govtApplicationId.trim()}
                  className="flex-1 px-4 py-3 bg-sgt-gradient text-white rounded-xl hover:shadow-sgt font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Adding...' : 'Add ID'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publication ID Modal */}
      {showPubIdModal && selectedApp && (
        <div className="fixed inset-0 bg-sgt-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp">
            <div className={`bg-gradient-to-r ${selectedApp.status ===
   'govt_rejected' ? 'from-red-600 to-red-700' : 'from-emerald-600 to-emerald-700'} p-6 text-white`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedApp.status ===
   'govt_rejected' ? 'Rejection Reference' : 'Publication ID'}</h3>
                  <p className={`${selectedApp.status ===
   'govt_rejected' ? 'text-red-100' : 'text-emerald-100'} text-sm`}>{selectedApp.status ===
   'govt_rejected' ? 'Document the rejection details' : 'Complete the IPR publication'}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Application</p>
                <p className="font-semibold text-gray-900">{selectedApp.title}</p>
                {selectedApp.govtApplicationId && (
                  <p className="text-sm text-gray-500 mt-1">Govt ID: {selectedApp.govtApplicationId}</p>
                )}
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {selectedApp.status ===
   'govt_rejected' ? 'Rejection Reference/Note' : 'Publication/Grant ID'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={publicationId}
                  onChange={(e) => setPublicationId(e.target.value)}
                  placeholder={selectedApp.status ===
   'govt_rejected' ? 'e.g., Rejection letter ref: REJ-2024-001' : 'e.g., IN-PAT-2024-12345'}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 ${selectedApp.status ===
   'govt_rejected' ? 'focus:ring-red-400 focus:border-red-400' : 'focus:ring-emerald-400 focus:border-emerald-400'} transition-all`}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPubIdModal(false);
                    setPublicationId('');
                    setSelectedApp(null);
                  }}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPublicationId}
                  disabled={submitting || !publicationId.trim()}
                  className={`flex-1 px-4 py-3 bg-gradient-to-r ${selectedApp.status ===
   'govt_rejected' ? 'from-red-600 to-red-700' : 'from-emerald-600 to-emerald-700'} text-white rounded-xl hover:shadow-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {submitting ? 'Adding...' : (selectedApp.status ===
   'govt_rejected' ? 'Add Reference' : 'Add & Publish')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Rejected Modal */}
      {showRejectModal && selectedApp && (
        <div className="fixed inset-0 bg-sgt-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp">
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Mark as Rejected</h3>
                  <p className="text-red-100 text-sm">Government rejected this application</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-xs text-red-600 uppercase tracking-wider font-medium mb-1">Application</p>
                <p className="font-semibold text-gray-900">{selectedApp.title}</p>
                {selectedApp.govtApplicationId && (
                  <p className="text-sm text-gray-500 mt-1">Govt ID: {selectedApp.govtApplicationId}</p>
                )}
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter the reason for government rejection..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">This will be communicated to the applicant.</p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                    setSelectedApp(null);
                  }}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkAsRejected}
                  disabled={submitting || !rejectionReason.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:shadow-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Processing...' : 'Mark as Rejected'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal - For DRD Head to view application details with documents */}
      {showViewDetailsModal && selectedApp && (
        <div className="fixed inset-0 bg-sgt-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-sgt-gradient p-6 text-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    <Eye className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Application Details</h2>
                    <p className="text-sgt-100">Review complete application information</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowViewDetailsModal(false);
                    setSelectedApp(null);
                  }}
                  className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center hover:bg-white/30 transition-all"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Application Info */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sgt-600" />
                  Application Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Application Number</p>
                    <p className="font-semibold text-gray-900 font-mono">{selectedApp.applicationNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Status</p>
                    {getStatusBadge(selectedApp.status)}
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Title</p>
                    <p className="font-semibold text-gray-900 text-lg">{selectedApp.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">IPR Type</p>
                    <span className="inline-block px-3 py-1 bg-sgt-100 text-sgt-700 rounded-lg font-semibold text-sm uppercase">
                      {selectedApp.iprType}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Project Type</p>
                    <p className="font-medium text-gray-700">{selectedApp.projectType?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Filing Type</p>
                    <p className="font-medium text-gray-700">{selectedApp.filingType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Submitted Date</p>
                    <p className="font-medium text-gray-700">
                      {selectedApp.submittedAt ? new Date(selectedApp.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Description</p>
                    <p className="text-gray-700">{selectedApp.description}</p>
                  </div>
                  {selectedApp.remarks && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Remarks</p>
                      <p className="text-gray-700">{selectedApp.remarks}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Applicant Details */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-sgt-600" />
                  Applicant Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Check for internal applicant - either from applicantDetails or applicantUser */}
                  {(selectedApp.applicantDetails?.uid || selectedApp.applicantDetails?.employeeCategory ===
   'internal' || selectedApp.applicantUser) ? (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Name</p>
                        <p className="font-semibold text-gray-900">
                          {selectedApp.applicantUser?.employeeDetails?.displayName || 
                           selectedApp.applicantUser?.employeeDetails?.firstName && selectedApp.applicantUser?.employeeDetails?.lastName 
                             ? `${selectedApp.applicantUser.employeeDetails.firstName} ${selectedApp.applicantUser.employeeDetails.lastName}`
                             : selectedApp.applicantDetails?.inventorName || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">UID</p>
                        <p className="font-semibold text-gray-900 font-mono">
                          {selectedApp.applicantDetails?.uid || selectedApp.applicantUser?.uid || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Email</p>
                        <p className="font-medium text-gray-700">
                          {selectedApp.applicantDetails?.email || selectedApp.applicantUser?.email || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Phone</p>
                        <p className="font-medium text-gray-700">{selectedApp.applicantDetails?.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Department</p>
                        <p className="font-medium text-gray-700">{selectedApp.applicantDetails?.universityDeptName || selectedApp.department?.departmentName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Employee Type</p>
                        <p className="font-medium text-gray-700 capitalize">{selectedApp.applicantDetails?.employeeType || selectedApp.applicantType || 'N/A'}</p>
                      </div>
                      {selectedApp.applicantDetails?.mentorName && (
                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Mentor</p>
                          <p className="font-medium text-gray-700">
                            {selectedApp.applicantDetails.mentorName} 
                            {selectedApp.applicantDetails.mentorUid && ` (${selectedApp.applicantDetails.mentorUid})`}
                          </p>
                        </div>
                      )}
                    </>
                  ) : selectedApp.applicantDetails?.externalName ? (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Name</p>
                        <p className="font-semibold text-gray-900">{selectedApp.applicantDetails.externalName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Email</p>
                        <p className="font-medium text-gray-700">{selectedApp.applicantDetails.externalEmail || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Phone</p>
                        <p className="font-medium text-gray-700">{selectedApp.applicantDetails.externalPhone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Organization</p>
                        <p className="font-medium text-gray-700">{selectedApp.applicantDetails.companyUniversityName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Type</p>
                        <p className="font-medium text-gray-700 capitalize">{selectedApp.applicantDetails.externalOption || 'External'}</p>
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-2 text-gray-500 italic">No applicant details available</div>
                  )}
                </div>
              </div>

              {/* Contributors/Inventors */}
              {selectedApp.contributors && selectedApp.contributors.length > 0 && (
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-sgt-600" />
                    Inventors/Contributors
                  </h3>
                  <div className="grid gap-3">
                    {selectedApp.contributors.map((contributor: any, index: number) => (
                      <div key={index} className="flex items-center gap-4 p-3 bg-white rounded-xl border border-gray-100">
                        <div className="w-10 h-10 bg-sgt-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-sgt-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{contributor.name}</p>
                          <p className="text-sm text-gray-500">
                            {contributor.email} • {contributor.role || 'Inventor'}
                            {contributor.uid && ` • ${contributor.uid}`}
                          </p>
                        </div>
                        {contributor.department && (
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">{contributor.department}</span>
                        )}
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          contributor.employeeCategory ===
   'internal' || contributor.userId
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {contributor.employeeCategory ===
   'internal' || contributor.userId ? 'Internal' : 'External'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SDGs */}
              {selectedApp.sdgs && selectedApp.sdgs.length > 0 && (
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-sgt-600" />
                    Sustainable Development Goals
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedApp.sdgs.map((sdg: any, index: number) => (
                      <span key={index} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">
                        {sdg.sdgCode}: {sdg.sdgName || sdg.sdgCode}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents Section - Always show, with message if no documents */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sgt-600" />
                  Uploaded Documents
                </h3>
                {(selectedApp.annexureFilePath || (selectedApp.supportingDocsFilePaths && selectedApp.supportingDocsFilePaths.length > 0)) ? (
                  <div className="space-y-3">
                    {/* Main Annexure Document */}
                    {selectedApp.annexureFilePath && (() => {
                      const filePath = selectedApp.annexureFilePath;
                      const fileName = filePath.split('/').pop() || 'Annexure Document';
                      const isPdf = fileName.toLowerCase().endsWith('.pdf');
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
                      const fileUrl = getFileUrl(filePath);
                      
                      return (
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                          <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <FileText className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">Main Annexure</p>
                                <p className="text-sm text-gray-500">{fileName}</p>
                              </div>
                            </div>
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all text-sm font-medium"
                            >
                              Open in New Tab
                            </a>
                          </div>
                          {isPdf && (
                            <div className="border-t border-gray-200">
                              <iframe
                                src={`${fileUrl}#toolbar=1&navpanes=0`}
                                className="w-full h-[500px]"
                                title={fileName}
                              />
                            </div>
                          )}
                          {isImage && (
                            <div className="border-t border-gray-200 p-4 bg-gray-100">
                              <img
                                src={fileUrl}
                                alt={fileName}
                                className="max-w-full h-auto rounded-lg mx-auto"
                                style={{ maxHeight: '400px' }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* Supporting Documents */}
                    {selectedApp.supportingDocsFilePaths && selectedApp.supportingDocsFilePaths.map((filePath: string, index: number) => {
                      const fileName = filePath.split('/').pop() || `Supporting Document ${index + 1}`;
                      const isPdf = fileName.toLowerCase().endsWith('.pdf');
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
                      const fileUrl = getFileUrl(filePath);
                      
                      return (
                        <div key={index} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                          <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <FileText className="w-5 h-5 text-green-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">Supporting Document {index + 1}</p>
                                <p className="text-sm text-gray-500">{fileName}</p>
                              </div>
                            </div>
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all text-sm font-medium"
                            >
                              Open in New Tab
                            </a>
                          </div>
                          {isPdf && (
                            <div className="border-t border-gray-200">
                              <iframe
                                src={`${fileUrl}#toolbar=1&navpanes=0`}
                                className="w-full h-[500px]"
                                title={fileName}
                              />
                            </div>
                          )}
                          {isImage && (
                            <div className="border-t border-gray-200 p-4 bg-gray-100">
                              <img
                                src={fileUrl}
                                alt={fileName}
                                className="max-w-full h-auto rounded-lg mx-auto"
                                style={{ maxHeight: '400px' }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No documents uploaded for this application</p>
                  </div>
                )}
              </div>

              {/* Review History - Enhanced Timeline */}
              {selectedApp.reviews && selectedApp.reviews.length > 0 && (
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-sgt-600" />
                    Review History
                  </h3>
                  <div className="space-y-4 relative">
                    {/* Timeline line */}
                    <div className="absolute left-[23px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-sgt-200 via-sgt-300 to-sgt-200"></div>
                    
                    {selectedApp.reviews.map((review: any, index: number) => {
                      const isApproved = review.decision ===
   'approved' || review.decision ===
   'recommended';
                      const isRejected = review.decision ===
   'rejected';
                      const isChangesRequired = review.decision ===
   'changes_required';
                      
                      return (
                        <div key={index} className="relative pl-14 pb-4">
                          {/* Timeline dot */}
                          <div className={`absolute left-3 top-3 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg z-10 ${
                            isApproved ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' :
                            isRejected ? 'bg-gradient-to-br from-red-400 to-red-600' :
                            'bg-gradient-to-br from-amber-400 to-amber-600'
                          }`}>
                            {isApproved ? <CheckCircle className="w-5 h-5 text-white" /> :
                             isRejected ? <XCircle className="w-5 h-5 text-white" /> :
                             <Edit3 className="w-5 h-5 text-white" />}
                          </div>
                          
                          {/* Review card */}
                          <div className={`bg-white rounded-xl border-2 shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden ${
                            isApproved ? 'border-emerald-200 hover:border-emerald-300' :
                            isRejected ? 'border-red-200 hover:border-red-300' :
                            'border-amber-200 hover:border-amber-300'
                          }`}>
                            {/* Header */}
                            <div className={`px-4 py-3 border-b ${
                              isApproved ? 'bg-emerald-50 border-emerald-100' :
                              isRejected ? 'bg-red-50 border-red-100' :
                              'bg-amber-50 border-amber-100'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide ${
                                    isApproved ? 'bg-emerald-100 text-emerald-700' :
                                    isRejected ? 'bg-red-100 text-red-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {review.decision?.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-sm font-medium text-gray-700">
                                    Review #{selectedApp.reviews.length - index}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 font-medium">
                                  {review.reviewedAt ? new Date(review.reviewedAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  }) : ''}
                                </span>
                              </div>
                            </div>
                            
                            {/* Content */}
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-semibold text-gray-900">
                                  {review.reviewer?.employeeDetails?.displayName || review.reviewer?.uid || 'Reviewer'}
                                </span>
                              </div>
                              {review.comments && (
                                <p className="text-sm text-gray-700 leading-relaxed pl-6">
                                  {review.comments}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-4 flex-shrink-0">
              <button
                onClick={() => {
                  setShowViewDetailsModal(false);
                  setSelectedApp(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-semibold transition-all"
              >
                Close
              </button>
              {selectedApp.status ===
   'recommended_to_head' && canApprove && (
                <>
                  <button
                    onClick={() => {
                      setShowViewDetailsModal(false);
                      handleHeadApprove(selectedApp);
                    }}
                    className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold transition-all"
                  >
                    Approve & Submit to Govt
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedApp && (
        <div className="fixed inset-0 bg-sgt-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-sgt-gradient p-6 text-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    {isCollaborativeMode ? (
                      <MessageSquare className="w-6 h-6" />
                    ) : (
                      <Edit3 className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {isCollaborativeMode ? 'Collaborative Review' : 'Traditional Review'}
                    </h2>
                    <p className="text-sgt-100">IPR Application Review</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setIsCollaborativeMode(false);
                    setSelectedApp(null);
                  }}
                  className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center hover:bg-white/30 transition-all"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Application Details */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sgt-600" />
                  Application Details
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Title</p>
                    <p className="font-semibold text-gray-900">{selectedApp.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Type</p>
                    <span className="inline-block px-3 py-1 bg-sgt-100 text-sgt-700 rounded-lg font-semibold text-sm uppercase">
                      {selectedApp.iprType}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Project Type</p>
                    <p className="font-medium text-gray-700">{selectedApp.projectType?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Filing Type</p>
                    <p className="font-medium text-gray-700">{selectedApp.filingType}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Description</p>
                    <p className="text-gray-700">{selectedApp.description}</p>
                  </div>
                  {selectedApp.remarks && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Remarks</p>
                      <p className="text-gray-700">{selectedApp.remarks}</p>
                    </div>
                  )}
                  {selectedApp.sdgs && selectedApp.sdgs.length > 0 && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">SDGs</p>
                      <div className="flex gap-2 flex-wrap">
                        {selectedApp.sdgs.map((s: any) => (
                          <span key={s.sdgCode} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">
                            {s.sdgCode}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Applicant Details */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-sgt-600" />
                  Applicant Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Check for internal applicant - either from applicantDetails or applicantUser */}
                  {(selectedApp.applicantDetails?.uid || selectedApp.applicantDetails?.employeeCategory ===
   'internal' || selectedApp.applicantUser) ? (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Name</p>
                        <p className="font-semibold text-gray-900">
                          {selectedApp.applicantUser?.employeeDetails?.displayName || 
                           (selectedApp.applicantUser?.employeeDetails?.firstName && selectedApp.applicantUser?.employeeDetails?.lastName 
                             ? `${selectedApp.applicantUser.employeeDetails.firstName} ${selectedApp.applicantUser.employeeDetails.lastName}`
                             : null) ||
                           selectedApp.applicantUser?.studentLogin?.displayName ||
                           (selectedApp.applicantUser?.studentLogin?.firstName && selectedApp.applicantUser?.studentLogin?.lastName
                             ? `${selectedApp.applicantUser.studentLogin.firstName} ${selectedApp.applicantUser.studentLogin.lastName}`
                             : null) ||
                           selectedApp.applicantDetails?.inventorName || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">UID</p>
                        <p className="font-semibold text-gray-900 font-mono">
                          {selectedApp.applicantDetails?.uid || selectedApp.applicantUser?.uid || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Email</p>
                        <p className="font-medium text-gray-700">
                          {selectedApp.applicantDetails?.email || selectedApp.applicantUser?.email || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Phone</p>
                        <p className="font-medium text-gray-700">
                          {selectedApp.applicantDetails?.phone || 
                           selectedApp.applicantUser?.studentLogin?.phone ||
                           selectedApp.applicantUser?.employeeDetails?.phoneNumber || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Department</p>
                        <p className="font-medium text-gray-700">
                          {selectedApp.applicantDetails?.universityDeptName || 
                           selectedApp.applicantUser?.employeeDetails?.primaryDepartment?.departmentName ||
                           selectedApp.applicantUser?.studentLogin?.program?.programName ||
                           selectedApp.department?.departmentName || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Applicant Type</p>
                        <p className="font-medium text-gray-700 capitalize">
                          {selectedApp.applicantUser?.employeeDetails?.designation ||
                           (selectedApp.applicantUser?.role?.name ===
   'staff' ? 'Staff' : 
                            selectedApp.applicantUser?.role?.name ===
   'faculty' ? 'Faculty' :
                            selectedApp.applicantUser?.employeeDetails ? 'Staff' : null) || 
                           (selectedApp.applicantUser?.studentLogin ? 'Student' : null) ||
                           selectedApp.applicantDetails?.employeeType || selectedApp.applicantType || 'N/A'}
                        </p>
                      </div>
                      {selectedApp.applicantDetails?.mentorName && (
                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Mentor</p>
                          <p className="font-medium text-gray-700">
                            {selectedApp.applicantDetails.mentorName} 
                            {selectedApp.applicantDetails.mentorUid && ` (${selectedApp.applicantDetails.mentorUid})`}
                          </p>
                        </div>
                      )}
                    </>
                  ) : selectedApp.applicantDetails?.externalName ? (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Name</p>
                        <p className="font-semibold text-gray-900">{selectedApp.applicantDetails.externalName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Email</p>
                        <p className="font-medium text-gray-700">{selectedApp.applicantDetails.externalEmail || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Phone</p>
                        <p className="font-medium text-gray-700">{selectedApp.applicantDetails.externalPhone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Organization</p>
                        <p className="font-medium text-gray-700">{selectedApp.applicantDetails.companyUniversityName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Type</p>
                        <p className="font-medium text-gray-700 capitalize">{selectedApp.applicantDetails.externalOption || 'External'}</p>
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-2 text-gray-500 italic">No applicant details available</div>
                  )}
                </div>
              </div>

              {/* Contributors/Inventors */}
              {selectedApp.contributors && selectedApp.contributors.length > 0 && (
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-sgt-600" />
                    Inventors/Contributors
                  </h3>
                  <div className="grid gap-3">
                    {selectedApp.contributors.map((contributor: any, index: number) => (
                      <div key={index} className="flex items-center gap-4 p-3 bg-white rounded-xl border border-gray-100">
                        <div className="w-10 h-10 bg-sgt-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-sgt-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{contributor.name}</p>
                          <p className="text-sm text-gray-500">
                            {contributor.email} • {contributor.role || 'Inventor'}
                            {contributor.uid && ` • ${contributor.uid}`}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          contributor.employeeCategory ===
   'internal' || contributor.userId
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {contributor.employeeCategory ===
   'internal' || contributor.userId ? 'Internal' : 'External'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents Section */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sgt-600" />
                  Uploaded Documents
                </h3>
                {(selectedApp.annexureFilePath || selectedApp.supportingDocsFilePaths || selectedApp.prototypeFilePath || 
                  selectedApp.abstractFile || selectedApp.supportingDocs || selectedApp.nocDocument || 
                  selectedApp.formIDocument || selectedApp.formIIDocument || selectedApp.formIIIDocument || 
                  selectedApp.formIVDocument) ? (
                  <div className="grid gap-3">
                    {/* Main Document (annexureFilePath) */}
                    {selectedApp.annexureFilePath && (
                      <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}/uploads/ipr/${selectedApp.annexureFilePath.split('/').pop()}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-sgt-200 transition-all">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Main Document</p>
                          <p className="text-xs text-gray-500">{selectedApp.annexureFilePath.split('/').pop()}</p>
                        </div>
                        <Download className="w-5 h-5 text-gray-400" />
                      </a>
                    )}
                    
                    {/* Prototype ZIP (prototypeFilePath) */}
                    {selectedApp.prototypeFilePath && (
                      <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}/uploads/ipr/${selectedApp.prototypeFilePath.split('/').pop()}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-sgt-200 transition-all">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Prototype Package (ZIP)</p>
                          <p className="text-xs text-gray-500">{selectedApp.prototypeFilePath.split('/').pop()}</p>
                        </div>
                        <Download className="w-5 h-5 text-gray-400" />
                      </a>
                    )}
                    
                    {/* Supporting Documents (supportingDocsFilePaths - JSON array) */}
                    {selectedApp.supportingDocsFilePaths && Array.isArray(selectedApp.supportingDocsFilePaths) && selectedApp.supportingDocsFilePaths.map((docPath: string, idx: number) => (
                      <a key={idx} href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}/uploads/ipr/${docPath.split('/').pop()}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-sgt-200 transition-all">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Supporting Document {idx + 1}</p>
                          <p className="text-xs text-gray-500">{docPath.split('/').pop()}</p>
                        </div>
                        <Download className="w-5 h-5 text-gray-400" />
                      </a>
                    ))}
                    
                    {/* Legacy fields for backward compatibility */}
                    {selectedApp.abstractFile && (
                      <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}/uploads/ipr/${selectedApp.abstractFile.split('/').pop()}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-sgt-200 transition-all">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Abstract Document</p>
                          <p className="text-xs text-gray-500">{selectedApp.abstractFile.split('/').pop()}</p>
                        </div>
                        <Download className="w-5 h-5 text-gray-400" />
                      </a>
                    )}
                    {selectedApp.supportingDocs && (
                      <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}/uploads/ipr/${selectedApp.supportingDocs.split('/').pop()}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-sgt-200 transition-all">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Supporting Documents</p>
                          <p className="text-xs text-gray-500">{selectedApp.supportingDocs.split('/').pop()}</p>
                        </div>
                        <Download className="w-5 h-5 text-gray-400" />
                      </a>
                    )}
                    {selectedApp.nocDocument && (
                      <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}/uploads/ipr/${selectedApp.nocDocument.split('/').pop()}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-sgt-200 transition-all">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">NOC Document</p>
                          <p className="text-xs text-gray-500">{selectedApp.nocDocument.split('/').pop()}</p>
                        </div>
                        <Download className="w-5 h-5 text-gray-400" />
                      </a>
                    )}
                    {selectedApp.formIDocument && (
                      <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}/uploads/ipr/${selectedApp.formIDocument.split('/').pop()}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-sgt-200 transition-all">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Form I</p>
                          <p className="text-xs text-gray-500">{selectedApp.formIDocument.split('/').pop()}</p>
                        </div>
                        <Download className="w-5 h-5 text-gray-400" />
                      </a>
                    )}
                    {selectedApp.formIIDocument && (
                      <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}/uploads/ipr/${selectedApp.formIIDocument.split('/').pop()}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-sgt-200 transition-all">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Form II</p>
                          <p className="text-xs text-gray-500">{selectedApp.formIIDocument.split('/').pop()}</p>
                        </div>
                        <Download className="w-5 h-5 text-gray-400" />
                      </a>
                    )}
                    {selectedApp.formIIIDocument && (
                      <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}/uploads/ipr/${selectedApp.formIIIDocument.split('/').pop()}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-sgt-200 transition-all">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Form III</p>
                          <p className="text-xs text-gray-500">{selectedApp.formIIIDocument.split('/').pop()}</p>
                        </div>
                        <Download className="w-5 h-5 text-gray-400" />
                      </a>
                    )}
                    {selectedApp.formIVDocument && (
                      <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}/uploads/ipr/${selectedApp.formIVDocument.split('/').pop()}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-sgt-200 transition-all">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Form IV</p>
                          <p className="text-xs text-gray-500">{selectedApp.formIVDocument.split('/').pop()}</p>
                        </div>
                        <Download className="w-5 h-5 text-gray-400" />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No documents uploaded for this application</p>
                )}
              </div>

              {/* Review Form */}
              <div className="bg-white rounded-2xl p-5 border-2 border-sgt-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-sgt-600" />
                  Your Review
                </h3>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Decision <span className="text-red-500">*</span>
                    </label>
                    {/* Permission Info */}
                    {!canApprove && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                        <Shield className="w-4 h-4 inline mr-2" />
                        You can <strong>Recommend</strong> applications for approval. Only DRD Head can give final approval.
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-3">
                      {/* Dynamic options based on permissions */}
                      {canApprove ? (
                        // DRD Head / Approver sees: Approve, Request Changes, Reject
                        <>
                          {[
                            { value: 'approved', label: 'Approve', icon: CheckCircle, color: 'emerald' },
                            { value: 'changes_required', label: 'Request Changes', icon: Edit3, color: 'amber' },
                            { value: 'rejected', label: 'Reject', icon: XCircle, color: 'red' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setReviewData({ ...reviewData, decision: option.value as any })}
                              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                                reviewData.decision ===
   option.value
                                  ? option.color ===
   'emerald' 
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : option.color ===
   'amber'
                                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                                    : 'border-red-500 bg-red-50 text-red-700'
                                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              <option.icon className="w-6 h-6" />
                              <span className="font-semibold text-sm">{option.label}</span>
                            </button>
                          ))}
                        </>
                      ) : (
                        // DRD Member / Reviewer sees: Recommend, Request Changes, Reject
                        <>
                          {[
                            { value: 'recommended', label: 'Recommend', icon: CheckCircle, color: 'blue' },
                            { value: 'changes_required', label: 'Request Changes', icon: Edit3, color: 'amber' },
                            { value: 'rejected', label: 'Reject', icon: XCircle, color: 'red' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setReviewData({ ...reviewData, decision: option.value as any })}
                              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                                reviewData.decision ===
   option.value
                                  ? option.color ===
   'blue' 
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : option.color ===
   'amber'
                                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                                    : 'border-red-500 bg-red-50 text-red-700'
                                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              <option.icon className="w-6 h-6" />
                              <span className="font-semibold text-sm">{option.label}</span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Comments <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={reviewData.comments}
                      onChange={(e) => setReviewData({ ...reviewData, comments: e.target.value })}
                      rows={4}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sgt-400 focus:border-sgt-400 transition-all resize-none"
                      placeholder="Provide your review comments..."
                    />
                  </div>

                  {reviewData.decision ===
   'changes_required' && selectedApp && (
                    <div className="space-y-6 mt-6 pt-6 border-t border-gray-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                          <MessageSquare className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">Collaborative Editing</h4>
                          <p className="text-sm text-gray-500">Make direct suggestions on the fields below</p>
                        </div>
                      </div>
                      
                      <div className="grid gap-6">
                        <CollaborativeEditor
                          iprApplicationId={selectedApp.id}
                          fieldName="title"
                          fieldPath="title"
                          currentValue={formData.title}
                          isReviewer={true}
                          label="Title"
                          placeholder="Enter IPR title..."
                          multiline={false}
                          onChange={(value) => setFormData({ ...formData, title: value })}
                        />
                        
                        <CollaborativeEditor
                          iprApplicationId={selectedApp.id}
                          fieldName="description"
                          fieldPath="description"
                          currentValue={formData.description}
                          isReviewer={true}
                          label="Description"
                          placeholder="Enter IPR description..."
                          multiline={true}
                          onChange={(value) => setFormData({ ...formData, description: value })}
                        />
                        
                        <div className="grid grid-cols-2 gap-4">
                          <CollaborativeEditor
                            iprApplicationId={selectedApp.id}
                            fieldName="iprType"
                            fieldPath="iprType"
                            currentValue={formData.iprType}
                            isReviewer={true}
                            label="IPR Type"
                            placeholder="Enter IPR type..."
                            multiline={false}
                            onChange={(value) => setFormData({ ...formData, iprType: value })}
                          />
                          
                          <CollaborativeEditor
                            iprApplicationId={selectedApp.id}
                            fieldName="projectType"
                            fieldPath="projectType"
                            currentValue={formData.projectType}
                            isReviewer={true}
                            label="Project Type"
                            placeholder="Enter project type..."
                            multiline={false}
                            onChange={(value) => setFormData({ ...formData, projectType: value })}
                          />
                        </div>
                        
                        <CollaborativeEditor
                          iprApplicationId={selectedApp.id}
                          fieldName="filingType"
                          fieldPath="filingType"
                          currentValue={formData.filingType}
                          isReviewer={true}
                          label="Filing Type"
                          placeholder="Enter filing type..."
                          multiline={false}
                          onChange={(value) => setFormData({ ...formData, filingType: value })}
                        />
                        
                        <CollaborativeEditor
                          iprApplicationId={selectedApp.id}
                          fieldName="remarks"
                          fieldPath="remarks"
                          currentValue={formData.remarks}
                          isReviewer={true}
                          label="Remarks"
                          placeholder="Enter remarks..."
                          multiline={true}
                          onChange={(value) => setFormData({ ...formData, remarks: value })}
                        />
                      </div>
                      
                      <div className="p-4 bg-sgt-50 rounded-xl border border-sgt-100">
                        <div className="flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-sgt-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-sgt-700">
                            <strong>How it works:</strong> Click &quot;Suggest Edit&quot; next to any field to propose changes. 
                            The applicant will be notified and can accept or reject your suggestions.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-4 flex-shrink-0">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setIsCollaborativeMode(false);
                  setSelectedApp(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submitting || !reviewData.comments}
                className="flex-1 px-6 py-3 bg-sgt-gradient text-white rounded-xl hover:shadow-sgt font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Separate Status Update Modal */}
      {showStatusUpdateModal && selectedApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6 rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <MessageSquare className="w-7 h-7" />
                    Status Updates
                  </h2>
                  <p className="text-purple-100 mt-1">
                    {selectedApp.applicationNumber} - {selectedApp.title}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowStatusUpdateModal(false);
                    setSelectedApp(null);
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Status Updates Component */}
            <div className="p-6">
              <IPRStatusUpdates applicationId={selectedApp.id} isDRD={true} />
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 p-6 rounded-b-2xl border-t border-gray-200">
              <button
                onClick={() => {
                  setShowStatusUpdateModal(false);
                  setSelectedApp(null);
                }}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-semibold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
