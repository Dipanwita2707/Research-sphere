'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowUpCircle, CheckCircle, MessageSquare, XCircle, Star, Clock, Send,
} from 'lucide-react';
import { useAuthStore } from '@/shared/auth/authStore';
import {
  useTicketDetail,
  useAddRemark,
  useEscalateTicket,
  useResolveTicket,
  useCloseTicket,
  useRateTicket,
} from '@/features/ticket-management/hooks/useTickets';
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  MESSAGE_TYPE_CONFIG,
  ESCALATION_LEVEL_LABELS,
} from '@/features/ticket-management/constants';
import type { TmsTicket, TmsTimelineEntry, UserBrief } from '@/features/ticket-management/types/tms.types';

function getDisplayName(user?: UserBrief | null): string {
  if (!user) return 'System';
  if (user.studentLogin) return user.studentLogin.displayName;
  if (user.employeeDetails) return user.employeeDetails.displayName;
  return user.uid;
}

function getDisplayNameWithUID(user?: UserBrief | null): string {
  if (!user) return 'System';
  if (user.employeeDetails) {
    const desig = user.employeeDetails.designation ? `${user.employeeDetails.designation} ` : '';
    return `${desig}${user.employeeDetails.displayName} (UID: ${user.uid})`;
  }
  if (user.studentLogin) return `${user.studentLogin.displayName} (${user.uid})`;
  return user.uid;
}

