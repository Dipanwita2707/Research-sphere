'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle, XCircle, User, Calendar, Clock, Car, Building, AlertCircle, Loader2, Camera } from 'lucide-react';
import { gateEntryService } from '@/shared/services/gateEntry.service';
// @ts-ignore - html5-qrcode doesn't have type definitions
import { Html5QrcodeScanner } from 'html5-qrcode';
import './qr-scanner.css';

interface Pass {
  id: string;
  passId: string;
  visitorName: string;
  mobileNumber: string;
  email: string;
  idProofType: string;
  idProofNumber: string;
  gender: string;
  age: number;
  purposeOfVisit: string;
  departmentToVisit: string;
  personToMeetName: string;
  visitDate: string;
  expectedEntryTime: string;
  expectedExitTime: string;
  actualEntryTime?: string;
  actualExitTime?: string;
  hasVehicle: boolean;
  vehicleType?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  numberOfPersons: number;
  status: string;
  specialInstructions?: string;
  itemsCarrying?: string;
}

export default function VerifyPassPage() {
  const [activeTab, setActiveTab] = useState<'manual' | 'qr'>('manual');
  const [searchType, setSearchType] = useState<'passId' | 'mobile' | 'visitorName' | 'vehicleNumber'>('passId');
  const [searchTerm, setSearchTerm] = useState('');
  const [pass, setPass] = useState<Pass | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [scannerInitialized, setScannerInitialized] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const qrReaderRef = useRef<HTMLDivElement>(null);

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
      
      // Validate time window
      const now = new Date();
      const visitDate = new Date(passData.visitDate);
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const passDate = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());
      
      // Check if today is the visit date
      if (passDate.getTime() !== todayDate.getTime()) {
        setError(
          `❌ Invalid Visit Date\n\n` +
          `This pass is scheduled for: ${passData.visitDate.split('T')[0]}\n` +
          `Today's date: ${now.toISOString().split('T')[0]}\n\n` +
          `Pass can only be used on the scheduled visit date.`
        );
        setPass(null);
        setActiveTab('manual');
        return;
      }
      
      // Parse expected entry and exit times
      const [entryHour, entryMin] = passData.expectedEntryTime.split(':').map(Number);
      const [exitHour, exitMin] = passData.expectedExitTime.split(':').map(Number);
      
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
      
      // Validate time window
      const now = new Date();
      const visitDate = new Date(passData.visitDate);
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const passDate = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());
      
      // Check if today is the visit date
      if (passDate.getTime() !== todayDate.getTime()) {
        setError(
          `❌ Invalid Visit Date - This pass is scheduled for: ${passData.visitDate.split('T')[0]}. Today: ${now.toISOString().split('T')[0]}. Pass can only be used on the scheduled visit date.`
        );
        setPass(null);
        return;
      }
      
      // Parse expected entry and exit times
      const [entryHour, entryMin] = passData.expectedEntryTime.split(':').map(Number);
      const [exitHour, exitMin] = passData.expectedExitTime.split(':').map(Number);
      
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

    try {
      setActionLoading(true);
      await gateEntryService.allowEntry(pass.passId, {
        gate: 'Main Gate',
        remarks: 'Entry verified and allowed'
      });
      
      // Refresh pass data
      const response = await gateEntryService.verifyPass(pass.passId, 'passId');
      setPass(response.pass);
      alert('✅ Entry Allowed Successfully!\n\nVisitor has been checked in.');
    } catch (err: any) {
      alert('❌ Error: ' + (err.response?.data?.message || 'Failed to allow entry'));
    } finally {
      setActionLoading(false);
    }
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
      alert('🚫 Entry Denied\n\nPass has been marked as denied.');
    } catch (err: any) {
      alert('❌ Error: ' + (err.response?.data?.message || 'Failed to deny entry'));
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
      alert('✅ Exit Recorded Successfully!\n\nVisitor has been checked out.');
    } catch (err: any) {
      alert('❌ Error: ' + (err.response?.data?.message || 'Failed to record exit'));
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
    <div className="min-h-screen bg-gray-50 p-3 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            🔍 Pass Verification
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">Guard interface for visitor pass verification and entry management</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-4 md:mb-6">
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

        {/* Pass Details Section */}
        {pass && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
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
              {/* Time Validation Success Notice */}
              <div className="mb-4 md:mb-6 p-3 md:p-4 bg-green-50 border-2 border-green-200 rounded-lg">
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

              <div className="grid grid-cols-1 gap-4 md:gap-6">
                {/* Visitor Information */}
                <div className="space-y-3 md:space-y-4">
                  <h3 className="font-semibold text-sm md:text-base text-gray-900 flex items-center gap-2 pb-2 border-b">
                    <User className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                    Visitor Information
                  </h3>
                  <div className="space-y-2 md:space-y-3">
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Name</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.visitorName}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Mobile</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.mobileNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Email</p>
                      <p className="font-medium text-sm md:text-base text-gray-900 break-all">{pass.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">ID Proof</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.idProofType}: {pass.idProofNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Gender / Age</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.gender} / {pass.age} years</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Number of Persons</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.numberOfPersons}</p>
                    </div>
                  </div>
                </div>

                {/* Visit Information */}
                <div className="space-y-3 md:space-y-4">
                  <h3 className="font-semibold text-sm md:text-base text-gray-900 flex items-center gap-2 pb-2 border-b">
                    <Building className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                    Visit Information
                  </h3>
                  <div className="space-y-2 md:space-y-3">
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Purpose</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.purposeOfVisit}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Department</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.departmentToVisit}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-600">Person to Meet</p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.personToMeetName}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-600 flex items-center gap-1">
                        <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                        Visit Date
                      </p>
                      <p className="font-medium text-sm md:text-base text-gray-900">{pass.visitDate.split('T')[0]}</p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-600 flex items-center gap-1">
                        <Clock className="w-3 h-3 md:w-4 md:h-4" />
                        Time Slot
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm md:text-base text-gray-900">{pass.expectedEntryTime} - {pass.expectedExitTime}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Valid Time
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle Information */}
              {pass.hasVehicle && (
                <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t">
                  <h3 className="font-semibold text-sm md:text-base text-gray-900 flex items-center gap-2 pb-2 mb-3 md:mb-4">
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
    </div>
  );
}
