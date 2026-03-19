'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle, XCircle, User, Calendar, Clock, Car, Building, AlertCircle, Loader2, Camera, X, Shield, LogOut } from 'lucide-react';
import { gateEntryService, GatePass } from '@/shared/services/gateEntry.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/shared/ui-components/Toast';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from '../components/LanguageSelector';
import { VerifyPassShimmer } from '../components/ShimmerUI';
// html5-qrcode is dynamically imported to avoid SSR issues
import './qr-scanner.css';
import '../styles/animations.css';

function VerifyPassPageContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const toast = useToast();
  const { t, displayText } = useLanguage(); // Get translation and display helpers
  
  const [activeTab, setActiveTab] = useState<'manual' | 'qr'>('manual');
  const [searchType, setSearchType] = useState<'passId' | 'mobile' | 'visitorName' | 'vehicleNumber'>('passId');
  const [searchTerm, setSearchTerm] = useState('');
  const [pass, setPass] = useState<GatePass | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [scannerInitialized, setScannerInitialized] = useState(false);
  const scannerRef = useRef<any>(null);
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
  const verifyScannerRef = useRef<any>(null);

  // Checkout verification modal states
  const [showCheckoutVerificationModal, setShowCheckoutVerificationModal] = useState(false);
  const [checkoutVerificationMethod, setCheckoutVerificationMethod] = useState<'qr' | 'code' | null>(null);
  const [checkoutVerificationCodeInput, setCheckoutVerificationCodeInput] = useState('');
  const checkoutVerifyQrReaderRef = useRef<HTMLDivElement>(null);
  const checkoutVerifyScannerRef = useRef<any>(null);

  // Exit verification modal states
  const [showExitVerificationModal, setShowExitVerificationModal] = useState(false);
  const [exitVerificationMethod, setExitVerificationMethod] = useState<'qr' | 'code' | null>(null);
  const [exitVerificationCodeInput, setExitVerificationCodeInput] = useState('');
  const exitVerifyQrReaderRef = useRef<HTMLDivElement>(null);
  const exitVerifyScannerRef = useRef<any>(null);

  // Guard against QR scanner double-fire
  const entryProcessingRef = useRef(false);
  const checkoutProcessingRef = useRef(false);
  const exitProcessingRef = useRef(false);

  // Cancel first modal
  const [showCancelFirstModal, setShowCancelFirstModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingPass, setCancellingPass] = useState(false);
  
  // Checkout credentials modal
  const [showCheckoutCredentialsModal, setShowCheckoutCredentialsModal] = useState(false);
  const [checkoutCredentials, setCheckoutCredentials] = useState<{checkoutId: string; checkoutCode: string; expiresAt: string} | null>(null);
  const cardClass = 'bg-white rounded-2xl border border-[#6497b1] shadow-[0_10px_24px_rgba(3,57,108,0.12)]';
  const inputClass = 'w-full px-4 py-3 text-sm md:text-base border border-[#b3cde0] rounded-xl bg-white focus:ring-2 focus:ring-[#6497b1] focus:border-[#005b96] transition-all';

  // Page-level access control - Only Admin and Guard can verify passes
  useEffect(() => {
    if (!user) return;
    
    const isAdmin = user?.role?.name === 'admin' || user?.userType === 'admin';
    const isStaff = user?.role?.name === 'staff' || user?.userType === 'staff';
    const userDesignation = (user?.employee?.designation || user?.employeeDetails?.designation?.name || '').toLowerCase();
    const isGuard = userDesignation.includes('guard') || userDesignation.includes('security');
    
    // Redirect if not Admin, Guard, or Staff (guards are registered as staff role)
    if (!isAdmin && !isGuard && !isStaff) {
      router.push('/admin/gate-entry');
    }
  }, [user, router]);

  // Initialize QR Scanner when QR tab is active (using Html5Qrcode direct API)
  const processingQrRef = useRef(false);

  useEffect(() => {
    if (activeTab !== 'qr' || scannerInitialized) return;
    
    let cancelled = false;

    const initScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        
        if (cancelled) return;
        
        // Stop any existing scanner first
        if (scannerRef.current) {
          try { await scannerRef.current.stop(); } catch {}
          scannerRef.current = null;
        }
        
        const scanner = new Html5Qrcode('qr-reader');
        
        if (cancelled) return;
        
        processingQrRef.current = false;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            if (processingQrRef.current) return;
            processingQrRef.current = true;
            console.log('[QR Scanner] Scanned:', decodedText);
            handleQRScan(decodedText);
            scanner.stop().catch(() => {});
            scannerRef.current = null;
            setTimeout(() => {
              processingQrRef.current = false;
              setScannerInitialized(false);
            }, 2000);
          },
          () => {} // Ignore continuous scanning errors
        );

        scannerRef.current = scanner;
        setScannerInitialized(true);
      } catch (err: any) {
        console.error('[QR Scanner] Failed to initialize:', err);
        if (err?.message?.includes('Permission') || err?.message?.includes('NotAllowed') || err?.name === 'NotAllowedError') {
          toast.error(t('verifyPass.err.cameraPermissionDenied'));
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initScanner, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeTab, scannerInitialized]);

  // Cleanup scanner when switching away from QR tab
  useEffect(() => {
    if (activeTab !== 'qr' && scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
      setScannerInitialized(false);
    }
  }, [activeTab]);

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
        if (qrData.type === 'CHECKOUT' && qrData.original_pass_id) {
          console.log('[SCAN] Checkout QR detected:', qrData);
          isCheckoutQR = true;
          
          // Call verify with checkout_qr search type
          const response = await gateEntryService.verifyPass(scannedData, 'checkout_qr');
          const passData = response.pass;
          
          if (!passData) {
            setError(t('verifyPass.err.checkoutQrScanNotFound'));
            setPass(null);
            setActiveTab('manual');
            return;
          }
          
          // Handle cancelled pass response — auto-checkout using verification code from QR
          if (response.isCancelled) {
            setActiveTab('manual');
            setLoading(false);

            // If the QR contains the checkout verification code, do checkout immediately
            // (no second scan needed — single scan workflow)
            if (qrData.checkout_verification_code && passData) {
              setActionLoading(true);
              try {
                const checkoutResult = await gateEntryService.recordCheckout(passData.passId, {
                  gate: 'Main Gate',
                  remarks: 'Checkout via cancelled pass QR scan',
                  verificationCode: qrData.checkout_verification_code
                });
                setPass(checkoutResult.pass);
                setIsCancelledPass(false);
                toast.success(t('verifyPass.toast.autoCheckoutSuccess'), t('verifyPass.toast.autoCheckoutSuccessTitle'));
              } catch (err: any) {
                // Auto-checkout failed — fall back to showing pass for manual checkout
                setIsCancelledPass(true);
                setCheckoutQRRemaining(response.checkoutQRRemaining || 0);
                setCheckoutExpiresAt(passData.checkoutQrExpiresAt || null);
                setPass(passData);
                toast.error(err.response?.data?.message || t('verifyPass.err.autoCheckoutFailed'), t('verifyPass.toast.autoCheckoutFailedTitle'));
              } finally {
                setActionLoading(false);
              }
              return;
            }

            // No verification code in QR — show pass for manual checkout
            setIsCancelledPass(true);
            setCheckoutQRRemaining(response.checkoutQRRemaining || 0);
            setCheckoutExpiresAt(passData.checkoutQrExpiresAt || null);
            setPass(passData);
            toast.warning(response.message || t('verifyPass.toast.cancelledPassWarning'));
            return;
          }
          
          setPass(passData);
          setActiveTab('manual');
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
        setError(t('verifyPass.err.passNotFound'));
        setPass(null);
        setActiveTab('manual');
        return;
      }
      
      // Check if this is a cancelled pass (for checkout) - Skip time validation
      if (response.isCancelled) {
        setIsCancelledPass(true);
        setCheckoutQRRemaining(response.checkoutQRRemaining || 0);
        setCheckoutExpiresAt(passData.checkoutQrExpiresAt || null);
        setPass(passData);
        toast.warning(response.message || t('verifyPass.toast.cancelledPassWarning'));
        setLoading(false);
        return;
      }
      
      // For completed/expired/denied passes, skip time validation - just show info
      if (passData.passStatus && ['completed', 'expired', 'denied'].includes(passData.passStatus)) {
        setPass(passData);
        setLoading(false);
        setActiveTab('manual');
        return;
      }
      
      // For non-cancelled passes, validate time window (support multi-day passes)
      const now = new Date();
      const visitDate = new Date(passData.visitDate || now);
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const passDate = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());
      
      // For multi-day passes, check if today is within visit date range
      const visitEndDate = passData.visitEndDate ? new Date(passData.visitEndDate) : null;
      const endPassDate = visitEndDate ? new Date(visitEndDate.getFullYear(), visitEndDate.getMonth(), visitEndDate.getDate()) : passDate;
      
      // Check if today is within valid date range
      if (todayDate.getTime() < passDate.getTime() || todayDate.getTime() > endPassDate.getTime()) {
        const dateRangeStr = visitEndDate 
          ? `${passData.visitDate.split('T')[0]} ${t('common.to')} ${passData.visitEndDate!.split('T')[0]}`
          : passData.visitDate.split('T')[0];
        
        setError(
          `❌ Invalid Visit Date\n\n` +
          `This pass is valid for: ${dateRangeStr}\n` +
          `Today's date: ${now.toISOString().split('T')[0]}\n\n` +
          `Pass can only be used during the scheduled date range.`
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
      
      // Gate Entry module is for ALL outsider passes - apply 5 hour buffer to everyone
      console.log('[QR SCAN TIME VALIDATION] Applying 5-hour buffer for all passes');
      
      // 1. Allow entry 5 hours before entry time
      expectedEntry.setTime(expectedEntry.getTime() - (5 * 60 * 60 * 1000));
      
      // 2. Allow until midnight (23:59) on exit date
      expectedExit.setHours(23, 59, 59, 999);
      
      const currentTime = now.getTime();
      
      // For multi-day passes, only enforce entry time on the FIRST day
      // On subsequent days, allow entry anytime
      const isFirstDay = todayDate.getTime() === passDate.getTime();
      const isMultiDay = visitEndDate !== null;
      
      // Check time window only for single-day passes or first day of multi-day pass
      if (!isMultiDay || isFirstDay) {
        if (currentTime < expectedEntry.getTime() || currentTime > expectedExit.getTime()) {
          const currentTimeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          const actualEntryTime = new Date(expectedEntry.getTime() + (5 * 60 * 60 * 1000)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          setError(
            `⏰ Outside Valid Time Window\n\n` +
            `Expected Entry: ${passData.expectedEntryTime} (Active 5 hours before: ${expectedEntry.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})\n` +
            `Expected Exit: ${passData.expectedExitTime || 'null'} (Valid until midnight)\n` +
            `Current Time: ${currentTimeStr}\n\n` +
            `Visitor can only enter during the scheduled time window.`
          );
          setPass(null);
          setActiveTab('manual');
          return;
        }
      }
      
      // Time is valid - show pass details
      setPass(passData);
      setActiveTab('manual'); // Switch to manual tab to show results
    } catch (err: any) {
      console.error('QR scan error:', err);
      setError(err.response?.data?.message || t('verifyPass.err.invalidQrOrPass'));
      setPass(null);
      setActiveTab('manual'); // Switch to show error
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError(t('verifyPass.err.searchTermRequired'));
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
        setError(t('verifyPass.err.noPassFound'));
        setPass(null);
        return;
      }
      
      // Check if this is a cancelled pass (for checkout)
      if (response.isCancelled) {
        setIsCancelledPass(true);
        setCheckoutQRRemaining(response.checkoutQRRemaining || 0);
        setCheckoutExpiresAt(passData.checkoutQrExpiresAt || null);
        setPass(passData);
        toast.warning(response.message || t('verifyPass.toast.cancelledPassWarning'));
        setLoading(false);
        return;
      }
      
      // For completed/expired/denied passes, skip time validation - just show info
      if (passData.passStatus && ['completed', 'expired', 'denied'].includes(passData.passStatus)) {
        setPass(passData);
        setLoading(false);
        return;
      }
      
      // For non-cancelled passes, validate time window (support multi-day passes)
      const now = new Date();
      const visitDate = new Date(passData.visitDate || now);
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const passDate = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());
      
      // For multi-day passes, check if today is within visit date range
      const visitEndDate = passData.visitEndDate ? new Date(passData.visitEndDate) : null;
      const endPassDate = visitEndDate ? new Date(visitEndDate.getFullYear(), visitEndDate.getMonth(), visitEndDate.getDate()) : passDate;
      
      // Check if today is within valid date range
      if (todayDate.getTime() < passDate.getTime() || todayDate.getTime() > endPassDate.getTime()) {
        const dateRangeStr = visitEndDate 
          ? `${passData.visitDate.split('T')[0]} ${t('common.to')} ${passData.visitEndDate!.split('T')[0]}`
          : passData.visitDate.split('T')[0];
        
        setError(
          `❌ Invalid Visit Date - This pass is valid for: ${dateRangeStr}. Today: ${now.toISOString().split('T')[0]}. Pass can only be used during the scheduled date range.`
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
      
      // Gate Entry module is for ALL outsider passes - apply 5 hour buffer to everyone
      console.log('[MANUAL SEARCH TIME VALIDATION] Applying 5-hour buffer for all passes');
      
      // 1. Allow entry 5 hours before entry time
      expectedEntry.setTime(expectedEntry.getTime() - (5 * 60 * 60 * 1000));
      
      // 2. Allow until midnight (23:59) on exit date
      expectedExit.setHours(23, 59, 59, 999);
      
      const currentTime = now.getTime();
      
      // For multi-day passes, only enforce entry time on the FIRST day
      // On subsequent days, allow entry anytime
      const isFirstDay = todayDate.getTime() === passDate.getTime();
      const isMultiDay = visitEndDate !== null;
      
      // Check time window only for single-day passes or first day of multi-day pass
      if (!isMultiDay || isFirstDay) {
        if (currentTime < expectedEntry.getTime() || currentTime > expectedExit.getTime()) {
          const currentTimeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          setError(
            `⏰ Outside Valid Time Window - Expected Entry: ${passData.expectedEntryTime} (Active 5 hours before), Expected Exit: ${passData.expectedExitTime || 'null'} (Valid until midnight). Current Time: ${currentTimeStr}. Visitor can only enter during the scheduled time window.`
          );
          setPass(null);
          return;
        }
      }
      
      // Time is valid - show pass details
      setPass(passData);
    } catch (err: any) {
      console.error('Verify pass error:', err);
      setError(err.response?.data?.message || t('verifyPass.err.noPassFound'));
      setPass(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAllowEntry = async () => {
    if (!pass) return;
    // Show verification modal instead of directly allowing entry
    entryProcessingRef.current = false; // Reset guard for new verification attempt
    setShowVerificationModal(true);
    setVerificationMethod(null);
    setVerificationCodeInput('');
  };
  
  const handleVerificationMethodSelect = (method: 'qr' | 'code') => {
    setVerificationMethod(method);
    
    if (method === 'qr') {
      // Initialize QR scanner for verification
      setTimeout(async () => {
        if (verifyScannerRef.current) {
          try { await verifyScannerRef.current.stop(); } catch {}
        }
        
        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode('verify-qr-reader');

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            // Guard against double-fire: QR scanner can call back multiple times before stop() completes
            if (entryProcessingRef.current) return;
            entryProcessingRef.current = true;
            confirmAllowEntry();
            scanner.stop().catch(() => {});
          },
          () => {}
        );

        verifyScannerRef.current = scanner;
      }, 200);
    }
  };
  
  const confirmAllowEntry = async (code?: string) => {
    if (!pass) return;

    const currentPassId = pass.passId;
    let entrySucceeded = false;
    try {
      setActionLoading(true);
      entryProcessingRef.current = true;

      const allowResult = await gateEntryService.allowEntry(currentPassId, {
        gate: 'Main Gate',
        remarks: 'Entry verified and allowed',
        verificationCode: code || undefined
      });

      entrySucceeded = true;
      toast.success(t('verifyPass.toast.checkinSuccess'), t('verifyPass.toast.checkinSuccessTitle'));
      if (allowResult?.pass) {
        setPass(allowResult.pass);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('verifyPass.toast.checkinFailed'), t('common.error'));
    } finally {
      setActionLoading(false);
      entryProcessingRef.current = false;
    }

    // Cleanup and refresh — fully isolated so errors never mask the success toast
    if (entrySucceeded) {
      setShowVerificationModal(false);
      setVerificationMethod(null);
      try { if (verifyScannerRef.current) { await verifyScannerRef.current.stop(); } } catch {} finally { verifyScannerRef.current = null; }
      try {
        const response = await gateEntryService.verifyPass(currentPassId, 'passId');
        if (response.pass) setPass(response.pass);
      } catch {}
    }
  };
  
  const handleCodeVerification = () => {
    if (!verificationCodeInput.trim()) {
      toast.warning(t('verifyPass.toast.codeRequired'), t('verifyPass.toast.codeRequiredTitle'));
      return;
    }
    
    if (verificationCodeInput.trim() !== pass?.verificationCode) {
      toast.error(t('verifyPass.toast.invalidCode'), t('verifyPass.toast.invalidCodeTitle'));
      return;
    }
    
    confirmAllowEntry(verificationCodeInput);
  };

  const handleDenyEntry = async () => {
    if (!pass) return;

    const reason = prompt(t('verifyPass.prompt.denyReason'));
    if (!reason) return;

    const currentPassId = pass.passId;
    try {
      setActionLoading(true);
      await gateEntryService.denyEntry(currentPassId, reason);
      
      // Deny succeeded — show toast immediately
      toast.info(t('verifyPass.toast.entryDenied'), t('verifyPass.toast.entryDeniedTitle'));
      
      // Refresh pass data (best-effort)
      try {
        const response = await gateEntryService.verifyPass(currentPassId, 'passId');
        if (response.pass) {
          setPass(response.pass);
        }
      } catch (refreshErr) {
        console.warn('[DENY_ENTRY] Deny succeeded but refresh failed:', refreshErr);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('verifyPass.toast.denyFailed'), t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordExit = async () => {
    if (!pass) return;

    // Check if pass is cancelled - if yes, show verification modal for final checkout
    if (pass.passStatus === 'cancelled' || pass.status === 'cancelled') {
      checkoutProcessingRef.current = false;
      setShowCheckoutVerificationModal(true);
      setCheckoutVerificationMethod(null);
      setCheckoutVerificationCodeInput('');
      return;
    }

    // For checked_in passes, show exit verification modal (same QR/code flow as entry)
    exitProcessingRef.current = false;
    setShowExitVerificationModal(true);
    setExitVerificationMethod(null);
    setExitVerificationCodeInput('');
  };

  const handleExitVerificationMethodSelect = (method: 'qr' | 'code') => {
    setExitVerificationMethod(method);

    if (method === 'qr') {
      setTimeout(async () => {
        if (exitVerifyScannerRef.current) {
          try { await exitVerifyScannerRef.current.stop(); } catch {}
        }

        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode('exit-verify-qr-reader');

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            if (exitProcessingRef.current) return;
            exitProcessingRef.current = true;
            confirmNormalExit();
            scanner.stop().catch(() => {});
          },
          () => {}
        );

        exitVerifyScannerRef.current = scanner;
      }, 200);
    }
  };

  const confirmNormalExit = async (code?: string) => {
    if (!pass) return;

    const currentPassId = pass.passId;
    let exitSucceeded = false;
    try {
      setActionLoading(true);
      exitProcessingRef.current = true;

      const exitResult = await gateEntryService.recordExit(currentPassId, {
        gate: 'Main Gate',
        remarks: 'Exit verified and recorded',
        verificationCode: code || undefined
      });

      exitSucceeded = true;
      toast.success(t('verifyPass.toast.exitSuccess'), t('verifyPass.toast.exitSuccessTitle'));
      if (exitResult?.pass) {
        setPass(exitResult.pass);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('verifyPass.toast.exitFailed'), t('common.error'));
    } finally {
      setActionLoading(false);
      exitProcessingRef.current = false;
    }

    if (exitSucceeded) {
      setShowExitVerificationModal(false);
      setExitVerificationMethod(null);
      try { if (exitVerifyScannerRef.current) { await exitVerifyScannerRef.current.stop(); } } catch {} finally { exitVerifyScannerRef.current = null; }
      try {
        const response = await gateEntryService.verifyPass(currentPassId, 'passId');
        if (response.pass) setPass(response.pass);
      } catch {}
    }
  };

  const handleExitCodeVerification = () => {
    if (!exitVerificationCodeInput.trim()) {
      toast.warning(t('verifyPass.toast.codeRequired'), t('verifyPass.toast.codeRequiredTitle'));
      return;
    }

    if (exitVerificationCodeInput.trim() !== pass?.verificationCode) {
      toast.error(t('verifyPass.toast.invalidCode'), t('verifyPass.toast.invalidCodeTitle'));
      return;
    }

    confirmNormalExit(exitVerificationCodeInput);
  };

  const handleCheckoutVerificationMethodSelect = (method: 'qr' | 'code') => {
    setCheckoutVerificationMethod(method);
    
    if (method === 'qr') {
      // Initialize QR scanner for checkout verification
      setTimeout(async () => {
        if (checkoutVerifyScannerRef.current) {
          try { await checkoutVerifyScannerRef.current.stop(); } catch {}
        }
        
        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode('checkout-verify-qr-reader');

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            // Guard against double-fire
            if (checkoutProcessingRef.current) return;
            checkoutProcessingRef.current = true;
            // Parse checkout QR JSON to extract the new checkout_verification_code.
            // The original pass QR is a plain string (not JSON) — parsing it will throw,
            // leaving checkoutCode undefined so the backend rejects it.
            let checkoutCode: string | undefined;
            try {
              const qrData = JSON.parse(decodedText);
              if (qrData.type === 'CHECKOUT' && qrData.checkout_verification_code) {
                checkoutCode = qrData.checkout_verification_code;
              }
            } catch {}
            if (!checkoutCode) {
              checkoutProcessingRef.current = false;
              toast.error(t('verifyPass.toast.checkoutCodeInvalid'), t('verifyPass.toast.invalidCodeTitle'));
              scanner.stop().catch(() => {});
              return;
            }
            confirmRecordCheckout(checkoutCode);
            scanner.stop().catch(() => {});
          },
          () => {}
        );

        checkoutVerifyScannerRef.current = scanner;
      }, 200);
    }
  };
  
  const confirmRecordExit = async (code?: string) => {
    if (!pass) return;

    const currentPassId = pass.passId;
    let exitSucceeded = false;
    try {
      setActionLoading(true);
      const exitResult = await gateEntryService.recordExit(currentPassId, {
        gate: 'Main Gate',
        remarks: 'Exit verified and recorded',
        verificationCode: code || undefined
      });

      exitSucceeded = true;
      toast.success(t('verifyPass.toast.exitSuccess'), t('verifyPass.toast.exitSuccessTitle'));
      if (exitResult?.pass) {
        setPass(exitResult.pass);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('verifyPass.toast.exitFailed'), t('common.error'));
    } finally {
      setActionLoading(false);
    }

    if (exitSucceeded) {
      setShowCheckoutVerificationModal(false);
      setCheckoutVerificationMethod(null);
      try { if (checkoutVerifyScannerRef.current) { await checkoutVerifyScannerRef.current.stop(); } } catch {} finally { checkoutVerifyScannerRef.current = null; }
      setIsCancelledPass(false);
      setCheckoutQRRemaining(0);
      setCheckoutExpiresAt(null);
      try {
        const response = await gateEntryService.verifyPass(currentPassId, 'passId');
        if (response.pass) setPass(response.pass);
      } catch {}
    }
  };
  
  // For cancelled passes - use the checkout endpoint with NEW verification code
  const confirmRecordCheckout = async (code?: string) => {
    if (!pass) return;

    const currentPassId = pass.passId;
    let checkoutSucceeded = false;
    try {
      setActionLoading(true);
      checkoutProcessingRef.current = true;

      const checkoutResult = await gateEntryService.recordCheckout(currentPassId, {
        gate: 'Main Gate',
        remarks: 'Checkout verified and recorded',
        verificationCode: code || undefined
      });

      checkoutSucceeded = true;
      toast.success(t('verifyPass.toast.exitSuccess'), t('verifyPass.toast.checkoutSuccessTitle'));
      if (checkoutResult?.pass) {
        setPass(checkoutResult.pass);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('verifyPass.toast.checkoutFailed'), t('common.error'));
    } finally {
      setActionLoading(false);
      checkoutProcessingRef.current = false;
    }

    if (checkoutSucceeded) {
      setShowCheckoutVerificationModal(false);
      setCheckoutVerificationMethod(null);
      try { if (checkoutVerifyScannerRef.current) { await checkoutVerifyScannerRef.current.stop(); } } catch {} finally { checkoutVerifyScannerRef.current = null; }
      setIsCancelledPass(false);
      setCheckoutQRRemaining(0);
      setCheckoutExpiresAt(null);
      try {
        const response = await gateEntryService.verifyPass(currentPassId, 'passId');
        if (response.pass) setPass(response.pass);
      } catch {}
    }
  };
  
  const handleCheckoutCodeVerification = () => {
    if (!checkoutVerificationCodeInput.trim()) {
      toast.warning(t('verifyPass.toast.codeRequired'), t('verifyPass.toast.codeRequiredTitle'));
      return;
    }
    
    // Use NEW checkout verification code for cancelled passes
    if (checkoutVerificationCodeInput.trim() !== pass?.checkoutVerificationCode) {
      toast.error(t('verifyPass.toast.checkoutCodeInvalid'), t('verifyPass.toast.invalidCodeTitle'));
      return;
    }
    
    confirmRecordCheckout(checkoutVerificationCodeInput);
  };

  const handleCancelAndCheckout = async () => {
    if (!pass) return;

    try {
      setCancellingPass(true);
      
      const reason = cancelReason.trim() || 'Pass cancelled by guard';
      
      // Cancel the pass
      const cancelResponse = await gateEntryService.cancelPass(pass.passId, reason);
      
      if (cancelResponse.success && cancelResponse.pass) {
        // Update pass data with cancelled pass
        setPass(cancelResponse.pass);
        setIsCancelledPass(true);
        
        // Close cancel modal
        setShowCancelFirstModal(false);
        setCancelReason('');
        
        // For after_check_in: show checkout credentials (new QR + code generated)
        // For from_checked_out: person already outside, no checkout QR needed - just success
        if (cancelResponse.cancellation_type === 'after_check_in') {
          const expiresAt = cancelResponse.pass.checkoutQrExpiresAt || '';
          setCheckoutCredentials({
            checkoutId: cancelResponse.pass.checkoutUniqueId || '',
            checkoutCode: cancelResponse.pass.checkoutVerificationCode || '',
            expiresAt
          });
          setCheckoutExpiresAt(expiresAt || null);
          setShowCheckoutCredentialsModal(true);
        }
        
        toast.success(t('verifyPass.toast.cancelSuccess'), t('verifyPass.toast.cancelSuccessTitle'));
      }
    } catch (err: any) {
      const backendMessage = err.response?.data?.message || '';
      const roomCancelBlocked = backendMessage.toLowerCase().includes('cancel the room');
      toast.error(
        roomCancelBlocked ? t('verifyPass.toast.roomCancelFirst') : (backendMessage || t('verifyPass.toast.cancelFailed')),
        t('common.error')
      );
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
      checked_out: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-orange-100 text-orange-800',
      expired: 'bg-red-100 text-red-800',
      denied: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labelKeys: Record<string, string> = {
      created: 'status.created',
      pending: 'status.pending',
      active: 'status.active',
      checked_in: 'status.checkedIn',
      completed: 'status.completed',
      checked_out: 'status.checkedOut',
      cancelled: 'status.cancelled',
      expired: 'status.expired',
      denied: 'status.denied',
    };
    return labelKeys[status] ? t(labelKeys[status]) : status;
  };

  const canAllowEntry = pass && pass.qrStatus === 'active' && (pass.passStatus === 'created' || pass.passStatus === 'checked_out');
  const canRecordExit = pass && ((pass.passStatus === 'checked_in' || pass.status === 'checked_in'));
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
    <div className="min-h-screen bg-[#f8fafc] p-3 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="relative bg-gradient-to-r from-[#011f4b] via-[#03396c] to-[#005b96] rounded-2xl border border-[#03396c] shadow-[0_12px_28px_rgba(1,31,75,0.28)] p-6 md:p-8 mb-6 animate-fade-in">
          <div className="relative z-10">
            {/* Header with Language Selector */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                  <Shield className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl md:text-4xl font-bold text-white">{t('verifyPass.title')}</h1>
                  <p className="text-[#b3cde0] text-sm md:text-base mt-1">{t('verifyPass.subtitle')}</p>
                </div>
              </div>
              {/* Language Selector */}
              <div className="flex-shrink-0">
                <LanguageSelector />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Card - Master Dashboard Style */}
        <div className={`${cardClass} mb-6 overflow-hidden animate-slide-up`}>
          <div className="border-b border-[#b3cde0] bg-[#f1f5f9]">
            <div className="flex">
              <button
                onClick={() => setActiveTab('manual')}
                className={`flex-1 px-3 md:px-6 py-3 md:py-4 text-center font-bold transition-all transform ${
                  activeTab === 'manual'
                    ? 'border-b-4 border-[#005b96] text-[#005b96] bg-[#b3cde0]/20 scale-105'
                    : 'text-[#6497b1] hover:text-[#03396c] hover:bg-[#b3cde0]/10'
                }`}
              >
                <div className="flex items-center justify-center gap-1 md:gap-2">
                  <Search className={`w-4 h-4 md:w-5 md:h-5 ${activeTab === 'manual' ? 'animate-pulse' : ''}`} />
                  <span className="text-xs md:text-base">{t('verifyPass.manualSearch')}</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('qr')}
                className={`flex-1 px-3 md:px-6 py-3 md:py-4 text-center font-bold transition-all transform ${
                  activeTab === 'qr'
                    ? 'border-b-4 border-[#005b96] text-[#005b96] bg-[#b3cde0]/20 scale-105'
                    : 'text-[#6497b1] hover:text-[#03396c] hover:bg-[#b3cde0]/10'
                }`}
              >
                <div className="flex items-center justify-center gap-1 md:gap-2">
                  <svg className={`w-4 h-4 md:w-5 md:h-5 ${activeTab === 'qr' ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <span className="text-xs md:text-base">{t('verifyPass.qrScan')}</span>
                </div>
              </button>
            </div>
          </div>

          {/* Manual Search Tab */}
          {activeTab === 'manual' && (
            <div className="p-4 md:p-6">
              <div className="grid grid-cols-1 gap-4 md:gap-5 mb-5">
                <div>
                  <label className="block text-sm font-bold text-[#03396c] mb-2 flex items-center gap-2">
                    <Search className="w-4 h-4 text-[#005b96]" />
                    {t('verifyPass.searchBy')}
                  </label>
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value as any)}
                    className={inputClass}
                  >
                    <option value="passId">{t('verifyPass.searchOptions.passId')}</option>
                    <option value="visitorName">{t('verifyPass.searchOptions.visitorName')}</option>
                    <option value="mobile">{t('verifyPass.searchOptions.mobile')}</option>
                    <option value="vehicleNumber">{t('verifyPass.searchOptions.vehicle')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#03396c] mb-2">
                    {searchType === 'passId' && t('verifyPass.enterPassId')}
                    {searchType === 'visitorName' && t('verifyPass.enterVisitorName')}
                    {searchType === 'mobile' && t('verifyPass.enterMobile')}
                    {searchType === 'vehicleNumber' && t('verifyPass.enterVehicle')}
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder={
                        searchType === 'passId' ? t('verifyPass.passIdPlaceholder') :
                        searchType === 'visitorName' ? t('verifyPass.placeholderName') :
                        searchType === 'mobile' ? t('verifyPass.placeholderMobile') :
                        t('verifyPass.placeholderVehicle')
                      }
                      className={`flex-1 ${inputClass}`}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={loading}
                      className="px-5 md:px-7 py-3 bg-[#005b96] text-white rounded-xl hover:bg-[#03396c] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base font-bold"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="hidden md:inline">{t('verifyPass.searching')}</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          <span className="hidden md:inline">{t('verifyPass.search')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-5 p-4 md:p-5 bg-[#b3cde0]/20 border-l-4 border-[#005b96] rounded-xl animate-shake">
                  <div className="flex items-start gap-3">
                    <div className="bg-[#005b96] p-2 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm md:text-base text-[#011f4b] mb-1">{t('verifyPass.err.verificationFailed')}</p>
                      <p className="text-xs md:text-sm text-[#03396c] whitespace-pre-line">{error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QR Code Scan Tab */}
          {activeTab === 'qr' && (
            <div className="p-4 md:p-8">
              <div className="max-w-2xl mx-auto">
                <div className="mb-5 md:mb-6 text-center animate-fade-in">
                  <div className="inline-block bg-gradient-to-br from-[#03396c] to-[#005b96] p-4 rounded-2xl mb-3 shadow-lg">
                    <Camera className="w-6 h-6 md:w-7 md:h-7 text-white" />
                  </div>
                  <h3 className="text-lg md:text-2xl font-bold text-[#011f4b] mb-2">{t('verifyPass.scannerCamera')}</h3>
                  <p className="text-sm md:text-base text-[#6497b1]">{t('verifyPass.positionQR')}</p>
                  {!scannerInitialized && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-blue-600 animate-pulse">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm md:text-base font-bold">{t('verifyPass.qr.initializing')}</span>
                    </div>
                  )}
                </div>

                {/* QR Scanner Container - Library will inject UI here */}
                <div id="qr-reader" ref={qrReaderRef} className="mb-6 rounded-xl overflow-hidden shadow-lg"></div>

                {loading && (
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-xl p-5 mb-6 animate-pulse">
                    <div className="flex items-center justify-center gap-3">
                      <div className="bg-blue-500 p-2 rounded-lg">
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                      </div>
                      <p className="text-blue-800 font-bold text-sm md:text-base">{t('verifyPass.verifying')}</p>
                    </div>
                  </div>
                )}

                <div className="bg-[#b3cde0]/20 border border-[#6497b1] rounded-2xl p-4 md:p-6 shadow-lg animate-slide-up">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-gradient-to-br from-[#03396c] to-[#005b96] p-2 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-bold text-base md:text-lg text-[#011f4b]">{t('verifyPass.qr.instructions')}</h4>
                  </div>
                  <div className="space-y-2.5 md:space-y-3 text-xs md:text-sm text-[#03396c]">
                    <p className="flex items-start gap-3 bg-white p-3 rounded-lg border border-[#b3cde0]">
                      <span className="font-bold text-[#005b96] bg-[#b3cde0]/30 px-2 py-1 rounded-lg">{t('common.step')} 1:</span>
                      <span className="flex-1">{t('verifyPass.qr.step1')}</span>
                    </p>
                    <p className="flex items-start gap-3 bg-white p-3 rounded-lg border border-[#b3cde0]">
                      <span className="font-bold text-[#005b96] bg-[#b3cde0]/30 px-2 py-1 rounded-lg">{t('common.step')} 2:</span>
                      <span className="flex-1">{t('verifyPass.qr.step2')}</span>
                    </p>
                    <p className="flex items-start gap-3 bg-white p-3 rounded-lg border border-[#b3cde0]">
                      <span className="font-bold text-[#005b96] bg-[#b3cde0]/30 px-2 py-1 rounded-lg">{t('common.step')} 3:</span>
                      <span className="flex-1">{t('verifyPass.qr.step3')}</span>
                    </p>
                    <p className="flex items-start gap-3 bg-green-50 border border-green-200 p-3 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="flex-1">{t('verifyPass.qr.tip1')}</span>
                    </p>
                    <p className="flex items-start gap-3 bg-green-50 border border-green-200 p-3 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="flex-1">{t('verifyPass.qr.tip2')}</span>
                    </p>
                    <p className="flex items-start gap-3 bg-blue-50 border border-blue-200 p-3 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="flex-1"><strong>{t('verifyPass.qr.tip3')}</strong></span>
                    </p>
                    <p className="flex items-start gap-3 bg-orange-50 border border-orange-200 p-3 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="flex-1">{t('verifyPass.qr.tip4')}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pass Details Section - Master Dashboard Style */}
        {pass && (
          <div className={`${cardClass} overflow-hidden animate-slide-up`}>
            {/* Status Header */}
            <div className="bg-gradient-to-r from-[#011f4b] via-[#03396c] to-[#005b96] px-4 md:px-6 py-4 md:py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#b3cde0] text-xs md:text-sm font-medium mb-1">{t('verifyPass.details.passId')}</p>
                  <p className="text-white text-lg md:text-2xl font-bold break-all">{pass.passId}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={`px-3 md:px-5 py-1.5 md:py-2 rounded-full ${getStatusColor(pass.passStatus || pass.status)} font-bold text-xs md:text-sm shadow-lg`}>
                    {getStatusLabel(pass.passStatus || pass.status)}
                  </div>
                  {pass.dailyEntries && pass.dailyEntries.length > 0 && (
                    <div className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold text-xs shadow">
                      {t('verifyPass.multiDay.badge')} ({t('verifyPass.multiDay.day')} {pass.dailyEntries.length})
                    </div>
                  )}
                  {/* Currently Inside / Outside Campus indicator */}
                  {pass.passStatus === 'checked_in' && (
                    <div className="px-3 py-1 rounded-full bg-green-500 text-white font-semibold text-xs shadow animate-pulse">
                      🟢 {t('verifyPass.status.insideCampus')}
                    </div>
                  )}
                  {pass.passStatus === 'checked_out' && (
                    <div className="px-3 py-1 rounded-full bg-orange-400 text-white font-semibold text-xs shadow">
                      🔵 {t('verifyPass.status.outsideCampus')}
                    </div>
                  )}
                  {getQRStatusBadge(pass.qrStatus)}
                </div>
              </div>
            </div>

            <div className="p-3 md:p-6">
              {/* Pass Cancelled Before Check-In - No Checkout Required */}
              {isCancelledPass && pass.passStatus === 'cancelled' && pass.cancellationType === 'before_check_in' && (
                <div className="mb-4 md:mb-6 bg-red-50 rounded-lg border-2 border-red-400 p-4 md:p-6">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-7 h-7 md:w-8 md:h-8 text-red-600 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="text-xl md:text-2xl font-bold text-red-900 mb-2">❌ {t('verifyPass.warnings.cancelledBeforeCheckinTitle')}</h3>
                      <p className="text-sm md:text-base text-red-700 font-medium mb-2">
                        {t('verifyPass.warnings.cancelledBeforeCheckinMsg')}
                      </p>
                      <p className="text-xs md:text-sm text-red-600">
                        {t('verifyPass.warnings.cancelledBeforeCheckinNote')}
                      </p>
                    </div>
                  </div>
                  
                  {/* Cancellation Details */}
                  {pass.cancellationTime && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <p className="text-xs md:text-sm text-gray-700">
                        <strong>{t('verifyPass.warnings.cancelledAt')}</strong> {new Date(pass.cancellationTime).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Checkout Warning for Cancelled Pass - After Check-In */}
              {isCancelledPass && pass.passStatus === 'cancelled' && pass.cancellationType === 'after_check_in' && (
                <div className="mb-4 md:mb-6 bg-red-50 rounded-lg border-2 border-red-400 p-4 md:p-6 animate-pulse">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertCircle className="w-7 h-7 md:w-8 md:h-8 text-red-600 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="text-xl md:text-2xl font-bold text-red-900 mb-2">{t('verifyPass.warnings.checkoutRequired')}</h3>
                      <p className="text-sm md:text-base text-red-700 font-medium mb-2">
                        {t('verifyPass.warnings.checkoutMsg')}
                      </p>
                      <p className="text-xs md:text-sm text-red-600">
                        {t('verifyPass.warnings.checkoutNote')}
                      </p>
                    </div>
                  </div>
                  
                  {/* QR Validity Countdown */}
                  <div className="bg-white rounded-lg border-2 border-red-300 p-3 md:p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm text-gray-600 mb-1">{t('verifyPass.warnings.qrValidity')}</p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
                          <span className={`text-xl md:text-3xl font-bold ${getCheckoutTimeRemaining().total <= 5 ? 'text-red-600' : 'text-orange-600'}`}>
                            {getCheckoutTimeRemaining().minutes} min {getCheckoutTimeRemaining().seconds} sec
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        {getCheckoutTimeRemaining().total <= 5 ? (
                          <p className="text-xs md:text-sm font-bold text-red-600">{t('verifyPass.warnings.expiringSoon')}</p>
                        ) : getCheckoutTimeRemaining().total <= 15 ? (
                          <p className="text-xs md:text-sm font-semibold text-orange-600">{t('verifyPass.warnings.lessThan15')}</p>
                        ) : (
                          <p className="text-xs md:text-sm text-green-600">{t('verifyPass.warnings.valid')}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {getCheckoutTimeRemaining().total <= 0 ? t('verifyPass.warnings.expired') : t('verifyPass.warnings.remaining')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cancellation Details if available */}
                  {pass.cancellationTime && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <p className="text-xs md:text-sm text-gray-700">
                        <strong>{t('verifyPass.warnings.cancelledAt')}</strong> {new Date(pass.cancellationTime).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* QR Status Warning - if inactive (only for non-cancelled passes) */}
              {pass.qrStatus === 'inactive' && pass.passStatus !== 'cancelled' && (
                <div className="mb-4 md:mb-6 bg-yellow-50 rounded-lg border border-yellow-300 p-3 md:p-4">
                  <div className="flex items-start gap-2 md:gap-3">
                    <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-bold text-sm md:text-base text-yellow-900 mb-1">{t('verifyPass.warnings.qrNotActiveTitle')}</h4>
                      <p className="text-xs md:text-sm text-yellow-700">
                        {t('verifyPass.warnings.qrNotActiveMsg')} ({pass.entryTime || pass.expectedEntryTime}).
                        {pass.qrActivationTime && (
                          <><br/>{t('verifyPass.warnings.activationTime')} {new Date(pass.qrActivationTime).toLocaleString()}</>
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
                      <h4 className="font-bold text-sm md:text-base text-green-900 mb-1">{t('verifyPass.warnings.qrActive')}</h4>
                      <p className="text-xs md:text-sm text-green-700">
                        {t('verifyPass.warnings.qrActiveMsg')}
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
                    {t('verifyPass.details.visitorInfo')}
                  </h3>
                  <div className="space-y-2 md:space-y-3">
                    {pass.visitorName && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.name')}</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{displayText(pass.visitorName)}</p>
                      </div>
                    )}
                    {pass.mobileNumber && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.mobile')}</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.mobileNumber}</p>
                      </div>
                    )}
                    {pass.email && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.email')}</p>
                        <p className="font-medium text-sm md:text-base text-gray-900 break-all">{pass.email}</p>
                      </div>
                    )}
                    {pass.idProofType && pass.idProofNumber && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.idProof')}</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.idProofType}: {pass.idProofNumber}</p>
                      </div>
                    )}
                    {(pass.gender || pass.age) && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.genderAge')}</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">
                          {pass.gender || '-'} / {pass.age ? `${pass.age} ${t('verifyPass.fields.years')}` : '-'}
                        </p>
                      </div>
                    )}
                    {pass.numberOfPersons && pass.numberOfPersons > 0 && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.persons')}</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.numberOfPersons}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Visit Information Card - LPU Style */}
                <div className="bg-white rounded-lg border border-blue-600 shadow-[0_2px_8px_rgba(21,101,192,0.1)] p-4">
                  <h3 className="font-semibold text-sm md:text-base text-gray-900 flex items-center gap-2 pb-2 mb-3 border-b">
                    <Building className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                    {t('verifyPass.details.visitInfo')}
                  </h3>
                  <div className="space-y-2 md:space-y-3">
                    {pass.purposeOfVisit && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.purpose')}</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.purposeOfVisit === 'other' && pass.purposeOther ? pass.purposeOther : pass.purposeOfVisit}</p>
                      </div>
                    )}
                    {pass.departmentToVisit && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.department')}</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.departmentToVisit}</p>
                      </div>
                    )}
                    {pass.personToMeetName && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.personToMeet')}</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{displayText(pass.personToMeetName)}</p>
                      </div>
                    )}
                    {pass.visitDate && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                          {t('verifyPass.fields.visitDate')}
                        </p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.visitDate.split('T')[0]}</p>
                      </div>
                    )}
                    {(pass.entryTime || pass.expectedEntryTime) && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600 flex items-center gap-1">
                          <Clock className="w-3 h-3 md:w-4 md:h-4" />
                          {t('verifyPass.fields.entryTime')}
                        </p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.entryTime || pass.expectedEntryTime}</p>
                      </div>
                    )}
                    {pass.qrActivationTime && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.qrActivatesAt')}</p>
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
                    {t('verifyPass.details.vehicleInfo')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.vehicleNumber')}</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.vehicleNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.vehicleType')}</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.vehicleType || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.vehicleModel')}</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.vehicleModel || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Information */}
              {(pass.specialInstructions || pass.itemsCarrying) && (
                <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t">
                  <h3 className="font-semibold text-sm md:text-base text-gray-900 pb-2 mb-3 md:mb-4">{t('verifyPass.details.additionalInfo')}</h3>
                  <div className="space-y-2 md:space-y-3">
                    {pass.itemsCarrying && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.itemsCarrying')}</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.itemsCarrying}</p>
                      </div>
                    )}
                    {pass.specialInstructions && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600">{t('verifyPass.fields.specialInstructions')}</p>
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.specialInstructions}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Entry/Exit Times */}
              {(pass.actualEntryTime || pass.actualExitTime) && (
                <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t">
                  <h3 className="font-semibold text-sm md:text-base text-gray-900 pb-2 mb-3 md:mb-4">{t('verifyPass.details.entryExitRecords')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {pass.actualEntryTime && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs md:text-sm text-green-700">{t('verifyPass.fields.actualEntryTime')}</p>
                        <p className="font-semibold text-sm md:text-base text-green-900">{new Date(pass.actualEntryTime).toLocaleString()}</p>
                      </div>
                    )}
                    {pass.actualExitTime && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs md:text-sm text-blue-700">{t('verifyPass.fields.actualExitTime')}</p>
                        <p className="font-semibold text-sm md:text-base text-blue-900">{new Date(pass.actualExitTime).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Entry/Exit History */}
              {pass.dailyEntries && pass.dailyEntries.length > 0 && (
                <div className="mt-4 md:mt-6">
                  <h3 className="font-semibold text-sm md:text-base text-gray-900 mb-3 flex items-center gap-2">
                    📅 {t('verifyPass.multiDay.historyTitle')}
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                      {pass.dailyEntries.length} {pass.dailyEntries.length === 1 ? t('verifyPass.multiDay.cycle') : t('verifyPass.multiDay.cycles')}
                    </span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm">
                      <thead>
                        <tr className="bg-purple-50">
                          <th className="px-3 py-2 text-left font-semibold text-purple-700">#</th>
                          <th className="px-3 py-2 text-left font-semibold text-purple-700">{t('verifyPass.multiDay.date')}</th>
                          <th className="px-3 py-2 text-left font-semibold text-purple-700">{t('verifyPass.multiDay.entryTime')}</th>
                          <th className="px-3 py-2 text-left font-semibold text-purple-700">{t('verifyPass.multiDay.exitTime')}</th>
                          <th className="px-3 py-2 text-left font-semibold text-purple-700">{t('common.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pass.dailyEntries.map((entry, idx) => (
                          <tr key={entry.id} className={`border-b border-gray-100 hover:bg-gray-50 ${!entry.exitTime ? 'bg-green-50' : ''}`}>
                            <td className="px-3 py-2 font-bold text-purple-700">{idx + 1}</td>
                            <td className="px-3 py-2">{new Date(entry.entryDate).toLocaleDateString('en-IN', { timeZone: 'UTC' })}</td>
                            <td className="px-3 py-2 text-green-700 font-medium">
                              ↓ {entry.entryTime ? new Date(entry.entryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                            <td className="px-3 py-2 text-blue-700 font-medium">
                              {entry.exitTime ? `↑ ${new Date(entry.exitTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : <span className="text-green-600 animate-pulse">{t('common.inside')}</span>}
                            </td>
                            <td className="px-3 py-2">
                              {entry.exitTime
                                ? <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">{t('common.exited')}</span>
                                : <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">{t('common.inside')}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Guard Action Section */}
              <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t">
                <div className="bg-[#f1f5f9] border border-[#b3cde0] rounded-lg p-3 md:p-4 mb-3 md:mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm md:text-base text-[#011f4b] flex items-center gap-2">
                      {t('verifyPass.details.guardActions')}
                    </h3>
                    <div className="flex items-center gap-1 text-xs md:text-sm text-[#6497b1]">
                      <Clock className="w-3 h-3 md:w-4 md:h-4" />
                      <span className="font-medium">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <p className="text-xs md:text-sm text-[#6497b1]">
                    {isCancelledPass && pass.cancellationType === 'after_check_in' && t('verifyPass.guard.checkoutMsg')}
                    {isCancelledPass && pass.cancellationType === 'before_check_in' && t('verifyPass.guard.noActionNeededMsg')}
                    {canAllowEntry && !isCancelledPass && t('verifyPass.guard.allowEntryMsg')}
                    {canRecordExit && !isCancelledPass && t('verifyPass.guard.exitOptionsMsg')}
                    {canDenyEntry && !isCancelledPass && t('verifyPass.guard.denyEntryMsg')}
                    {!canAllowEntry && !canRecordExit && !canDenyEntry && !isCancelledPass && t('verifyPass.guard.noActionsMsg')}
                  </p>
                </div>

                <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                  {/* Checkout for Cancelled Pass - After Check-In Only */}
                  {isCancelledPass && pass.passStatus === 'cancelled' && pass.cancellationType === 'after_check_in' && getCheckoutTimeRemaining().total > 0 && (
                    <button
                      onClick={handleRecordExit}
                      disabled={actionLoading}
                      className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all hover:shadow-lg flex items-center justify-center gap-2 md:gap-3 font-bold text-base md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-95"
                    >
                      <AlertCircle className="w-5 h-5 md:w-6 md:h-6" />
                      {actionLoading ? t('verifyPass.actions.processing') : t('verifyPass.actions.recordCheckout')}
                    </button>
                  )}

                  {/* Expired QR Warning - After Check-In Only */}
                  {isCancelledPass && pass.cancellationType === 'after_check_in' && getCheckoutTimeRemaining().total <= 0 && (
                    <div className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-red-100 border-2 border-red-500 text-red-800 rounded-lg text-center font-semibold text-sm md:text-base">
                      {t('verifyPass.actions.qrExpired')}
                    </div>
                  )}

                  {canAllowEntry && pass.qrStatus === 'active' && !isCancelledPass && (
                    <button
                      onClick={handleAllowEntry}
                      disabled={actionLoading}
                      className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all hover:shadow-lg flex items-center justify-center gap-2 md:gap-3 font-bold text-base md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-95"
                    >
                      <CheckCircle className="w-5 h-5 md:w-6 md:h-6" />
                      {actionLoading ? t('verifyPass.actions.processing') : t('verifyPass.actions.allowEntry')}
                    </button>
                  )}

                  {pass.qrStatus === 'inactive' && !isCancelledPass && pass.passStatus !== 'checked_out' && (
                    <div className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-yellow-50 border-2 border-yellow-400 text-yellow-800 rounded-lg text-center font-semibold text-sm md:text-base">
                      {t('verifyPass.actions.qrWillActivate')}
                    </div>
                  )}
                  
                  {canRecordExit && !isCancelledPass && (
                    <>
                      {/* Normal Exit - temporary, can re-enter */}
                      <button
                        onClick={handleRecordExit}
                        disabled={actionLoading}
                        className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all hover:shadow-lg flex items-center justify-center gap-2 md:gap-3 font-bold text-base md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-95"
                      >
                        <LogOut className="w-5 h-5 md:w-6 md:h-6" />
                        {actionLoading ? t('verifyPass.actions.processing') : t('verifyPass.actions.normalExit')}
                      </button>
                      {/* Cancel Pass & Final Checkout */}
                      <button
                        onClick={() => setShowCancelFirstModal(true)}
                        disabled={actionLoading}
                        className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all hover:shadow-lg flex items-center justify-center gap-2 md:gap-3 font-bold text-base md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-95"
                      >
                        <XCircle className="w-5 h-5 md:w-6 md:h-6" />
                        {actionLoading ? t('verifyPass.actions.processing') : t('verifyPass.actions.cancelAndCheckout')}
                      </button>
                    </>
                  )}
                  
                  {canDenyEntry && !isCancelledPass && (
                    <button
                      onClick={handleDenyEntry}
                      disabled={actionLoading}
                      className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all hover:shadow-lg flex items-center justify-center gap-2 md:gap-3 font-bold text-base md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-95"
                    >
                      <XCircle className="w-5 h-5 md:w-6 md:h-6" />
                      {actionLoading ? t('verifyPass.actions.processing') : t('verifyPass.actions.denyEntry')}
                    </button>
                  )}

                  {!canAllowEntry && !canRecordExit && !canDenyEntry && !isCancelledPass && (
                    <div className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-gray-100 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg text-center font-semibold text-sm md:text-base">
                      {pass.status === 'completed' && t('verifyPass.actions.alreadyCompleted')}
                      {pass.status === 'expired' && t('verifyPass.actions.passExpired')}
                      {pass.status === 'rejected' && t('verifyPass.actions.passRejected')}
                      {!['completed', 'expired', 'rejected'].includes(pass.status) && t('verifyPass.actions.noActions')}
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
          <div className="bg-white rounded-2xl border border-[#6497b1] shadow-[0_14px_34px_rgba(1,31,75,0.2)] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#011f4b] to-[#03396c] px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {t('verifyPass.modal.verifyIdentity')}
                </h2>
                <button
                  onClick={() => {
                    setShowVerificationModal(false);
                    setVerificationMethod(null);
                    if (verifyScannerRef.current) {
                      verifyScannerRef.current.stop().catch(() => {});
                      verifyScannerRef.current = null;
                    }
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <p className="text-[#b3cde0] text-sm mt-1">{t('verifyPass.modal.chooseMethod')}</p>
            </div>

            <div className="p-6">
              {!verificationMethod && (
                <>
                  <div className="mb-6">
                    <div className="bg-[#b3cde0]/20 border-l-4 border-[#005b96] p-4 mb-4 rounded-r-lg">
                      <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-[#011f4b]">{t('verifyPass.modal.identityRequired')}</h3>
                          <p className="text-sm text-[#03396c] mt-1">
                            {t('verifyPass.modal.identityMsg')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* QR Code Option */}
                    <button
                      onClick={() => handleVerificationMethodSelect('qr')}
                      className="group relative bg-[#f8fafc] border border-[#b3cde0] hover:border-[#6497b1] rounded-xl p-6 transition-all hover:shadow-lg active:scale-95"
                    >
                      <div className="text-center">
                        <div className="bg-[#005b96] text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <Camera className="w-8 h-8" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">{t('verifyPass.modal.scanQR')}</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {t('verifyPass.modal.scanQRMsg')}
                        </p>
                        <div className="bg-[#005b96] text-white text-xs font-semibold py-2 px-4 rounded-full inline-block">
                          {t('verifyPass.modal.openCamera')}
                        </div>
                      </div>
                    </button>

                    {/* Verification Code Option */}
                    <button
                      onClick={() => handleVerificationMethodSelect('code')}
                      className="group relative bg-[#f8fafc] border border-[#b3cde0] hover:border-[#6497b1] rounded-xl p-6 transition-all hover:shadow-lg active:scale-95"
                    >
                      <div className="text-center">
                        <div className="bg-[#03396c] text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <span className="text-2xl font-bold">123</span>
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">{t('verifyPass.modal.enterCode')}</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {t('verifyPass.modal.enterCodeMsg')}
                        </p>
                        <div className="bg-[#03396c] text-white text-xs font-semibold py-2 px-4 rounded-full inline-block">
                          {t('verifyPass.modal.enterCode')}
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
                          verifyScannerRef.current.stop().catch(() => {});
                          verifyScannerRef.current = null;
                        }
                      }}
                      className="text-[#005b96] hover:text-[#011f4b] font-medium flex items-center gap-2"
                    >
                      ← Back to options
                    </button>
                  </div>
                  
                  <div className="bg-[#b3cde0]/20 border border-[#6497b1] rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-[#011f4b] mb-2 flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      {t('verifyPass.modal.scanVisitorQR')}
                    </h3>
                    <p className="text-sm text-[#03396c]">
                      {t('verifyPass.modal.positionQR')}
                    </p>
                  </div>

                  <div id="verify-qr-reader" ref={verifyQrReaderRef} className="mb-4"></div>
                  
                  {actionLoading && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                        <p className="text-green-800 font-medium">{t('verifyPass.modal.verifyingEntry')}</p>
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
                      className="text-[#005b96] hover:text-[#011f4b] font-medium flex items-center gap-2"
                    >
                      {t('verifyPass.modal.backToOptions')}
                    </button>
                  </div>
                  
                  <div className="bg-[#b3cde0]/20 border border-[#6497b1] rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-[#011f4b] mb-2">
                      {t('verifyPass.modal.enter6Digit')}
                    </h3>
                    <p className="text-sm text-[#03396c]">
                      {t('verifyPass.modal.ask6Digit')}
                    </p>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('verifyPass.modal.verificationCode')}
                    </label>
                    <input
                      type="text"
                      value={verificationCodeInput}
                      onChange={(e) => setVerificationCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={t('verifyPass.modal.enter6DigitPlaceholder')}
                      maxLength={6}
                      className="w-full px-4 py-3 text-2xl font-bold text-center border border-[#b3cde0] rounded-lg focus:ring-2 focus:ring-[#6497b1] focus:border-[#005b96] tracking-widest"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      {t('verifyPass.modal.codeHelp')}
                    </p>
                  </div>

                  <button
                    onClick={handleCodeVerification}
                    disabled={actionLoading || verificationCodeInput.length !== 6}
                    className="w-full bg-[#005b96] hover:bg-[#03396c] text-white font-bold py-4 rounded-lg transition-all hover:shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('verifyPass.modal.verifying')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        {t('verifyPass.modal.verifyAndAllow')}
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
          <div className="bg-white rounded-2xl border border-[#6497b1] shadow-[0_14px_34px_rgba(1,31,75,0.2)] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#011f4b] to-[#03396c] px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {t('verifyPass.checkoutModal.title')}
                </h2>
                <button
                  onClick={() => {
                    setShowCheckoutVerificationModal(false);
                    setCheckoutVerificationMethod(null);
                    if (checkoutVerifyScannerRef.current) {
                      checkoutVerifyScannerRef.current.stop().catch(() => {});
                      checkoutVerifyScannerRef.current = null;
                    }
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <p className="text-[#b3cde0] text-sm mt-1">{t('verifyPass.checkoutModal.subtitle')}</p>
            </div>

            <div className="p-6">
              {!checkoutVerificationMethod && (
                <>
                  <div className="mb-6">
                    <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-4">
                      <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-orange-900">{t('verifyPass.checkoutModal.verificationTitle')}</h3>
                          <p className="text-sm text-orange-700 mt-1">
                            {t('verifyPass.checkoutModal.verificationMsg')}
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
                        <h3 className="font-bold text-lg text-gray-900 mb-2">{t('verifyPass.checkoutModal.scanCheckoutQR')}</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {t('verifyPass.checkoutModal.scanCheckoutMsg')}
                        </p>
                        <div className="bg-red-600 text-white text-xs font-semibold py-2 px-4 rounded-full inline-block">
                          {t('verifyPass.modal.openCamera')}
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
                        <h3 className="font-bold text-lg text-gray-900 mb-2">{t('verifyPass.checkoutModal.enterCheckoutCode')}</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {t('verifyPass.checkoutModal.enterCheckoutCodeMsg')}
                        </p>
                        <div className="bg-orange-600 text-white text-xs font-semibold py-2 px-4 rounded-full inline-block">
                          {t('verifyPass.checkoutModal.enterCheckoutCode')}
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
                          checkoutVerifyScannerRef.current.stop().catch(() => {});
                          checkoutVerifyScannerRef.current = null;
                        }
                      }}
                      className="text-red-600 hover:text-red-800 font-medium flex items-center gap-2"
                    >
                      {t('verifyPass.modal.backToOptions')}
                    </button>
                  </div>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      {t('verifyPass.checkoutModal.scanCheckoutQRTitle')}
                    </h3>
                    <p className="text-sm text-red-700">
                      {t('verifyPass.checkoutModal.scanCheckoutQRMsg')}
                    </p>
                  </div>

                  <div id="checkout-verify-qr-reader" ref={checkoutVerifyQrReaderRef} className="mb-4"></div>
                  
                  {actionLoading && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                        <p className="text-green-800 font-medium">{t('verifyPass.checkoutModal.verifyingExit')}</p>
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
                      {t('verifyPass.modal.backToOptions')}
                    </button>
                  </div>
                  
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                      <span className="text-xl">🔢</span>
                      {t('verifyPass.checkoutModal.enterNewCode')}
                    </h3>
                    <p className="text-sm text-orange-700">
                      {t('verifyPass.checkoutModal.newCodeMsg')}
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('verifyPass.checkoutModal.checkoutCode')}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={checkoutVerificationCodeInput}
                      onChange={(e) => setCheckoutVerificationCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={t('verifyPass.modal.enter6DigitPlaceholder')}
                      maxLength={6}
                      className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 tracking-widest"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      {t('verifyPass.modal.codeHelp')}
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
                        {t('verifyPass.modal.verifying')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        {t('verifyPass.checkoutModal.verifyAndExit')}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Normal Exit Verification Modal */}
      {showExitVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl border border-[#6497b1] shadow-[0_14px_34px_rgba(1,31,75,0.2)] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#011f4b] to-[#03396c] px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {t('verifyPass.exitModal.title')}
                </h2>
                <button
                  onClick={() => {
                    setShowExitVerificationModal(false);
                    setExitVerificationMethod(null);
                    try { if (exitVerifyScannerRef.current) { exitVerifyScannerRef.current.stop().catch(() => {}); exitVerifyScannerRef.current = null; } } catch {}
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <p className="text-[#b3cde0] text-sm mt-1">{t('verifyPass.exitModal.subtitle')}</p>
            </div>

            <div className="p-6">
              {!exitVerificationMethod && (
                <>
                  <div className="mb-6">
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                      <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold text-blue-900">{t('verifyPass.exitModal.verificationTitle')}</h3>
                          <p className="text-sm text-blue-700 mt-1">
                            {t('verifyPass.exitModal.verificationMsg')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => handleExitVerificationMethodSelect('qr')}
                      className="group relative bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-2 border-blue-300 hover:border-blue-500 rounded-xl p-6 transition-all hover:shadow-lg active:scale-95"
                    >
                      <div className="text-center">
                        <div className="bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <Camera className="w-8 h-8" />
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">{t('verifyPass.modal.scanQR')}</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {t('verifyPass.exitModal.scanQRMsg')}
                        </p>
                        <div className="bg-blue-600 text-white text-xs font-semibold py-2 px-4 rounded-full inline-block">
                          {t('verifyPass.modal.openCamera')}
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleExitVerificationMethodSelect('code')}
                      className="group relative bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border-2 border-green-300 hover:border-green-500 rounded-xl p-6 transition-all hover:shadow-lg active:scale-95"
                    >
                      <div className="text-center">
                        <div className="bg-green-600 text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <span className="text-2xl font-bold">123</span>
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">{t('verifyPass.modal.enterCode')}</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {t('verifyPass.exitModal.enterCodeMsg')}
                        </p>
                        <div className="bg-green-600 text-white text-xs font-semibold py-2 px-4 rounded-full inline-block">
                          {t('verifyPass.modal.enterCode')}
                        </div>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {exitVerificationMethod === 'qr' && (
                <div>
                  <div className="mb-4">
                    <button
                      onClick={() => {
                        setExitVerificationMethod(null);
                        try { if (exitVerifyScannerRef.current) { exitVerifyScannerRef.current.stop().catch(() => {}); exitVerifyScannerRef.current = null; } } catch {}
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
                    >
                      {t('verifyPass.modal.backToOptions')}
                    </button>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      {t('verifyPass.exitModal.scanVisitorQR')}
                    </h3>
                    <p className="text-sm text-blue-700">
                      {t('verifyPass.exitModal.positionQR')}
                    </p>
                  </div>

                  <div id="exit-verify-qr-reader" ref={exitVerifyQrReaderRef} className="mb-4"></div>

                  {actionLoading && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                        <p className="text-green-800 font-medium">{t('verifyPass.exitModal.verifyingExit')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {exitVerificationMethod === 'code' && (
                <div>
                  <div className="mb-4">
                    <button
                      onClick={() => setExitVerificationMethod(null)}
                      className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
                    >
                      {t('verifyPass.modal.backToOptions')}
                    </button>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-green-900 mb-2">
                      {t('verifyPass.modal.enter6Digit')}
                    </h3>
                    <p className="text-sm text-green-700">
                      {t('verifyPass.exitModal.ask6Digit')}
                    </p>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('verifyPass.modal.verificationCode')}
                    </label>
                    <input
                      type="text"
                      value={exitVerificationCodeInput}
                      onChange={(e) => setExitVerificationCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={t('verifyPass.modal.enter6DigitPlaceholder')}
                      maxLength={6}
                      className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 tracking-widest"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      {t('verifyPass.modal.codeHelp')}
                    </p>
                  </div>

                  <button
                    onClick={handleExitCodeVerification}
                    disabled={actionLoading || exitVerificationCodeInput.length !== 6}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition-all hover:shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('verifyPass.modal.verifying')}
                      </>
                    ) : (
                      <>
                        <LogOut className="w-5 h-5" />
                        {t('verifyPass.exitModal.verifyAndExit')}
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
          <div className="bg-white rounded-2xl border border-[#6497b1] shadow-[0_14px_34px_rgba(1,31,75,0.2)] max-w-md w-full">
            <div className="bg-gradient-to-r from-[#011f4b] to-[#03396c] px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {t('verifyPass.cancelModal.title')}
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
              <p className="text-[#b3cde0] text-sm mt-1">{t('verifyPass.cancelModal.subtitle')}</p>
            </div>

            <div className="p-6">
              <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="w-6 h-6 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-orange-900 mb-2">{t('verifyPass.cancelModal.mustCancel')}</h3>
                    <p className="text-sm text-orange-700">
                      {t('verifyPass.cancelModal.currentlyCheckedIn')}
                    </p>
                    <ol className="text-sm text-orange-700 mt-2 ml-4 list-decimal space-y-1">
                      <li>{t('verifyPass.cancelModal.step2')}</li>
                      <li>{t('verifyPass.cancelModal.step3')}</li>
                      <li>{t('verifyPass.cancelModal.step4')}</li>
                    </ol>
                  </div>
                </div>
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
                  {t('verifyPass.cancelModal.cancelBtn')}
                </button>
                <button
                  onClick={handleCancelAndCheckout}
                  disabled={cancellingPass}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {cancellingPass ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('verifyPass.cancelModal.cancelling')}
                    </>
                  ) : (
                    <>
                      <X className="w-5 h-5" />
                      {t('verifyPass.cancelModal.confirmBtn')}
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
          <div className="bg-white rounded-2xl border border-[#6497b1] shadow-[0_14px_34px_rgba(1,31,75,0.2)] max-w-lg w-full">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#011f4b] to-[#03396c] px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {t('verifyPass.credModal.title')}
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
                    <h3 className="font-semibold text-green-900 mb-1">{t('verifyPass.credModal.successTitle')}</h3>
                    <p className="text-sm text-green-700">
                      {t('verifyPass.credModal.successMsg')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Checkout Credentials */}
              <div className="space-y-4 mb-6">
                {/* Checkout ID */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">{t('verifyPass.credModal.checkoutId')}</label>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-mono font-bold text-gray-800">{checkoutCredentials.checkoutId}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(checkoutCredentials.checkoutId);
                        toast.success(t('verifyPass.toast.idCopied'), t('verifyPass.toast.copied'));
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {t('verifyPass.credModal.copy')}
                    </button>
                  </div>
                </div>

                {/* Checkout Verification Code */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-5 border-2 border-orange-300">
                  <label className="block text-xs font-semibold text-orange-900 mb-2">
                    {t('verifyPass.credModal.checkoutCodeTitle')}
                  </label>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-4xl font-mono font-bold text-orange-600 tracking-wider">
                      {checkoutCredentials.checkoutCode}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(checkoutCredentials.checkoutCode);
                        toast.success(t('verifyPass.toast.codeCopied'), t('verifyPass.toast.copied'));
                      }}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      {t('verifyPass.credModal.copyCode')}
                    </button>
                  </div>
                  <p className="text-xs text-orange-700 font-medium">
                    {t('verifyPass.credModal.newCodeWarning')}
                  </p>
                </div>

                {/* Expiry Time */}
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <label className="block text-xs font-semibold text-red-900 mb-2">{t('verifyPass.credModal.validUntil')}</label>
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
                  <p className="text-xs text-red-600 mt-1">{t('verifyPass.credModal.validFor1Hour')}</p>
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
                  {t('verifyPass.credModal.closeBtn')}
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
                  {t('verifyPass.credModal.proceedBtn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap with LanguageProvider
export default function VerifyPassPage() {
  return (
    <LanguageProvider>
      <VerifyPassPageContent />
    </LanguageProvider>
  );
}