function TimelineItem({ entry }: { entry: TmsTimelineEntry }) {
  const actionLabels: Record<string, { label: string; icon: typeof Clock; color: string }> = {
    created: { label: 'Ticket Created', icon: Clock, color: 'text-blue-500' },
    assigned: { label: 'Assigned', icon: ArrowUpCircle, color: 'text-blue-500' },
    escalated: { label: 'Escalated', icon: ArrowUpCircle, color: 'text-orange-500' },
    auto_escalated: { label: 'Auto-Escalated (48h overdue)', icon: ArrowUpCircle, color: 'text-red-500' },
    remarked: { label: 'Remark Added', icon: MessageSquare, color: 'text-gray-600' },
    resolved: { label: 'Resolved', icon: CheckCircle, color: 'text-green-500' },
    closed: { label: 'Closed', icon: XCircle, color: 'text-gray-500' },
    rated: { label: 'Rated', icon: Star, color: 'text-yellow-500' },
    status_changed: { label: 'Status Changed', icon: Clock, color: 'text-blue-500' },
    forwarded: { label: 'Forwarded', icon: ArrowUpCircle, color: 'text-purple-500' },
    reopened: { label: 'Reopened', icon: Clock, color: 'text-orange-500' },
  };

  const config = actionLabels[entry.action] || { label: entry.action, icon: Clock, color: 'text-gray-500' };
  const Icon = config.icon;

  return (
    <div className="flex gap-3 py-3">
      <div className={`mt-0.5 ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-900 dark:text-white">{config.label}</span>
          {entry.isAutomatic && (
            <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 rounded text-xs">
              Auto
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {getDisplayNameWithUID(entry.performedBy)} • {new Date(entry.createdAt).toLocaleString()}
        </div>
        {entry.fromLevel && entry.toLevel && (
          <div className="text-xs text-gray-500 mt-0.5">
            {ESCALATION_LEVEL_LABELS[entry.fromLevel]} → {ESCALATION_LEVEL_LABELS[entry.toLevel]}
          </div>
        )}
        {entry.remarks && (
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/40 rounded p-2">
            {entry.remarks}
          </p>
        )}
      </div>
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: ticket, isLoading } = useTicketDetail(id);

  const addRemarkMutation = useAddRemark();
  const escalateMutation = useEscalateTicket();
  const resolveMutation = useResolveTicket();
  const closeMutation = useCloseTicket();
  const rateMutation = useRateTicket();

  const [remarkText, setRemarkText] = useState('');
  const [rating, setRating] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [showRating, setShowRating] = useState(false);
  const [actionRemarks, setActionRemarks] = useState('');
  const [showActionModal, setShowActionModal] = useState<'escalate' | 'resolve' | 'close' | null>(null);
  const [actionError, setActionError] = useState('');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Ticket not found</p>
      </div>
    );
  }

  const isCreator = ticket.createdBy?.id === user?.id;
  const isAssignee = ticket.assignedTo?.id === user?.id;
  const isActive = ['open', 'in_progress', 'escalated'].includes(ticket.status);
  const isResolved = ticket.status === 'resolved';
  const canRate = isCreator && isResolved && !ticket.rating;

  const statusConfig = STATUS_CONFIG[ticket.status];
  const priorityConfig = PRIORITY_CONFIG[ticket.priority];
  const messageTypeConfig = MESSAGE_TYPE_CONFIG[ticket.messageType];
  const StatusIcon = statusConfig?.icon || Clock;

  const handleAddRemark = async () => {
    if (!remarkText.trim()) return;
    await addRemarkMutation.mutateAsync({ id, payload: { remarks: remarkText.trim() } });
    setRemarkText('');
  };

  const handleAction = async () => {
    if (!showActionModal) return;
    setActionError('');
    try {
      if (showActionModal === 'escalate') {
        await escalateMutation.mutateAsync({ id, payload: { remarks: actionRemarks || undefined } });
      } else if (showActionModal === 'resolve') {
        await resolveMutation.mutateAsync({ id, payload: { remarks: actionRemarks } });
      } else if (showActionModal === 'close') {
        await closeMutation.mutateAsync({ id, payload: { remarks: actionRemarks || undefined } });
      }
      setShowActionModal(null);
      setActionRemarks('');
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      setActionError(apiErr?.response?.data?.message || 'Operation failed. The ticket may have already been escalated or updated.');
    }
  };

  const handleRate = async () => {
    if (rating < 1 || rating > 5) return;
    await rateMutation.mutateAsync({ id, payload: { rating, feedback: ratingFeedback || undefined } });
    setShowRating(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{ticket.requestId}</h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig?.bgColor} ${statusConfig?.color}`}>
                <StatusIcon className="w-3 h-3" />
                {statusConfig?.label}
              </span>
            </div>
            {ticket.subject && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ticket.subject}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Student Information (for employees viewing) */}
            {!isCreator && ticket.createdBy && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Student Information</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{getDisplayName(ticket.createdBy)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">UID</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{ticket.createdBy.uid}</p>
                  </div>
                  {ticket.createdBy.studentLogin?.registrationNo && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Registration No.</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{ticket.createdBy.studentLogin.registrationNo}</p>
                    </div>
                  )}
                  {ticket.createdBy.studentLogin?.program?.programName && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Program</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{ticket.createdBy.studentLogin.program.programName}</p>
                    </div>
                  )}
                  {ticket.createdBy.studentLogin?.program?.department?.departmentName && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Department</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{ticket.createdBy.studentLogin.program.department.departmentName}</p>
                    </div>
                  )}
                  {ticket.createdBy.studentLogin?.program?.department?.faculty?.facultyName && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Faculty / School</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{ticket.createdBy.studentLogin.program.department.faculty.facultyName}</p>
                    </div>
                  )}
                  {ticket.contactNumber && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Contact Number</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{ticket.contactNumber}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Request Details */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Request Details</h2>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.description}</p>
            </div>

            {/* Supporting Documents */}
            {ticket.documentPath && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Supporting Documents</h2>
                <a
                  href={ticket.documentPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  📎 {ticket.documentName || 'View Attached Document'}
                </a>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Request Timeline</h2>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {ticket.timeline?.map((entry) => (
                  <TimelineItem key={entry.id} entry={entry} />
                ))}
              </div>
            </div>

            {/* Add Remark (employee only) */}
            {isAssignee && isActive && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Add Remark</h2>
                <textarea
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                  rows={3}
                  placeholder="Enter your remark or response..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleAddRemark}
                    disabled={!remarkText.trim() || addRemarkMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {addRemarkMutation.isPending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            )}

            {/* Rating (student, resolved ticket) */}
            {canRate && !showRating && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
                <p className="text-sm text-green-700 dark:text-green-400 mb-2">
                  This ticket has been resolved. Please rate the resolution.
                </p>
                <button
                  onClick={() => setShowRating(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                >
                  <Star className="w-4 h-4" />
                  Rate Resolution
                </button>
              </div>
            )}

            {showRating && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Rate Resolution</h2>
                <div className="flex gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`p-1 ${star <= rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
                <textarea
                  value={ratingFeedback}
                  onChange={(e) => setRatingFeedback(e.target.value)}
                  rows={2}
                  placeholder="Optional feedback..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setShowRating(false)}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRate}
                    disabled={rating < 1 || rateMutation.isPending}
                    className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {rateMutation.isPending ? 'Submitting...' : 'Submit Rating'}
                  </button>
                </div>
              </div>
            )}

            {/* Rating display */}
            {ticket.rating && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Rating:</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${s <= ticket.rating!.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                </div>
                {ticket.rating.feedback && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{ticket.rating.feedback}</p>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
              <InfoRow label="Type">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${messageTypeConfig?.bgColor} ${messageTypeConfig?.color}`}>
                  {messageTypeConfig?.label}
                </span>
              </InfoRow>
              <InfoRow label="Priority">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityConfig?.bgColor} ${priorityConfig?.color}`}>
                  {priorityConfig?.label}
                </span>
              </InfoRow>
              <InfoRow label="Level">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {ESCALATION_LEVEL_LABELS[ticket.currentLevel]}
                </span>
              </InfoRow>
              <InfoRow label="Category">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {ticket.masterCategory?.name} / {ticket.category?.name} / {ticket.subCategory?.name}
                </span>
              </InfoRow>
              <InfoRow label="Created By">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {getDisplayName(ticket.createdBy)}
                </span>
              </InfoRow>
              <InfoRow label="Assigned To">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {getDisplayName(ticket.assignedTo)}
                </span>
              </InfoRow>
              <InfoRow label="Created">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {new Date(ticket.createdAt).toLocaleString()}
                </span>
              </InfoRow>
              {ticket.contactNumber && (
                <InfoRow label="Contact">
                  <span className="text-xs text-gray-600 dark:text-gray-400">{ticket.contactNumber}</span>
                </InfoRow>
              )}
              {ticket.documentPath && (
                <InfoRow label="Attachment">
                  <a
                    href={ticket.documentPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {ticket.documentName || 'View File'}
                  </a>
                </InfoRow>
              )}
              {ticket.escalationDeadline && (
                <InfoRow label="Deadline">
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    {new Date(ticket.escalationDeadline).toLocaleString()}
                  </span>
                </InfoRow>
              )}
            </div>

            {/* Action Buttons (employee) */}
            {isAssignee && isActive && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Update Status</h3>
                <button
                  onClick={() => setShowActionModal('resolve')}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                >
                  <CheckCircle className="w-4 h-4" /> Resolve
                </button>
                <button
                  onClick={() => setShowActionModal('escalate')}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm"
                >
                  <ArrowUpCircle className="w-4 h-4" /> Forward / Escalate
                </button>
                <button
                  onClick={() => setShowActionModal('close')}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm"
                >
                  <XCircle className="w-4 h-4" /> Close with Remarks
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Modal */}
        {showActionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {showActionModal === 'escalate'
                  ? 'Forward / Escalate Ticket'
                  : showActionModal === 'resolve'
                    ? 'Resolve Ticket'
                    : 'Close Ticket with Remarks'}
              </h3>
              {actionError && (
                <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {actionError}
                </div>
              )}
              <textarea
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                rows={3}
                placeholder={
                  showActionModal === 'resolve'
                    ? 'Resolution details (required)...'
                    : showActionModal === 'close'
                      ? 'Closure remarks (required)...'
                      : 'Reason for forwarding / escalation (optional)...'
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => { setShowActionModal(null); setActionRemarks(''); setActionError(''); }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={
                    ((showActionModal === 'resolve' || showActionModal === 'close') && !actionRemarks.trim()) ||
                    escalateMutation.isPending || resolveMutation.isPending || closeMutation.isPending
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {showActionModal === 'escalate' ? 'Forward' : showActionModal === 'resolve' ? 'Resolve' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      {children}
    </div>
  );
}
