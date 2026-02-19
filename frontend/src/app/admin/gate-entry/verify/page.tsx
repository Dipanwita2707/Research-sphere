'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle, XCircle, User, Calendar, Clock, Car, Building, AlertCircle, Loader2, Camera, X } from 'lucide-react';
import { gateEntryService, GatePass } from '@/shared/services/gateEntry.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/shared/ui-components/Toast';
// @ts-ignore - html5-qrcode doesn't have type definitions
import { Html5QrcodeScanner } from 'html5-qrcode';
import './qr-scanner.css';

export default function VerifyPassPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<'manual' | 'qr'>('manual');
  const [searchType, setSearchType] = useState<'passId' | 'mobile' | 'visitorName' | 'vehicleNumber'>('passId');
  const [searchTerm, setSearchTerm] = useState('');
  const [pass, setPass] = useState<GatePass | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [scannerInitialized, setScannerInitialized] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const qrReaderRef = useRef<HTMLDivElement>(null);
  
  // Cancelled pass checkout QR states
  const [isCancelledPass, setIsCancelledPass] = useState(false);
  const [checkoutQRRemaining, setCheckoutQRRemaining] = useState<number>(0);
  const [checkoutExpiresAt, setCheckoutExpiresAt] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Verification modal states
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<'qr' | 'code' | null>(null);
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const verifyQrReaderRef = useRef<HTMLDivElement>(null);
  const verifyScannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Checkout verification modal states
  const [showCheckoutVerificationModal, setShowCheckoutVerificationModal] = useState(false);
  const [checkoutVerificationMethod, setCheckoutVerificationMethod] = useState<'qr' | 'code' | null>(null);
  const [checkoutVerificationCodeInput, setCheckoutVerificationCodeInput] = useState('');
  const checkoutVerifyQrReaderRef = useRef<HTMLDivElement>(null);
  const checkoutVerifyScannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Cancel first modal
  const [showCancelFirstModal, setShowCancelFirstModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingPass, setCancellingPass] = useState(false);
  
  // Checkout credentials modal
  const [showCheckoutCredentialsModal, setShowCheckoutCredentialsModal] = useState(false);
  const [checkoutCredentials, setCheckoutCredentials] = useState<{checkoutId: string; checkoutCode: string; expiresAt: string} | null>(null);

  // Page-level access control - Only Admin and Guard can verify passes
  useEffect(() => {
    if (!user) return;
    
    const isAdmin = user?.role?.name === 'admin' || user?.userType === 'admin';
    const userDesignation = (user?.employee?.designation || user?.employeeDetails?.designation?.name || '').toLowerCase();
    const isGuard = userDesignation.includes('guard') || userDesignation.includes('security');
    
    // Redirect if not Admin or Guard
    if (!isAdmin && !isGuard) {
      router.push('/admin/gate-entry');
    }
  }, [user, router]);

  // Initialize QR Scanner when QR tab is active
  useEffect(() => {
    if (activeTab === 'qr' && !scannerInitialized) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          'qr-reader',
          { 
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText: string) => {
            // Success callback - QR code scanned
            handleQRScan(decodedText);
            scanner.clear().catch(() => {});
            setScannerInitialized(false);
          },
          (error: any) => {
            // Error callback - ignore continuous scanning errors
          }
        );

        scannerRef.current = scanner;
        setScannerInitialized(true);
      }, 100);
    }

    // Cleanup scanner when switching tabs
    return () => {
      if (scannerRef.current && activeTab !== 'qr') {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
        setScannerInitialized(false);
      }
    };
  }, [activeTab, scannerInitialized]);

  // Countdown timer for cancelled pass checkout QR - updates every second
  useEffect(() => {
    if (isCancelledPass && checkoutExpiresAt) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isCancelledPass, checkoutExpiresAt]);

  // Calculate remaining time dynamically
  const getCheckoutTimeRemaining = () => {
    if (!checkoutExpiresAt) return { minutes: 0, seconds: 0, total: 0 };
    
    const expiryTime = new Date(checkoutExpiresAt).getTime();
    const now = currentTime;
    const remainingMs = expiryTime - now;
    
    if (remainingMs <= 0) {
      return { minutes: 0, seconds: 0, total: 0 };
    }
    
    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return { minutes, seconds, total: minutes + seconds / 60 };
  };

  const handleQRScan = async (scannedData: string) => {
    try {
      setLoading(true);
      setError(null);
      setPass(null);
      setIsCancelledPass(false);
      setCheckoutQRRemaining(0);
      setCheckoutExpiresAt(null);
      
      // Check if this is a checkout QR code (JSON format)
      let isCheckoutQR = false;
      try {
        const qrData = JSON.parse(scannedData);
        if (qrData.type === 'CHECKOUT' && qrData.passId) {
          console.log('[SCAN] Checkout QR detected:', qrData);
          isCheckoutQR = true;
          
          // Call verify with checkout_qr search type
          const response = await gateEntryService.verifyPass(scannedData, 'checkout_qr');
          const passData = response.pass;
          
          if (!passData) {
            setError('Pass not found for checkout QR');
            setPass(null);
            setActiveTab('manual');
            return;
          }
          
          // Handle cancelled pass response
          if (response.isCancelled) {
            setIsCancelledPass(true);
            setCheckoutQRRemaining(response.checkoutQRRemaining || 0);
            setCheckoutExpiresAt(passData.checkoutQrExpiresAt || null);
            setPass(passData);
            toast.warning(response.message || '⚠️ CANCELLED PASS - Checkout Required');
            setLoading(false);
            return;
          }
          
          setPass(passData);
          setLoading(false);
          return;
        }
      } catch (jsonError) {
        // Not a JSON QR, proceed with regular pass ID extraction
        console.log('[SCAN] Regular pass QR detected');
      }
      
      // Extract pass ID from regular QR code data
      let passId = scannedData;
      if (scannedData.includes('UNI-PASS')) {
        const match = scannedData.match(/UNI-PASS-\d{8}-\d{3}/);
        if (match) passId = match[0];
      }
      
      const response = await gateEntryService.verifyPass(passId, 'passId');
      const passData = response.pass;
      
      if (!passData) {
        setError('Pass not found');
        setPass(null);
        setActiveTab('manual');
        return;
      }
      
      // Validate time window
      const now = new Date();
      const visitDate = new Date(passData.visitDate || now);
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const passDate = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());
      
      // Check if today is the visit date
      if (passDate.getTime() !== todayDate.getTime()) {
        setError(
          `❌ Invalid Visit Date\n\n` +
          `This pass is scheduled for: ${(passData.visitDate || '').split('T')[0]}\n` +
          `Today's date: ${now.toISOString().split('T')[0]}\n\n` +
          `Pass can only be used on the scheduled visit date.`
        );
        setPass(null);
        setActiveTab('manual');
        return;
      }
      
      // Parse expected entry and exit times (with null safety)
      const entryTimeParts = (passData.expectedEntryTime || '00:00').split(':').map(Number);
      const exitTimeParts = (passData.expectedExitTime || '23:59').split(':').map(Number);
      const [entryHour, entryMin] = entryTimeParts;
      const [exitHour, exitMin] = exitTimeParts;
      
      const expectedEntry = new Date(now);
      expectedEntry.setHours(entryHour, entryMin, 0, 0);
      
      const expectedExit = new Date(now);
      expectedExit.setHours(exitHour, exitMin, 0, 0);
      
      const currentTime = now.getTime();
      
      // Check if current time is within expected time window
      if (currentTime < expectedEntry.getTime() || currentTime > expectedExit.getTime()) {
        const currentTimeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        setError(
          `⏰ Outside Valid Time Window\n\n` +
          `Expected Entry: ${passData.expectedEntryTime}\n` +
          `Expected Exit: ${passData.expectedExitTime}\n` +
          `Current Time: ${currentTimeStr}\n\n` +
          `Visitor can only enter during the scheduled time window.`
        );
        setPass(null);
        setActiveTab('manual');
        return;
      }
      
      // Time is valid - show pass details
      setPass(passData);
      setActiveTab('manual'); // Switch to manual tab to show results
    } catch (err: any) {
      console.error('QR scan error:', err);
      setError(err.response?.data?.message || 'Invalid QR Code or Pass not found');
      setPass(null);
      setActiveTab('manual'); // Switch to show error
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a search term');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setPass(null);
      setIsCancelledPass(false);
      setCheckoutQRRemaining(0);
      setCheckoutExpiresAt(null);

      const response = await gateEntryService.verifyPass(searchTerm, searchType);
      const passData = response.pass;
      
      if (!passData) {
        setError('No pass found matching your search criteria');
        setPass(null);
        return;
      }
      
      // Check if this is a cancelled pass (for checkout)
      if (response.isCancelled) {
        setIsCancelledPass(true);
        setCheckoutQRRemaining(response.checkoutQRRemaining || 0);
        setCheckoutExpiresAt(passData.checkoutQrExpiresAt || null);
        setPass(passData);
        toast.warning(response.message || '⚠️ CANCELLED PASS - Checkout Required');
        setLoading(false);
        return;
      }
      
      // For non-cancelled passes, validate time window
      const now = new Date();
      const visitDate = new Date(passData.visitDate || now);
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const passDate = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());
      
      // Check if today is the visit date
      if (passDate.getTime() !== todayDate.getTime()) {
        setError(
          `❌ Invalid Visit Date - This pass is scheduled for: ${(passData.visitDate || '').split('T')[0]}. Today: ${now.toISOString().split('T')[0]}. Pass can only be used on the scheduled visit date.`
        );
        setPass(null);
        return;
      }
      
      // Parse expected entry and exit times (with null safety)
      const entryTimeParts = (passData.expectedEntryTime || '00:00').split(':').map(Number);
      const exitTimeParts = (passData.expectedExitTime || '23:59').split(':').map(Number);
      const [entryHour, entryMin] = entryTimeParts;
      const [exitHour, exitMin] = exitTimeParts;
      
      const expectedEntry = new Date(now);
      expectedEntry.setHours(entryHour, entryMin, 0, 0);
      
      const expectedExit = new Date(now);
      expectedExit.setHours(exitHour, exitMin, 0, 0);
      
      const currentTime = now.getTime();
      
      // Check if current time is within expected time window
      if (currentTime < expectedEntry.getTime() || currentTime > expectedExit.getTime()) {
        const currentTimeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        setError(
          `⏰ Outside Valid Time Window - Expected Entry: ${passData.expectedEntryTime}, Expected Exit: ${passData.expectedExitTime}. Current Time: ${currentTimeStr}. Visitor can only enter during the scheduled time window.`
        );
        setPass(null);
        return;
      }
      
      // Time is valid - show pass details
      setPass(passData);
    } catch (err: any) {
      console.error('Verify pass error:', err);
      setError(err.response?.data?.message || 'No pass found matching your search criteria');
      setPass(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAllowEntry = async () => {
    if (!pass) return;
    // Show verification modal instead of directly allowing entry
    setShowVerificationModal(true);
    setVerificationMethod(null);
    setVerificationCodeInput('');
  };
  
  const handleVerificationMethodSelect = (method: 'qr' | 'code') => {
    setVerificationMethod(method);
    
    if (method === 'qr') {
      // Initialize QR scanner for verification
      setTimeout(() => {
        if (verifyScannerRef.current) {
          verifyScannerRef.current.clear().catch(() => {});
        }
        
        const scanner = new Html5QrcodeScanner(
          'verify-qr-reader',
          { 
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
          },
          false
        );

        scanner.render(
          (decodedText: string) => {
            // Success - QR code matches pass
            confirmAllowEntry();
            scanner.clear().catch(() => {});
          },
          () => {}
        );

        verifyScannerRef.current = scanner;
      }, 100);
    }
  };
  
  const confirmAllowEntry = async (code?: string) => {
    if (!pass) return;

    try {
      setActionLoading(true);
      await gateEntryService.allowEntry(pass.passId, {
        gate: 'Main Gate',
        remarks: 'Entry verified and allowed',
        verificationCode: code || undefined
      });
      
      // Close modal and cleanup
      setShowVerificationModal(false);
      setVerificationMethod(null);
      if (verifyScannerRef.current) {
        verifyScannerRef.current.clear().catch(() => {});
        verifyScannerRef.current = null;
      }
      
      // Refresh pass data
      const response = await gateEntryService.verifyPass(pass.passId, 'passId');
      setPass(response.pass);
      toast.success('Visitor has been checked in successfully!', 'Entry Allowed');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to allow entry', 'Error');
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleCodeVerification = () => {
    if (!verificationCodeInput.trim()) {
      toast.warning('Please enter the verification code', 'Verification Required');
      return;
    }
    
    if (verificationCodeInput.trim() !== pass?.verificationCode) {
      toast.error('Invalid verification code. Please try again.', 'Verification Failed');
      return;
    }
    
    confirmAllowEntry(verificationCodeInput);
  };

  const handleDenyEntry = async () => {
    if (!pass) return;

    const reason = prompt('Enter reason for denial:');
    if (!reason) return;

    try {
      setActionLoading(true);
      await gateEntryService.denyEntry(pass.passId, reason);
      
      // Refresh pass data
      const response = await gateEntryService.verifyPass(pass.passId, 'passId');
      setPass(response.pass);
      toast.info('Pass has been marked as denied', 'Entry Denied');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to deny entry', 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordExit = async () => {
    if (!pass) return;

    // Check if pass is cancelled - if yes, show verification modal
    if (pass.passStatus === 'cancelled' || pass.status === 'cancelled') {
      setShowCheckoutVerificationModal(true);
      setCheckoutVerificationMethod(null);
      setCheckoutVerificationCodeInput('');
      return;
    }

    // If pass is checked_in but not cancelled, must cancel first
    if (pass.passStatus === 'checked_in' || pass.status === 'checked_in') {
      setShowCancelFirstModal(true);
      return;
    }

    // Otherwise, try direct checkout (shouldn't reach here normally)
    try {
      setActionLoading(true);
      await gateEntryService.recordExit(pass.passId, {
        gate: 'Main Gate',
        remarks: 'Exit recorded'
      });
      
      // Refresh pass data
      const response = await gateEntryService.verifyPass(pass.passId, 'passId');
      setPass(response.pass);
      toast.success('Visitor has been checked out successfully!', 'Exit Recorded');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record exit', 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckoutVerificationMethodSelect = (method: 'qr' | 'code') => {
    setCheckoutVerificationMethod(method);
    
    if (method === 'qr') {
      // Initialize QR scanner for checkout verification
      setTimeout(() => {
        if (checkoutVerifyScannerRef.current) {
          checkoutVerifyScannerRef.current.clear().catch(() => {});
        }
        
        const scanner = new Html5QrcodeScanner(
          'checkout-verify-qr-reader',
          { 
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
          },
          false
        );

        scanner.render(
          (decodedText: string) => {
            // Success - QR code scanned for checkout
            confirmRecordCheckout();
            scanner.clear().catch(() => {});
          },
          () => {}
        );

        checkoutVerifyScannerRef.current = scanner;
      }, 100);
    }
  };
  
  const confirmRecordExit = async (code?: string) => {
    if (!pass) return;

    try {
      setActionLoading(true);
      await gateEntryService.recordExit(pass.passId, {
        gate: 'Main Gate',
        remarks: 'Exit verified and recorded',
        verificationCode: code || undefined
      });
      
      // Close modal and cleanup
      setShowCheckoutVerificationModal(false);
      setCheckoutVerificationMethod(null);
      if (checkoutVerifyScannerRef.current) {
        checkoutVerifyScannerRef.current.clear().catch(() => {});
        checkoutVerifyScannerRef.current = null;
      }
      
      // Refresh pass data
      const response = await gateEntryService.verifyPass(pass.passId, 'passId');
      setPass(response.pass);
      setIsCancelledPass(false);
      setCheckoutQRRemaining(0);
      setCheckoutExpiresAt(null);
      toast.success('Visitor has been checked out successfully!', 'Exit Recorded');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record exit', 'Error');
    } finally {
      setActionLoading(false);
    }
  };
  
  // For cancelled passes - use the checkout endpoint with NEW verification code
  const confirmRecordCheckout = async (code?: string) => {
    if (!pass) return;

    try {
      setActionLoading(true);
      await gateEntryService.recordCheckout(pass.passId, {
        gate: 'Main Gate',
        remarks: 'Checkout verified and recorded',
        verificationCode: code || undefined
      });
      
      // Close modal and cleanup
      setShowCheckoutVerificationModal(false);
      setCheckoutVerificationMethod(null);
      if (checkoutVerifyScannerRef.current) {
        checkoutVerifyScannerRef.current.clear().catch(() => {});
        checkoutVerifyScannerRef.current = null;
      }
      
      // Refresh pass data
      const response = await gateEntryService.verifyPass(pass.passId, 'passId');
      setPass(response.pass);
      setIsCancelledPass(false);
      setCheckoutQRRemaining(0);
      setCheckoutExpiresAt(null);
      toast.success('Visitor has been checked out successfully!', 'Checkout Recorded');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record checkout', 'Error');
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleCheckoutCodeVerification = () => {
    if (!checkoutVerificationCodeInput.trim()) {
      toast.warning('Please enter the verification code', 'Verification Required');
      return;
    }
    
    // Use NEW checkout verification code for cancelled passes
    if (checkoutVerificationCodeInput.trim() !== pass?.checkoutVerificationCode) {
      toast.error('Invalid checkout verification code. Please use the NEW code sent after cancellation.', 'Verification Failed');
      return;
    }
    
    confirmRecordCheckout(checkoutVerificationCodeInput);
  };

  const handleCancelAndCheckout = async () => {
    if (!pass) return;
    
    if (!cancelReason.trim()) {
      toast.warning('Please enter cancellation reason', 'Reason Required');
      return;
    }

    try {
      setCancellingPass(true);
      
      // Cancel the pass first
      const cancelResponse = await gateEntryService.cancelPass(pass.passId, cancelReason);
      
      if (cancelResponse.success && cancelResponse.pass) {
        // Update pass data with cancelled pass
        setPass(cancelResponse.pass);
        setIsCancelledPass(true);
        
        // Close cancel modal
        setShowCancelFirstModal(false);
        setCancelReason('');
        
        // Show checkout credentials popup
        setCheckoutCredentials({
          checkoutId: cancelResponse.pass.checkoutUniqueId || '',
          checkoutCode: cancelResponse.pass.checkoutVerificationCode || '',
          expiresAt: cancelResponse.pass.checkoutQrExpiresAt || ''
        });
        setShowCheckoutCredentialsModal(true);
        
        toast.success('Pass cancelled successfully. Checkout credentials generated!', 'Pass Cancelled');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel pass', 'Error');
    } finally {
      setCancellingPass(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      created: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      active: 'bg-blue-100 text-blue-800',
      checked_in: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      checked_out: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-orange-100 text-orange-800',
      expired: 'bg-red-100 text-red-800',
      denied: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      created: 'Created',
      pending: 'Pending',
      active: 'Active',
      checked_in: 'Checked In',
      completed: 'Completed',
      checked_out: 'Checked Out',
      cancelled: 'Cancelled',
      expired: 'Expired',
      denied: 'Denied',
    };
    return labels[status] || status;
  };

  const canAllowEntry = pass && (pass.qrStatus === 'active' || pass.status === 'active') && (pass.passStatus === 'created' || pass.status === 'pending' || pass.status === 'active'); const canRecordExit = pass && ((pass.passStatus === 'checked_in' || pass.status === 'checked_in'));
  const canDenyEntry = pass && ['active'].includes(pass.status);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-3 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            🔍 Pass Verification
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">Guard interface for visitor pass verification and entry management</p>
        </div>

        {/* Tabs Card - LPU Style */}
        <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] mb-4 md:mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('manual')}
                className={`flex-1 px-3 md:px-6 py-3 md:py-4 text-center font-medium transition-colors ${
                  activeTab === 'manual'
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-1 md:gap-2">
                  <Search className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="text-xs md:text-base">Manual Search</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('qr')}
                className={`flex-1 px-3 md:px-6 py-3 md:py-4 text-center font-medium transition-colors ${
                  activeTab === 'qr'
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-1 md:gap-2">
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <span className="text-xs md:text-base">QR Scan</span>
                </div>
              </button>
            </div>
          </div>

          {/* Manual Search Tab */}
          {activeTab === 'manual' && (
            <div className="p-3 md:p-6">
              <div className="grid grid-cols-1 gap-3 md:gap-4 mb-4">
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">Search By</label>
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value as any)}
                    className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="passId">Pass ID</option>
                    <option value="visitorName">Visitor Name</option>
                    <option value="mobile">Mobile Number</option>
                    <option value="vehicleNumber">Vehicle Number</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">
                    {searchType === 'passId' && 'Enter Pass ID'}
                    {searchType === 'visitorName' && 'Enter Visitor Name'}
                    {searchType === 'mobile' && 'Enter Mobile Number'}
                    {searchType === 'vehicleNumber' && 'Enter Vehicle Number'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder={
                        searchType === 'passId' ? 'UNI-PASS-XXX' :
                        searchType === 'visitorName' ? 'Name' :
                        searchType === 'mobile' ? 'Mobile' :
                        'Vehicle No.'
                      }
                      className="flex-1 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={loading}
                      className="px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 md:gap-2 disabled:bg-gray-400 text-sm md:text-base font-medium"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="hidden md:inline">Searching...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          <span className="hidden md:inline">Search</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-sm md:text-base text-red-800 mb-1">Verification Failed</p>
                      <p className="text-xs md:text-sm text-red-600 whitespace-pre-line">{error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QR Code Scan Tab */}
          {activeTab === 'qr' && (
            <div className="p-3 md:p-8">
              <div className="max-w-2xl mx-auto">
                <div className="mb-4 md:mb-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Camera className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                    <h3 className="text-lg md:text-xl font-bold text-gray-900">Scanner Camera</h3>
                  </div>
                  <p className="text-xs md:text-sm text-gray-600">Position the QR code within the camera frame</p>
                  {!scannerInitialized && (
                    <div className="mt-3 md:mt-4 flex items-center justify-center gap-2 text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs md:text-sm font-medium">Initializing camera scanner...</span>
                    </div>
                  )}
                </div>

                {/* QR Scanner Container - Library will inject UI here */}
                <div id="qr-reader" ref={qrReaderRef} className="mb-6"></div>

                {loading && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <p className="text-blue-800 font-medium">Verifying scanned pass...</p>
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 md:p-6">
                  <h4 className="font-semibold text-sm md:text-base text-gray-900 mb-2 md:mb-3">📋 Scanning Instructions:</h4>
                  <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-gray-700">
                    <p className="flex items-start gap-2">
                      <span className="font-semibold text-blue-600">Step 1:</span>
                      <span>Camera selection dropdown will appear above - select your camera</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="font-semibold text-blue-600">Step 2:</span>
                      <span>Click the <strong>&quot;Start Scanning&quot;</strong> button to open camera</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="font-semibold text-blue-600">Step 3:</span>
                      <span>Hold visitor&apos;s gate pass QR code in front of camera</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Ensure good lighting and steady hand for faster detection</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Scanner will automatically verify pass after successful scan</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Allow camera permission</strong> when browser prompts</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span>Switch to Manual Search tab if QR code is not readable</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pass Details Section - LPU Style */}
        {pass && (
          <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] overflow-hidden">
            {/* Status Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-3 md:px-6 py-3 md:py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-xs md:text-sm opacity-90">Pass ID</p>
                  <p className="text-white text-lg md:text-2xl font-bold break-all">{pass.passId}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={`px-2 md:px-4 py-1 md:py-2 rounded-full ${getStatusColor(pass.passStatus || pass.status)} font-semibold text-xs md:text-sm`}>
                    {getStatusLabel(pass.passStatus || pass.status)}
                  </div>
                  {getQRStatusBadge(pass.qrStatus)}
                </div>
              </div>
            </div>

            <div className="p-3 md:p-6">
              {/* Checkout Warning for Cancelled Pass */}
              {isCancelledPass && pass.passStatus === 'cancelled' && (
                <div className="mb-4 md:mb-6 bg-red-50 rounded-lg border-2 border-red-400 p-4 md:p-6 animate-pulse">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertCircle className="w-7 h-7 md:w-8 md:h-8 text-red-600 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="text-xl md:text-2xl font-bold text-red-900 mb-2">⚠️ CHECKOUT - CANCELLED PASS</h3>
                      <p className="text-sm md:text-base text-red-700 font-medium mb-2">
                        This pass has been cancelled. A 1-hour checkout QR code was issued to the visitor.
                      </p>
                      <p className="text-xs md:text-sm text-red-600">
                        Verify visitor identity and allow exit using the "Record Checkout" button below.
                      </p>
                    </div>
                  </div>
                  
                  {/* QR Validity Countdown */}
                  <div className="bg-white rounded-lg border-2 border-red-300 p-3 md:p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm text-gray-600 mb-1">Checkout QR Validity</p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
                          <span className={`text-xl md:text-3xl font-bold ${getCheckoutTimeRemaining().total <= 5 ? 'text-red-600' : 'text-orange-600'}`}>
                            {getCheckoutTimeRemaining().minutes} min {getCheckoutTimeRemaining().seconds} sec
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        {getCheckoutTimeRemaining().total <= 5 ? (
                          <p className="text-xs md:text-sm font-bold text-red-600">⏰ EXPIRING SOON!</p>
                        ) : getCheckoutTimeRemaining().total <= 15 ? (
                          <p className="text-xs md:text-sm font-semibold text-orange-600">⚠️ Less than 15 min</p>
                        ) : (
                          <p className="text-xs md:text-sm text-green-600">✅ Valid</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {getCheckoutTimeRemaining().total <= 0 ? 'EXPIRED' : 'Remaining'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cancellation Details if available */}
                  {pass.cancellationTime && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <p className="text-xs md:text-sm text-gray-700">
                        <strong>Cancelled At:</strong> {new Date(pass.cancellationTime).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* QR Status Warning - if inactive */}
              {pass.qrStatus === 'inactive' && (
                <div className="mb-4 md:mb-6 bg-yellow-50 rounded-lg border border-yellow-300 p-3 md:p-4">
                  <div className="flex items-start gap-2 md:gap-3">
                    <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-bold text-sm md:text-base text-yellow-900 mb-1">⏰ QR Code Not Yet Active</h4>
                      <p className="text-xs md:text-sm text-yellow-700">
                        This QR code will activate 5 hours before entry time ({pass.entryTime || pass.expectedEntryTime}).
                        {pass.qrActivationTime && (
                          <><br/>Activation Time: {new Date(pass.qrActivationTime).toLocaleString()}</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Checkout QR for Cancelled Passes - REMOVED (Should only be on visitor's device) */}
              {/* The checkout QR code is sent to visitor's WhatsApp/Email only */}
              {/* Guard will scan visitor's QR or enter the verification code */}

              {/* Time Validation Success Notice - LPU Style */}
              {pass.qrStatus === 'active' && (
                <div className="mb-4 md:mb-6 bg-white rounded-lg border border-blue-600 shadow-[0_2px_8px_rgba(21,101,192,0.1)] p-3 md:p-4">
                  <div className="flex items-start gap-2 md:gap-3">
                    <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-bold text-sm md:text-base text-green-900 mb-1">✅ Pass Verified - QR Active</h4>
                      <p className="text-xs md:text-sm text-green-700">
                        QR code is active. Please verify visitor ID proof and details below before allowing entry.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Visitor Information Card - LPU Style */}
                <div className="bg-white rounded-lg border border-blue-600 shadow-[0_2px_8px_rgba(21,101,192,0.1)] p-4">
                  <h3 className="font-semibold text-sm md:text-base text-gray-900 flex items-center gap-2 pb-2 mb-3 border-b">
                    <User className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                    Visitor Information
                  </h3>
                  <div className="space-y-2 md:space-y-3">
                    {pass.visitorName && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">Name</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.visitorName}</p>
                      </div>
                    )}
                    {pass.mobileNumber && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">Mobile</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.mobileNumber}</p>
                      </div>
                    )}
                    {pass.email && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">Email</p>
                        <p className="font-medium text-sm md:text-base text-gray-900 break-all">{pass.email}</p>
                      </div>
                    )}
                    {pass.idProofType && pass.idProofNumber && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">ID Proof</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.idProofType}: {pass.idProofNumber}</p>
                      </div>
                    )}
                    {(pass.gender || pass.age) && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">Gender / Age</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">
                          {pass.gender || '-'} / {pass.age ? `${pass.age} years` : '-'}
                        </p>
                      </div>
                    )}
                    {pass.numberOfPersons && pass.numberOfPersons > 0 && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">Number of Persons</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.numberOfPersons}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Visit Information Card - LPU Style */}
                <div className="bg-white rounded-lg border border-blue-600 shadow-[0_2px_8px_rgba(21,101,192,0.1)] p-4">
                  <h3 className="font-semibold text-sm md:text-base text-gray-900 flex items-center gap-2 pb-2 mb-3 border-b">
                    <Building className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                    Visit Information
                  </h3>
                  <div className="space-y-2 md:space-y-3">
                    {pass.purposeOfVisit && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">Purpose</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.purposeOfVisit === 'other' && pass.purposeOther ? pass.purposeOther : pass.purposeOfVisit}</p>
                      </div>
                    )}
                    {pass.departmentToVisit && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">Department</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.departmentToVisit}</p>
                      </div>
                    )}
                    {pass.personToMeetName && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">Person to Meet</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.personToMeetName}</p>
                      </div>
                    )}
                    {pass.visitDate && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                          Visit Date
                        </p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.visitDate.split('T')[0]}</p>
                      </div>
                    )}
                    {(pass.entryTime || pass.expectedEntryTime) && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600 flex items-center gap-1">
                          <Clock className="w-3 h-3 md:w-4 md:h-4" />
                          Entry Time
                        </p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.entryTime || pass.expectedEntryTime}</p>
                      </div>
                    )}
                    {pass.qrActivationTime && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">QR Activates At</p>
                        <p className="font-medium text-sm md:text-base text-blue-600">
                          {new Date(pass.qrActivationTime).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Vehicle Information Card - LPU Style */}
              {pass.hasVehicle && (
                <div className="mt-4 md:mt-6 bg-white rounded-lg border border-blue-600 shadow-[0_2px_8px_rgba(21,101,192,0.1)] p-4">
                  <h3 className="font-semibold text-sm md:text-base text-gray-900 flex items-center gap-2 pb-2 mb-3 md:mb-4 border-b">
                    <Car className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                    Vehicle Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Vehicle Number</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.vehicleNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Vehicle Type</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.vehicleType || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Vehicle Model</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.vehicleModel || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Information */}
              {(pass.specialInstructions || pass.itemsCarrying) && (
                <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t">
                  <h3 className="font-semibold text-sm md:text-base text-gray-900 pb-2 mb-3 md:mb-4">Additional Information</h3>
                  <div className="space-y-2 md:space-y-3">
                    {pass.itemsCarrying && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">Items Carrying</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.itemsCarrying}</p>
                      </div>
                    )}
                    {pass.specialInstructions && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">Special Instructions</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.specialInstructions}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Entry/Exit Times */}
              {(pass.actualEntryTime || pass.actualExitTime) && (
                <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t">
                  <h3 className="font-semibold text-sm md:text-base text-gray-900 pb-2 mb-3 md:mb-4">Entry/Exit Records</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {pass.actualEntryTime && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs md:text-sm text-green-700">Actual Entry Time</p>
                        <p className="font-semibold text-sm md:text-base text-green-900">{new Date(pass.actualEntryTime).toLocaleString()}</p>
                      </div>
                    )}
                    {pass.actualExitTime && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs md:text-sm text-blue-700">Actual Exit Time</p>
                        <p className="font-semibold text-sm md:text-base text-blue-900">{new Date(pass.actualExitTime).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Guard Action Section */}
              <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 md:p-4 mb-3 md:mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm md:text-base text-gray-900 flex items-center gap-2">
                      🛡️ Guard Actions
                    </h3>
                    <div className="flex items-center gap-1 text-xs md:text-sm text-gray-600">
                      <Clock className="w-3 h-3 md:w-4 md:h-4" />
                      <span className="font-medium">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <p className="text-xs md:text-sm text-gray-600">
                    {isCancelledPass && "🚨 CHECKOUT - Record visitor exit"}
                    {canAllowEntry && !isCancelledPass && "✅ Verify visitor ID proof before allowing entry"}
                    {canRecordExit && !isCancelledPass && "✅ Confirm visitor is leaving premises"}
                    {canDenyEntry && !isCancelledPass && "⚠️ Deny entry if verification fails"}
                    {!canAllowEntry && !canRecordExit && !canDenyEntry && !isCancelledPass && "ℹ️ No actions available - pass already processed"}
                  </p>
                </div>

                <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                  {/* Checkout for Cancelled Pass */}
                  {isCancelledPass && pass.passStatus === 'cancelled' && getCheckoutTimeRemaining().total > 0 && (
                    <button
                      onClick={handleRecordExit}
                      disabled={actionLoading}
                      className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all hover:shadow-lg flex items-center justify-center gap-2 md:gap-3 font-bold text-base md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-95"
                    >
                      <AlertCircle className="w-5 h-5 md:w-6 md:h-6" />
                      {actionLoading ? 'Processing...' : '🚨 Record Checkout'}
                    </button>
                  )}

                  {/* Expired QR Warning */}
                  {isCancelledPass && getCheckoutTimeRemaining().total <= 0 && (
                    <div className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-red-100 border-2 border-red-500 text-red-800 rounded-lg text-center font-semibold text-sm md:text-base">
                      ❌ Checkout QR Expired - Contact Admin to Regenerate
                    </div>
                  )}

                  {canAllowEntry && pass.qrStatus === 'active' && !isCancelledPass && (
                    <button
                      onClick={handleAllowEntry}
                      disabled={actionLoading}
                      className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all hover:shadow-lg flex items-center justify-center gap-2 md:gap-3 font-bold text-base md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-95"
                    >
                      <CheckCircle className="w-5 h-5 md:w-6 md:h-6" />
                      {actionLoading ? 'Processing...' : 'Allow Entry'}
                    </button>
                  )}

                  {pass.qrStatus === 'inactive' && !isCancelledPass && (
                    <div className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-yellow-50 border-2 border-yellow-400 text-yellow-800 rounded-lg text-center font-semibold text-sm md:text-base">
                      ⏰ QR will activate 5 hours before entry time
                    </div>
                  )}
                  
                  {canRecordExit && !isCancelledPass && (
                    <button
                      onClick={handleRecordExit}
                      disabled={actionLoading}
                      className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all hover:shadow-lg flex items-center justify-center gap-2 md:gap-3 font-bold text-base md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-95"
                    >
                      <CheckCircle className="w-5 h-5 md:w-6 md:h-6" />
                      {actionLoading ? 'Processing...' : 'Record Exit'}
                    </button>
                  )}
                  
                  {canDenyEntry && !isCancelledPass && (
                    <button
                      onClick={handleDenyEntry}
                      disabled={actionLoading}
                      className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all hover:shadow-lg flex items-center justify-center gap-2 md:gap-3 font-bold text-base md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-95"
                    >
                      <XCircle className="w-5 h-5 md:w-6 md:h-6" />
                      {actionLoading ? 'Processing...' : 'Deny Entry'}
                    </button>
                  )}

                  {!canAllowEntry && !canRecordExit && !canDenyEntry && !isCancelledPass && (
                    <div className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-gray-100 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg text-center font-semibold text-sm md:text-base">
                      {pass.status === 'completed' && '✅ Pass Already Completed'}
                      {pass.status === 'expired' && '⏰ Pass Expired'}
                      {pass.status === 'rejected' && '❌ Pass Rejected'}
                      {!['completed', 'expired', 'rejected'].includes(pass.status) && 'ℹ️ No Actions Available'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  🔐 Verify Visitor Identity
                </h2>
                <button
                  onClick={() => {
                    setShowVerificationModal(false);
                    setVerificationMethod(null);
                    if (verifyScannerRef.current) {
                      verifyScannerRef.current.clear().catch(() => {});
                      verifyScannerRef.current = null;
                    }
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <p className="text-blue-100 text-sm mt-1">Choose verification method</p>
            </div>

            <div className="p-6">
              {!verificationMethod && (
                <>
                  <div className="mb-6">
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                      <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-yellow-900">Visitor Identity Verification Required</h3>
                          <p className="text-sm text-yellow-700 mt-1">
                            Before allowing entry, verify the visitor&apos;s identity using one of the methods below.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* QR Code Option */}
                    <button
                      onClick={() => handleVerificationMethodSelect('qr')}
                      className="group relative bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-2 border-blue-300 hover:border-blue-500 rounded-xl p-6 transition-all hover:shadow-lg active:scale-95"
                    >
                      <div className="text-center">
                        <div className="bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <Camera className="w-8 h-8" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">Scan QR Code</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          Ask visitor to show QR code from their gate pass
                        </p>
                        <div className="bg-blue-600 text-white text-xs font-semibold py-2 px-4 rounded-full inline-block">
                          Open Camera
                        </div>
                      </div>
                    </button>

                    {/* Verification Code Option */}
                    <button
                      onClick={() => handleVerificationMethodSelect('code')}
                      className="group relative bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border-2 border-green-300 hover:border-green-500 rounded-xl p-6 transition-all hover:shadow-lg active:scale-95"
                    >
                      <div className="text-center">
                        <div className="bg-green-600 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <span className="text-2xl font-bold">123</span>
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">Enter Code</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          Ask visitor for their 6-digit verification code
                        </p>
                        <div className="bg-green-600 text-white text-xs font-semibold py-2 px-4 rounded-full inline-block">
                          Enter Code
                        </div>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* QR Scanner */}
              {verificationMethod === 'qr' && (
                <div>
                  <div className="mb-4">
                    <button
                      onClick={() => {
                        setVerificationMethod(null);
                        if (verifyScannerRef.current) {
                          verifyScannerRef.current.clear().catch(() => {});
                          verifyScannerRef.current = null;
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
                    >
                      ← Back to options
                    </button>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      Scan Visitor&apos;s QR Code
                    </h3>
                    <p className="text-sm text-blue-700">
                      Ask the visitor to show their gate pass QR code. Position it within the camera frame.
                    </p>
                  </div>

                  <div id="verify-qr-reader" ref={verifyQrReaderRef} className="mb-4"></div>
                  
                  {actionLoading && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                        <p className="text-green-800 font-medium">Verifying and allowing entry...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Code Entry */}
              {verificationMethod === 'code' && (
                <div>
                  <div className="mb-4">
                    <button
                      onClick={() => setVerificationMethod(null)}
                      className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
                    >
                      ← Back to options
                    </button>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-green-900 mb-2">
                      Enter 6-Digit Verification Code
                    </h3>
                    <p className="text-sm text-green-700">
                      Ask the visitor to provide the 6-digit code they received with their gate pass.
                    </p>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      value={verificationCodeInput}
                      onChange={(e) => setVerificationCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 tracking-widest"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Code should be 6 digits (numbers only)
                    </p>
                  </div>

                  <button
                    onClick={handleCodeVerification}
                    disabled={actionLoading || verificationCodeInput.length !== 6}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg transition-all hover:shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Verify & Allow Entry
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Verification Modal */}
      {showCheckoutVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  🚨 Verify Checkout
                </h2>
                <button
                  onClick={() => {
                    setShowCheckoutVerificationModal(false);
                    setCheckoutVerificationMethod(null);
                    if (checkoutVerifyScannerRef.current) {
                      checkoutVerifyScannerRef.current.clear().catch(() => {});
                      checkoutVerifyScannerRef.current = null;
                    }
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <p className="text-red-100 text-sm mt-1">Cancelled pass - verify using QR or code</p>
            </div>

            <div className="p-6">
              {!checkoutVerificationMethod && (
                <>
                  <div className="mb-6">
                    <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-4">
                      <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-orange-900">Checkout Verification</h3>
                          <p className="text-sm text-orange-700 mt-1">
                            This pass was cancelled. Visitor must show checkout QR code or provide verification code.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* QR Code Option */}
                    <button
                      onClick={() => handleCheckoutVerificationMethodSelect('qr')}
                      className="group relative bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 border-2 border-red-300 hover:border-red-500 rounded-xl p-6 transition-all hover:shadow-lg active:scale-95"
                    >
                      <div className="text-center">
                        <div className="bg-red-600 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <Camera className="w-8 h-8" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">Scan Checkout QR</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          Scan the checkout QR code sent to visitor
                        </p>
                        <div className="bg-red-600 text-white text-xs font-semibold py-2 px-4 rounded-full inline-block">
                          Open Camera
                        </div>
                      </div>
                    </button>

                    {/* Verification Code Option */}
                    <button
                      onClick={() => handleCheckoutVerificationMethodSelect('code')}
                      className="group relative bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 border-2 border-orange-300 hover:border-orange-500 rounded-xl p-6 transition-all hover:shadow-lg active:scale-95"
                    >
                      <div className="text-center">
                        <div className="bg-orange-600 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <span className="text-2xl font-bold">123</span>
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">Enter Code</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          Ask visitor for their NEW 6-digit checkout code
                        </p>
                        <div className="bg-orange-600 text-white text-xs font-semibold py-2 px-4 rounded-full inline-block">
                          Enter Code
                        </div>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* QR Scanner */}
              {checkoutVerificationMethod === 'qr' && (
                <div>
                  <div className="mb-4">
                    <button
                      onClick={() => {
                        setCheckoutVerificationMethod(null);
                        if (checkoutVerifyScannerRef.current) {
                          checkoutVerifyScannerRef.current.clear().catch(() => {});
                          checkoutVerifyScannerRef.current = null;
                        }
                      }}
                      className="text-red-600 hover:text-red-800 font-medium flex items-center gap-2"
                    >
                      ← Back to options
                    </button>
                  </div>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      Scan Checkout QR Code
                    </h3>
                    <p className="text-sm text-red-700">
                      Ask the visitor to show their checkout QR code. Position it within the camera frame.
                    </p>
                  </div>

                  <div id="checkout-verify-qr-reader" ref={checkoutVerifyQrReaderRef} className="mb-4"></div>
                  
                  {actionLoading && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                        <p className="text-green-800 font-medium">Verifying and recording exit...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Code Entry */}
              {checkoutVerificationMethod === 'code' && (
                <div>
                  <div className="mb-4">
                    <button
                      onClick={() => setCheckoutVerificationMethod(null)}
                      className="text-orange-600 hover:text-orange-800 font-medium flex items-center gap-2"
                    >
                      ← Back to options
                    </button>
                  </div>
                  
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                      <span className="text-xl">🔢</span>
                      Enter NEW Checkout Verification Code
                    </h3>
                    <p className="text-sm text-orange-700">
                      Ask the visitor for their NEW 6-digit verification code sent AFTER cancellation (not the original check-in code).
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Checkout Verification Code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={checkoutVerificationCodeInput}
                      onChange={(e) => setCheckoutVerificationCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 tracking-widest"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Code should be 6 digits (numbers only)
                    </p>
                  </div>

                  <button
                    onClick={handleCheckoutCodeVerification}
                    disabled={actionLoading || checkoutVerificationCodeInput.length !== 6}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg transition-all hover:shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Verify & Record Exit
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel First Modal */}
      {showCancelFirstModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  🚨 Cancel Pass & Record Checkout
                </h2>
                <button
                  onClick={() => {
                    setShowCancelFirstModal(false);
                    setCancelReason('');
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <p className="text-orange-100 text-sm mt-1">Cancel checked-in pass and proceed with checkout</p>
            </div>

            <div className="p-6">
              <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="w-6 h-6 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-orange-900 mb-2">Pass Must Be Cancelled Before Checkout</h3>
                    <p className="text-sm text-orange-700">
                      This pass is currently checked-in. You can cancel it now and proceed with checkout:
                    </p>
                    <ol className="text-sm text-orange-700 mt-2 ml-4 list-decimal space-y-1">
                      <li>Enter cancellation reason below</li>
                      <li>System will generate 1-hour checkout QR</li>
                      <li>Visitor will receive QR via email/WhatsApp</li>
                      <li>Then verify using QR code or verification code to checkout</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cancellation Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter reason for cancelling the pass..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  disabled={cancellingPass}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This reason will be recorded in the system
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCancelFirstModal(false);
                    setCancelReason('');
                  }}
                  disabled={cancellingPass}
                  className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCancelAndCheckout}
                  disabled={cancellingPass || !cancelReason.trim()}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {cancellingPass ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <X className="w-5 h-5" />
                      Cancel Pass & Proceed to Checkout
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Credentials Modal - Shows after cancellation */}
      {showCheckoutCredentialsModal && checkoutCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  ✅ Pass Cancelled - Checkout Credentials Generated
                </h2>
                <button
                  onClick={() => {
                    setShowCheckoutCredentialsModal(false);
                    setCheckoutCredentials(null);
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Success Message */}
              <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-green-900 mb-1">Pass Successfully Cancelled</h3>
                    <p className="text-sm text-green-700">
                      1-hour checkout QR code has been generated and sent to visitor's WhatsApp/Email.
                    </p>
                  </div>
                </div>
              </div>

              {/* Checkout Credentials */}
              <div className="space-y-4 mb-6">
                {/* Checkout ID */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Checkout ID</label>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-mono font-bold text-gray-800">{checkoutCredentials.checkoutId}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(checkoutCredentials.checkoutId);
                        toast.success('Checkout ID copied!', 'Copied');
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>

                {/* Checkout Verification Code */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-5 border-2 border-orange-300">
                  <label className="block text-xs font-semibold text-orange-900 mb-2">
                    🔐 Checkout Verification Code
                  </label>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-4xl font-mono font-bold text-orange-600 tracking-wider">
                      {checkoutCredentials.checkoutCode}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(checkoutCredentials.checkoutCode);
                        toast.success('Checkout code copied!', 'Copied');
                      }}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      📋 Copy Code
                    </button>
                  </div>
                  <p className="text-xs text-orange-700 font-medium">
                    ⚠️ Use this code for checkout verification (NOT the original check-in code)
                  </p>
                </div>

                {/* Expiry Time */}
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <label className="block text-xs font-semibold text-red-900 mb-2">⏰ Valid Until</label>
                  <span className="text-base font-semibold text-red-700">
                    {new Date(checkoutCredentials.expiresAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </span>
                  <p className="text-xs text-red-600 mt-1">Valid for 1 hour only</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCheckoutCredentialsModal(false);
                    setCheckoutCredentials(null);
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg transition"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowCheckoutCredentialsModal(false);
                    setCheckoutCredentials(null);
                    // Open checkout verification modal
                    setTimeout(() => {
                      setShowCheckoutVerificationModal(true);
                      setCheckoutVerificationMethod(null);
                      setCheckoutVerificationCodeInput('');
                    }, 300);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Proceed to Checkout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
