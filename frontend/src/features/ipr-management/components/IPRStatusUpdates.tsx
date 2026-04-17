'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { iprService, IprStatusUpdate } from '@/features/ipr-management/services/ipr.service';
import api from '@/shared/api/api';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { logger } from '@/shared/utils/logger';
import { Bell, Calendar, FileText, AlertTriangle, CheckCircle, Info, Trash2, Plus, Send, User, Clock } from 'lucide-react';

interface IPRStatusUpdatesProps {
  applicationId: string;
  isDRD?: boolean; // True if viewing as DRD member
  timelineMode?: boolean; // True to display in compact timeline mode matching status history
}

const UPDATE_TYPE_CONFIG = {
  hearing: {
    icon: Calendar,
    label: 'Hearing',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-800',
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100',
  },
  document_request: {
    icon: FileText,
    label: 'Document Request',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
  },
  milestone: {
    icon: CheckCircle,
    label: 'Milestone',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
  },
  general: {
    icon: Info,
    label: 'General Update',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
  },
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', className: 'bg-gray-100 text-gray-700 border border-gray-300' },
  medium: { label: 'Medium', className: 'bg-blue-100 text-blue-700 border border-blue-300' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-700 border border-orange-300' },
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700 border border-red-300' },
};

export default function IPRStatusUpdates({ applicationId, isDRD = false, timelineMode = false }: IPRStatusUpdatesProps) {
  const toast = useToast();
  const { confirmDelete } = useConfirm();
  
  const [updates, setUpdates] = useState<IprStatusUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newUpdate, setNewUpdate] = useState({
    updateMessage: '',
    updateType: 'general' as 'hearing' | 'document_request' | 'milestone' | 'general',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    notifyApplicant: true,
    notifyInventors: true,
  });

  const fetchUpdates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await iprService.getStatusUpdates(applicationId);
      setUpdates(data);
    } catch (err: unknown) {
      const errorMessage = (err as Error).message || 'Failed to load status updates';
      logger.error('Failed to fetch status updates', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUpdate.updateMessage.trim()) return;

    try {
      setSubmitting(true);
      setError('');
      await api.post(`/drd-review/status-update/${applicationId}`, newUpdate);

      // Refresh updates
      await fetchUpdates();
      toast.success('Status update added successfully');
      
      // Reset form
      setNewUpdate({
        updateMessage: '',
        updateType: 'general',
        priority: 'medium',
        notifyApplicant: true,
        notifyInventors: true,
      });
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || 
                          (err as Error).message || 'Failed to add update';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUpdate = async (updateId: string) => {
    const confirmed = await confirmDelete('this status update');
    if (!confirmed) return;

    try {
      await api.delete(`/drd-review/status-update/${updateId}`);
      toast.success('Status update deleted');
      // Refresh updates
      await fetchUpdates();
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || 
                          (err as Error).message || 'Failed to delete update';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto"></div>
        <p className="text-gray-500 mt-3">Loading status updates...</p>
      </div>
    );
  }

  // Timeline mode - compact display matching status history
  if (timelineMode) {
    return (
      <>
        {updates.length ===
   0 ? (
          <div className="py-4 text-center text-gray-500 text-sm">
            No DRD updates yet
          </div>
        ) : (
          updates.map((update, index) => {
            const typeConfig = UPDATE_TYPE_CONFIG[update.updateType] || UPDATE_TYPE_CONFIG.general;
            const TypeIcon = typeConfig.icon;
            const creatorName = update.createdBy?.employeeDetails
              ? `${update.createdBy.employeeDetails.firstName} ${update.createdBy.employeeDetails.lastName}`
              : update.createdBy?.uid || 'DRD';

            return (
              <div key={update.id} className="relative">
                {/* Timeline connector line */}
                {index < updates.length - 1 && (
                  <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-blue-200"></div>
                )}
                
                <div className="flex gap-3">
                  <div className="flex-shrink-0 z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md ${typeConfig.iconBg}`}>
                      <TypeIcon className={`w-4 h-4 ${typeConfig.iconColor}`} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pb-4">
                    <p className="text-sm font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                      {typeConfig.label}
                      {update.priority ===
   'urgent' && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 border border-red-300 rounded-full">
                          Urgent
                        </span>
                      )}
                      {update.priority ===
   'high' && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 border border-orange-300 rounded-full">
                          High
                        </span>
                      )}
                    </p>
                            <p className="text-xs text-gray-500 mt-1">{formatDate(update.createdAt)}</p>
                            <p className="text-xs text-gray-700 mt-2 bg-gray-50 p-2 rounded leading-relaxed">{update.updateMessage}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              By {creatorName}{update.createdBy?.uid ? ` (${update.createdBy.uid})` : ''}
                            </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </>
    );
  }

  // Regular mode - full display with cards
  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Add Update Form (DRD only - Always Visible) */}
      {isDRD && (
        <div className="bg-white rounded-xl shadow-sm border-2 border-purple-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-purple-600" />
            Send Status Update
          </h4>
          <form onSubmit={handleAddUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Update Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={newUpdate.updateType}
                  onChange={(e) => setNewUpdate(prev => ({ ...prev, updateType: e.target.value as any }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="general">📢 General Update</option>
                  <option value="hearing">📅 Hearing Scheduled</option>
                  <option value="document_request">📄 Document Request</option>
                  <option value="milestone">✅ Milestone Update</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={newUpdate.priority}
                  onChange={(e) => setNewUpdate(prev => ({ ...prev, priority: e.target.value as any }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="low">🟢 Low</option>
                  <option value="medium">🔵 Medium</option>
                  <option value="high">🟠 High</option>
                  <option value="urgent">🔴 Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={newUpdate.updateMessage}
                onChange={(e) => setNewUpdate(prev => ({ ...prev, updateMessage: e.target.value }))}
                placeholder="Enter your update message here. This will be sent to the applicant and inventors..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                required
              />
            </div>

            <div className="flex gap-6 items-center">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newUpdate.notifyApplicant}
                  onChange={(e) => setNewUpdate(prev => ({ ...prev, notifyApplicant: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <User className="w-4 h-4" />
                Notify Applicant
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newUpdate.notifyInventors}
                  onChange={(e) => setNewUpdate(prev => ({ ...prev, notifyInventors: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <User className="w-4 h-4" />
                Notify Inventors
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !newUpdate.updateMessage.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Sending...' : 'Send Update'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Updates Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-purple-600" />
            Update History ({updates.length})
          </h3>
        </div>

        <div className="p-6">
          {updates.length ===
   0 ? (
            <div className="py-12 text-center text-gray-500">
              <Info className="w-16 h-16 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium text-gray-600">No status updates yet</p>
              {isDRD && (
                <p className="text-sm mt-2">Use the form above to send your first update to the applicant.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {updates.map((update, index) => {
                const typeConfig = UPDATE_TYPE_CONFIG[update.updateType] || UPDATE_TYPE_CONFIG.general;
                const priorityConfig = PRIORITY_CONFIG[update.priority] || PRIORITY_CONFIG.medium;
                const TypeIcon = typeConfig.icon;
                const creatorName = update.createdBy?.employeeDetails
                  ? `${update.createdBy.employeeDetails.firstName} ${update.createdBy.employeeDetails.lastName}`
                  : update.createdBy?.uid || 'DRD Member';

                return (
                  <div
                    key={update.id}
                    className={`relative p-5 ${typeConfig.bgColor} border-l-4 ${typeConfig.borderColor} rounded-lg transition-all hover:shadow-md`}
                  >
                    {/* Timeline connector */}
                    {index < updates.length - 1 && (
                      <div className="absolute left-8 top-full h-4 w-0.5 bg-gray-300"></div>
                    )}

                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`flex-shrink-0 p-3 rounded-xl ${typeConfig.iconBg} shadow-sm`}>
                        <TypeIcon className={`w-6 h-6 ${typeConfig.iconColor}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`text-sm font-semibold ${typeConfig.textColor}`}>
                            {typeConfig.label}
                          </span>
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${priorityConfig.className}`}>
                            {priorityConfig.label}
                          </span>
                          <span className="text-xs text-gray-500">#{updates.length - index}</span>
                        </div>

                        <p className="text-gray-900 mb-3 leading-relaxed whitespace-pre-wrap">
                          {update.updateMessage}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            <span>{creatorName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatDate(update.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Delete button */}
                      {isDRD && (
                        <button
                          onClick={() => handleDeleteUpdate(update.id)}
                          className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete update"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
