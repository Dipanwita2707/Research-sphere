/**
 * Audit Service
 * Frontend service for interacting with audit log API endpoints
 */

import api from '@/shared/api/api';

export interface AuditLog {
  id: string;
  actorId: string | null;
  performedByName?: string | null;
  performedByRole?: string | null;
  action: string;
  description?: string | null;
  actionType: string;
  module: string | null;
  category: string | null;
  severity: string;
  targetTable: string | null;
  targetId: string | null;
  entityId?: string | null;
  entityName?: string | null;
  details: Record<string, any>;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  requestPath: string | null;
  requestMethod: string | null;
  responseStatus: number | null;
  status?: string | null;
  duration: number | null;
  errorMessage: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  actor?: {
    id: string;
    uid: string;
    email: string;
    role: string;
    employeeDetails?: {
      displayName: string;
      empId: string;
    };
  };
}

export interface AuditStatistics {
  totalLogs: number;
  byActionType: { actionType: string; count: number }[];
  byModule: { module: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  topActors: { actorId: string; actorName: string; email: string; count: number }[];
  errorCount: number;
  period: { startDate: string; endDate: string };
}

export interface AuditReportConfig {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  receiveMonthly: boolean;
  receiveWeekly: boolean;
  receiveDaily: boolean;
  modules: string[];
  severities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditReportHistory {
  id: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  recipients: string[];
  totalLogs: number;
  filePath: string | null;
  status: string;
  errorMsg: string | null;
  sentAt: string;
}

export interface AuditFilters {
  page?: number;
  limit?: number;
  actorId?: string;
  performedBy?: string;
  module?: string;
  actionType?: string;
  severity?: string;
  status?: string;
  targetTable?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterOptions {
  modules: string[];
  actionTypes: string[];
  severities: string[];
  statuses?: string[];
  performers?: string[];
}

class AuditService {
  /**
   * Get audit logs with filters and pagination
   */
  async getLogs(filters: AuditFilters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const response = await api.get(`/audit/logs?${params.toString()}`);
    return response.data;
  }

  /**
   * Get audit statistics for a period
   */
  async getStatistics(startDate: string, endDate: string) {
    const response = await api.get('/audit/statistics', {
      params: { startDate, endDate }
    });
    return response.data;
  }

  /**
   * Get audit history for a specific entity
   */
  async getEntityHistory(targetTable: string, targetId: string, page = 1, limit = 20) {
    const response = await api.get(`/audit/logs/${targetTable}/${targetId}`, {
      params: { page, limit }
    });
    return response.data;
  }

  /**
   * Export audit logs to Excel
   */
  async exportLogs(filters: AuditFilters & { format?: 'csv' | 'xlsx' }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    if (!params.get('format')) {
      params.append('format', 'xlsx');
    }

    const response = await api.get(`/audit/logs/export?${params.toString()}`, {
      responseType: 'blob'
    });

    const selectedFormat = (params.get('format') || 'xlsx').toLowerCase();
    const extension = selectedFormat === 'csv' ? 'csv' : 'xlsx';
    const mimeType = extension === 'csv'
      ? 'text/csv;charset=utf-8'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    // Trigger download
    const blob = new Blob([response.data], { 
      type: mimeType
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.${extension}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true };
  }

  /**
   * Generate on-demand report
   */
  async generateReport(data: {
    startDate: string;
    endDate: string;
    reportType?: string;
    sendEmail?: boolean;
    recipientEmails?: string[];
  }) {
    if (data.sendEmail) {
      const response = await api.post('/audit/reports/generate', data);
      return response.data;
    } else {
      const response = await api.post('/audit/reports/generate', data, {
        responseType: 'blob'
      });

      // Trigger download
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-report-${data.reportType || 'custom'}-${data.startDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return { success: true };
    }
  }

  /**
   * Get report history
   */
  async getReportHistory(page = 1, limit = 20, reportType?: string) {
    const response = await api.get('/audit/reports/history', {
      params: { page, limit, reportType }
    });
    return response.data;
  }

  /**
   * Get report recipients configuration
   */
  async getRecipients() {
    const response = await api.get('/audit/recipients');
    return response.data;
  }

  /**
   * Add or update report recipient
   */
  async saveRecipient(data: Partial<AuditReportConfig>, id?: string) {
    if (id) {
      const response = await api.put(`/audit/recipients/${id}`, data);
      return response.data;
    } else {
      const response = await api.post('/audit/recipients', data);
      return response.data;
    }
  }

  /**
   * Delete report recipient
   */
  async deleteRecipient(id: string) {
    const response = await api.delete(`/audit/recipients/${id}`);
    return response.data;
  }

  /**
   * Get available filter options
   */
  async getFilterOptions(): Promise<{ success: boolean; data: FilterOptions }> {
    const response = await api.get('/audit/logs/filters');
    return response.data;
  }

  /**
   * Trigger manual log cleanup
   */
  async triggerCleanup(retentionDays = 365) {
    const response = await api.post('/audit/cleanup', { retentionDays });
    return response.data;
  }

  /**
   * Send manual audit report via email
   */
  async sendManualReport(reportType: 'monthly' | 'weekly' | 'daily' = 'monthly') {
    const response = await api.post('/audit/reports/send-email', { reportType });
    return response.data;
  }
}

export const auditService = new AuditService();
