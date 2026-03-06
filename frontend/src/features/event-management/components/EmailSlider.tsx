'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';
import {
  X, Send, Users, ChevronDown, AlertCircle,
  Loader2, CheckCircle2, Mail, Clock, UserCheck,
  UserX, TestTube, History,
  ChevronRight, XCircle, MailOpen, MailX,
  Ban, ArrowDownCircle, Maximize2, Minimize2, Calendar, Zap,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { useToast } from '@/shared/ui-components/Toast';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

const QUILL_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['link'],
    ['clean'],
  ],
};

const QUILL_FORMATS = ['bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'align', 'link'];

// ── Types ────────────────────────────────────────────────────────
interface RecipientCounts {
  all: number;
  confirmed: number;
  pending: number;
  cancelled: number;
}

type StatusFilter = 'all' | 'confirmed' | 'pending' | 'cancelled' | 'selected';

type SliderTab = 'compose' | 'history';

interface RecipientDetail {
  id: string;
  email: string;
  name: string;
  status: string;            // sent | delivered | bounced | failed
  failureReason: string | null;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
}

interface EmailLogEntry {
  id: string;
  subject: string;
  body: string;
  filter: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: string;
  replyTo: string | null;
  errors: string[];
  sentAt: string;
  scheduledAt?: string | null;
  sentByName: string;
  sentByEmail: string | null;
  // Aggregated stats
  deliveredCount: number;
  bouncedCount: number;
  openedCount: number;
  notOpenedCount: number;
  // Per-recipient details
  recipientDetails: RecipientDetail[];
}

interface EmailSliderProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  /** When provided, a "Selected" filter option appears and is pre-selected */
  selectedRegistrationIds?: string[];
}

// ── Status filter pills ──────────────────────────────────────────
const BASE_FILTERS: { value: StatusFilter; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'all', label: 'All', icon: Users, color: '#6366f1' },
  { value: 'confirmed', label: 'Confirmed', icon: UserCheck, color: '#10b981' },
  { value: 'pending', label: 'Pending', icon: Clock, color: '#f59e0b' },
  { value: 'cancelled', label: 'Cancelled', icon: UserX, color: '#ef4444' },
];

