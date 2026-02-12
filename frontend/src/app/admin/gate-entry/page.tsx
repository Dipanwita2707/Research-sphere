'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Filter, Download, RefreshCw, Eye, X, Send, 
  CheckCircle, XCircle, Clock, AlertCircle, Calendar, User, Phone, QrCode, Car, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { gateEntryService, type GatePass } from '@/shared/services/gateEntry.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { useToast } from '@/shared/ui-components/Toast';

interface Pass {
  id: string;
  passId: string;
  visitorName: string;
  mobileNumber: string;
  visitorRelation?: string;
  purposeOfVisit: string;
  purposeOther?: string;
  visitDate: string;
  expectedEntryTime: string;
  expectedExitTime: string;
  actualEntryTime?: string;
  actualExitTime?: string;
  status: string;
  hasVehicle: boolean;
  vehicleNumber?: string;
  vehicleType?: string;
  vehicleModel?: string;
  stayRequired?: boolean;
  checkInDate?: string;
  checkOutDate?: string;
  hostelName?: string;
  roomNumber?: string;
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
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  active: { label: 'Active', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  checked_in: { label: 'Checked In', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
  denied: { label: 'Denied', color: 'bg-red-100 text-red-800', icon: XCircle },
  expired: { label: 'Expired', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: X },
};

export default function AllPassesPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedPass, setSelectedPass] = useState<Pass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    fetchStats();
  }, []);

  const fetchPasses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await gateEntryService.getAllPasses();
      setPasses(response.data?.passes || []);
    } catch (err: any) {
      console.error('Error fetching passes:', err);
      setError(err.response?.data?.message || 'Failed to load passes');
      setPasses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await gateEntryService.getStats();
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
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
      const today = new Date().toISOString().split('T')[0];
      const passDate = (pass.visitDate || '').split('T')[0]; // Extract date part from ISO string
      if (dateFilter === 'today') {
        dateMatch = passDate === today;
      } else if (dateFilter === 'upcoming') {
        dateMatch = passDate > today;
      } else if (dateFilter === 'past') {
        dateMatch = passDate < today;
      }

      return searchMatch && statusMatch && dateMatch;
    });
  }, [passes, searchTerm, statusFilter, dateFilter]);

  const handleResendNotification = (pass: Pass) => {
    toast.success(`Notification resent to ${pass.mobileNumber}${pass.email ? ` and ${pass.email}` : ''}`, 'Notification Sent');
  };

  const handleCancelPass = async (passId: string) => {
    if (confirm('Are you sure you want to cancel this pass?')) {
      try {
        await gateEntryService.cancelPass(passId, 'Cancelled by admin');
        toast.success('Pass has been cancelled successfully', 'Pass Cancelled');
        fetchPasses(); // Refresh the list
        fetchStats(); // Refresh stats
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to cancel pass', 'Error');
      }
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
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading gate passes...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Passes</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchPasses();
                fetchStats();
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-3 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-gray-900">📋 All Gate Passes</h1>
              <p className="text-xs md:text-sm text-gray-600 mt-1">
                {(() => {
                  const role = (user?.role?.name || '').toLowerCase();
                  const designation = (user?.employee?.designation || user?.employeeDetails?.designation?.name || '').toLowerCase();
                  const isAdmin = role === 'admin';
                  const isGuard = designation.includes('guard') || designation.includes('security') || designation.includes('volunteer');
                  
                  if (isAdmin) {
                    return '👨‍💼 Admin View: Showing all gate passes';
                  } else if (isGuard) {
                    return '🛡️ Guard View: Showing all gate passes for verification';
                  } else {
                    return '📝 My Passes: Showing only passes created by you';
                  }
                })()}
              </p>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => {
                  fetchPasses();
                  fetchStats();
                }}
                className="px-3 md:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1 md:gap-2 text-sm md:text-base"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <Link
                href="/admin/gate-entry/create-pass"
                className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 md:gap-2 text-sm md:text-base"
              >
                ➕ <span className="hidden sm:inline">Create New Pass</span><span className="sm:hidden">New</span>
              </Link>
            </div>
          </div>

          {/* Stats Cards - LPU Style with thin border all sides */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 mb-6">
            <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] p-3 md:p-4 hover:shadow-[0_6px_20px_rgba(21,101,192,0.25)] transition-shadow">
              <div className="text-xs md:text-sm text-gray-600">Total Passes</div>
              <div className="text-xl md:text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] p-3 md:p-4 hover:shadow-[0_6px_20px_rgba(21,101,192,0.25)] transition-shadow">
              <div className="text-xs md:text-sm text-gray-600">Active Today</div>
              <div className="text-xl md:text-2xl font-bold text-blue-600">{stats.active}</div>
            </div>
            <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] p-3 md:p-4 hover:shadow-[0_6px_20px_rgba(21,101,192,0.25)] transition-shadow">
              <div className="text-xs md:text-sm text-gray-600">Pending</div>
              <div className="text-xl md:text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </div>
            <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] p-3 md:p-4 hover:shadow-[0_6px_20px_rgba(21,101,192,0.25)] transition-shadow">
              <div className="text-xs md:text-sm text-gray-600">Completed</div>
              <div className="text-xl md:text-2xl font-bold text-green-600">{stats.completed}</div>
            </div>
            <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] p-3 md:p-4 hover:shadow-[0_6px_20px_rgba(21,101,192,0.25)] transition-shadow">
              <div className="text-xs md:text-sm text-gray-600">Expired</div>
              <div className="text-xl md:text-2xl font-bold text-red-600">{stats.expired}</div>
            </div>
          </div>
        </div>

        {/* Filters Card - LPU Style */}
        <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] p-3 md:p-4 mb-4 md:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by Pass ID, Name, Mobile, Relation, or Vehicle..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending (Not Completed)</option>
                <option value="active">Active</option>
                <option value="checked_in">Checked In</option>
                <option value="completed">Completed</option>
                <option value="denied">Denied</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200 gap-2">
            <div className="text-xs md:text-sm text-gray-600">
              Showing <span className="font-semibold">{filteredPasses.length}</span> of{' '}
              <span className="font-semibold">{passes.length}</span> passes
            </div>
            <button
              onClick={handleExport}
              className="px-3 md:px-4 py-2 text-xs md:text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export to CSV
            </button>
          </div>
        </div>

        {/* Passes Table - LPU Style Card */}
        <div className="bg-white rounded-lg border border-blue-600 shadow-[0_4px_15px_rgba(21,101,192,0.15)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Pass ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Visitor Details
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Visit Info
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPasses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="w-12 h-12 text-gray-300" />
                        <p>No passes found matching your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPasses.map((pass) => {
                    const statusConfig = STATUS_CONFIG[pass.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                    const StatusIcon = statusConfig.icon;
                    return (
                      <tr key={pass.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <QrCode className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{pass.passId}</div>
                              <div className="text-xs text-gray-500">by {pass.creator?.username || 'System'}</div>
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
                                  👥 {pass.numberOfPersons} persons
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
                                🏠 Multi-day stay: {pass.hostelName}
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
                                  ✓ In: {pass.actualEntryTime}
                                </div>
                              )}
                              {pass.actualExitTime && (
                                <div className="text-xs text-gray-600">
                                  Out: {pass.actualExitTime}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedPass(pass)}
                              className="text-blue-600 hover:text-blue-800"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {(pass.status === 'active' || pass.status === 'pending') && (
                              <>
                                <button
                                  onClick={() => handleResendNotification(pass)}
                                  className="text-green-600 hover:text-green-800"
                                  title="Resend Notification"
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleCancelPass(pass.id)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Cancel Pass"
                                >
                                  <X className="w-4 h-4" />
                                </button>
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
                <h3 className="text-xl font-semibold text-gray-900">Pass Details</h3>
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
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium mt-2 ${STATUS_CONFIG[selectedPass.status as keyof typeof STATUS_CONFIG]?.color || 'bg-gray-100 text-gray-800'}`}>
                    {STATUS_CONFIG[selectedPass.status as keyof typeof STATUS_CONFIG]?.label || selectedPass.status}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="font-semibold text-gray-900 mb-3">Visitor Information</h5>
                    <dl className="space-y-2 text-sm">
                      {selectedPass.visitorName && (
                        <div><dt className="text-gray-600">Name:</dt><dd className="font-medium">{selectedPass.visitorName}</dd></div>
                      )}
                      {selectedPass.mobileNumber && (
                        <div><dt className="text-gray-600">Mobile:</dt><dd className="font-medium">{selectedPass.mobileNumber}</dd></div>
                      )}
                      {selectedPass.email && (
                        <div><dt className="text-gray-600">Email:</dt><dd className="font-medium">{selectedPass.email}</dd></div>
                      )}
                      {selectedPass.visitorRelation && (
                        <div><dt className="text-gray-600">Relation:</dt><dd className="font-medium">{selectedPass.visitorRelation}</dd></div>
                      )}
                      {selectedPass.numberOfPersons && selectedPass.numberOfPersons > 0 && (
                        <div><dt className="text-gray-600">Number of Persons:</dt><dd className="font-medium text-green-600">👥 {selectedPass.numberOfPersons}</dd></div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h5 className="font-semibold text-gray-900 mb-3">Visit Information</h5>
                    <dl className="space-y-2 text-sm">
                      {selectedPass.purposeOfVisit && (
                        <div><dt className="text-gray-600">Purpose:</dt><dd className="font-medium">{selectedPass.purposeOfVisit === 'other' && selectedPass.purposeOther ? selectedPass.purposeOther : selectedPass.purposeOfVisit}</dd></div>
                      )}
                      {selectedPass.visitDate && (
                        <div><dt className="text-gray-600">Date:</dt><dd className="font-medium">{selectedPass.visitDate}</dd></div>
                      )}
                      {(selectedPass.expectedEntryTime || selectedPass.expectedExitTime) && (
                        <div><dt className="text-gray-600">Time:</dt><dd className="font-medium">{selectedPass.expectedEntryTime || '-'} - {selectedPass.expectedExitTime || '-'}</dd></div>
                      )}
                    </dl>
                  </div>

                  {selectedPass.hasVehicle && (
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-3">Vehicle Information</h5>
                      <dl className="space-y-2 text-sm">
                        <div><dt className="text-gray-600">Vehicle Number:</dt><dd className="font-medium">{selectedPass.vehicleNumber || 'N/A'}</dd></div>
                        {selectedPass.vehicleType && (
                          <div><dt className="text-gray-600">Vehicle Type:</dt><dd className="font-medium">{selectedPass.vehicleType}</dd></div>
                        )}
                        {selectedPass.vehicleModel && (
                          <div><dt className="text-gray-600">Vehicle Model:</dt><dd className="font-medium">{selectedPass.vehicleModel}</dd></div>
                        )}
                      </dl>
                    </div>
                  )}

                  {selectedPass.stayRequired && (
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-3">Stay Information</h5>
                      <dl className="space-y-2 text-sm">
                        <div><dt className="text-gray-600">Check-in Date:</dt><dd className="font-medium">{selectedPass.checkInDate || selectedPass.visitDate}</dd></div>
                        <div><dt className="text-gray-600">Check-out Date:</dt><dd className="font-medium">{selectedPass.checkOutDate || 'N/A'}</dd></div>
                        {selectedPass.hostelName && (
                          <div><dt className="text-gray-600">Hostel:</dt><dd className="font-medium">{selectedPass.hostelName}</dd></div>
                        )}
                        {selectedPass.roomNumber && (
                          <div><dt className="text-gray-600">Room Number:</dt><dd className="font-medium">{selectedPass.roomNumber}</dd></div>
                        )}
                      </dl>
                    </div>
                  )}

                  <div>
                    <h5 className="font-semibold text-gray-900 mb-3">Entry/Exit Records</h5>
                    <dl className="space-y-2 text-sm">
                      <div><dt className="text-gray-600">Created At:</dt><dd className="font-medium">{new Date(selectedPass.createdAt).toLocaleString()}</dd></div>
                      <div><dt className="text-gray-600">Created By:</dt><dd className="font-medium">{selectedPass.creator?.username || 'Unknown'}</dd></div>
                      {selectedPass.actualEntryTime && (
                        <div className="text-green-600">
                          <dt>Entry Time:</dt>
                          <dd className="font-medium">
                            {new Date(selectedPass.actualEntryTime).toLocaleString('en-US', { 
                              dateStyle: 'short', 
                              timeStyle: 'short',
                              hour12: true 
                            })}
                          </dd>
                        </div>
                      )}
                      {selectedPass.actualExitTime && (
                        <div className="text-gray-600">
                          <dt>Exit Time:</dt>
                          <dd className="font-medium">
                            {new Date(selectedPass.actualExitTime).toLocaleString('en-US', { 
                              dateStyle: 'short', 
                              timeStyle: 'short',
                              hour12: true 
                            })}
                          </dd>
                        </div>
                      )}
                      {selectedPass.actualEntryTime && selectedPass.actualExitTime && (
                        <div className="text-blue-600">
                          <dt>Total Duration:</dt>
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

              <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
                <button
                  onClick={() => handleResendNotification(selectedPass)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Resend Notification
                </button>
                <button
                  onClick={() => setSelectedPass(null)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
