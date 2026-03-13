'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Search, Filter, Download, RefreshCw, Eye, X, Send, 
  CheckCircle, XCircle, Clock, AlertCircle, Calendar, User, Phone, QrCode, Car, Loader2, FileText
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { gateEntryService, type GatePass } from '@/shared/services/gateEntry.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { useToast } from '@/shared/ui-components/Toast';
import ExtendPassModal from './components/ExtendPassModal';
import { canExtendPass, canCancelPass } from '@/shared/utils/gateEntryPermissions';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { LanguageSelector } from './components/LanguageSelector';
import { DashboardShimmer } from './components/ShimmerUI';
import './styles/animations.css';

interface Pass {
  id: string;
  passId: string;
  visitorName: string;
  mobileNumber: string;
  visitorRelation?: string;
  purposeOfVisit: string;
  purposeOther?: string;
  visitDate: string;
  visitEndDate?: string;
  expectedEntryTime: string;
  expectedExitTime?: string;
  entryTime?: string;
  actualEntryTime?: string;
  actualExitTime?: string;
  status: string;
  passStatus?: string;
  qrStatus?: string;
  qrActivationTime?: string;
  checkoutQrCode?: string;
  checkoutQrExpiresAt?: string;
  extensionCount?: number;
  extensionReason?: string;
  hasVehicle: boolean;
  vehicleNumber?: string;
  vehicleType?: string;
  vehicleModel?: string;
  stayRequired?: boolean;
  checkInDate?: string;
  checkOutDate?: string;
  hostelName?: string;
  roomNumber?: string;
  verificationCode?: string;
  checkoutVerificationCode?: string;
  hostelBooking?: {
    id?: string;
    totalPrice?: number;
    roomNumber?: string;
    hostelName?: string;
    bookingStatus?: string;
    paymentStatus?: string;
    requestedCheckinTime?: string;
    checkinRequestStatus?: 'pending' | 'approved' | 'rejected' | null;
    checkinRequestRejectReason?: string;
  };
  createdAt: string;
  createdBy?: {
    employeeDetails?: {
      displayName?: string;
    };
    username?: string;
  };
  creator?: {
    username: string;
  };
  // Old fields (for backward compatibility - optional)
  email?: string;
  idProofType?: string;
  idProofNumber?: string;
  departmentToVisit?: string;
  personToMeetName?: string;
  numberOfPersons?: number;
}

