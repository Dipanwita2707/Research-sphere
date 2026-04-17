'use client';

import React, { useState, useEffect } from 'react';
import { deanApprovalService } from '@/features/ipr-management/services/ipr.service';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Shield, 
  Award, 
  FileCheck, 
  AlertTriangle,
  User,
  Building2,
  GraduationCap,
  ChevronRight,
  Sparkles,
  TrendingUp
} from 'lucide-react';

export default function DeanApprovalDashboard() {
  const { toast } = useToast();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const data = await deanApprovalService.getPendingApprovals();
      setApplications(data);
    } catch (error: unknown) {
      logger.error('Error fetching pending approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = async (app: any) => {
    try {
      const details = await deanApprovalService.getApprovalDetails(app.id);
      setSelectedApp(details);
      setShowModal(true);
    } catch (error: unknown) {
      logger.error('Error fetching application details:', error);
    }
  };

  const handleSubmitDecision = async () => {
    if (!selectedApp) return;

    try {
      setSubmitting(true);
      
      if (decision ===
   'approve') {
        await deanApprovalService.approve(selectedApp.id, comments);
        toast({ type: 'success', message: 'Application approved successfully!' });
      } else {
        await deanApprovalService.reject(selectedApp.id, comments);
        toast({ type: 'success', message: 'Application rejected successfully!' });
      }

      setShowModal(false);
      setSelectedApp(null);
      setComments('');
      fetchPendingApprovals();
    } catch (error: unknown) {
      toast({ type: 'error', message: extractErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-sgt-200 rounded-full animate-spin border-t-sgt-600 mx-auto"></div>
            <Shield className="w-6 h-6 text-sgt-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading pending approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Hero Header */}
      <div className="bg-sgt-gradient rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Dean Approval Dashboard</h1>
              <p className="text-white/80 mt-1">Review and approve DRD-approved IPR applications</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 mt-6">
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
              <FileCheck className="w-5 h-5" />
              <span className="font-medium">{applications.length} Pending</span>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/30 backdrop-blur-sm px-4 py-2 rounded-xl">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Ready for Review</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sgt card-hover border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Pending Approvals</p>
              <p className="text-3xl font-bold text-sgt-700 mt-1">{applications.length}</p>
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Awaiting your review
              </p>
            </div>
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center">
              <Clock className="w-7 h-7 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sgt card-hover border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Approved Today</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">0</p>
              <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Successfully processed
              </p>
            </div>
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sgt card-hover border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Rejected Today</p>
              <p className="text-3xl font-bold text-red-600 mt-1">0</p>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Sent back for revision
              </p>
            </div>
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
              <XCircle className="w-7 h-7 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Applications List */}
      <div className="bg-white rounded-2xl shadow-sgt border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-900">Applications Awaiting Dean Approval</h2>
        </div>
        
        {applications.length ===
   0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-500">No pending approvals at the moment.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {applications.map((app: any) => (
              <div key={app.id} className="p-6 hover:bg-gray-50/50 transition-all duration-200 group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-sgt-700 transition-colors">
                        {app.title}
                      </h3>
                      <span className="px-3 py-1 bg-sgt-100 text-sgt-700 text-xs rounded-full font-semibold uppercase tracking-wide">
                        {app.iprType}
                      </span>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        DRD Approved
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm line-clamp-2 mb-4">{app.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="flex items-center gap-2 text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                        <User className="w-4 h-4" />
                        {app.applicantUser?.employeeDetails?.displayName || 'External Applicant'}
                      </span>
                      <span className="flex items-center gap-2 text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                        <GraduationCap className="w-4 h-4" />
                        {app.school?.facultyName || 'N/A'}
                      </span>
                      <span className="flex items-center gap-2 text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                        <Building2 className="w-4 h-4" />
                        {app.department?.departmentName || 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleReviewClick(app)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-sgt-gradient text-white rounded-xl hover:shadow-lg hover:shadow-sgt-500/25 transition-all duration-200 font-medium group/btn"
                  >
                    Review
                    <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {showModal && selectedApp && (
        <div className="fixed inset-0 bg-sgt-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="bg-sgt-gradient p-6 text-white sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Dean Approval</h2>
                    <p className="text-white/80 text-sm">Review application details</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Application Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileCheck className="w-4 h-4" />
                  Application Details
                </h3>
                <div className="bg-gray-50 p-5 rounded-2xl space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Title</p>
                      <p className="font-semibold text-gray-900">{selectedApp.title}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Type</p>
                      <span className="inline-flex px-3 py-1 bg-sgt-100 text-sgt-700 rounded-full text-sm font-medium">
                        {selectedApp.iprType.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p>
                    <p className="text-gray-700">{selectedApp.description}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</p>
                    <span className="inline-flex px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                      {selectedApp.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* DRD Review */}
              {selectedApp.reviews && selectedApp.reviews.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    DRD Review Summary
                  </h3>
                  <div className="bg-sgt-50 border border-sgt-200 p-5 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-sgt-200 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-sgt-700" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {selectedApp.reviews[0].reviewer?.employeeDetails?.displayName}
                          </p>
                          <p className="text-xs text-gray-500">DRD Reviewer</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                        {selectedApp.reviews[0].decision.toUpperCase()}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-sgt-200">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Comments</p>
                      <p className="text-gray-700">{selectedApp.reviews[0].comments}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Decision Form */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Your Decision
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Decision <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={decision}
                      onChange={(e) => setDecision(e.target.value as any)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sgt-400 focus:border-sgt-400 transition-all bg-white"
                    >
                      <option value="approve">✓ Approve Application</option>
                      <option value="reject">✗ Reject Application</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Comments {decision ===
   'reject' && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      rows={4}
                      required={decision ===
   'reject'}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sgt-400 focus:border-sgt-400 transition-all resize-none"
                      placeholder="Provide your decision comments..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDecision}
                disabled={submitting || (decision ===
   'reject' && !comments)}
                className={`flex-1 px-6 py-3 rounded-xl text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  decision ===
   'approve' 
                    ? 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/25' 
                    : 'bg-red-600 hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/25'
                }`}
              >
                {submitting ? 'Submitting...' : `${decision ===
   'approve' ? 'Approve' : 'Reject'} Application`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
