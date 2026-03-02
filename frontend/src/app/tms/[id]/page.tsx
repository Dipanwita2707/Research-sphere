'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowUpCircle, CheckCircle, MessageSquare, XCircle, Star, Clock, Send,
  FileText, AlertCircle, ChevronRight,
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

const TIMELINE_STYLES: Record<string, { label: string; icon: typeof Clock; dotColor: string; lineColor: string; bgColor: string; textColor: string }> = {
  created:        { label: 'Ticket Created',              icon: Clock,          dotColor: 'bg-[#005b96]',   lineColor: 'border-[#005b96]',   bgColor: 'bg-[#005b96]/5',       textColor: 'text-[#005b96]' },
  assigned:       { label: 'Assigned',                    icon: CheckCircle,    dotColor: 'bg-[#03396c]',   lineColor: 'border-[#03396c]',   bgColor: 'bg-[#03396c]/5',       textColor: 'text-[#03396c]' },
  escalated:      { label: 'Escalated',                   icon: ArrowUpCircle,  dotColor: 'bg-orange-500',  lineColor: 'border-orange-400',  bgColor: 'bg-orange-50',         textColor: 'text-orange-600' },
  auto_escalated: { label: 'Auto-Escalated (48h overdue)',icon: AlertCircle,    dotColor: 'bg-red-500',     lineColor: 'border-red-400',     bgColor: 'bg-red-50',            textColor: 'text-red-600' },
  remarked:       { label: 'Remark Added',                icon: MessageSquare,  dotColor: 'bg-[#6497b1]',   lineColor: 'border-[#6497b1]',   bgColor: 'bg-[#6497b1]/5',       textColor: 'text-[#6497b1]' },
  resolved:       { label: 'Resolved',                    icon: CheckCircle,    dotColor: 'bg-emerald-500', lineColor: 'border-emerald-400', bgColor: 'bg-emerald-50',        textColor: 'text-emerald-600' },
  closed:         { label: 'Closed',                      icon: XCircle,        dotColor: 'bg-[#011f4b]',   lineColor: 'border-[#011f4b]',   bgColor: 'bg-[#011f4b]/5',       textColor: 'text-[#011f4b]' },
  rated:          { label: 'Rated',                       icon: Star,           dotColor: 'bg-amber-500',   lineColor: 'border-amber-400',   bgColor: 'bg-amber-50',          textColor: 'text-amber-600' },
  status_changed: { label: 'Status Changed',              icon: Clock,          dotColor: 'bg-[#005b96]',   lineColor: 'border-[#005b96]',   bgColor: 'bg-[#005b96]/5',       textColor: 'text-[#005b96]' },
  forwarded:      { label: 'Forwarded',                   icon: ChevronRight,   dotColor: 'bg-purple-500',  lineColor: 'border-purple-400',  bgColor: 'bg-purple-50',         textColor: 'text-purple-600' },
  reopened:       { label: 'Reopened',                     icon: Clock,          dotColor: 'bg-orange-500',  lineColor: 'border-orange-400',  bgColor: 'bg-orange-50',          textColor: 'text-orange-600' },
};