const STATUS_CONFIG = {
  // New pass_status values with spec colors
  created: { label: 'Created', color: 'bg-blue-100 text-blue-800', icon: Clock },
  checked_in: { label: 'Checked In', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-orange-100 text-orange-800', icon: XCircle },
  checked_out: { label: 'Checked Out', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  // Legacy status values (for backward compatibility)
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  active: { label: 'Active', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
  denied: { label: 'Denied', color: 'bg-red-100 text-red-800', icon: XCircle },
};

function AllPassesPageContent() {
  const { user } = useAuthStore();
  const toast = useToast();
  const { t } = useLanguage(); // Get translation function
  const searchParams = useSearchParams();
  const reviewBookingId = searchParams.get('reviewBooking');

  // Helper: get translated status label
  const getStatusLabel = (status: string): string => {
    const key = `allPasses.status.${status}`;
    const translated = t(key as any);
    // Fall back to STATUS_CONFIG label if key not found
    if (translated === key) {
      return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label || status;
    }
    return translated;
  };
  
  // Safe date formatting utilities
  const safeFormatDate = (dateValue: any, defaultValue: string = 'N/A'): string => {
    if (!dateValue) return defaultValue;
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return defaultValue;
      return date.toLocaleDateString();
    } catch {
      return defaultValue;
    }
  };

  const safeFormatDateTime = (dateValue: any, defaultValue: string = 'N/A', options?: Intl.DateTimeFormatOptions): string => {
    if (!dateValue) return defaultValue;
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return defaultValue;
      return date.toLocaleString('en-US', options);
    } catch {
      return defaultValue;
    }
  };

  const [passes, setPasses] = useState<Pass[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedPass, setSelectedPass] = useState<Pass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedPassForExtend, setSelectedPassForExtend] = useState<Pass | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingPass, setCancellingPass] = useState(false);
  const [refundPreview, setRefundPreview] = useState<any>(null);
  const [loadingRefund, setLoadingRefund] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null);
  const [processingCheckin, setProcessingCheckin] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,      // Active Today
    pending: 0,     // All non-completed
    completed: 0,
    expired: 0,
  });

  // Fetch passes from backend
  useEffect(() => {
    fetchPasses();
  }, []);

  // Calculate stats from passes array (no API call needed)
  useEffect(() => {
    try {
      if (passes && passes.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        
        const calculated = {
          total: passes.length,
          active: passes.filter(p => {
            if (!p.actualEntryTime) return false;
            try {
              const passDate = new Date(p.actualEntryTime).toISOString().split('T')[0];
              return passDate === today && p.passStatus === 'checked_in';
            } catch {
              return false;
            }
          }).length,
          pending: passes.filter(p => p.passStatus === 'pending').length,
          completed: passes.filter(p => p.passStatus === 'checked_out' || p.status === 'completed').length,
          expired: passes.filter(p => p.passStatus === 'expired').length,
        };
        
        setStats(calculated);
      } else {
        setStats({ total: 0, active: 0, pending: 0, completed: 0, expired: 0 });
      }
    } catch (err) {
      console.error('Error calculating stats:', err);
      // Fallback to zero stats on error
      setStats({ total: 0, active: 0, pending: 0, completed: 0, expired: 0 });
    }
  }, [passes]);

  // Debug selectedPass data
  useEffect(() => {
    if (selectedPass) {
      console.log('[DEBUG] Selected Pass Data:', {
        passId: selectedPass.passId,
        extensionCount: selectedPass.extensionCount,
        extensionReason: selectedPass.extensionReason,
        visitEndDate: selectedPass.visitEndDate,
        checkOutDate: selectedPass.checkOutDate,
      });
    }
  }, [selectedPass]);

  // Auto-open pass detail modal when navigating from notification with reviewBooking param
  useEffect(() => {
    if (reviewBookingId && passes.length > 0 && !selectedPass) {
      const matchingPass = passes.find(
        (p) => p.hostelBooking?.id === reviewBookingId
      );
      if (matchingPass) {
        setSelectedPass(matchingPass);
      }
    }
  }, [reviewBookingId, passes]);

  // Early check-in approve handler
  const handleApproveCheckin = useCallback(async (bookingId: string) => {
    setProcessingCheckin(true);
    try {
      await gateEntryService.approveEarlyCheckin(bookingId);
      toast.success('Early check-in request approved successfully', 'Approved');
      fetchPasses();
      setSelectedPass(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve request', 'Error');
    } finally {
      setProcessingCheckin(false);
    }
  }, []);

  // Early check-in reject handler
  const handleRejectCheckin = useCallback(async () => {
    if (!rejectingBookingId) return;
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection', 'Reason Required');
      return;
    }
    setProcessingCheckin(true);
    try {
      await gateEntryService.rejectEarlyCheckin(rejectingBookingId, rejectReason.trim());
      toast.success('Early check-in request rejected', 'Rejected');
      fetchPasses();
      setSelectedPass(null);
      setShowRejectModal(false);
      setRejectReason('');
      setRejectingBookingId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject request', 'Error');
    } finally {
      setProcessingCheckin(false);
    }
  }, [rejectingBookingId, rejectReason]);

  const fetchPasses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await gateEntryService.getAllPasses();
      const fetchedPasses = response.data?.passes || [];
      console.log('[FETCH PASSES] Received passes from backend:', fetchedPasses);
      if (fetchedPasses.length > 0) {
        console.log('[FETCH PASSES] Sample pass data:', {
          passId: fetchedPasses[0].passId,
          passStatus: fetchedPasses[0].passStatus,
          status: fetchedPasses[0].status,
          stayRequired: fetchedPasses[0].stayRequired,
          hasHostelBooking: !!fetchedPasses[0].hostelBooking,
          hostelBooking: fetchedPasses[0].hostelBooking
        });
      }
      setPasses(fetchedPasses);
    } catch (err: any) {
      console.error('Error fetching passes:', err);
      // More user-friendly error messages
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError('Cannot connect to server. Please check if the backend is running.');
      } else if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view gate passes.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to load passes');
      }
      setPasses([]);
    } finally {
      setLoading(false);
    }
  };

  // Stats are now calculated from passes array, no separate API call needed

  const getQRStatusBadge = (qrStatus?: string) => {
    if (!qrStatus) return null;
    const colors = {
      inactive: 'bg-gray-100 text-gray-700',
      active: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
      expired: 'bg-orange-100 text-orange-700',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[qrStatus as keyof typeof colors] || colors.inactive}`}>
        QR: {qrStatus}
      </span>
    );
  };

  // Filter and search logic
  const filteredPasses = useMemo(() => {
    return passes.filter(pass => {
      // Search filter - only search in fields we're actually collecting (with null safety)
      const searchLower = searchTerm.toLowerCase();
      const searchMatch = 
        (pass.passId?.toLowerCase() || '').includes(searchLower) ||
        (pass.visitorName?.toLowerCase() || '').includes(searchLower) ||
        (pass.mobileNumber || '').includes(searchTerm) ||
        (pass.vehicleNumber?.toLowerCase() || '').includes(searchLower) ||
        (pass.visitorRelation?.toLowerCase() || '').includes(searchLower);

      // Status filter
      // "Pending" shows all non-completed passes (active, checked_in, pending)
      let statusMatch = false;
      if (statusFilter === 'all') {
        statusMatch = true;
      } else if (statusFilter === 'pending') {
        statusMatch = ['active', 'checked_in', 'pending'].includes(pass.status);
      } else {
        statusMatch = pass.status === statusFilter;
      }

      // Date filter
      let dateMatch = true;
      if (dateFilter !== 'all') {
        try {
          const today = new Date().toISOString().split('T')[0];
          const passDate = (pass.visitDate || '').split('T')[0]; // Extract date part from ISO string
          if (dateFilter === 'today') {
            dateMatch = passDate === today;
          } else if (dateFilter === 'upcoming') {
            dateMatch = passDate > today;
          } else if (dateFilter === 'past') {
            dateMatch = passDate < today;
          }
        } catch {
          dateMatch = true; // On error, include the pass
        }
      }

      return searchMatch && statusMatch && dateMatch;
    });
  }, [passes, searchTerm, statusFilter, dateFilter]);

  const handleResendNotification = (pass: Pass) => {
    toast.success(`${t('allPasses.resend.message')} ${pass.mobileNumber}${pass.email ? ` and ${pass.email}` : ''}`, t('allPasses.resend.title'));
  };

  const handleCancelPass = async (passId: string) => {
    const pass = passes.find(p => p.passId === passId);
    if (pass) {
      console.log('[CANCEL MODAL] Full pass object:', JSON.stringify(pass, null, 2));
      console.log('[CANCEL MODAL] Pass data:', {
        passId: pass.passId,
        passStatus: pass.passStatus,
        status: pass.status,
        stayRequired: pass.stayRequired,
        hasHostelBooking: !!pass.hostelBooking,
        hostelBookingField: pass.hostelBooking,
        hostelBookingKeys: pass.hostelBooking ? Object.keys(pass.hostelBooking) : 'null'
      });
      
      setSelectedPass(pass);
      setShowCancelModal(true);
      
      // Fetch refund preview if before check-in and has hostel booking
      // Check both passStatus (new field) and status (legacy field) for compatibility
      const isCreated = pass.passStatus === 'created' || pass.status === 'created';
      
      if (isCreated && pass.stayRequired && pass.hostelBooking) {
        console.log('[CANCEL MODAL] Pass is created status with hostel booking - calculating refund preview...');
        console.log('[CANCEL MODAL] Hostel booking data:', pass.hostelBooking);
        setLoadingRefund(true);
        
        try {
          // Calculate time remaining until check-in
          const now = new Date();
          const checkInDate = new Date(pass.checkInDate || pass.visitDate);
          
          // Parse check-in time from expectedEntryTime or assume 12:00 PM
          const entryTime = pass.expectedEntryTime || pass.entryTime || '12:00';
          const [hours, minutes] = entryTime.split(':').map(Number);
          checkInDate.setHours(hours, minutes, 0, 0);
          
          const timeUntilCheckIn = checkInDate.getTime() - now.getTime();
          const hoursUntilCheckIn = timeUntilCheckIn / (1000 * 60 * 60);
          const daysUntilCheckIn = hoursUntilCheckIn / 24;
          
          console.log('[REFUND CALC] Check-in date:', checkInDate);
          console.log('[REFUND CALC] Hours until check-in:', hoursUntilCheckIn);
          console.log('[REFUND CALC] Days until check-in:', daysUntilCheckIn);
          
          // Dynamic refund calculation based on time before check-in
          let refundPercent = 0;
          let appliedSlab = '';
          
          if (daysUntilCheckIn >= 3) {
            refundPercent = 90;
            appliedSlab = '3+ days before check-in';
          } else if (daysUntilCheckIn >= 1) {
            refundPercent = 70;
            appliedSlab = '1–3 days before check-in';
          } else if (hoursUntilCheckIn >= 2) {
            refundPercent = 40;
            appliedSlab = '2–24 hours before check-in';
          } else {
            refundPercent = 0;
            appliedSlab = 'Less than 2 hours before check-in';
          }
          
          console.log('[REFUND CALC] Applied slab:', appliedSlab, '(' + refundPercent + '% refund)');
          
          // Calculate refund amounts - convert to number to ensure .toFixed() works
          const originalAmount = pass.hostelBooking.totalPrice || 0;
          const cancellationFeePercent = 100 - refundPercent;
          const cancellationFeeAmount = (originalAmount * cancellationFeePercent) / 100;
          const refundAmount = originalAmount - cancellationFeeAmount;
          
          console.log('[REFUND CALC] Original amount:', originalAmount);
          console.log('[REFUND CALC] Cancellation fee:', cancellationFeeAmount);
          console.log('[REFUND CALC] Refund amount:', refundAmount);
          
          // Format time remaining
          const days = Math.floor(daysUntilCheckIn);
          const remainingHours = Math.floor(hoursUntilCheckIn % 24);
          let timeRemainingStr = '';
          if (days > 0) {
            timeRemainingStr = `${days} day${days > 1 ? 's' : ''} ${remainingHours} hr${remainingHours !== 1 ? 's' : ''}`;
          } else if (hoursUntilCheckIn > 0) {
            timeRemainingStr = `${Math.floor(hoursUntilCheckIn)} hr${Math.floor(hoursUntilCheckIn) !== 1 ? 's' : ''}`;
          } else {
            timeRemainingStr = 'Less than 1 hour';
          }
          
          const preview = {
            originalAmount,
            cancellationFeePercent,
            cancellationFeeAmount,
            refundAmount,
            refundPercent,
            appliedSlab,
            timeRemaining: timeRemainingStr,
            checkInDate: checkInDate.toLocaleString('en-IN', { 
              day: '2-digit', 
              month: 'short', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            roomNumber: pass.hostelBooking.roomNumber,
            hostelName: pass.hostelBooking.hostelName
          };
          
          console.log('[CANCEL MODAL] Calculated refund preview:', preview);
          setRefundPreview(preview);
        } catch (err) {
          console.error('[CANCEL MODAL] Error calculating refund preview:', err);
          setRefundPreview(null);
        } finally {
          setLoadingRefund(false);
        }
      } else {
        console.log('[CANCEL MODAL] Not showing refund preview. Reasons:', {
          isCreated,
          stayRequired: pass.stayRequired,
          hasHostelBooking: !!pass.hostelBooking
        });
        setRefundPreview(null);
      }
    }
  };

  const handleCancelPassConfirm = async () => {
    if (!selectedPass) {
      return;
    }
    
    // Check if reason is required (only for before check-in)
    const isBeforeCheckIn = selectedPass.passStatus === 'created' || selectedPass.status === 'created';
    if (isBeforeCheckIn && !cancelReason.trim()) {
      toast.error(t('allPasses.cancel.noReason'), t('allPasses.cancel.reasonRequired'));
      return;
    }
    
    setCancellingPass(true);
    try {
      // For after check-in, use a generic reason if not provided
      const reason = cancelReason.trim() || 'Cancelled after check-in by admin';
      const response = await gateEntryService.cancelPass(selectedPass.passId, reason) as any;
      const cancelledPass = response.pass || response.data;
      const cancellationType = cancelledPass.cancellation_type || cancelledPass.cancellationType;
      const backendMessage = response.message || '';
      
      console.log('[CANCEL RESPONSE]', {
        cancellationType,
        backendMessage,
        response
      });
      
      // Close modal first
      setShowCancelModal(false);
      setCancelReason('');
      setSelectedPass(null);
      setRefundPreview(null);
      
      // Handle different cancellation types
      if (cancellationType === 'before_check_in') {
        // Before check-in cancellation - show simple toast
        const hostelRefund = cancelledPass.hostel_refund || cancelledPass.hostelRefund;
        
        if (hostelRefund) {
          // Show success with refund details
          toast.success(
            `Pass cancelled successfully. Refund of ₹${hostelRefund.refund_amount || hostelRefund.refundAmount} will be processed.`,
            t('allPasses.cancel.successTitle')
          );
        } else {
          // No refund (no hostel booking) - use backend message
          toast.success(
            backendMessage || t('allPasses.cancel.successBeforeCheckIn'),
            t('allPasses.cancel.successTitle')
          );
        }
      } else if (cancellationType === 'after_check_in') {
        // After check-in cancellation - show checkout QR modal
        const checkoutQR = cancelledPass.checkout_qr || cancelledPass.checkoutQr;
        toast.showSuccessModal({
          title: t('allPasses.cancel.successTitle'),
          message: backendMessage || t('allPasses.cancel.successMessage'),
          passId: cancelledPass.passId || cancelledPass.pass_id,
          verificationCode: checkoutQR?.checkout_verification_code || cancelledPass.checkoutVerificationCode,
          mobile: cancelledPass.mobileNumber || cancelledPass.mobile_number,
          email: cancelledPass.email || undefined,
        });
      } else {
        // Fallback for unknown cancellation type
        toast.success(
          backendMessage || 'Pass cancelled successfully.',
          t('allPasses.cancel.successTitle')
        );
      }
      
      await fetchPasses();
    } catch (err: any) {
      console.error('Error cancelling pass:', err);
      toast.error(err.response?.data?.message || t('allPasses.cancel.failedMsg'), t('common.error'));
    } finally {
      setCancellingPass(false);
    }
  };

  const handleExport = () => {
    // Prepare CSV data from filtered passes - only simplified fields
    const headers = ['Pass ID', 'Visitor Name', 'Mobile', 'Relation', 'Persons', 'Purpose', 'Visit Date', 'Entry Time', 'Exit Time', 'Status', 'Vehicle', 'Stay Required', 'Hostel'];
    const csvRows = [
      headers.join(','),
      ...filteredPasses.map(pass => [
        pass.passId,
        `"${pass.visitorName}"`,
        pass.mobileNumber,
        pass.visitorRelation || '',
        pass.numberOfPersons || 1,
        `"${pass.purposeOfVisit}"`,
        pass.visitDate.split('T')[0],
        pass.expectedEntryTime,
        pass.expectedExitTime,
        pass.status,
        pass.vehicleNumber || '',
        pass.stayRequired ? 'Yes' : 'No',
        pass.hostelName || ''
      ].join(','))
    ];

    // Create blob and download
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `gate-passes-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Loading State
  if (loading) {
    return <DashboardShimmer />;
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 animate-shake">
          <div className="text-center">
            <div className="bg-gradient-to-br from-red-500 to-pink-500 p-4 rounded-2xl inline-block mb-4">
              <AlertCircle className="w-16 h-16 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('allPasses.errorTitle')}</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchPasses();
              }}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-5 h-5" />
              {t('allPasses.tryAgain')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero Header with Gradient Background - Master Dashboard Style */}
        <div className="relative bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl shadow-[0_8px_30px_rgba(37,99,235,0.25)] p-6 md:p-8 mb-6 overflow-visible animate-fade-in">
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-10 overflow-hidden rounded-2xl">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse-glow"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-300 rounded-full blur-3xl animate-pulse-glow" style={{animationDelay: '1s'}}></div>
          </div>
          
          {/* Content */}
          <div className="relative z-10">
            <div className="flex flex-col gap-4">
              {/* Top Row: Title and Language Selector */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                    <FileText className="w-7 h-7 md:w-8 md:h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl md:text-4xl font-bold text-white">{t('allPasses.title')}</h1>
                    <p className="text-indigo-100 text-sm md:text-base mt-1">
                      {(() => {
                        const role = (user?.role?.name || '').toLowerCase();
                        const isAdmin = role === 'admin' || role === 'superadmin';
                        const isGuard = role === 'staff';
                        
                        if (isAdmin) {
                          return `👨‍💼 ${t('allPasses.adminView')}`;
                        } else if (isGuard) {
                          return `🛡️ ${t('allPasses.guardView')}`;
                        } else {
                          return `📝 ${t('allPasses.myPasses')}`;
                        }
                      })()}
                    </p>
                  </div>
                </div>
                {/* Language Selector */}
                <div className="flex-shrink-0">
                  <LanguageSelector />
                </div>
              </div>
              
              {/* Bottom Row: Action Buttons */}
              <div className="flex items-center gap-2 md:gap-3 justify-end">
                <button
                  onClick={() => {
                    fetchPasses();
                  }}
                  className="px-3 md:px-4 py-2.5 bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-xl hover:bg-white/30 transition-all flex items-center gap-2 text-sm md:text-base font-medium hover-lift"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('allPasses.refresh')}</span>
                </button>
                <Link
                  href="/admin/gate-entry/create-pass"
                  className="px-3 md:px-4 py-2.5 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-all flex items-center gap-2 text-sm md:text-base font-bold shadow-lg hover:shadow-xl hover-lift"
                >
                  ➕ <span className="hidden sm:inline">{t('allPasses.createNew')}</span><span className="sm:hidden">New</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards - Master Dashboard Style with Gradient Icons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 md:p-5 hover-lift animate-slide-up stagger-item-1">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-gray-500 to-gray-600 p-3 rounded-xl shadow-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs md:text-sm text-gray-600">{t('allPasses.totalPasses')}</div>
                <div className="text-xl md:text-2xl font-bold text-gray-900">{stats.total}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 md:p-5 hover-lift animate-slide-up stagger-item-2">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-xl shadow-lg">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs md:text-sm text-gray-600">{t('allPasses.activeToday')}</div>
                <div className="text-xl md:text-2xl font-bold text-blue-600">{stats.active}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 md:p-5 hover-lift animate-slide-up stagger-item-3">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-3 rounded-xl shadow-lg">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs md:text-sm text-gray-600">{t('allPasses.pending')}</div>
                <div className="text-xl md:text-2xl font-bold text-yellow-600">{stats.pending}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 md:p-5 hover-lift animate-slide-up stagger-item-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-3 rounded-xl shadow-lg">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs md:text-sm text-gray-600">{t('allPasses.completed')}</div>
                <div className="text-xl md:text-2xl font-bold text-green-600">{stats.completed}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 md:p-5 hover-lift animate-slide-up stagger-item-5">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-red-500 to-pink-500 p-3 rounded-xl shadow-lg">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs md:text-sm text-gray-600">{t('allPasses.expired')}</div>
                <div className="text-xl md:text-2xl font-bold text-red-600">{stats.expired}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Card - Master Dashboard Style with Gradient Header */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 md:p-6 mb-6 animate-slide-up">
          {/* Filter Section Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-500 p-2.5 rounded-xl shadow-lg">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900">{t('allPasses.filterSearch')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-2">{t('allPasses.searchPasses')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={t('common.passIdNameMobile')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all hover:border-cyan-400"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">{t('allPasses.status')}</label>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all hover:border-cyan-400 bg-white"
                >
                  <option value="all">{t('common.allStatus')}</option>
                  <option value="pending">{t('allPasses.filter.pending')}</option>
                  <option value="active">{t('allPasses.filter.active')}</option>
                  <option value="checked_in">{t('allPasses.filter.checkedIn')}</option>
                  <option value="completed">{t('allPasses.filter.completed')}</option>
                  <option value="denied">{t('allPasses.filter.denied')}</option>
                  <option value="expired">{t('allPasses.filter.expired')}</option>
                  <option value="cancelled">{t('allPasses.filter.cancelled')}</option>
                </select>
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">{t('allPasses.dateRange')}</label>
              <div className="relative">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all hover:border-cyan-400 bg-white"
                >
                  <option value="all">{t('common.allDates')}</option>
                  <option value="today">{t('allPasses.filter.today')}</option>
                  <option value="upcoming">{t('allPasses.filter.upcoming')}</option>
                  <option value="past">{t('allPasses.filter.past')}</option>
                </select>
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-5 pt-5 border-t border-gray-200 gap-3">
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <div className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs">
                {filteredPasses.length}
              </div>
              <span>{t('common.of')} {passes.length} {t('common.passes')}</span>
            </div>
            <button
              onClick={handleExport}
              className="px-4 py-2.5 text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {t('allPasses.exportCSV')}
            </button>
          </div>
        </div>

        {/* Passes Table - Master Dashboard Style Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-slide-up">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    {t('allPasses.col.passId')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    {t('allPasses.col.visitorDetails')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    {t('allPasses.col.visitInfo')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    {t('allPasses.col.dateTime')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Verification Codes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    {t('allPasses.col.status')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    {t('allPasses.col.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPasses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="w-12 h-12 text-gray-300" />
                        <p>{t('allPasses.noPassesFound')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPasses.map((pass, index) => {
                    const statusConfig = STATUS_CONFIG[(pass.passStatus || pass.status) as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                    const StatusIcon = statusConfig.icon;
                    return (
                      <tr key={pass.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 transition-all duration-300 animate-fade-in" style={{animationDelay: `${index * 50}ms`}}>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <QrCode className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{pass.passId}</div>
                              <div className="text-xs text-gray-500">{t('allPasses.by')} {pass.creator?.username || t('allPasses.system')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-2">
                            <User className="w-4 h-4 text-gray-400 mt-1" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{pass.visitorName}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {pass.mobileNumber}
                              </div>
                              {pass.visitorRelation && (
                                <div className="text-xs text-blue-600 mt-1">
                                  {pass.visitorRelation}
                                </div>
                              )}
                              {pass.numberOfPersons && pass.numberOfPersons > 1 && (
                                <div className="text-xs text-green-600 mt-1 font-semibold">
                                  👥 {pass.numberOfPersons} {t('allPasses.persons')}
                                </div>
                              )}
                              {pass.hasVehicle && (
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                  <Car className="w-3 h-3" />
                                  {pass.vehicleNumber}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{pass.purposeOfVisit === 'other' && pass.purposeOther ? pass.purposeOther : pass.purposeOfVisit}</div>
                            {pass.stayRequired && (
                              <div className="text-xs text-purple-600 mt-1">
                                🏠 {t('allPasses.multiDayStay')} {pass.hostelName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-start gap-1 text-sm">
                            <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <div className="text-gray-900">{pass.visitDate}</div>
                              <div className="text-xs text-gray-500">
                                {pass.expectedEntryTime} - {pass.expectedExitTime}
                              </div>
                              {pass.actualEntryTime && (
                                <div className="text-xs text-green-600 mt-1">
                                  {t('allPasses.in')} {pass.actualEntryTime}
                                </div>
                              )}
                              {pass.actualExitTime && (
                                <div className="text-xs text-gray-600">
                                  {t('allPasses.out')} {pass.actualExitTime}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm space-y-1">
                            {pass.verificationCode && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">Entry:</span>
                                <span className="font-mono font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                  {pass.verificationCode}
                                </span>
                              </div>
                            )}
                            {pass.checkoutVerificationCode && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">Checkout:</span>
                                <span className="font-mono font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                                  {pass.checkoutVerificationCode}
                                </span>
                              </div>
                            )}
                            {!pass.verificationCode && !pass.checkoutVerificationCode && (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {getStatusLabel(pass.passStatus || pass.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedPass(pass)}
                              className="text-blue-600 hover:text-blue-800"
                              title={t('allPasses.action.viewDetails')}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            
                            {/* Cancel button - Context-dependent (after check-in) */}
                            {(pass.status === 'checked_in' || pass.passStatus === 'checked_in') && 
                             (pass.passStatus !== 'expired' && pass.status !== 'expired') &&
                             canCancelPass(user as any, pass as any) && (
                              <button
                                onClick={() => {
                                  setSelectedPass(pass);
                                  setShowCancelModal(true);
                                }}
                                className="text-red-600 hover:text-red-800"
                                title={t('allPasses.action.cancelPass')}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                            
                            {/* Cancel button - Before check-in (only Creator/Admin) */}
                            {(pass.status === 'active' || pass.status === 'pending' || pass.status === 'created' || pass.passStatus === 'created') && 
                             (pass.passStatus !== 'expired' && pass.status !== 'expired') && (
                              <>
                                <button
                                  onClick={() => handleResendNotification(pass)}
                                  className="text-green-600 hover:text-green-800"
                                  title={t('allPasses.action.resendNotif')}
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                                {canCancelPass(user as any, pass as any) && (
                                  <button
                                    onClick={() => handleCancelPass(pass.passId)}
                                    className="text-red-600 hover:text-red-800"
                                    title={t('allPasses.action.cancelPass')}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pass Detail Modal */}
        {selectedPass && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">{t('allPasses.detail.title')}</h3>
                <button
                  onClick={() => setSelectedPass(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Pass ID & QR */}
                <div className="text-center border-b border-gray-200 pb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-3">
                    <QrCode className="w-8 h-8 text-blue-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900">{selectedPass.passId}</h4>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${STATUS_CONFIG[(selectedPass.passStatus || selectedPass.status) as keyof typeof STATUS_CONFIG]?.color || 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_CONFIG[(selectedPass.passStatus || selectedPass.status) as keyof typeof STATUS_CONFIG]?.label || selectedPass.passStatus || selectedPass.status}
                    </span>
                    {getQRStatusBadge(selectedPass.qrStatus)}
                  </div>
                  
                  {/* Verification Codes Display */}
                  {(selectedPass.verificationCode || selectedPass.checkoutVerificationCode) && (
                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                      {selectedPass.verificationCode && (
                        <div className="flex flex-col items-center gap-1 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                          <span className="text-xs text-green-700 font-medium">Entry Code</span>
                          <span className="font-mono text-2xl font-bold text-green-600 tracking-wider">
                            {selectedPass.verificationCode}
                          </span>
                        </div>
                      )}
                      {selectedPass.checkoutVerificationCode && (
                        <div className="flex flex-col items-center gap-1 bg-orange-50 px-4 py-2 rounded-lg border border-orange-200">
                          <span className="text-xs text-orange-700 font-medium">Checkout Code</span>
                          <span className="font-mono text-2xl font-bold text-orange-600 tracking-wider">
                            {selectedPass.checkoutVerificationCode}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="font-semibold text-gray-900 mb-3">{t('allPasses.detail.visitorInfo')}</h5>
                    <dl className="space-y-2 text-sm">
                      {selectedPass.visitorName && (
                        <div><dt className="text-gray-600">{t('allPasses.detail.name')}</dt><dd className="font-medium">{selectedPass.visitorName}</dd></div>
                      )}
                      {selectedPass.mobileNumber && (
                        <div><dt className="text-gray-600">{t('allPasses.detail.mobile')}</dt><dd className="font-medium">{selectedPass.mobileNumber}</dd></div>
                      )}
                      {selectedPass.email && (
                        <div><dt className="text-gray-600">{t('allPasses.detail.email')}</dt><dd className="font-medium">{selectedPass.email}</dd></div>
                      )}
                      {selectedPass.visitorRelation && (
                        <div><dt className="text-gray-600">{t('allPasses.detail.relation')}</dt><dd className="font-medium">{selectedPass.visitorRelation}</dd></div>
                      )}
                      {selectedPass.numberOfPersons && selectedPass.numberOfPersons > 0 && (
                        <div><dt className="text-gray-600">{t('allPasses.detail.persons')}</dt><dd className="font-medium text-green-600">👥 {selectedPass.numberOfPersons}</dd></div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h5 className="font-semibold text-gray-900 mb-3">{t('allPasses.detail.visitInfo')}</h5>
                    <dl className="space-y-2 text-sm">
                      {selectedPass.purposeOfVisit && (
                        <div><dt className="text-gray-600">{t('allPasses.detail.purpose')}</dt><dd className="font-medium">{selectedPass.purposeOfVisit === 'other' && selectedPass.purposeOther ? selectedPass.purposeOther : selectedPass.purposeOfVisit}</dd></div>
                      )}
                      {selectedPass.visitDate && (
                        <div><dt className="text-gray-600">{t('allPasses.detail.visitDate')}</dt><dd className="font-medium">{selectedPass.visitDate}</dd></div>
                      )}
                      {selectedPass.visitEndDate && (
                        <div><dt className="text-gray-600">{t('allPasses.detail.endDate')}</dt><dd className="font-medium text-blue-600">{selectedPass.visitEndDate}</dd></div>
                      )}
                      {(selectedPass.entryTime || selectedPass.expectedEntryTime) && (
                        <div><dt className="text-gray-600">{t('allPasses.detail.entryTime')}</dt><dd className="font-medium">{selectedPass.entryTime || selectedPass.expectedEntryTime}</dd></div>
                      )}
                      {selectedPass.qrActivationTime && (
                        <div><dt className="text-gray-600">{t('allPasses.detail.qrActivates')}</dt><dd className="font-medium text-blue-600">{safeFormatDateTime(selectedPass.qrActivationTime)}</dd></div>
                      )}
                    </dl>
                  </div>

                  {selectedPass.hasVehicle && (
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-3">{t('allPasses.detail.vehicleInfo')}</h5>
                      <dl className="space-y-2 text-sm">
                        <div><dt className="text-gray-600">{t('allPasses.detail.vehicleNumber')}</dt><dd className="font-medium">{selectedPass.vehicleNumber || 'N/A'}</dd></div>
                        {selectedPass.vehicleType && (
                          <div><dt className="text-gray-600">{t('allPasses.detail.vehicleType')}</dt><dd className="font-medium">{selectedPass.vehicleType}</dd></div>
                        )}
                        {selectedPass.vehicleModel && (
                          <div><dt className="text-gray-600">{t('allPasses.detail.vehicleModel')}</dt><dd className="font-medium">{selectedPass.vehicleModel}</dd></div>
                        )}
                      </dl>
                    </div>
                  )}

                  {selectedPass.stayRequired && (
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-3">{t('allPasses.detail.stayInfo')}</h5>
                      <dl className="space-y-2 text-sm">
                        <div><dt className="text-gray-600">{t('allPasses.detail.checkInDate')}</dt><dd className="font-medium">{safeFormatDate(selectedPass.checkInDate || selectedPass.visitDate)}</dd></div>
                        <div><dt className="text-gray-600">{t('allPasses.detail.checkOutDate')}</dt><dd className="font-medium">{safeFormatDate(selectedPass.checkOutDate)}</dd></div>
                        {selectedPass.hostelName && (
                          <div><dt className="text-gray-600">{t('allPasses.detail.hostel')}</dt><dd className="font-medium">{selectedPass.hostelName}</dd></div>
                        )}
                        {selectedPass.roomNumber && (
                          <div><dt className="text-gray-600">{t('allPasses.detail.roomNumber')}</dt><dd className="font-medium">{selectedPass.roomNumber}</dd></div>
                        )}
                      </dl>
                    </div>
                  )}

                  {/* Early Check-in Request Section */}
                  {selectedPass.hostelBooking?.checkinRequestStatus && (
                    <div className="md:col-span-2">
                      <div className={`border-2 rounded-lg p-5 ${
                        selectedPass.hostelBooking.checkinRequestStatus === 'pending'
                          ? 'border-amber-300 bg-amber-50'
                          : selectedPass.hostelBooking.checkinRequestStatus === 'approved'
                            ? 'border-green-300 bg-green-50'
                            : 'border-red-300 bg-red-50'
                      }`}>
                        <div className="flex items-center justify-between mb-4">
                          <h5 className={`font-semibold text-lg flex items-center gap-2 ${
                            selectedPass.hostelBooking.checkinRequestStatus === 'pending'
                              ? 'text-amber-800'
                              : selectedPass.hostelBooking.checkinRequestStatus === 'approved'
                                ? 'text-green-800'
                                : 'text-red-800'
                          }`}>
                            <Clock className="w-5 h-5" />
                            Early Check-in Request
                          </h5>
                          <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide ${
                            selectedPass.hostelBooking.checkinRequestStatus === 'pending'
                              ? 'bg-amber-200 text-amber-800'
                              : selectedPass.hostelBooking.checkinRequestStatus === 'approved'
                                ? 'bg-green-200 text-green-800'
                                : 'bg-red-200 text-red-800'
                          }`}>
                            {selectedPass.hostelBooking.checkinRequestStatus}
                          </span>
                        </div>

                        {/* Request details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                          <div className="bg-white/60 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Visitor Name</p>
                            <p className="font-semibold text-gray-900">{selectedPass.visitorName}</p>
                          </div>
                          <div className="bg-white/60 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Requested Check-in Time</p>
                            <p className="font-semibold text-gray-900">
                              {selectedPass.hostelBooking.requestedCheckinTime
                                ? new Date(selectedPass.hostelBooking.requestedCheckinTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                                : '—'}
                            </p>
                          </div>
                          <div className="bg-white/60 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Guest House</p>
                            <p className="font-semibold text-gray-900">{selectedPass.hostelBooking.hostelName || selectedPass.hostelName || '—'}</p>
                          </div>
                          <div className="bg-white/60 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Room Number</p>
                            <p className="font-semibold text-gray-900">{selectedPass.hostelBooking.roomNumber || selectedPass.roomNumber || '—'}</p>
                          </div>
                          <div className="bg-white/60 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Pass ID</p>
                            <p className="font-semibold text-gray-900">{selectedPass.passId}</p>
                          </div>
                          <div className="bg-white/60 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Mobile Number</p>
                            <p className="font-semibold text-gray-900">{selectedPass.mobileNumber || '—'}</p>
                          </div>
                        </div>

                        {selectedPass.hostelBooking.checkinRequestStatus === 'rejected' && selectedPass.hostelBooking.checkinRequestRejectReason && (
                          <div className="bg-red-100 border border-red-200 rounded-lg p-3 mb-4">
                            <p className="text-sm font-medium text-red-800">
                              Rejection Reason: <span className="font-normal">{selectedPass.hostelBooking.checkinRequestRejectReason}</span>
                            </p>
                          </div>
                        )}

                        {/* Admin approve/reject buttons for pending requests - only visible to admin/superadmin */}
                        {selectedPass.hostelBooking.checkinRequestStatus === 'pending' && selectedPass.hostelBooking.id && ['admin', 'superadmin'].includes((user?.role?.name || '').toLowerCase()) && (
                          <div className="flex gap-3 mt-2 pt-4 border-t border-gray-200">
                            <button
                              onClick={() => handleApproveCheckin(selectedPass.hostelBooking!.id!)}
                              disabled={processingCheckin}
                              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                              {processingCheckin ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-5 h-5" />
                              )}
                              Accept Request
                            </button>
                            <button
                              onClick={() => {
                                setRejectingBookingId(selectedPass.hostelBooking!.id!);
                                setRejectReason('');
                                setShowRejectModal(true);
                              }}
                              disabled={processingCheckin}
                              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                              <XCircle className="w-5 h-5" />
                              Reject Request
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedPass.checkoutQrCode && (
                    <div className="md:col-span-2">
                      <div className="border-2 border-orange-300 rounded-lg p-4 bg-orange-50">
                        <h5 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5" />
                          Checkout QR Code (1 Hour Validity)
                        </h5>
                        <div className="flex flex-col md:flex-row items-center gap-4">
                          <img 
                            src={selectedPass.checkoutQrCode} 
                            alt="Checkout QR" 
                            className="w-48 h-48 border-2 border-orange-400 rounded" 
                          />
                          <div className="text-sm space-y-2">
                            <p className="text-gray-700">
                              <strong>Expires:</strong> {safeFormatDateTime(selectedPass.checkoutQrExpiresAt)}
                            </p>
                            <p className="text-orange-600 font-medium">
                              ⏰ Valid for 1 hour only. Visitor must exit within this time.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedPass.extensionCount && selectedPass.extensionCount > 0 && (
                    <div className="md:col-span-2">
                      <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
                        <h5 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                          <Calendar className="w-5 h-5" />
                          Pass Extension Information
                        </h5>
                        <dl className="space-y-2 text-sm">
                          <div><dt className="text-gray-600">Extended:</dt><dd className="font-medium text-blue-600">{selectedPass.extensionCount} time(s)</dd></div>
                          <div>
                            <dt className="text-gray-600">Reason:</dt>
                            <dd className="font-medium">{selectedPass.extensionReason || 'Not provided'}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  )}

                  <div>
                    <h5 className="font-semibold text-gray-900 mb-3">{t('allPasses.detail.entryExitRecords')}</h5>
                    <dl className="space-y-2 text-sm">
                      <div><dt className="text-gray-600">{t('allPasses.detail.createdAt')}</dt><dd className="font-medium">{safeFormatDateTime(selectedPass.createdAt)}</dd></div>
                      <div><dt className="text-gray-600">{t('allPasses.detail.createdBy')}</dt><dd className="font-medium">{selectedPass.creator?.username || t('allPasses.detail.unknown')}</dd></div>
                      {selectedPass.actualEntryTime && (
                        <div className="text-green-600">
                          <dt>{t('allPasses.detail.entryTime')}</dt>
                          <dd className="font-medium">
                            {safeFormatDateTime(selectedPass.actualEntryTime, 'N/A', { 
                              dateStyle: 'short', 
                              timeStyle: 'short',
                              hour12: true 
                            })}
                          </dd>
                        </div>
                      )}
                      {selectedPass.actualExitTime && (
                        <div className="text-gray-600">
                          <dt>{t('allPasses.detail.exitTime')}</dt>
                          <dd className="font-medium">
                            {safeFormatDateTime(selectedPass.actualExitTime, 'N/A', { 
                              dateStyle: 'short', 
                              timeStyle: 'short',
                              hour12: true 
                            })}
                          </dd>
                        </div>
                      )}
                      {selectedPass.actualEntryTime && selectedPass.actualExitTime && (
                        <div className="text-blue-600">
                          <dt>{t('allPasses.detail.totalDuration')}</dt>
                          <dd className="font-medium">
                            {(() => {
                              const entry = new Date(selectedPass.actualEntryTime);
                              const exit = new Date(selectedPass.actualExitTime);
                              const diffMs = exit.getTime() - entry.getTime();
                              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                              const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                              return `${diffHours}h ${diffMinutes}m`;
                            })()}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 px-6 py-4 flex flex-wrap gap-3">
                {/* Extend Pass - Only show if user has permission (Creator or Admin) and pass is not expired */}
                {(selectedPass.passStatus === 'created' || selectedPass.passStatus === 'checked_in' || selectedPass.status === 'active' || selectedPass.status === 'checked_in') && 
                 selectedPass.passStatus !== 'expired' && selectedPass.status !== 'expired' &&
                 canExtendPass(user as any, selectedPass as any) && (
                  <button
                    onClick={() => {
                      setSelectedPassForExtend(selectedPass);
                      setShowExtendModal(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    {t('allPasses.detail.extendPass')}
                  </button>
                )}
                <button
                  onClick={() => handleResendNotification(selectedPass)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {t('allPasses.detail.resendNotif')}
                </button>
                <button
                  onClick={() => setSelectedPass(null)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('allPasses.detail.close')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Extend Pass Modal */}
        {showExtendModal && selectedPassForExtend && (
          <ExtendPassModal
            passId={selectedPassForExtend.passId}
            currentEntryTime={selectedPassForExtend.entryTime || selectedPassForExtend.expectedEntryTime}
            currentVisitDate={selectedPassForExtend.visitDate}
            currentEndDate={
              selectedPassForExtend.stayRequired 
                ? (selectedPassForExtend.checkOutDate || selectedPassForExtend.visitEndDate || selectedPassForExtend.visitDate)
                : (selectedPassForExtend.visitEndDate || selectedPassForExtend.visitDate)
            }
            hasHostelBooking={!!selectedPassForExtend.hostelBooking?.id}
            onClose={() => {
              setShowExtendModal(false);
              setSelectedPassForExtend(null);
            }}
            onSuccess={async (updatedPass?: Pass) => {
              await fetchPasses();
              setShowExtendModal(false);
              setSelectedPassForExtend(null);
              // Update the pass details view with the updated pass from API response
              if (selectedPass && updatedPass && selectedPass.passId === updatedPass.passId) {
                console.log('[EXTEND SUCCESS] Updating selectedPass with:', updatedPass);
                setSelectedPass(updatedPass);
              }
            }}
          />
        )}

        {/* Reject Early Check-in Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-red-800 flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Reject Early Check-in
                </h3>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                    setRejectingBookingId(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">
                  Please provide a reason for rejecting this early check-in request. The student and their parent will be notified.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g., Room is not ready before standard check-in time..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    rows={3}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectReason('');
                      setRejectingBookingId(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
                    disabled={processingCheckin}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRejectCheckin}
                    disabled={!rejectReason.trim() || processingCheckin}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingCheckin ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Pass Confirmation Modal */}
        {showCancelModal && selectedPass && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col">
              {/* Fixed Header - Different styles for before/after check-in */}
              {selectedPass.passStatus === 'created' || selectedPass.status === 'created' ? (
                <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-200 bg-white rounded-t-xl flex-shrink-0">
                  <h3 className="text-xl font-semibold text-gray-900">{t('allPasses.cancel.title')}</h3>
                  <button
                    onClick={() => {
                      setShowCancelModal(false);
                      setCancelReason('');
                      setRefundPreview(null);
                      setSelectedPass(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    disabled={cancellingPass}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-yellow-600 to-orange-600 px-6 py-4 rounded-t-xl flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      🔔 Cancel Pass & Record Checkout
                    </h2>
                    <button
                      onClick={() => {
                        setShowCancelModal(false);
                        setCancelReason('');
                        setRefundPreview(null);
                        setSelectedPass(null);
                      }}
                      className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                      disabled={cancellingPass}
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <p className="text-orange-100 text-sm mt-1">Cancel checked-in pass and proceed with checkout</p>
                </div>
              )}

              {/* Scrollable Content */}
              <div className="p-6 pt-4 overflow-y-auto flex-1">

              {/* Warning Message - Dynamic based on pass status */}
              {selectedPass.passStatus === 'created' || selectedPass.status === 'created' ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800 font-medium mb-1">
                    📌 Note: This pass has not been checked in yet.
                  </p>
                  <p className="text-xs text-blue-700">
                    Cancelling will {selectedPass.stayRequired ? 'cancel guest house booking and ' : ''}revoke pass access.
                  </p>
                </div>
              ) : (
                <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-6">
                  <div className="flex items-start">
                    <AlertCircle className="w-6 h-6 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-orange-900 mb-2">⚠️ Pass Must Be Cancelled Before Checkout</h3>
                      <p className="text-sm text-orange-700">
                        This pass is currently checked-in. You can cancel it now and proceed with checkout:
                      </p>
                      <ol className="text-sm text-orange-700 mt-2 ml-4 list-decimal space-y-1">
                        <li>System will generate 1-hour checkout QR</li>
                        <li>Visitor will receive QR via email/WhatsApp</li>
                        <li>Then verify using QR code or verification code to checkout</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('allPasses.cancel.passDetails')}</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium">{t('allPasses.cancel.passId')}</span> {selectedPass.passId}</p>
                  <p><span className="font-medium">{t('allPasses.cancel.visitor')}</span> {selectedPass.visitorName}</p>
                  <p><span className="font-medium">{t('allPasses.cancel.mobile')}</span> {selectedPass.mobileNumber}</p>
                  <p><span className="font-medium">{t('allPasses.cancel.status')}</span> {selectedPass.passStatus}</p>
                </div>
              </div>

              {/* Refund Preview (Before Check-in with Hostel Booking) */}
              {(selectedPass.passStatus === 'created' || selectedPass.status === 'created') && selectedPass.stayRequired && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('allPasses.cancel.refundDetails')}
                  </h4>
                  
                  {loadingRefund ? (
                    <div className="text-center py-2">
                      <svg className="animate-spin h-5 w-5 mx-auto text-green-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : refundPreview ? (
                    <div className="space-y-3">
                      {/* Room and Check-in Details */}
                      <div className="text-sm text-gray-700 bg-white rounded-md p-3 border border-green-200">
                        <p className="mb-1"><span className="font-medium">Room:</span> {refundPreview.roomNumber}</p>
                        <p className="mb-1"><span className="font-medium">Check-in:</span> {refundPreview.checkInDate}</p>
                      </div>

                      {/* Time Remaining */}
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <p className="text-xs font-semibold text-blue-800 mb-1">⏰ Time Before Check-in</p>
                        <p className="text-lg font-bold text-blue-900">{refundPreview.timeRemaining}</p>
                      </div>

                      {/* Cancellation Policy */}
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                        <p className="text-xs font-semibold text-gray-700 mb-2">📋 Cancellation Policy</p>
                        <div className="space-y-1 text-xs text-gray-600">
                          <p className={refundPreview.appliedSlab === '3+ days before check-in' ? 'font-bold text-green-700' : ''}>
                            • 3+ days before → 90% refund {refundPreview.appliedSlab === '3+ days before check-in' ? '✅' : ''}
                          </p>
                          <p className={refundPreview.appliedSlab === '1–3 days before check-in' ? 'font-bold text-green-700' : ''}>
                            • 1–3 days before → 70% refund {refundPreview.appliedSlab === '1–3 days before check-in' ? '✅' : ''}
                          </p>
                          <p className={refundPreview.appliedSlab === '2–24 hours before check-in' ? 'font-bold text-orange-700' : ''}>
                            • 2–24 hours before → 40% refund {refundPreview.appliedSlab === '2–24 hours before check-in' ? '✅' : ''}
                          </p>
                          <p className={refundPreview.appliedSlab === 'Less than 2 hours before check-in' ? 'font-bold text-red-700' : ''}>
                            • Less than 2 hours → No refund {refundPreview.appliedSlab === 'Less than 2 hours before check-in' ? '✅' : ''}
                          </p>
                        </div>
                        <p className="text-xs font-semibold text-green-700 mt-2">
                          Applicable: {refundPreview.appliedSlab} ({refundPreview.refundPercent}% refund)
                        </p>
                      </div>

                      {/* Refund Calculation */}
                      <div className="border-t border-green-300 pt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Original Amount:</span>
                          <span className="font-semibold text-gray-800">₹{Number(refundPreview.originalAmount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>Cancellation Fee ({refundPreview.cancellationFeePercent}%):</span>
                          <span className="font-semibold">− ₹{Number(refundPreview.cancellationFeeAmount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t border-green-300 pt-2 text-base">
                          <span className="font-bold text-green-800">Refund Amount:</span>
                          <span className="font-bold text-green-700">₹{Number(refundPreview.refundAmount || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">{t('allPasses.cancel.noRefund')}</p>
                  )}
                </div>
              )}
              </div>

              {/* Fixed Footer with Reason & Actions */}
              <div className="p-6 pt-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex-shrink-0">
              {/* Show reason input only for BEFORE check-in cancellations */}
              {(selectedPass.passStatus === 'created' || selectedPass.status === 'created') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('allPasses.cancel.reasonLabel')} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder={t('allPasses.cancel.reasonPlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    rows={3}
                    required
                    disabled={cancellingPass}
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelReason('');
                    setRefundPreview(null);
                    setSelectedPass(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={cancellingPass}
                >
                  {selectedPass.passStatus === 'created' || selectedPass.status === 'created' ? t('allPasses.cancel.keepPass') : 'Cancel'}
                </button>
                <button
                  onClick={handleCancelPassConfirm}
                  disabled={(selectedPass.passStatus === 'created' || selectedPass.status === 'created') ? (!cancelReason.trim() || cancellingPass) : cancellingPass}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {cancellingPass ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('allPasses.cancel.cancelling')}
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      {selectedPass.passStatus === 'created' || selectedPass.status === 'created' ? t('allPasses.cancel.confirm') : 'Cancel Pass & Proceed to Checkout'}
                    </>
                  )}
                </button>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap with LanguageProvider
export default function AllPassesPage() {
  return (
    <LanguageProvider>
      <React.Suspense fallback={<DashboardShimmer />}>
        <AllPassesPageContent />
      </React.Suspense>
    </LanguageProvider>
  );
}
