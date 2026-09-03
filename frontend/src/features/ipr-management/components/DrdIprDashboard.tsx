'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { drdReviewService, iprService } from '@/features/ipr-management/services/ipr.service';
import api from '@/shared/api/api';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { 
  Shield, 
  Eye, 
  Edit3, 
  ThumbsUp, 
  CheckCircle, 
  XCircle, 
  FileText,
  Plus,
  Trash2,
  BarChart3,
  ArrowLeft,
  AlertCircle,
  Clock,
  DollarSign,
  Crown,
  Settings,
  Award,
  Search,
  Filter,
  ChevronRight,
  User,
  Building,
  Calendar,
  RefreshCcw,
  Sparkles,
  MapPin
} from 'lucide-react';
import Link from 'next/link';

interface IprApplication {
  id: string;
  title: string;
  iprType: string;
  status: string;
  pointsAwarded?: number;
  incentiveAmount?: number;
  creditedAt?: string;
  submittedAt?: string;
  applicantUser?: {
    employeeDetails?: {
      displayName: string;
    };
  };
  applicantDetails?: {
    externalName?: string;
  };
}

export default function DrdIprDashboard() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuthStore();
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [applications, setApplications] = useState<IprApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedApp, setSelectedApp] = useState<IprApplication | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'changes' | 'dean_approve' | 'dean_reject' | 'finance_approve' | 'finance_audit' | 'system_override'>('approve');
  const [actionComments, setActionComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchUserPermissions();
      fetchApplications();
    }
  }, [user, activeTab]);

  const fetchUserPermissions = async () => {
    try {
      const response = await api.get('/dashboard/staff');
      
      // Extract ALL permissions from staff dashboard response
      const allPermissions: Record<string, boolean> = {};
      
      if (response.data.success && response.data.data.permissions) {
        logger.debug('Full permissions response:', response.data.data.permissions);
        
        response.data.data.permissions.forEach((dept: any) => {
          logger.debug('Processing department:', dept.category, 'with permissions:', dept.permissions);
          
          if (Array.isArray(dept.permissions)) {
            // Convert permission array to boolean map - include ALL permissions
            dept.permissions.forEach((perm: string) => {
              allPermissions[perm] = true;
              
              // Also create mappings for common IPR permission patterns
              const permLower = perm.toLowerCase().replace(/\s+/g, '_');
              
              // Map to NEW simplified 4-permission model
              if (permLower ===
   'ipr_file_new' || permLower.includes('file') && permLower.includes('ipr')) {
                allPermissions['ipr_file_new'] = true;
                allPermissions['drd_ipr_file'] = true;  // backward compat
              }
              if (permLower ===
   'ipr_review' || permLower.includes('review') && permLower.includes('ipr')) {
                allPermissions['ipr_review'] = true;
                allPermissions['drd_ipr_review'] = true;  // backward compat
              }
              if (permLower ===
   'ipr_approve' || permLower.includes('approve') && permLower.includes('ipr')) {
                allPermissions['ipr_approve'] = true;
                allPermissions['drd_ipr_approve'] = true;  // backward compat
              }
              if (permLower ===
   'ipr_assign_school' || permLower.includes('assign') && permLower.includes('school')) {
                allPermissions['ipr_assign_school'] = true;
              }
              // Also handle recommend as part of review
              if (permLower.includes('recommend')) {
                allPermissions['ipr_review'] = true;  // recommend is part of review
                allPermissions['drd_ipr_recommend'] = true;
              }
            });
          }
        });
      }
      
      logger.debug('Extracted ALL permissions:', allPermissions);
      setUserPermissions(allPermissions);
    } catch (error: unknown) {
      logger.error('Error fetching permissions:', error);
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      
      if (activeTab ===
   'pending') {
        const response = await drdReviewService.getPendingReviews({ limit: 50 });
        setApplications(response.data || []);
      } else {
        // Fetch all applications based on tab
        const statusFilter = activeTab ===
   'all' ? undefined : 
          (activeTab ===
   'approved' ? 'drd_approved' as const :
           activeTab ===
   'rejected' ? 'drd_rejected' as const :
           activeTab as any);
        const response = await iprService.getAllApplications({ 
          status: statusFilter
        });
        setApplications(response || []);
      }
    } catch (error: unknown) {
      logger.error('Error fetching applications:', error);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (app: IprApplication, action: 'approve' | 'reject' | 'changes' | 'dean_approve' | 'dean_reject' | 'finance_approve' | 'finance_audit' | 'system_override') => {
    setSelectedApp(app);
    setActionType(action);
    setActionComments('');
    setShowActionModal(true);
  };

  const handleSubmitAction = async () => {
    if (!selectedApp || !actionComments.trim()) return;

    try {
      setSubmitting(true);
      
      switch (actionType) {
        case 'approve':
          // DRD member approves and sends to Dean
          await drdReviewService.approveReview(selectedApp.id, actionComments);
          break;
        case 'changes':
          // DRD member requests changes - goes back to applicant
          await drdReviewService.requestChanges(selectedApp.id, actionComments);
          break;
        case 'reject':
          // DRD member rejects application
          await drdReviewService.rejectReview(selectedApp.id, actionComments);
          break;
        case 'dean_approve':
          // Dean approves and sends to Finance
          await drdReviewService.deanApprove(selectedApp.id, actionComments);
          break;
        case 'dean_reject':
          // Dean rejects application
          await drdReviewService.deanReject(selectedApp.id, actionComments);
          break;
        case 'finance_approve':
          // Finance processes incentives and completes workflow
          await drdReviewService.financeApprove(selectedApp.id, actionComments);
          break;
        case 'finance_audit':
          // Finance requests additional audit
          await drdReviewService.financeAudit(selectedApp.id, actionComments);
          break;
        case 'system_override':
          // System admin override (if needed)
          await drdReviewService.systemOverride(selectedApp.id, actionComments);
          break;
      }

      const actionMessages = {
        approve: 'Application approved and sent to DRD Head',
        changes: 'Change request sent to applicant',
        reject: 'Application rejected',
        dean_approve: 'DRD Head approved - sent to Finance',
        dean_reject: 'Application rejected by DRD Head',
        finance_approve: 'Incentives processed successfully',
        finance_audit: 'Audit review requested',
        system_override: 'System override applied'
      };

      toast({ type: 'success', message: actionMessages[actionType] });
      setShowActionModal(false);
      setSelectedApp(null);
      fetchApplications();
    } catch (error: unknown) {
      logger.error(`Error processing ${actionType}:`, error);
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700 ring-gray-200',
      pending_mentor_approval: 'bg-orange-50 text-orange-700 ring-orange-200',
      submitted: 'bg-ResearchSphere-50 text-ResearchSphere-700 ring-ResearchSphere-200',
      under_drd_review: 'bg-amber-50 text-amber-700 ring-amber-200',
      changes_required: 'bg-orange-50 text-orange-700 ring-orange-200',
      resubmitted: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
      drd_approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      drd_rejected: 'bg-red-50 text-red-700 ring-red-200',
      under_dean_review: 'bg-purple-50 text-purple-700 ring-purple-200',
      dean_approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      dean_rejected: 'bg-red-50 text-red-700 ring-red-200',
      recommended_to_head: 'bg-teal-50 text-teal-700 ring-teal-200',
      drd_head_approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      submitted_to_govt: 'bg-[#fdf5ec] text-[#7d1a34] ring-blue-200',
      govt_application_filed: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
      published: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
      // Kept for backward compatibility
      under_finance_review: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
      finance_approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      incentives_processed: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
      completed: 'bg-emerald-100 text-emerald-800 ring-emerald-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-700 ring-gray-200';
  };

  const getApplicantName = (app: IprApplication) => {
    return app.applicantUser?.employeeDetails?.displayName || 
           app.applicantDetails?.externalName || 
           'Unknown Applicant';
  };

  const getWorkflowStage = (status: string) => {
    const stages: Record<string, { stage: string; description: string; color: string }> = {
      draft: { stage: 'Draft', description: 'Application being prepared', color: 'text-gray-600' },
      submitted: { stage: 'DRD Review Queue', description: 'Waiting for DRD team member review', color: 'text-[#7d1a34]' },
      under_drd_review: { stage: 'DRD Review', description: 'Under review by DRD team member', color: 'text-yellow-600' },
      changes_required: { stage: 'Changes Required', description: 'Applicant needs to make revisions', color: 'text-orange-600' },
      resubmitted: { stage: 'DRD Re-review', description: 'Revised application under review', color: 'text-indigo-600' },
      drd_approved: { stage: 'DRD Head Queue', description: 'Approved by DRD member, awaiting Head', color: 'text-green-600' },
      recommended_to_head: { stage: 'Recommended', description: 'Recommended to DRD Head for approval', color: 'text-teal-600' },
      under_dean_review: { stage: 'DRD Head Review', description: 'Under review by DRD Head', color: 'text-purple-600' },
      dean_approved: { stage: 'Govt Filing Queue', description: 'Approved by DRD Head, ready for government filing', color: 'text-emerald-600' },
      drd_head_approved: { stage: 'Govt Filing Queue', description: 'Approved by DRD Head, ready for government filing', color: 'text-emerald-600' },
      submitted_to_govt: { stage: 'Submitted to Govt', description: 'Application submitted to government', color: 'text-[#7d1a34]' },
      govt_application_filed: { stage: 'Govt Filed', description: 'Government application filed successfully', color: 'text-cyan-600' },
      published: { stage: 'Published', description: 'IPR published - Incentives credited automatically', color: 'text-indigo-600' },
      // Kept for backward compatibility
      under_finance_review: { stage: 'Published', description: 'IPR published (legacy status)', color: 'text-indigo-600' },
      finance_approved: { stage: 'Completed', description: 'Incentives processed (legacy status)', color: 'text-green-600' },
      incentives_processed: { stage: 'Completed', description: 'Incentives credited to applicant', color: 'text-emerald-600' },
      completed: { stage: 'Completed', description: 'Workflow completed successfully', color: 'text-green-700' },
      drd_rejected: { stage: 'Rejected by DRD', description: 'Application rejected by DRD team', color: 'text-red-600' },
      dean_rejected: { stage: 'Rejected by Head', description: 'Application rejected by DRD Head', color: 'text-red-600' }
    };
    return stages[status] || { stage: 'Unknown', description: 'Status not recognized', color: 'text-gray-500' };
  };

  // Permission checks using simplified 4 permissions
  // Faculty/Student can file IPR by default, Staff/Admin need explicit permission
  const isFacultyOrStudent = user?.role?.name ===
   'faculty' || user?.role?.name ===
   'student';
  const isAdmin = user?.role?.name ===
   'admin';
  
  // Simplified permission checks - only 4 core permissions now
  const canFile = isFacultyOrStudent || userPermissions.ipr_file_new;  // Faculty/Student default, others need checkbox
  const canReview = userPermissions.ipr_review;  // DRD Member can review
  const canApprove = userPermissions.ipr_approve;  // DRD Head can approve
  const canAssignSchools = userPermissions.ipr_assign_school;  // DRD Head assigns schools to members
  
  // View permissions derived from core permissions
  const canViewAll = canReview || canApprove || canAssignSchools;
  const canEditOwn = isFacultyOrStudent || userPermissions.ipr_file_new;
  const canEditAll = canApprove;  // DRD Head can edit all
  
  // Workflow stage permissions
  const canDrdMemberReview = canReview; // ipr_review permission
  const canDrdApproval = canApprove; // ipr_approve permission
  
  // Additional derived permissions for UI sections (simplified - based on core 4)
  const canViewAnalytics = canApprove;  // Only DRD Head
  const canGenerateReports = canApprove;  // Only DRD Head
  const canManageProjects = canApprove;  // Only DRD Head
  const canManageGrants = canApprove;  // Only DRD Head
  const canManagePublications = canApprove;  // Only DRD Head
  const canSystemAdmin = isAdmin;  // Only Admin (IT head)
  const canFinanceReview = false;  // Finance module - disabled for now
  const canSystemOverride = isAdmin;  // Only Admin
  const canDelete = canApprove || isAdmin;  // DRD Head or Admin

  // Show available permissions for debugging
  logger.debug('Permission checks (simplified):', {
    canFile, canReview, canApprove, canAssignSchools,
    canViewAll, canEditOwn, 
    allPermissions: Object.keys(userPermissions)
  });

  if (!canViewAll && !canFile) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">
            You don&apos;t have permission to view IPR applications dashboard.
          </p>
          <Link href="/drd" className="inline-flex items-center px-5 py-3 bg-ResearchSphere-gradient text-white rounded-xl font-semibold hover:shadow-ResearchSphere transition-all">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to DRD Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-ResearchSphere-gradient rounded-3xl p-8 text-white shadow-ResearchSphere-xl">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
        </div>
        
        {/* Floating elements */}
        <div className="absolute top-8 right-16 w-3 h-3 bg-ResearchSphere-50 rounded-full animate-float opacity-60"></div>
        <div className="absolute bottom-16 right-32 w-2 h-2 bg-ResearchSphere-100 rounded-full animate-float opacity-40" style={{animationDelay: '0.5s'}}></div>
        
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center border border-white/20">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold">IPR Applications Management</h1>
                <p className="text-ResearchSphere-100 text-lg mt-1">Manage and review intellectual property applications</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {canFile && (
                <Link
                  href="/ipr/apply"
                  className="flex items-center gap-2 px-5 py-3 bg-white text-ResearchSphere-700 hover:bg-ResearchSphere-50 rounded-xl transition-all duration-200 font-semibold shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  <span>File New IPR</span>
                </Link>
              )}
              <Link
                href="/drd"
                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl transition-all duration-200 border border-white/20"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="font-medium">Back to DRD</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* IPR Filing */}
        {canFile && (
          <Link
            href="/ipr/apply"
            className="group p-5 bg-gradient-to-br from-ResearchSphere-50 to-white rounded-2xl border border-ResearchSphere-100 hover:border-ResearchSphere-300 hover:shadow-ResearchSphere transition-all duration-300 card-hover"
          >
            <div className="w-12 h-12 bg-ResearchSphere-gradient rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">File New IPR</h3>
            <p className="text-sm text-gray-500">Submit new applications</p>
            <ChevronRight className="w-5 h-5 text-ResearchSphere-400 mt-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        )}

        {/* Review Applications */}
        {canReview && (
          <Link
            href="/drd/review"
            className="group p-5 bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-100 hover:border-amber-300 hover:shadow-lg transition-all duration-300 card-hover"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Review Applications</h3>
            <p className="text-sm text-gray-500">Provide feedback</p>
            <ChevronRight className="w-5 h-5 text-amber-400 mt-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        )}

        {/* All Applications */}
        {(canViewAll || canEditAll) && (
          <Link
            href="/ipr/all-applications"
            className="group p-5 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 hover:border-emerald-300 hover:shadow-lg transition-all duration-300 card-hover"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">All Applications</h3>
            <p className="text-sm text-gray-500">View all IPR records</p>
            <ChevronRight className="w-5 h-5 text-emerald-400 mt-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        )}

        {/* Analytics Dashboard */}
        {canViewAnalytics && (
          <Link
            href="/drd/analytics"
            className="group p-5 bg-gradient-to-br from-purple-50 to-white rounded-2xl border border-purple-100 hover:border-purple-300 hover:shadow-lg transition-all duration-300 card-hover"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Analytics</h3>
            <p className="text-sm text-gray-500">IPR insights & trends</p>
            <ChevronRight className="w-5 h-5 text-purple-400 mt-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        )}
      </div>

      {/* Additional Actions Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {canGenerateReports && (
          <Link
            href="/drd/reports"
            className="group p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all card-hover"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Reports</h3>
                <p className="text-xs text-gray-500">Generate exports</p>
              </div>
            </div>
          </Link>
        )}

        {canManageProjects && (
          <Link
            href="/drd/projects"
            className="group p-4 bg-white rounded-xl border border-gray-100 hover:border-teal-200 hover:shadow-md transition-all card-hover"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                <Award className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Projects</h3>
                <p className="text-xs text-gray-500">Research mgmt</p>
              </div>
            </div>
          </Link>
        )}

        {canManageGrants && (
          <Link
            href="/drd/grants"
            className="group p-4 bg-white rounded-xl border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all card-hover"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Grants</h3>
                <p className="text-xs text-gray-500">Funding ops</p>
              </div>
            </div>
          </Link>
        )}

        {canManagePublications && (
          <Link
            href="/drd/publications"
            className="group p-4 bg-white rounded-xl border border-gray-100 hover:border-pink-200 hover:shadow-md transition-all card-hover"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center group-hover:bg-pink-200 transition-colors">
                <FileText className="w-5 h-5 text-pink-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Publications</h3>
                <p className="text-xs text-gray-500">Research papers</p>
              </div>
            </div>
          </Link>
        )}

        {canSystemAdmin && (
          <Link
            href="/drd/admin"
            className="group p-4 bg-white rounded-xl border border-gray-100 hover:border-red-200 hover:shadow-md transition-all card-hover"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Admin</h3>
                <p className="text-xs text-gray-500">System config</p>
              </div>
            </div>
          </Link>
        )}

        {canAssignSchools && (
          <Link
            href="/admin/drd-school-assignment"
            className="group p-4 bg-white rounded-xl border border-gray-100 hover:border-green-200 hover:shadow-md transition-all card-hover"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <MapPin className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">School Assignment</h3>
                <p className="text-xs text-gray-500">Assign schools to DRD members</p>
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* Final Approval Card */}
      {canApprove && (
        <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50 rounded-2xl p-6 border-2 border-emerald-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <CheckCircle className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-emerald-900">Final Approval Authority</h3>
              <p className="text-emerald-700">You have authority to approve applications and credit incentives</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-xl">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-emerald-700">Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Workflow Controls */}
      {(canReview || canApprove || canSystemAdmin) && (
        <div className="bg-gradient-to-br from-gray-50 to-ResearchSphere-50/30 rounded-2xl p-6 border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-ResearchSphere-600" />
            Advanced Workflow Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {canReview && (
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm card-hover">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-3">
                  <Eye className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Batch Review</h3>
                <p className="text-sm text-gray-500 mb-4">Review multiple applications at once</p>
                <button className="w-full px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-medium transition-all">
                  Start Batch Review
                </button>
              </div>
            )}
            
            {canApprove && (
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm card-hover">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-3">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Incentive Processing</h3>
                <p className="text-sm text-gray-500 mb-4">Process payments for approved IPRs</p>
                <button className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium transition-all">
                  Process Incentives
                </button>
              </div>
            )}
            
            {canSystemAdmin && (
              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm card-hover">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-3">
                  <Settings className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">System Configuration</h3>
                <p className="text-sm text-gray-500 mb-4">Configure workflows & approval chains</p>
                <button className="w-full px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition-all">
                  Open Config
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="bg-white rounded-2xl shadow-ResearchSphere border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
              {[
                { key: 'all', label: 'All', count: applications.length, color: 'ResearchSphere' },
                { key: 'pending_drd', label: 'DRD Queue', count: applications.filter(app => ['submitted', 'resubmitted'].includes(app.status)).length, color: 'amber' },
                { key: 'changes_required', label: 'Changes', count: applications.filter(app => app.status ===
   'changes_required').length, color: 'orange' },
                { key: 'pending_head', label: 'Head Queue', count: applications.filter(app => app.status ===
   'under_dean_review').length, color: 'purple' },
                { key: 'completed', label: 'Completed', count: applications.filter(app => ['completed', 'incentives_processed'].includes(app.status)).length, color: 'emerald' },
                { key: 'rejected', label: 'Rejected', count: applications.filter(app => app.status.includes('rejected')).length, color: 'red' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all duration-200 ${
                    activeTab ===
   tab.key
                      ? 'bg-ResearchSphere-gradient text-white shadow-ResearchSphere'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                      activeTab ===
   tab.key 
                        ? 'bg-white/20 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search & Filters */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search applications..."
                  className="pl-10 pr-4 py-2.5 w-64 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ResearchSphere-400 focus:border-ResearchSphere-400 transition-all text-sm"
                />
              </div>
              
              <select className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-ResearchSphere-400 focus:border-ResearchSphere-400">
                <option>All Types</option>
                <option>Patent</option>
                <option>Copyright</option>
                <option>Design</option>
              </select>
            </div>
          </div>
        </div>

        {/* Applications List */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-ResearchSphere-100 rounded-full animate-spin border-t-ResearchSphere-600"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-ResearchSphere-gradient rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
              <p className="mt-4 text-gray-600 font-medium">Loading applications...</p>
            </div>
          </div>
        ) : applications.length ===
   0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Applications Found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              There are no IPR applications in the selected category.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {applications.map((app) => (
              <div key={app.id} className="p-6 hover:bg-gray-50/50 transition-all duration-200 group">
                <div className="flex items-start gap-6">
                  {/* Icon */}
                  <div className="w-14 h-14 bg-ResearchSphere-gradient rounded-2xl flex items-center justify-center flex-shrink-0 shadow-ResearchSphere group-hover:scale-105 transition-transform">
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap mb-2">
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-ResearchSphere-600 transition-colors">
                            {app.title}
                          </h3>
                          <span className="px-2.5 py-1 bg-ResearchSphere-100 text-ResearchSphere-700 text-xs rounded-lg font-semibold uppercase">
                            {app.iprType}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ${getStatusColor(app.status)}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-60"></span>
                            {app.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        
                        {/* Incentive Info */}
                        {app.pointsAwarded && (
                          <div className="flex items-center gap-3 mb-3">
                            <span className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium">
                              <Award className="w-4 h-4 mr-1" />
                              {app.pointsAwarded} points
                            </span>
                            {app.incentiveAmount && (
                              <span className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium">
                                <DollarSign className="w-4 h-4 mr-1" />
                                ₹{app.incentiveAmount}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <User className="w-4 h-4" />
                        <span>{getApplicantName(app)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                      </div>
                      {app.creditedAt && (
                        <span className="text-emerald-600 font-medium">
                          Credited: {new Date(app.creditedAt).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>

                    {/* Workflow Stage */}
                    <div className="mt-2">
                      <span className={`text-xs font-medium ${getWorkflowStage(app.status).color}`}>
                        🔄 {getWorkflowStage(app.status).stage}: {getWorkflowStage(app.status).description}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* View Details */}
                    <Link
                      href={`/ipr/applications/${app.id}`}
                      className="p-2.5 bg-ResearchSphere-50 text-ResearchSphere-600 rounded-xl hover:bg-ResearchSphere-100 transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>

                    {/* Edit Actions */}
                    {(canEditAll || canEditOwn) && (
                      <Link
                        href={`/ipr/applications/${app.id}/edit`}
                        className="p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                        title="Edit Application"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Link>
                    )}

                    {/* DRD Member Review Actions - Permission: drd_ipr_review */}
                    {canDrdMemberReview && ['submitted', 'resubmitted'].includes(app.status) && (
                      <>
                        <button
                          onClick={() => handleQuickAction(app, 'approve')}
                          className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                          title="Accept & Send to DRD Head"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleQuickAction(app, 'changes')}
                          className="p-2.5 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-colors"
                          title="Request Changes"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleQuickAction(app, 'reject')}
                          className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                          title="Reject Application"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* DRD Approval Actions - Permission: drd_ipr_approve */}
                    {canDrdApproval && app.status ===
   'under_dean_review' && (
                      <>
                        <button
                          onClick={() => handleQuickAction(app, 'dean_approve')}
                          className="p-2.5 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors"
                          title="DRD Head Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleQuickAction(app, 'dean_reject')}
                          className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                          title="DRD Head Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* Legacy Finance Review Actions - kept for backward compatibility with old records */}
                    {canFinanceReview && app.status ===
   'under_finance_review' && (
                      <>
                        <button
                          onClick={() => handleQuickAction(app, 'finance_approve')}
                          className="p-2.5 bg-[#fdf5ec] text-[#7d1a34] rounded-xl hover:bg-[#fbe2e8] transition-colors"
                          title="Process Incentives"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleQuickAction(app, 'finance_audit')}
                          className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors"
                          title="Request Audit Review"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* System Override */}
                    {canSystemOverride && (
                      <button
                        onClick={() => handleQuickAction(app, 'system_override')}
                        className="p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                        title="System Override"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    )}

                    {/* Delete Action */}
                    {canDelete && (
                      <button
                        onClick={async () => {
                          const confirmed = await confirm({
                            title: 'Delete Application',
                            message: 'Are you sure you want to delete this application?',
                            type: 'danger',
                            confirmText: 'Delete'
                          });
                          if (confirmed) {
                            // TODO: Implement delete
                          }
                        }}
                        className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                        title="Delete Application"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {showActionModal && selectedApp && (
        <div className="fixed inset-0 bg-ResearchSphere-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp">
            <div className="bg-ResearchSphere-gradient p-6 text-white">
              <h3 className="text-xl font-bold">
                {actionType ===
   'approve' ? 'DRD Approve & Send to Head' :
                 actionType ===
   'changes' ? 'Request Changes from Applicant' :
                 actionType ===
   'reject' ? 'Reject Application' :
                 actionType ===
   'dean_approve' ? 'DRD Head Approval' :
                 actionType ===
   'dean_reject' ? 'DRD Head Rejection' :
                 actionType ===
   'finance_approve' ? 'Process Incentives' :
                 actionType ===
   'finance_audit' ? 'Request Audit' :
                 actionType ===
   'system_override' ? 'System Override' : 'Process'}
              </h3>
            </div>
            
            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Application</p>
                <p className="font-semibold text-gray-900">{selectedApp.title}</p>
                <p className="text-sm text-gray-500 mt-1">{selectedApp.iprType.toUpperCase()}</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Comments <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ResearchSphere-400 focus:border-ResearchSphere-400 transition-all resize-none"
                  placeholder={`Enter your ${actionType} comments...`}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowActionModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAction}
                  disabled={submitting || !actionComments.trim()}
                  className={`flex-1 px-4 py-3 rounded-xl text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    actionType ===
   'approve' || actionType ===
   'dean_approve' || actionType ===
   'finance_approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    actionType ===
   'reject' || actionType ===
   'dean_reject' ? 'bg-red-600 hover:bg-red-700' :
                    actionType ===
   'changes' ? 'bg-orange-600 hover:bg-orange-700' :
                    actionType ===
   'finance_audit' ? 'bg-[#7d1a34] hover:bg-[#5e1024]' :
                    actionType ===
   'system_override' ? 'bg-gray-600 hover:bg-gray-700' :
                    'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {submitting ? 'Processing...' : 
                   actionType ===
   'approve' ? 'Approve & Send' :
                   actionType ===
   'changes' ? 'Request Changes' :
                   actionType ===
   'reject' ? 'Reject' :
                   actionType ===
   'dean_approve' ? 'Head Approve' :
                   actionType ===
   'dean_reject' ? 'Head Reject' :
                   actionType ===
   'finance_approve' ? 'Process Incentives' :
                   actionType ===
   'finance_audit' ? 'Request Audit' :
                   actionType ===
   'system_override' ? 'Apply Override' : 'Process'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