function TimelineItem({ entry, isLast }: { entry: TmsTimelineEntry; isLast: boolean }) {
  const config = TIMELINE_STYLES[entry.action] || TIMELINE_STYLES.created;
  const Icon = config.icon;

  return (
    <div className="flex gap-0">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center w-10 shrink-0">
        <div className={`w-8 h-8 rounded-full ${config.dotColor} flex items-center justify-center shadow-md ring-4 ring-white z-10`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 border-l-2 ${config.lineColor} border-dashed opacity-40 my-1`} />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 ml-3 mb-6 ${isLast ? '' : ''}`}>
        <div className={`rounded-xl border ${config.lineColor}/20 ${config.bgColor} p-4`} style={{ boxShadow: `0 1px 8px 0 ${config.dotColor === 'bg-orange-500' ? 'rgba(249,115,22,0.08)' : config.dotColor === 'bg-red-500' ? 'rgba(239,68,68,0.08)' : config.dotColor === 'bg-emerald-500' ? 'rgba(16,185,129,0.08)' : 'rgba(0,91,150,0.06)'}` }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-sm font-bold ${config.textColor}`}>{config.label}</span>
            {entry.isAutomatic && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                Auto
              </span>
            )}
          </div>
          <div className="text-xs text-[#6497b1] font-medium">
            {getDisplayNameWithUID(entry.performedBy)} &bull; {new Date(entry.createdAt).toLocaleString()}
          </div>
          {entry.fromLevel && entry.toLevel && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-white/80 rounded-lg border border-[#b3cde0]/30">
              <span className="text-xs font-semibold text-[#03396c]">{ESCALATION_LEVEL_LABELS[entry.fromLevel]}</span>
              <span className="text-[#005b96]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </span>
              <span className="text-xs font-semibold text-[#005b96]">{ESCALATION_LEVEL_LABELS[entry.toLevel]}</span>
            </div>
          )}
          {entry.remarks && (
            <div className="mt-2.5 px-3 py-2.5 bg-white/70 rounded-lg border border-[#b3cde0]/20 text-sm text-[#03396c] leading-relaxed">
              {entry.remarks}
            </div>
          )}
        </div>
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
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-9 w-9 border-[3px] border-[#b3cde0] border-t-[#005b96]" />
          <p className="text-sm text-[#6497b1] mt-4 font-medium">Loading ticket details...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#b3cde0]/20 flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-[#6497b1]" />
          </div>
          <p className="text-[#03396c] font-semibold">Ticket not found</p>
        </div>
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
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2.5 bg-white hover:bg-[#005b96]/5 border border-[#b3cde0]/40 rounded-xl transition-all shadow-sm"
            >
              <ArrowLeft className="w-5 h-5 text-[#005b96]" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-[#011f4b] tracking-tight">{ticket.requestId}</h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${statusConfig?.bgColor} ${statusConfig?.color}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {statusConfig?.label}
                </span>
              </div>
              {ticket.subject && (
                <p className="text-sm text-[#6497b1] mt-1">{ticket.subject}</p>
              )}
            </div>
          </div>
          <div className="mt-4 h-[2px] bg-gradient-to-r from-[#005b96] via-[#b3cde0] to-transparent rounded-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Student Information (for employees viewing) */}
            {!isCreator && ticket.createdBy && (
              <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
                <h2 className="text-sm font-bold text-[#011f4b] mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                  Student Information
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#6497b1] font-semibold mb-0.5">Name</p>
                    <p className="text-sm font-medium text-[#011f4b]">{getDisplayName(ticket.createdBy)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#6497b1] font-semibold mb-0.5">UID</p>
                    <p className="text-sm font-medium text-[#011f4b]">{ticket.createdBy.uid}</p>
                  </div>
                  {ticket.createdBy.studentLogin?.registrationNo && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#6497b1] font-semibold mb-0.5">Registration No.</p>
                      <p className="text-sm font-medium text-[#011f4b]">{ticket.createdBy.studentLogin.registrationNo}</p>
                    </div>
                  )}
                  {ticket.createdBy.studentLogin?.program?.programName && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#6497b1] font-semibold mb-0.5">Program</p>
                      <p className="text-sm font-medium text-[#011f4b]">{ticket.createdBy.studentLogin.program.programName}</p>
                    </div>
                  )}
                  {ticket.createdBy.studentLogin?.program?.department?.departmentName && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#6497b1] font-semibold mb-0.5">Department</p>
                      <p className="text-sm font-medium text-[#011f4b]">{ticket.createdBy.studentLogin.program.department.departmentName}</p>
                    </div>
                  )}
                  {ticket.createdBy.studentLogin?.program?.department?.faculty?.facultyName && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#6497b1] font-semibold mb-0.5">Faculty / School</p>
                      <p className="text-sm font-medium text-[#011f4b]">{ticket.createdBy.studentLogin.program.department.faculty.facultyName}</p>
                    </div>
                  )}
                  {ticket.contactNumber && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#6497b1] font-semibold mb-0.5">Contact Number</p>
                      <p className="text-sm font-medium text-[#011f4b]">{ticket.contactNumber}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Request Details */}
            <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
              <h2 className="text-sm font-bold text-[#011f4b] mb-3 flex items-center gap-2">
                <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                Request Details
              </h2>
              <p className="text-sm text-[#03396c] whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            </div>

            {/* Supporting Documents */}
            {ticket.documentPath && (
              <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
                <h2 className="text-sm font-bold text-[#011f4b] mb-3 flex items-center gap-2">
                  <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                  Supporting Documents
                </h2>
                <a
                  href={ticket.documentPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#005b96]/[0.06] border border-[#005b96]/15 rounded-xl text-sm text-[#005b96] font-medium hover:bg-[#005b96]/10 transition-colors"
                >
                  📎 {ticket.documentName || 'View Attached Document'}
                </a>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
              <h2 className="text-sm font-bold text-[#011f4b] mb-6 flex items-center gap-2">
                <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-[#005b96] to-[#b3cde0]" />
                Request Timeline
              </h2>
              <div className="pl-1">
                {ticket.timeline?.map((entry, idx) => (
                  <TimelineItem key={entry.id} entry={entry} isLast={idx === (ticket.timeline?.length ?? 0) - 1} />
                ))}
              </div>
            </div>

            {/* Add Remark (employee only) */}
            {isAssignee && isActive && (
              <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
                <h2 className="text-sm font-bold text-[#011f4b] mb-3 flex items-center gap-2">
                  <div className="w-1.5 h-5 rounded-full bg-[#6497b1]" />
                  Add Remark
                </h2>
                <textarea
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                  rows={3}
                  placeholder="Enter your remark or response..."
                  className="w-full px-4 py-3 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] placeholder-[#6497b1]/50 resize-none focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-all"
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleAddRemark}
                    disabled={!remarkText.trim() || addRemarkMutation.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#005b96] hover:bg-[#03396c] text-white rounded-xl text-sm font-medium disabled:opacity-40 transition-colors shadow-md shadow-[#005b96]/15"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {addRemarkMutation.isPending ? 'Sending...' : 'Send Remark'}
                  </button>
                </div>
              </div>
            )}

            {/* Rating (student, resolved ticket) */}
            {canRate && !showRating && (
              <div className="bg-emerald-50/70 border border-emerald-200/50 rounded-2xl p-6" style={{ boxShadow: '0 2px 12px 0 rgba(16, 185, 129, 0.06)' }}>
                <p className="text-sm text-emerald-700 mb-3 font-medium">
                  This ticket has been resolved. Please rate the resolution.
                </p>
                <button
                  onClick={() => setShowRating(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-md"
                >
                  <Star className="w-4 h-4" />
                  Rate Resolution
                </button>
              </div>
            )}

            {showRating && (
              <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
                <h2 className="text-sm font-bold text-[#011f4b] mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-5 rounded-full bg-amber-400" />
                  Rate Resolution
                </h2>
                <div className="flex gap-1.5 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`p-1 transition-transform hover:scale-110 ${star <= rating ? 'text-amber-400' : 'text-[#b3cde0]'}`}
                    >
                      <Star className="w-7 h-7 fill-current" />
                    </button>
                  ))}
                </div>
                <textarea
                  value={ratingFeedback}
                  onChange={(e) => setRatingFeedback(e.target.value)}
                  rows={2}
                  placeholder="Optional feedback..."
                  className="w-full px-4 py-3 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] placeholder-[#6497b1]/50 resize-none focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-all"
                />
                <div className="flex justify-end gap-3 mt-3">
                  <button
                    onClick={() => setShowRating(false)}
                    className="px-4 py-2 text-sm text-[#6497b1] bg-[#f8fafc] border border-[#b3cde0]/40 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRate}
                    disabled={rating < 1 || rateMutation.isPending}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 transition-colors shadow-md"
                  >
                    {rateMutation.isPending ? 'Submitting...' : 'Submit Rating'}
                  </button>
                </div>
              </div>
            )}

            {/* Rating display */}
            {ticket.rating && (
              <div className="bg-amber-50/60 border border-amber-200/50 rounded-2xl p-6" style={{ boxShadow: '0 2px 12px 0 rgba(245, 158, 11, 0.06)' }}>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-semibold text-[#011f4b]">Customer Rating:</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-5 h-5 ${s <= ticket.rating!.rating ? 'text-amber-400 fill-current' : 'text-[#b3cde0]'}`}
                      />
                    ))}
                  </div>
                </div>
                {ticket.rating.feedback && (
                  <p className="text-sm text-[#03396c] mt-2 italic">&ldquo;{ticket.rating.feedback}&rdquo;</p>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Info Card */}
            <div className="bg-white rounded-2xl border border-[#b3cde0]/40 overflow-hidden" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
              <div className="bg-gradient-to-r from-[#011f4b] to-[#03396c] px-5 py-3">
                <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider">Ticket Information</h3>
              </div>
              <div className="p-5 space-y-3.5">
                <InfoRow label="Type">
                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${messageTypeConfig?.bgColor} ${messageTypeConfig?.color}`}>
                    {messageTypeConfig?.label}
                  </span>
                </InfoRow>
                <InfoRow label="Priority">
                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${priorityConfig?.bgColor} ${priorityConfig?.color}`}>
                    {priorityConfig?.label}
                  </span>
                </InfoRow>
                <InfoRow label="Level">
                  <span className="text-xs font-medium text-[#03396c]">
                    {ESCALATION_LEVEL_LABELS[ticket.currentLevel]}
                  </span>
                </InfoRow>
                <div className="h-px bg-[#b3cde0]/20" />
                <InfoRow label="Category">
                  <span className="text-xs text-[#03396c] text-right leading-relaxed">
                    {ticket.masterCategory?.name} / {ticket.category?.name} / {ticket.subCategory?.name}
                  </span>
                </InfoRow>
                <div className="h-px bg-[#b3cde0]/20" />
                <InfoRow label="Created By">
                  <span className="text-xs font-medium text-[#03396c]">
                    {getDisplayName(ticket.createdBy)}
                  </span>
                </InfoRow>
                <InfoRow label="Assigned To">
                  <span className="text-xs font-medium text-[#03396c]">
                    {getDisplayName(ticket.assignedTo)}
                  </span>
                </InfoRow>
                <InfoRow label="Created">
                  <span className="text-xs text-[#6497b1]">
                    {new Date(ticket.createdAt).toLocaleString()}
                  </span>
                </InfoRow>
                {ticket.contactNumber && (
                  <InfoRow label="Contact">
                    <span className="text-xs font-medium text-[#03396c]">{ticket.contactNumber}</span>
                  </InfoRow>
                )}
                {ticket.documentPath && (
                  <InfoRow label="Attachment">
                    <a
                      href={ticket.documentPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#005b96] font-medium hover:underline"
                    >
                      {ticket.documentName || 'View File'}
                    </a>
                  </InfoRow>
                )}
                {ticket.escalationDeadline && (
                  <>
                    <div className="h-px bg-[#b3cde0]/20" />
                    <InfoRow label="Deadline">
                      <span className="text-xs font-semibold text-orange-600">
                        {new Date(ticket.escalationDeadline).toLocaleString()}
                      </span>
                    </InfoRow>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons (employee) */}
            {isAssignee && isActive && (
              <div className="bg-white rounded-2xl border border-[#b3cde0]/40 overflow-hidden" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
                <div className="bg-gradient-to-r from-[#011f4b] to-[#03396c] px-5 py-3">
                  <h3 className="text-xs font-semibold text-white/90 uppercase tracking-wider">Update Status</h3>
                </div>
                <div className="p-5 space-y-2.5">
                  <button
                    onClick={() => setShowActionModal('resolve')}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" /> Resolve
                  </button>
                  <button
                    onClick={() => setShowActionModal('escalate')}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                  >
                    <ArrowUpCircle className="w-4 h-4" /> Forward / Escalate
                  </button>
                  <button
                    onClick={() => setShowActionModal('close')}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-[#6497b1] hover:bg-[#03396c] text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                  >
                    <XCircle className="w-4 h-4" /> Close with Remarks
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Modal */}
        {showActionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#011f4b]/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-md mx-4 border border-[#b3cde0]/30">
              <h3 className="text-lg font-bold text-[#011f4b] mb-4">
                {showActionModal === 'escalate'
                  ? 'Forward / Escalate Ticket'
                  : showActionModal === 'resolve'
                    ? 'Resolve Ticket'
                    : 'Close Ticket with Remarks'}
              </h3>
              {actionError && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200/50 rounded-xl text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
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
                className="w-full px-4 py-3 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] placeholder-[#6497b1]/50 resize-none focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-all"
              />
              <div className="flex justify-end gap-3 mt-5">
                <button
                  onClick={() => { setShowActionModal(null); setActionRemarks(''); setActionError(''); }}
                  className="px-5 py-2.5 text-sm text-[#6497b1] bg-[#f8fafc] border border-[#b3cde0]/40 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={
                    ((showActionModal === 'resolve' || showActionModal === 'close') && !actionRemarks.trim()) ||
                    escalateMutation.isPending || resolveMutation.isPending || closeMutation.isPending
                  }
                  className="px-5 py-2.5 bg-[#005b96] hover:bg-[#03396c] text-white rounded-xl text-sm font-medium disabled:opacity-40 transition-colors shadow-md shadow-[#005b96]/15"
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
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] font-semibold text-[#6497b1] uppercase tracking-wider shrink-0">{label}</span>
      {children}
    </div>
  );
}
