'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle, XCircle, User, Calendar, Clock, Car, Building, AlertCircle, Loader2, Camera } from 'lucide-react';
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
  
  // Verification modal states
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<'qr' | 'code' | null>(null);
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const verifyQrReaderRef = useRef<HTMLDivElement>(null);
  const verifyScannerRef = useRef<Html5QrcodeScanner | null>(null);

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

  const handleQRScan = async (scannedData: string) => {
    try {
      setLoading(true);
      setError(null);
      setPass(null);
      
      // Extract pass ID from QR code data
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

      const response = await gateEntryService.verifyPass(searchTerm, searchType);
      const passData = response.pass;
      
      if (!passData) {
        setError('No pass found matching your search criteria');
        setPass(null);
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-blue-100 text-blue-800',
      checked_in: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      denied: 'bg-red-100 text-red-800',
      expired: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Active',
      checked_in: 'Checked In',
      completed: 'Completed',
      denied: 'Denied',
      expired: 'Expired',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  };

  const canAllowEntry = pass && ['active'].includes(pass.status);
  const canRecordExit = pass && ['checked_in'].includes(pass.status);
  const canDenyEntry = pass && ['active'].includes(pass.status);

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
                <div className={`px-2 md:px-4 py-1 md:py-2 rounded-full ${getStatusColor(pass.status)} font-semibold text-xs md:text-sm`}>
                  {getStatusLabel(pass.status)}
                </div>
              </div>
            </div>

            <div className="p-3 md:p-6">
              {/* Time Validation Success Notice - LPU Style */}
              <div className="mb-4 md:mb-6 bg-white rounded-lg border border-blue-600 shadow-[0_2px_8px_rgba(21,101,192,0.1)] p-3 md:p-4">
                <div className="flex items-start gap-2 md:gap-3">
                  <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-bold text-sm md:text-base text-green-900 mb-1">✅ Pass Verified - Time Valid</h4>
                    <p className="text-xs md:text-sm text-green-700">
                      Current time is within the scheduled visit window. Please verify visitor ID proof and details below before allowing entry.
                    </p>
                  </div>
                </div>
              </div>

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
                    {(pass.expectedEntryTime || pass.expectedExitTime) && (
                      <div>
                        <p className="text-xs md:text-sm text-gray-600 flex items-center gap-1">
                          <Clock className="w-3 h-3 md:w-4 md:h-4" />
                          Time Slot
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm md:text-base text-gray-900">{pass.expectedEntryTime || '-'} - {pass.expectedExitTime || '-'}</p>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Valid Time
                          </span>
                        </div>
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
                    {canAllowEntry && "✅ Verify visitor ID proof before allowing entry"}
                    {canRecordExit && "✅ Confirm visitor is leaving premises"}
                    {canDenyEntry && "⚠️ Deny entry if verification fails"}
                    {!canAllowEntry && !canRecordExit && !canDenyEntry && "ℹ️ No actions available - pass already processed"}
                  </p>
                </div>

                <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                  {canAllowEntry && (
                    <button
                      onClick={handleAllowEntry}
                      disabled={actionLoading}
                      className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all hover:shadow-lg flex items-center justify-center gap-2 md:gap-3 font-bold text-base md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-95"
                    >
                      <CheckCircle className="w-5 h-5 md:w-6 md:h-6" />
                      {actionLoading ? 'Processing...' : 'Allow Entry'}
                    </button>
                  )}
                  
                  {canRecordExit && (
                    <button
                      onClick={handleRecordExit}
                      disabled={actionLoading}
                      className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all hover:shadow-lg flex items-center justify-center gap-2 md:gap-3 font-bold text-base md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-95"
                    >
                      <CheckCircle className="w-5 h-5 md:w-6 md:h-6" />
                      {actionLoading ? 'Processing...' : 'Record Exit'}
                    </button>
                  )}
                  
                  {canDenyEntry && (
                    <button
                      onClick={handleDenyEntry}
                      disabled={actionLoading}
                      className="flex-1 px-4 md:px-8 py-3 md:py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all hover:shadow-lg flex items-center justify-center gap-2 md:gap-3 font-bold text-base md:text-lg disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-95"
                    >
                      <XCircle className="w-5 h-5 md:w-6 md:h-6" />
                      {actionLoading ? 'Processing...' : 'Deny Entry'}
                    </button>
                  )}

                  {!canAllowEntry && !canRecordExit && !canDenyEntry && (
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
    </div>
  );
}
