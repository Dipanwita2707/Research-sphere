'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { 
  FileText, 
  Download, 
  Filter, 
  Search, 
  RefreshCw, 
  Calendar,
  BarChart3,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Mail,
  Plus,
  Trash2,
  Edit,
  Eye,
  ChevronLeft,
  ChevronRight,
  Activity,
  Shield,
  Database,
  LogIn,
  LogOut,
  Upload
} from 'lucide-react';
import { auditService, AuditLog, AuditStatistics, AuditReportConfig, FilterOptions } from '@/shared/services/audit.service';
import RecipientModal from '@/shared/ui-components/RecipientModal';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';

type TabType = 'logs' | 'statistics' | 'reports' | 'recipients';

const SEVERITY_COLORS: Record<string, string> = {
  DEBUG: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  INFO: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  WARNING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  CRITICAL: 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
};

const ACTION_TYPE_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  LOGIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  LOGOUT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  APPROVE: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  REJECT: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  EXPORT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
};

export default function AuditLogsPage() {
  const { addToast } = useToast();
  const { confirmDelete, confirmAction } = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);
  const [recipients, setRecipients] = useState<AuditReportConfig[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    module: '',
    performedBy: '',
    actionType: '',
    severity: '',
    status: '',
    startDate: '',
    endDate: '',
    sortBy: 'createdAt',
    sortOrder: 'desc' as 'asc' | 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<AuditReportConfig | null>(null);
  const [showLogDetail, setShowLogDetail] = useState<AuditLog | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Load filter options on mount
  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Load data when tab or filters change
  useEffect(() => {
    if (activeTab ===
   'logs') {
      loadLogs();
    } else if (activeTab ===
   'statistics') {
      loadStatistics();
    } else if (activeTab ===
   'recipients') {
      loadRecipients();
    }
  }, [activeTab, page, limit, filters]);

  const loadFilterOptions = async () => {
    try {
      const response = await auditService.getFilterOptions();
      if (response.success) {
        setFilterOptions(response.data);
      }
    } catch (err: unknown) {
      logger.error('Failed to load filter options:', err);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await auditService.getLogs({
        page,
        limit,
        ...filters
      });

      if (response.success) {
        setLogs(response.data);
        setTotalPages(response.pagination.totalPages);
        setTotal(response.pagination.total);
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      setLoading(true);
      // Default to last 30 days if no dates specified
      const endDate = filters.endDate || new Date().toISOString();
      const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const response = await auditService.getStatistics(startDate, endDate);
      if (response.success) {
        setStatistics(response.data);
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadRecipients = async () => {
    try {
      setLoading(true);
      const response = await auditService.getRecipients();
      if (response.success) {
        setRecipients(response.data);
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      await auditService.exportLogs({
        ...filters,
        format,
      });
    } catch (err: unknown) {
      addToast({ type: 'error', message: 'Failed to export: ' + extractErrorMessage(err) });
    }
  };

  const handleDeleteRecipient = async (id: string) => {
    const confirmed = await confirmDelete('Delete Recipient', 'Are you sure you want to delete this recipient?');
    if (!confirmed) return;

    try {
      await auditService.deleteRecipient(id);
      loadRecipients();
    } catch (err: unknown) {
      addToast({ type: 'error', message: 'Failed to delete: ' + extractErrorMessage(err) });
    }
  };

  const handleSaveRecipient = async (data: Partial<AuditReportConfig>) => {
    const response = await auditService.saveRecipient(data);
    if (!response.success) {
      throw new Error(response.message || 'Failed to save recipient');
    }
    loadRecipients();
  };

  const handleSendManualReport = async () => {
    try {
      // Get recipients first
      const recipientsData = await auditService.getRecipients();
      const activeRecipients = recipientsData.data?.filter((r: any) => r.isActive) || [];
      
      if (activeRecipients.length ===
   0) {
        addToast({ type: 'warning', message: 'No active recipients configured. Please add recipients in the Recipients tab first.' });
        return;
      }

      // Use current date filters or default to last 30 days
      let startDate = filters.startDate;
      let endDate = filters.endDate;
      
      if (!startDate || !endDate) {
        // Default to last 30 days if no filters set
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        startDate = start.toISOString().split('T')[0];
        endDate = end.toISOString().split('T')[0];
      }

      const recipientEmails = activeRecipients.map((r: any) => r.email);
      const confirmMsg = `Send audit report to ${recipientEmails.length} recipient(s)?\n\n` +
        `Date Range: ${startDate} to ${endDate}\n` +
        `Recipients: ${recipientEmails.join(', ')}\n\n` +
        `Click OK to send now.`;
      
      const confirmed = await confirmAction('Send Report', confirmMsg);
      if (!confirmed) return;

      setSendingEmail(true);
      
      // Use generateReport with sendEmail=true to send with custom dates
      const data = await auditService.generateReport({
        startDate,
        endDate,
        reportType: 'custom',
        sendEmail: true,
        recipientEmails
      });
      
      if (data.success) {
        addToast({ type: 'success', message: `Report sent successfully to ${recipientEmails.length} recipient(s)! Logs included: ${data.logCount || 'N/A'}. Date range: ${startDate} to ${endDate}` });
      } else {
        addToast({ type: 'error', message: 'Failed to send report: ' + data.message });
      }
    } catch (err: unknown) {
      logger.error('Error sending manual report:', err);
      addToast({ type: 'error', message: 'Failed to send email: ' + extractErrorMessage(err) });
    } finally {
      setSendingEmail(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      module: '',
      performedBy: '',
      actionType: '',
      severity: '',
      status: '',
      startDate: '',
      endDate: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    setPage(1);
    setLimit(25);
  };

  const renderLogs = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search actions..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters 
                ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>

          <button
            onClick={() => loadLogs()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>

          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Module</label>
              <select
                value={filters.module}
                onChange={(e) => setFilters(prev => ({ ...prev, module: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Modules</option>
                <option value="event">Events</option>
                <option value="dsw">DSW</option>
                <option value="notes">Notes</option>
                {filterOptions?.modules.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Action Type</label>
              <select
                value={filters.actionType}
                onChange={(e) => setFilters(prev => ({ ...prev, actionType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="READ">View</option>
                {filterOptions?.actionTypes?.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Performed By</label>
              <input
                list="audit-performers"
                value={filters.performedBy}
                onChange={(e) => setFilters(prev => ({ ...prev, performedBy: e.target.value }))}
                placeholder="All users"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <datalist id="audit-performers">
                {filterOptions?.performers?.map((performer) => (
                  <option key={performer} value={performer} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                {filterOptions?.statuses?.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Severity</label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Severities</option>
                {filterOptions?.severities.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rows / Page</label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="col-span-2 md:col-span-4 lg:col-span-8 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      sortBy: 'createdAt',
                      sortOrder: prev.sortOrder === 'desc' ? 'asc' : 'desc',
                    }))
                  }
                >
                  Timestamp {filters.sortOrder === 'desc' ? '▼' : '▲'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Module</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Performed By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IP Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      log.module === 'event'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                        : log.module === 'dsw'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                          : log.module === 'notes'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {(log.module || '-').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${ACTION_TYPE_COLORS[log.actionType] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {log.actionType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-md">
                    <div className="truncate" title={log.description || log.action}>
                      {log.description || log.action}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={log.entityName || ''}>
                      {log.entityName || log.entityId || log.targetId || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-semibold">
                        {(log.performedByName || log.actor?.employeeDetails?.displayName || log.actor?.uid || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-gray-900 dark:text-white">
                          {log.performedByName || log.actor?.employeeDetails?.displayName || log.actor?.uid || 'SYSTEM'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {log.actor?.email || ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {log.performedByRole || log.actor?.role || 'SYSTEM'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {log.ipAddress || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      (log.status || '').toLowerCase() === 'failed' || (log.responseStatus || 0) >= 400
                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    }`}>
                      {(log.status || ((log.responseStatus || 0) >= 400 ? 'failed' : 'success')).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setShowLogDetail(log)}
                      className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {logs.length} of {total} logs
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page ===
   1}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page ===
   totalPages}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStatistics = () => (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <button
            onClick={loadStatistics}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Load Statistics
          </button>
        </div>
      </div>

      {statistics && (
        <>
          {/* Summary Cards - Enhanced Design */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl shadow-lg border border-blue-200 dark:border-blue-700 p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                  <Activity className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {statistics.totalLogs.toLocaleString()}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Logs</div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-2xl shadow-lg border border-red-200 dark:border-red-700 p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                  <AlertCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {statistics.errorCount}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Errors</div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-2xl shadow-lg border border-green-200 dark:border-green-700 p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                  <Database className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {statistics.byModule.length}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Active Modules</div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl shadow-lg border border-purple-200 dark:border-purple-700 p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                  <Users className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {statistics.topActors.length}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Active Users</div>
            </div>
          </div>

          {/* Charts Grid - Enhanced Design */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Module */}
            <div className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Database className="w-6 h-6 text-blue-600" />
                Activity by Module
              </h3>
              <div className="space-y-4">
                {(() => {
                  // Group modules and sum counts, with proper naming
                  const moduleMap = new Map();
                  const moduleNames: Record<string, string> = {
                    'auth': '🔐 Authentication',
                    'ipr': '💡 IPR & Patents',
                    'IPR': '💡 IPR & Patents',
                    'research': '📝 Research Papers',
                    'admin': '⚙️ Administration',
                    'system': '🖥️ System',
                    'report': '📊 Reports',
                    'user': '👤 User Management',
                    'book': '📚 Books & Chapters',
                    'conference': '🎤 Conferences',
                    'grant': '💰 Grants',
                    'finance': '💳 Finance',
                    'drd': '🔬 R&D Department'
                  };

                  statistics.byModule.forEach((item: any) => {
                    const moduleLower = (item.module || 'unknown').toLowerCase();
                    const displayName = moduleNames[moduleLower] || `📂 ${item.module || 'Other'}`;
                    const current = moduleMap.get(displayName) || 0;
                    moduleMap.set(displayName, current + item.count);
                  });

                  // Convert to array and sort by count
                  const sortedModules = Array.from(moduleMap.entries())
                    .map(([module, count]) => ({ module, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10); // Show top 10

                  return sortedModules.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-40 text-sm text-gray-700 dark:text-gray-300 truncate font-medium">
                        {item.module}
                      </div>
                      <div className="flex-1 h-5 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                          style={{ width: `${(item.count / statistics.totalLogs) * 100}%` }}
                        />
                      </div>
                      <div className="w-16 text-sm text-gray-900 dark:text-white text-right font-semibold">
                        {item.count}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* By Action Type */}
            <div className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Activity className="w-6 h-6 text-green-600" />
                Activity by Action Type
              </h3>
              <div className="space-y-4">
                {(() => {
                  // Map action types to Lucide icons
                  const actionIconComponents: Record<string, any> = {
                    'CREATE': Plus,
                    'UPDATE': Edit,
                    'DELETE': Trash2,
                    'LOGIN': LogIn,
                    'LOGOUT': LogOut,
                    'APPROVE': CheckCircle,
                    'REJECT': XCircle,
                    'EXPORT': Download,
                    'READ': Eye,
                    'UPLOAD': Upload,
                    'EMAIL_SENT': Mail,
                    'STATUS_CHANGE': RefreshCw
                  };

                  const actionColors: Record<string, { bg: string; text: string; gradient: string }> = {
                    'CREATE': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', gradient: 'from-green-500 to-green-400' },
                    'UPDATE': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', gradient: 'from-blue-500 to-blue-400' },
                    'DELETE': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', gradient: 'from-red-500 to-red-400' },
                    'LOGIN': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', gradient: 'from-purple-500 to-purple-400' },
                    'LOGOUT': { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', gradient: 'from-gray-500 to-gray-400' },
                    'APPROVE': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', gradient: 'from-emerald-500 to-emerald-400' },
                    'REJECT': { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400', gradient: 'from-rose-500 to-rose-400' },
                    'EXPORT': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400', gradient: 'from-indigo-500 to-indigo-400' },
                    'READ': { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400', gradient: 'from-cyan-500 to-cyan-400' },
                    'UPLOAD': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', gradient: 'from-orange-500 to-orange-400' },
                    'EMAIL_SENT': { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400', gradient: 'from-pink-500 to-pink-400' },
                    'STATUS_CHANGE': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', gradient: 'from-amber-500 to-amber-400' }
                  };

                  // Filter out "OTHER" if it's too dominant and show meaningful actions
                  const filteredActions = statistics.byActionType
                    .filter((item: any) => item.actionType !== 'OTHER')
                    .slice(0, 9);

                  return filteredActions.map((item: any, idx: number) => {
                    const IconComponent = actionIconComponents[item.actionType] || Activity;
                    const colors = actionColors[item.actionType] || { 
                      bg: 'bg-gray-100 dark:bg-gray-700', 
                      text: 'text-gray-600 dark:text-gray-400', 
                      gradient: 'from-gray-500 to-gray-400' 
                    };
                    
                    return (
                      <div key={idx} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all duration-200">
                        <div className={`p-2 ${colors.bg} rounded-lg flex-shrink-0`}>
                          <IconComponent className={`w-5 h-5 ${colors.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                            {item.actionType.replace(/_/g, ' ')}
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full transition-all duration-700 ease-out`}
                              style={{ width: `${(item.count / statistics.totalLogs) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <div className={`px-3 py-1 ${colors.bg} rounded-full`}>
                            <span className={`text-sm font-bold ${colors.text}`}>
                              {item.count}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Severity Distribution */}
            <div className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
                Severity Distribution
              </h3>
              <div className="space-y-4">
                {statistics.bySeverity.map((item: any, idx: number) => {
                  const severityInfo: Record<string, { icon: string; gradient: string }> = {
                    'DEBUG': { icon: '🐛', gradient: 'from-gray-500 to-gray-400' },
                    'INFO': { icon: 'ℹ️', gradient: 'from-blue-500 to-blue-400' },
                    'WARNING': { icon: '⚠️', gradient: 'from-yellow-500 to-amber-400' },
                    'ERROR': { icon: '❌', gradient: 'from-red-500 to-red-400' },
                    'CRITICAL': { icon: '🚨', gradient: 'from-red-600 to-rose-500' }
                  };

                  const info = severityInfo[item.severity] || { icon: '📌', gradient: 'from-gray-500 to-gray-400' };

                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <span className={`px-3 py-1 text-xs rounded-full font-medium flex items-center gap-1 ${SEVERITY_COLORS[item.severity]}`}>
                        <span>{info.icon}</span>
                        {item.severity}
                      </span>
                      <div className="flex-1 h-5 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${info.gradient} rounded-full transition-all duration-500`}
                          style={{ width: `${(item.count / statistics.totalLogs) * 100}%` }}
                        />
                      </div>
                      <div className="w-16 text-sm text-gray-900 dark:text-white text-right font-semibold">
                        {item.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Users */}
            <div className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Users className="w-6 h-6 text-purple-600" />
                Top Active Users
              </h3>
              <div className="space-y-3">
                {statistics.topActors.slice(0, 8).map((actor: any, idx: number) => {
                  const badges = ['🥇', '🥈', '🥉'];
                  const badge = idx < 3 ? badges[idx] : `${idx + 1}`;
                  const bgColors = ['bg-yellow-100 dark:bg-yellow-900', 'bg-gray-100 dark:bg-gray-700', 'bg-orange-100 dark:bg-orange-900'];
                  const bgColor = idx < 3 ? bgColors[idx] : 'bg-blue-100 dark:bg-blue-900';

                  return (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center text-sm font-bold`}>
                        {badge}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {actor.actorName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {actor.email || 'N/A'}
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-full">
                        <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                          {actor.count}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderRecipients = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Audit Report Recipients</h3>
        <button
          onClick={() => {
            setEditingRecipient(null);
            setShowRecipientModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Recipient
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Monthly</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Weekly</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Daily</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {recipients.map((recipient) => (
              <tr key={recipient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{recipient.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{recipient.email}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{recipient.role}</td>
                <td className="px-4 py-3 text-center">
                  {recipient.receiveMonthly ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <XCircle className="w-5 h-5 text-gray-300 mx-auto" />}
                </td>
                <td className="px-4 py-3 text-center">
                  {recipient.receiveWeekly ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <XCircle className="w-5 h-5 text-gray-300 mx-auto" />}
                </td>
                <td className="px-4 py-3 text-center">
                  {recipient.receiveDaily ? <CheckCircle className="w-5 h-5 text-green-500 mx-auto" /> : <XCircle className="w-5 h-5 text-gray-300 mx-auto" />}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    recipient.isActive 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  }`}>
                    {recipient.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        setEditingRecipient(recipient);
                        setShowRecipientModal(true);
                      }}
                      className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRecipient(recipient.id)}
                      className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {recipients.length ===
   0 && (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No recipients configured</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">Add recipients to receive audit reports</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 transition-colors duration-200">
      {/* Header */}
      <div className="bg-ResearchSphere-gradient dark:bg-gradient-to-r dark:from-blue-900 dark:via-blue-800 dark:to-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-lg">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Audit Logs</h1>
                <p className="opacity-90">Monitor system activity and generate compliance reports</p>
              </div>
            </div>
            <button
              onClick={handleSendManualReport}
              disabled={sendingEmail}
              className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
            >
              {sendingEmail ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  Send Report Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              {[
                { id: 'logs', label: 'Audit Logs', icon: FileText },
                { id: 'statistics', label: 'Statistics', icon: BarChart3 },
                { id: 'reports', label: 'Report History', icon: Calendar },
                { id: 'recipients', label: 'Recipients', icon: Users }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors relative ${
                    activeTab ===
   tab.id
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                  {activeTab ===
   tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-center">
            {error}
          </div>
        ) : (
          <>
            {activeTab ===
   'logs' && renderLogs()}
            {activeTab ===
   'statistics' && renderStatistics()}
            {activeTab ===
   'recipients' && renderRecipients()}
          </>
        )}
      </div>

      {/* Log Detail Modal */}
      {showLogDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Audit Log Details</h3>
              <button
                onClick={() => setShowLogDetail(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Timestamp</dt>
                  <dd className="text-gray-900 dark:text-white">
                    {new Date(showLogDetail.createdAt).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">User</dt>
                  <dd className="text-gray-900 dark:text-white">
                    {showLogDetail.performedByName || showLogDetail.actor?.employeeDetails?.displayName || showLogDetail.actor?.uid || 'SYSTEM'}
                    {showLogDetail.actor?.email && <span className="text-gray-500 ml-2">({showLogDetail.actor.email})</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</dt>
                  <dd className="text-gray-900 dark:text-white">
                    {showLogDetail.performedByRole || showLogDetail.actor?.role || 'SYSTEM'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Action</dt>
                  <dd className="text-gray-900 dark:text-white">{showLogDetail.description || showLogDetail.action}</dd>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Action Type</dt>
                    <dd><span className={`px-2 py-1 text-xs rounded-full ${ACTION_TYPE_COLORS[showLogDetail.actionType] || 'bg-gray-100'}`}>{showLogDetail.actionType}</span></dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                    <dd>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        (showLogDetail.status || '').toLowerCase() === 'failed' || (showLogDetail.responseStatus || 0) >= 400
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      }`}>
                        {(showLogDetail.status || ((showLogDetail.responseStatus || 0) >= 400 ? 'failed' : 'success')).toUpperCase()}
                      </span>
                    </dd>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Module</dt>
                    <dd className="text-gray-900 dark:text-white">{showLogDetail.module || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Category</dt>
                    <dd className="text-gray-900 dark:text-white">{showLogDetail.category || '-'}</dd>
                  </div>
                </div>
                {showLogDetail.requestPath && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Request</dt>
                    <dd className="text-gray-900 dark:text-white font-mono text-sm">
                      {showLogDetail.requestMethod} {showLogDetail.requestPath}
                      <a
                        href={showLogDetail.requestPath}
                        className="ml-2 text-blue-600 dark:text-blue-400 underline"
                      >
                        Open
                      </a>
                    </dd>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                    <dd className="text-gray-900 dark:text-white">{showLogDetail.responseStatus || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Duration</dt>
                    <dd className="text-gray-900 dark:text-white">{showLogDetail.duration ? `${showLogDetail.duration}ms` : '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">IP Address</dt>
                    <dd className="text-gray-900 dark:text-white font-mono text-sm">{showLogDetail.ipAddress || '-'}</dd>
                  </div>
                </div>
                {showLogDetail.errorMessage && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Error Message</dt>
                    <dd className="text-red-600 dark:text-red-400">{showLogDetail.errorMessage}</dd>
                  </div>
                )}
                {(showLogDetail.oldValues || showLogDetail.newValues) && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Field Changes</dt>
                    <dd className="mt-2 overflow-x-auto">
                      <table className="min-w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Field</th>
                            <th className="px-3 py-2 text-left font-semibold text-red-600 dark:text-red-300">Old Value</th>
                            <th className="px-3 py-2 text-left font-semibold text-green-600 dark:text-green-300">New Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(new Set([
                            ...Object.keys(showLogDetail.oldValues || {}),
                            ...Object.keys(showLogDetail.newValues || {}),
                          ])).map((field) => (
                            <tr key={field} className="border-t border-gray-200 dark:border-gray-700">
                              <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{field}</td>
                              <td className="px-3 py-2 text-red-700 dark:text-red-300 break-all">
                                {JSON.stringify((showLogDetail.oldValues || {})[field] ?? null)}
                              </td>
                              <td className="px-3 py-2 text-green-700 dark:text-green-300 break-all">
                                {JSON.stringify((showLogDetail.newValues || {})[field] ?? null)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </dd>
                  </div>
                )}
                {showLogDetail.details && Object.keys(showLogDetail.details).length > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Details</dt>
                    <dd className="mt-1 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 overflow-x-auto">
                      <pre className="text-xs text-gray-800 dark:text-gray-200">{JSON.stringify(showLogDetail.details, null, 2)}</pre>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      )}

      {/* Recipient Modal */}
      <RecipientModal
        isOpen={showRecipientModal}
        onClose={() => {
          setShowRecipientModal(false);
          setEditingRecipient(null);
        }}
        onSave={handleSaveRecipient}
        recipient={editingRecipient}
      />
    </div>
  );
}