// ── Main Component ───────────────────────────────────────────────
export default function EmailSlider({ open, onClose, eventId, eventName, selectedRegistrationIds }: EmailSliderProps) {
  const { toast } = useToast();

  // When selected IDs are passed in, always show a "Selected" pill and pre-select it
  const hasSelection = Array.isArray(selectedRegistrationIds) && selectedRegistrationIds.length > 0;
  const FILTERS = hasSelection
    ? [{ value: 'selected' as StatusFilter, label: `Selected (${selectedRegistrationIds!.length})`, icon: CheckCircle2, color: '#8b5cf6' }, ...BASE_FILTERS]
    : BASE_FILTERS;

  // State
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [replyTo, setReplyTo] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [counts, setCounts] = useState<RecipientCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showReplyTo, setShowReplyTo] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Schedule state
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Credit state
  const [credits, setCredits] = useState<{ total: number; used: number; available: number; creditsPerRegistration: number } | null>(null);

  // Slider tabs: compose vs history
  const [sliderTab, setSliderTab] = useState<SliderTab>('compose');

  // History state
  const [historyLogs, setHistoryLogs] = useState<EmailLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState<{ total: number; totalPages: number } | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'delivered' | 'opened' | 'not_opened' | 'failed'>('all');

  // Load counts + credits on open
  useEffect(() => {
    if (open && eventId) {
      setCountsLoading(true);
      Promise.all([
        eventService.getEmailRecipientsCount(eventId),
        eventService.getEmailCredits(eventId),
      ])
        .then(([countsData, creditsData]) => {
          setCounts(countsData);
          setCredits(creditsData);
        })
        .catch(() => toast({ type: 'error', message: 'Failed to load email data' }))
        .finally(() => setCountsLoading(false));
    }
  }, [open, eventId, toast]);

  // Auto-select the 'selected' filter when the slider opens with pre-selected IDs
  useEffect(() => {
    if (open && hasSelection) {
      setFilter('selected');
    } else if (open && !hasSelection) {
      setFilter('all');
    }
  }, [open, hasSelection]);

  // Load history when history tab is active
  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const data = await eventService.getEmailHistory(eventId, page);
      setHistoryLogs(data.logs);
      setHistoryPagination(data.pagination);
      setHistoryPage(page);
    } catch {
      toast({ type: 'error', message: 'Failed to load email history' });
    } finally {
      setHistoryLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (open && sliderTab === 'history') {
      loadHistory(1);
      setExpandedLogId(null);
    }
  }, [open, sliderTab, loadHistory]);

  // Pre-fill subject
  useEffect(() => {
    if (open && eventName && !subject) {
      setSubject(`Update regarding ${eventName}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventName]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // When filter is 'selected', count comes from the passed-in IDs (not the API)
  const recipientCount = filter === 'selected'
    ? (selectedRegistrationIds?.length ?? 0)
    : (counts ? counts[filter as keyof typeof counts] ?? 0 : 0);

  // ── Handlers ────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!subject.trim()) {
      toast({ type: 'error', message: 'Please enter an email subject.' });
      return;
    }
    const stripped = body.replace(/<[^>]*>/g, '').trim();
    if (!stripped) {
      toast({ type: 'error', message: 'Please enter email body content.' });
      return;
    }
    if (recipientCount === 0) {
      toast({ type: 'error', message: 'No recipients match the selected filter.' });
      return;
    }

    setSending(true);
    try {
      // Build scheduledAt ISO string if schedule mode
      let scheduledAtISO: string | undefined;
      if (scheduleMode) {
        if (!scheduledDate) {
          toast({ type: 'error', message: 'Please pick a date to schedule.' });
          setSending(false);
          return;
        }
        const dt = new Date(`${scheduledDate}T${scheduledTime || '09:00'}`);
        if (isNaN(dt.getTime()) || dt <= new Date()) {
          toast({ type: 'error', message: 'Scheduled time must be in the future.' });
          setSending(false);
          return;
        }
        scheduledAtISO = dt.toISOString();
      }

      const result = await eventService.sendBulkEmail(eventId, {
        subject,
        body,
        filter: filter === 'selected' ? 'all' : filter,
        replyTo: replyTo || undefined,
        ...(scheduledAtISO ? { scheduledAt: scheduledAtISO } : {}),
        ...(filter === 'selected' && selectedRegistrationIds?.length
          ? { registrationIds: selectedRegistrationIds }
          : {}),
      });
      if (result.scheduled) {
        const when = result.scheduledAt ? new Date(result.scheduledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        toast({ type: 'success', message: `Email scheduled for ${when} (${result.recipientCount ?? recipientCount} recipients)` });
        onClose();
        setSubject(''); setBody(''); setFilter('all'); setReplyTo('');
        setScheduleMode(false); setScheduledDate(''); setScheduledTime('09:00');
      } else if (result.success) {
        toast({ type: 'success', message: `Email sent to ${result.sent} recipient(s)!` });
        onClose();
        // Refresh credits balance in background
        eventService.getEmailCredits(eventId).then(setCredits).catch(() => {});
        // Reset form
        setSubject('');
        setBody('');
        setFilter('all');
        setReplyTo('');
      } else {
        toast({ type: 'error', message: `Sent ${result.sent}, failed ${result.failed}. ${result.errors?.[0] || ''}` });
      }
    } catch (err: any) {
      toast({ type: 'error', message: err?.response?.data?.message || 'Failed to send email.' });
    } finally {
      setSending(false);
    }
  }, [subject, body, filter, replyTo, recipientCount, eventId, onClose, toast, scheduleMode, scheduledDate, scheduledTime, selectedRegistrationIds, credits]);

  const handleSendTest = useCallback(async () => {
    if (!testEmail.trim()) {
      toast({ type: 'error', message: 'Enter a test email address.' });
      return;
    }
    const stripped = body.replace(/<[^>]*>/g, '').trim();
    if (!subject.trim() || !stripped) {
      toast({ type: 'error', message: 'Fill in subject and body before sending a test.' });
      return;
    }
    setSendingTest(true);
    try {
      const result = await eventService.sendBulkEmail(eventId, {
        subject,
        body,
        testEmail,
        replyTo: replyTo || undefined,
      });
      toast({ type: result.success ? 'success' : 'error', message: result.success ? 'Test email sent!' : 'Test email failed.' });
    } catch {
      toast({ type: 'error', message: 'Failed to send test email.' });
    } finally {
      setSendingTest(false);
    }
  }, [testEmail, subject, body, eventId, replyTo, toast]);

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slider Panel */}
      <div
        className={`fixed top-0 right-0 h-full bg-gray-50 dark:bg-[#0f1117] shadow-2xl z-50 flex flex-col transition-all duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        } ${
          expanded ? 'w-full sm:w-[90vw] lg:w-[1100px]' : 'w-full sm:w-[560px]'
        }`}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="border-b border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sgt-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white leading-none">Email</h2>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-[180px]">{eventName}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Credit badge */}
              {credits !== null && (
                <div
                  title={`⚡ Email Credits\n\nAvailable: ${credits.available}  |  Used: ${credits.used}  |  Total: ${credits.total}\n\nHow it works:\n• Each registration earns ${credits.creditsPerRegistration} credits\n• 1 credit is spent per email sent\n• Failed deliveries are automatically refunded\n• Credits grow as more people register`}
                  className={`hidden sm:flex flex-col items-start gap-0 px-2 py-1 rounded-lg text-xs font-semibold mr-1 ${
                    credits.available === 0
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      : credits.available < 10
                      ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {credits.available} credits
                  </span>
                  <span className="text-[10px] font-normal opacity-70">1 reg = {credits.creditsPerRegistration} credits</span>
                </div>
              )}
              <button
                onClick={() => setExpanded(!expanded)}
                className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
                title={expanded ? 'Collapse panel' : 'Expand panel'}
              >
                {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Tab Selector */}
          <div className="flex px-5 gap-0.5">
            <button
              type="button"
              onClick={() => setSliderTab('compose')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                sliderTab === 'compose'
                  ? 'border-sgt-600 text-sgt-600 dark:text-sgt-400 dark:border-sgt-400'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Compose
            </button>
            <button
              type="button"
              onClick={() => setSliderTab('history')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                sliderTab === 'history'
                  ? 'border-sgt-600 text-sgt-600 dark:text-sgt-400 dark:border-sgt-400'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              History
            </button>
          </div>
        </div>

        {/* ── Scrollable Content ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
         {sliderTab === 'compose' ? (
          <div className="px-5 py-5 space-y-5">

            {/* ── To: Recipients Card ──────────────────────── */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden">
              {/* Recipient count header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
                <div className="flex items-center gap-2.5">
                  <div className="flex -space-x-1.5">
                    {[['bg-sgt-500','A'],['bg-indigo-500','B'],['bg-emerald-500','C']].map(([bg, ltr], i) => (
                      <div key={i} className={`w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-[9px] font-bold text-white ${bg}`}>{ltr}</div>
                    ))}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">
                      {countsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : recipientCount}
                      {!countsLoading && <span className="font-normal text-gray-500 dark:text-gray-400"> recipient{recipientCount !== 1 ? 's' : ''}</span>}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md">To</span>
              </div>

              {/* Filter pills */}
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Filter by status</p>
                <div className="flex flex-wrap gap-1.5">
                  {FILTERS.map((f) => {
                    const active = filter === f.value;
                    const count = f.value === 'selected'
                      ? (selectedRegistrationIds?.length ?? 0)
                      : (counts ? counts[f.value as keyof RecipientCounts] : '…');
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFilter(f.value)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={
                          active
                            ? { backgroundColor: f.color, color: '#fff' }
                            : { backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb' }
                        }
                      >
                        <f.icon className="w-3 h-3" />
                        {f.label}
                        <span className={`px-1.5 py-px rounded text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Compose Card ─────────────────────────────── */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-sgt-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Compose</span>
              </div>

              <div className="p-4 space-y-4">
                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject…"
                    className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 focus:bg-white dark:focus:bg-gray-800 transition-all"
                  />
                </div>

                {/* Body – Rich text editor */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Body</label>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                    {/* Header banner */}
                    <div className="bg-gradient-to-r from-[#0F2573] via-[#266CA9] to-[#4BBAF2] px-5 py-4 text-center">
                      <p className="text-white text-sm font-bold tracking-wide">{eventName || 'Event Name'}</p>
                    </div>
                    {/* Greeting */}
                    <div className="bg-white dark:bg-gray-800 px-4 pt-3 pb-1 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-400 italic">Hi [Recipient Name],</p>
                    </div>
                    {/* Quill editor */}
                    <div className="email-quill-wrapper bg-white dark:bg-gray-800">
                      {typeof window !== 'undefined' && (
                        <ReactQuill
                          theme="snow"
                          value={body}
                          onChange={setBody}
                          modules={QUILL_MODULES}
                          formats={QUILL_FORMATS}
                          placeholder="Write your email content here…"
                          className="email-quill-editor"
                        />
                      )}
                    </div>
                    {/* Footer strip */}
                    <div className="bg-gray-50 dark:bg-gray-800/60 border-t border-gray-100 dark:border-gray-700 px-4 py-2.5 text-center">
                      <p className="text-[10px] font-semibold text-gray-400">SGT Event Portal · {eventName || 'this event'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Advanced Options Card ─────────────────────── */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden">
              {/* Reply-to toggle */}
              <button
                type="button"
                onClick={() => setShowReplyTo(!showReplyTo)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />
                  Reply-to Address
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showReplyTo ? 'rotate-180' : ''}`} />
              </button>
              {showReplyTo && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700/60 pt-3">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Replies will be forwarded to this address.</p>
                  <input
                    type="email"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder="reply-to@example.com"
                    className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
                  />
                </div>
              )}

              <div className="border-t border-gray-100 dark:border-gray-700/60">
                {/* Test email row */}
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5 flex items-center gap-2">
                    <TestTube className="w-3.5 h-3.5" />
                    Send Test Email
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="test@example.com"
                      className="flex-1 px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleSendTest}
                      disabled={sendingTest}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Test
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Warning note ──────────────────────────────── */}
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                Sent via <span className="font-semibold">SGT Mail Service</span>. Review subject &amp; body carefully before sending.
              </p>
            </div>

          </div>
         ) : (
          /* ── HISTORY TAB ─────────────────────────────────── */
          <div className="px-6 py-5 space-y-4">
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <span className="text-sm">Loading email history…</span>
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Mail className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No emails sent yet</p>
                <p className="text-xs mt-1">Emails you send will appear here.</p>
              </div>
            ) : (
              <>
                {historyLogs.map((log) => {
                  const expanded = expandedLogId === log.id;
                  const isScheduled = log.status === 'scheduled';
                  const isCancelled = log.status === 'cancelled';
                  const statusColor =
                    log.status === 'sent' ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
                    : log.status === 'partial' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'
                    : log.status === 'scheduled' ? 'text-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400'
                    : log.status === 'cancelled' ? 'text-gray-500 bg-gray-100 dark:bg-gray-700/40 dark:text-gray-400'
                    : 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
                  const StatusIcon = log.status === 'sent' ? CheckCircle2
                    : log.status === 'partial' ? AlertCircle
                    : log.status === 'scheduled' ? Calendar
                    : log.status === 'cancelled' ? Ban
                    : XCircle;

                  // Filter recipient details
                  const filteredRecipients = (log.recipientDetails || []).filter((r) => {
                    if (recipientFilter === 'all') return true;
                    if (recipientFilter === 'delivered') return r.status === 'delivered';
                    if (recipientFilter === 'opened') return r.openCount > 0;
                    if (recipientFilter === 'not_opened') return r.openCount === 0 && r.status === 'delivered';
                    if (recipientFilter === 'failed') return r.status === 'failed' || r.status === 'bounced';
                    return true;
                  });

                  return (
                    <div key={log.id} className={`rounded-lg border overflow-hidden ${
                      isScheduled ? 'border-violet-300 dark:border-violet-700' :
                      isCancelled ? 'border-gray-200 dark:border-gray-700 opacity-60' :
                      'border-gray-200 dark:border-gray-700'
                    }`}>
                      {/* Summary Row */}
                      <button
                        type="button"
                        onClick={() => { if (!isScheduled) { setExpandedLogId(expanded ? null : log.id); setRecipientFilter('all'); } }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isScheduled ? 'cursor-default bg-violet-50/50 dark:bg-violet-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        {!isScheduled && <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`} />}
                        {isScheduled && <Calendar className="w-4 h-4 text-violet-500 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{log.subject}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {isScheduled && log.scheduledAt ? (
                              <>
                                <Calendar className="w-3 h-3 text-violet-500" />
                                <span className="text-violet-600 dark:text-violet-400 font-medium">
                                  Scheduled: {new Date(log.scheduledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span>·</span>
                                <span>{log.recipientCount} recipients</span>
                              </>
                            ) : (
                              <>
                                <span>{new Date(log.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                <span>·</span>
                                <span>{new Date(log.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                <span>·</span>
                                <span className="capitalize">{log.filter}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!isScheduled && <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{log.sentCount}/{log.recipientCount}</span>}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor}`}>
                            <StatusIcon className="w-3 h-3" />
                            {log.status}
                          </span>
                          {/* Cancel button for scheduled emails */}
                          {isScheduled && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setCancellingId(log.id);
                                try {
                                  await eventService.cancelScheduledEmail(eventId, log.id);
                                  toast({ type: 'success', message: 'Scheduled email cancelled.' });
                                  loadHistory(historyPage);
                                } catch {
                                  toast({ type: 'error', message: 'Failed to cancel scheduled email.' });
                                } finally {
                                  setCancellingId(null);
                                }
                              }}
                              disabled={cancellingId === log.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-md bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                            >
                              {cancellingId === log.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                              Cancel
                            </button>
                          )}
                        </div>
                      </button>

                      {/* Expanded Detail */}
                      {expanded && (
                        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-4 py-4 space-y-4 text-sm">

                          {/* ── Stats Dashboard ──────────────── */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
                              <ArrowDownCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                              <div>
                                <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase">Delivered</p>
                                <p className="text-lg font-bold text-green-700 dark:text-green-300">{log.deliveredCount}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40">
                              <MailOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <div>
                                <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase">Opened</p>
                                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{log.openedCount}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600">
                              <MailX className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                              <div>
                                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Not Opened</p>
                                <p className="text-lg font-bold text-gray-700 dark:text-gray-300">{log.notOpenedCount}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
                              <Ban className="w-4 h-4 text-red-500 dark:text-red-400" />
                              <div>
                                <p className="text-[10px] font-semibold text-red-500 dark:text-red-400 uppercase">Failed</p>
                                <p className="text-lg font-bold text-red-600 dark:text-red-300">{log.failedCount}</p>
                              </div>
                            </div>
                          </div>

                          {/* ── Open Rate Bar ─────────────────── */}
                          {log.deliveredCount > 0 && (
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Open Rate</span>
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                  {Math.round((log.openedCount / log.deliveredCount) * 100)}%
                                </span>
                              </div>
                              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full transition-all"
                                  style={{ width: `${Math.round((log.openedCount / log.deliveredCount) * 100)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* ── Meta Grid ─────────────────────── */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Sent By</span>
                              <p className="text-gray-800 dark:text-gray-200 mt-0.5">{log.sentByName || 'Unknown'}</p>
                              {log.sentByEmail && <p className="text-xs text-gray-400">{log.sentByEmail}</p>}
                            </div>
                            <div>
                              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Reply-To</span>
                              <p className="text-gray-800 dark:text-gray-200 mt-0.5">{log.replyTo || 'Default'}</p>
                            </div>
                            <div>
                              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Sent At</span>
                              <p className="text-gray-800 dark:text-gray-200 mt-0.5">
                                {new Date(log.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </p>
                            </div>
                            <div>
                              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Filter Used</span>
                              <p className="text-gray-800 dark:text-gray-200 mt-0.5 capitalize">{log.filter}</p>
                            </div>
                          </div>

                          {/* ── Errors ─────────────────────────── */}
                          {log.errors && log.errors.length > 0 && (
                            <div>
                              <span className="text-[11px] font-semibold text-red-500 uppercase tracking-wider">Errors</span>
                              <div className="mt-1 p-2 rounded bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300 space-y-0.5">
                                {log.errors.map((err, i) => <p key={i}>• {err}</p>)}
                              </div>
                            </div>
                          )}

                          {/* ── Recipient Filter Pills ─────────── */}
                          <div>
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                              Recipients ({log.recipientDetails?.length || 0})
                            </span>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {([
                                { key: 'all' as const, label: 'All', count: log.recipientDetails?.length || 0, color: '#6366f1' },
                                { key: 'delivered' as const, label: 'Delivered', count: log.deliveredCount, color: '#10b981' },
                                { key: 'opened' as const, label: 'Opened', count: log.openedCount, color: '#3b82f6' },
                                { key: 'not_opened' as const, label: 'Not Opened', count: log.notOpenedCount, color: '#6b7280' },
                                { key: 'failed' as const, label: 'Failed', count: log.failedCount + (log.bouncedCount || 0), color: '#ef4444' },
                              ]).map((f) => {
                                const active = recipientFilter === f.key;
                                return (
                                  <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setRecipientFilter(f.key)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all"
                                    style={active ? { backgroundColor: f.color, color: '#fff', borderColor: f.color } : { borderColor: '#d1d5db' }}
                                  >
                                    {f.label}
                                    <span className={`px-1 py-0 rounded-full text-[9px] ${active ? 'bg-white/25 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                                      {f.count}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Recipient List */}
                            <div className="max-h-52 overflow-y-auto rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                              {filteredRecipients.length === 0 ? (
                                <div className="px-3 py-4 text-center text-xs text-gray-400">No recipients match this filter.</div>
                              ) : (
                                filteredRecipients.map((r) => {
                                  const rStatusColor =
                                    r.status === 'delivered' && r.openCount > 0 ? 'text-blue-600 dark:text-blue-400'
                                    : r.status === 'delivered' ? 'text-green-600 dark:text-green-400'
                                    : r.status === 'failed' || r.status === 'bounced' ? 'text-red-500 dark:text-red-400'
                                    : 'text-gray-500 dark:text-gray-400';
                                  const RIcon =
                                    r.openCount > 0 ? MailOpen
                                    : r.status === 'delivered' ? CheckCircle2
                                    : r.status === 'failed' || r.status === 'bounced' ? XCircle
                                    : Clock;
                                  return (
                                    <div key={r.id} className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                      <div className="w-7 h-7 rounded-full bg-sgt-100 dark:bg-sgt-900/40 flex items-center justify-center text-[10px] font-bold text-sgt-700 dark:text-sgt-300 shrink-0">
                                        {(r.name || r.email || '?').charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{r.name || 'Unknown'}</p>
                                        <p className="text-[11px] text-gray-400 truncate">{r.email}</p>
                                      </div>
                                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${rStatusColor}`}>
                                          <RIcon className="w-3 h-3" />
                                          {r.openCount > 0 ? `Opened (${r.openCount}×)` : r.status === 'delivered' ? 'Delivered' : r.status === 'bounced' ? 'Bounced' : r.status === 'failed' ? 'Failed' : 'Sent'}
                                        </span>
                                        {r.openCount > 0 && r.firstOpenedAt && (
                                          <span className="text-[9px] text-gray-400">
                                            First: {new Date(r.firstOpenedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                        {r.deliveredAt && r.openCount === 0 && (
                                          <span className="text-[9px] text-gray-400">
                                            {new Date(r.deliveredAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                        {r.failureReason && (
                                          <span className="text-[9px] text-red-400 max-w-[140px] truncate" title={r.failureReason}>
                                            {r.failureReason}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* ── Body Preview ───────────────────── */}
                          <div>
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Email Body Preview</span>
                            <div
                              className="mt-1 p-3 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 max-h-40 overflow-y-auto prose prose-sm dark:prose-invert"
                              dangerouslySetInnerHTML={{ __html: log.body }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Pagination */}
                {historyPagination && historyPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      disabled={historyPage <= 1}
                      onClick={() => loadHistory(historyPage - 1)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-gray-500">
                      Page {historyPage} of {historyPagination.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={historyPage >= historyPagination.totalPages}
                      onClick={() => loadHistory(historyPage + 1)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
         )}
        </div>

        {/* ── Footer Actions ──────────────────────────────── */}
        {sliderTab === 'compose' && (
        <div className="border-t border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900">
          {/* Schedule date/time picker (shown when schedule mode is on) */}
          {scheduleMode && (
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/60 bg-violet-50 dark:bg-violet-900/10 flex flex-wrap items-center gap-3">
              <Calendar className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
              <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">Schedule for</span>
              <input
                type="date"
                value={scheduledDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="flex-1 min-w-[120px] px-3 py-1.5 border border-violet-300 dark:border-violet-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
              />
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-28 px-3 py-1.5 border border-violet-300 dark:border-violet-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
              />
            </div>
          )}

          {/* Insufficient credit warning */}
          {credits !== null && recipientCount > 0 && credits.available < recipientCount && (
            <div className="px-5 py-2.5 bg-red-50 dark:bg-red-900/10 border-b border-red-200 dark:border-red-800/40 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                <p><strong>Not enough credits</strong> — <strong>{credits.available}</strong> available, <strong>{recipientCount}</strong> needed.</p>
                <p className="text-red-500/80 dark:text-red-400/70">Each registration gives {credits.creditsPerRegistration} credits · 1 credit = 1 email · failed sends are refunded automatically.</p>
              </div>
            </div>
          )}

          <div className="px-5 py-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0"
            >
              Cancel
            </button>

            {/* Schedule toggle */}
            <button
              type="button"
              onClick={() => setScheduleMode(!scheduleMode)}
              title={scheduleMode ? 'Switch back to Send Now' : 'Schedule for later'}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all shrink-0 ${
                scheduleMode
                  ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-400 text-violet-600 dark:text-violet-400'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-400 hover:text-violet-600 hover:border-violet-400'
              }`}
            >
              <Calendar className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={sending || recipientCount === 0 || (scheduleMode && !scheduledDate) || (!!credits && credits.available < recipientCount)}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
                scheduleMode
                  ? 'bg-violet-600 hover:bg-violet-700 active:bg-violet-800'
                  : 'bg-sgt-600 hover:bg-sgt-700 active:bg-sgt-800'
              }`}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {scheduleMode ? 'Scheduling…' : `Sending to ${recipientCount}…`}
                </>
              ) : scheduleMode ? (
                <>
                  <Calendar className="w-4 h-4" />
                  Schedule{scheduledDate && scheduledTime ? ` · ${new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ' for later'}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send to {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
        )}
      </div>

      <style jsx global>{`
        /* Quill editor inside email slider */
        .email-quill-editor .ql-toolbar {
          border: none;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
          padding: 6px 10px;
        }
        .dark .email-quill-editor .ql-toolbar {
          background: #374151;
          border-bottom-color: #4b5563;
        }
        .dark .email-quill-editor .ql-toolbar .ql-stroke { stroke: #d1d5db; }
        .dark .email-quill-editor .ql-toolbar .ql-fill { fill: #d1d5db; }
        .dark .email-quill-editor .ql-toolbar .ql-picker { color: #d1d5db; }
        .email-quill-editor .ql-container {
          border: none;
          font-size: 14px;
          min-height: 120px;
          max-height: 220px;
          overflow-y: auto;
        }
        .email-quill-editor .ql-editor {
          padding: 12px 16px;
          line-height: 1.6;
          color: #1f2937;
        }
        .dark .email-quill-editor .ql-editor { color: #e5e7eb; }
        .email-quill-editor .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: normal;
        }
      `}</style>
    </>
  );
}
