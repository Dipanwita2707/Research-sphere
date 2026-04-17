'use client';

import React, { useState, useEffect } from 'react';
import { financeService } from '@/features/ipr-management/services/ipr.service';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Wallet,
  Receipt,
  CreditCard,
  Banknote,
  User,
  Building2,
  GraduationCap,
  ChevronRight,
  Sparkles,
  BadgeDollarSign,
  FileText,
  Award
} from 'lucide-react';

export default function FinanceDashboard() {
  const { toast } = useToast();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    auditStatus: 'approved' as 'approved' | 'rejected',
    incentiveAmount: '',
    pointsAwarded: '',
    paymentReference: '',
    creditedToAccount: '',
    comments: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchPendingReviews();
    fetchStats();
  }, []);

  const fetchPendingReviews = async () => {
    try {
      setLoading(true);
      const data = await financeService.getPendingReviews();
      setApplications(data);
    } catch (error: unknown) {
      logger.error('Error fetching pending finance reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await financeService.getStats();
      setStats(data);
    } catch (error: unknown) {
      logger.error('Error fetching stats:', error);
    }
  };

  const handleReviewClick = async (app: any) => {
    try {
      const details = await financeService.getReviewDetails(app.id);
      setSelectedApp(details);
      setShowModal(true);
      // Reset form
      setFormData({
        auditStatus: 'approved',
        incentiveAmount: '',
        pointsAwarded: '',
        paymentReference: '',
        creditedToAccount: '',
        comments: '',
      });
    } catch (error: unknown) {
      logger.error('Error fetching application details:', error);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedApp) return;

    // Validation
    if (formData.auditStatus ===
   'approved') {
      if (!formData.incentiveAmount || !formData.pointsAwarded) {
        toast({ type: 'error', message: 'Incentive amount and points are required for approval' });
        return;
      }
    } else {
      if (!formData.comments) {
        toast({ type: 'error', message: 'Comments are required for rejection' });
        return;
      }
    }

    try {
      setSubmitting(true);

      if (formData.auditStatus ===
   'approved') {
        // Process incentive
        await financeService.submitReview(selectedApp.id, {
          auditStatus: 'approved',
          incentiveAmount: parseFloat(formData.incentiveAmount),
          pointsAwarded: parseInt(formData.pointsAwarded),
          paymentReference: formData.paymentReference,
          creditedToAccount: formData.creditedToAccount,
          auditComments: formData.comments,
        });
        toast({ type: 'success', message: 'Incentive processed successfully!' });
      } else {
        // Reject
        await financeService.submitReview(selectedApp.id, {
          auditStatus: 'rejected',
          incentiveAmount: 0,
          auditComments: formData.comments,
        });
        toast({ type: 'success', message: 'Application rejected successfully!' });
      }

      setShowModal(false);
      setSelectedApp(null);
      fetchPendingReviews();
      fetchStats();
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
            <div className="w-16 h-16 border-4 border-sgt-200 rounded-full animate-spin border-t-emerald-600 mx-auto"></div>
            <Wallet className="w-6 h-6 text-emerald-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading finance reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
              <Wallet className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Finance Dashboard</h1>
              <p className="text-white/80 mt-1">Process incentives for approved IPR applications</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 mt-6">
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
              <Receipt className="w-5 h-5" />
              <span className="font-medium">{applications.length} Pending</span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
              <BadgeDollarSign className="w-5 h-5" />
              <span className="font-medium">Incentive Processing</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-6 shadow-sgt card-hover border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Pending Reviews</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">{applications.length}</p>
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Awaiting processing
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
              <p className="text-sm text-gray-500 font-medium">Processed Today</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">{stats?.processedToday || 0}</p>
              <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Completed
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
              <p className="text-sm text-gray-500 font-medium">Total Incentives</p>
              <p className="text-3xl font-bold text-sgt-700 mt-1">
                ₹{stats?.totalIncentives?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-sgt-600 mt-2 flex items-center gap-1">
                <Banknote className="w-3 h-3" />
                Disbursed
              </p>
            </div>
            <div className="w-14 h-14 bg-sgt-100 rounded-2xl flex items-center justify-center">
              <DollarSign className="w-7 h-7 text-sgt-700" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sgt card-hover border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Points</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">{stats?.totalPoints || 0}</p>
              <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
                <Award className="w-3 h-3" />
                Awarded
              </p>
            </div>
            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Applications List */}
      <div className="bg-white rounded-2xl shadow-sgt border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-900">Applications Awaiting Finance Processing</h2>
        </div>
        
        {applications.length ===
   0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h3>
            <p className="text-gray-500">No pending finance reviews at the moment.</p>
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
                        Dean Approved
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm line-clamp-2 mb-4">{app.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm">
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
                      <span className="flex items-center gap-2 text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                        <FileText className="w-4 h-4" />
                        {app.projectType?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleReviewClick(app)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 font-medium group/btn"
                  >
                    <Wallet className="w-4 h-4" />
                    Process
                    <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Finance Processing Modal */}
      {showModal && selectedApp && (
        <div className="fixed inset-0 bg-sgt-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Finance Processing</h2>
                    <p className="text-white/80 text-sm">Process incentives and awards</p>
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
                  <FileText className="w-4 h-4" />
                  Application Details
                </h3>
                <div className="bg-gray-50 p-5 rounded-2xl space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Title</p>
                      <p className="font-semibold text-gray-900">{selectedApp.title}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">IPR Type</p>
                      <span className="inline-flex px-3 py-1 bg-sgt-100 text-sgt-700 rounded-full text-sm font-medium">
                        {selectedApp.iprType.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Project Type</p>
                      <p className="text-gray-700">{selectedApp.projectType?.replace(/_/g, ' ')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Filing Type</p>
                      <p className="text-gray-700">{selectedApp.filingType?.toUpperCase() || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Applicant</p>
                    <p className="text-gray-700">{selectedApp.applicantUser?.employeeDetails?.displayName || 'External Applicant'}</p>
                  </div>
                </div>
              </div>

              {/* Finance Form */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Incentive Processing
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Audit Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.auditStatus}
                      onChange={(e) =>
                        setFormData({ ...formData, auditStatus: e.target.value as any })
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all bg-white"
                    >
                      <option value="approved">✓ Approve & Process Incentive</option>
                      <option value="rejected">✗ Reject Application</option>
                    </select>
                  </div>

                  {formData.auditStatus ===
   'approved' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Incentive Amount (₹) <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                            <input
                              type="number"
                              value={formData.incentiveAmount}
                              onChange={(e) =>
                                setFormData({ ...formData, incentiveAmount: e.target.value })
                              }
                              required
                              className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
                              placeholder="50000"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Points Awarded <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Award className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type="number"
                              value={formData.pointsAwarded}
                              onChange={(e) =>
                                setFormData({ ...formData, pointsAwarded: e.target.value })
                              }
                              required
                              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
                              placeholder="10"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Reference
                        </label>
                        <div className="relative">
                          <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input
                            type="text"
                            value={formData.paymentReference}
                            onChange={(e) =>
                              setFormData({ ...formData, paymentReference: e.target.value })
                            }
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
                            placeholder="TXN123456789"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Credited To Account
                        </label>
                        <div className="relative">
                          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input
                            type="text"
                            value={formData.creditedToAccount}
                            onChange={(e) =>
                              setFormData({ ...formData, creditedToAccount: e.target.value })
                            }
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
                            placeholder="Account number or UPI ID"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Comments {formData.auditStatus ===
   'rejected' && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      value={formData.comments}
                      onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                      rows={4}
                      required={formData.auditStatus ===
   'rejected'}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all resize-none"
                      placeholder="Additional comments..."
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
                onClick={handleSubmitReview}
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Submit
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
