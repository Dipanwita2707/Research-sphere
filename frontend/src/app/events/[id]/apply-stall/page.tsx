'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Store, ChevronRight, ChevronLeft, CheckCircle,
  Upload, Trash2, AlertCircle, Zap, Droplets, Plus, FileText,
  QrCode, Download, Star, BarChart2, MessageSquare, Award,
  Package, Clock, Badge, Info, TrendingUp, Hash
} from 'lucide-react';
import QRCode from 'qrcode';
import { eventService } from '@/features/event-management/services/event.service';
import type { StallApplication, StallApplicationFormData, StallType } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { getErrorMessage } from '@/shared/utils/errorHandler';

type StallDashTab = 'details' | 'qr' | 'feedback';

const STALL_FEEDBACK_LABELS = [
  'Overall Experience', 'Product / Food Quality', 'Pricing & Value',
  'Staff Friendliness', 'Cleanliness', 'Presentation & Setup',
  'Wait Time', 'Variety', 'Packaging', 'Would Recommend',
];

const STALL_TYPES: { value: StallType; label: string; desc: string }[] = [
  { value: 'food', label: 'Food & Beverage', desc: 'Snacks, beverages, meals' },
  { value: 'non_food', label: 'Non-Food Products', desc: 'Clothing, accessories, gadgets' },
  { value: 'service', label: 'Service / Activity', desc: 'Games, workshops, services' },
  { value: 'other', label: 'Other', desc: 'Anything that doesn\'t fit above' },
];

const STEPS = [
  { id: 1, label: 'Stall Info' },
  { id: 2, label: 'Business Details' },
  { id: 3, label: 'Infrastructure' },
  { id: 4, label: 'Documents' },
  { id: 5, label: 'Review & Submit' },
];

interface FormState extends StallApplicationFormData {
  products: string[];
}

const defaultForm: FormState = {
  stallName: '',
  stallType: 'non_food',
  category: '',
  businessName: '',
  businessDescription: '',
  products: [''],
  spaceRequired: undefined,
  electricityRequired: false,
  waterRequired: false,
  specialRequirements: '',
  gstNumber: '',
  foodLicenseNumber: '',
  documentUrls: [],
  termsAccepted: false,
};

export default function ApplyStallPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingApplication, setExistingApplication] = useState<StallApplication | null>(null);
  const [eventName, setEventName] = useState('');

  // Approved stall dashboard state
  const [activeTab, setActiveTab] = useState<StallDashTab>('details');
  const [stallQrDataUrl, setStallQrDataUrl] = useState<string>('');
  const [feedbackData, setFeedbackData] = useState<{
    feedback: Array<{ id: string; points: number[]; shortDescription: string | null; createdAt: string }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
    summary: { totalFeedback: number; overallAvg: number; perCriterion: Array<{ label: string; avg: number }> };
  } | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      eventService.getEvent(eventId),
      eventService.getMyStallApplication(eventId).catch(() => null),
    ]).then(([event, app]) => {
      setEventName(event.name);
      if (app) setExistingApplication(app);
    }).catch(() => {
      toast({ type: 'error', message: 'Failed to load event details' });
    }).finally(() => setLoading(false));
  }, [eventId, toast]);

  // Generate QR when qr tab is opened
  const generateQr = useCallback(async (app: StallApplication) => {
    if (stallQrDataUrl) return;
    const path = app.qrCode || `/events/${eventId}/stalls/${app.stallId}/feedback`;
    const fullUrl = path.startsWith('http') ? path : `${window.location.origin}${path}`;
    try {
      const url = await QRCode.toDataURL(fullUrl, { width: 280, margin: 2, color: { dark: '#1e1b4b', light: '#ffffff' } });
      setStallQrDataUrl(url);
    } catch { /* ignore */ }
  }, [eventId, stallQrDataUrl]);

  // Fetch feedback when feedback tab is opened
  const fetchFeedback = useCallback(async (stallId: string) => {
    if (feedbackData) return;
    setFeedbackLoading(true);
    try {
      const data = await eventService.getStallOwnerFeedback(eventId, stallId);
      setFeedbackData(data);
    } catch {
      toast({ type: 'error', message: 'Could not load feedback' });
    } finally {
      setFeedbackLoading(false);
    }
  }, [eventId, feedbackData, toast]);

  const update = (fields: Partial<FormState>) => setForm((f) => ({ ...f, ...fields }));

  const addProduct = () => update({ products: [...form.products, ''] });
  const removeProduct = (i: number) => update({ products: form.products.filter((_, idx) => idx !== i) });
  const updateProduct = (i: number, v: string) => {
    const p = [...form.products]; p[i] = v; update({ products: p });
  };

  const handleSubmit = async () => {
    if (!form.termsAccepted) {
      toast({ type: 'error', message: 'You must accept the terms and conditions' });
      return;
    }
    setSubmitting(true);
    try {
      const payload: StallApplicationFormData = {
        ...form,
        products: form.products.filter(Boolean),
      };
      await eventService.submitStallApplication(eventId, payload);
      toast({ type: 'success', message: 'Application submitted successfully!' });
      router.push('/events/stall-opportunities');
    } catch (err) {
      toast({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center">
        <CardSkeleton className="max-w-sm w-full" />
      </div>
    );
  }

  // Already applied – show status / dashboard
  if (existingApplication) {
    const statusConfig = {
      pending: { label: 'Under Review', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-400' },
      approved: { label: 'Approved', color: 'text-green-600', bg: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
      rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
      withdrawn: { label: 'Withdrawn', color: 'text-gray-600', bg: 'bg-gray-50 border-[#b3cde0]', dot: 'bg-gray-400' },
    };
    const s = statusConfig[existingApplication.status] ?? statusConfig.pending;
    const isApproved = existingApplication.status ===
   'approved';

    // ─── Non-approved: simple status card ───────────────────
    if (!isApproved) {
      return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 py-6 px-4">
          <div className="max-w-2xl mx-auto">
            <Link href="/events/stall-opportunities" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-ev-700 mb-5 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to opportunities
            </Link>
            <div className={`rounded-xl border p-8 text-center ${s.bg}`}>
              <CheckCircle className={`w-12 h-12 mx-auto mb-3 ${s.color}`} />
              <h2 className={`text-xl font-bold ${s.color} mb-1`}>Application {s.label}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Your stall application for <strong>{eventName}</strong> is {s.label.toLowerCase()}.
              </p>
              <div className="text-left bg-white dark:bg-gray-800 rounded-lg p-4 space-y-2 text-sm max-w-sm mx-auto">
                <div className="flex justify-between"><span className="text-gray-500">Stall Name</span><span className="font-medium">{existingApplication.stallName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium capitalize">{existingApplication.stallType?.replace('_', ' ')}</span></div>
                {existingApplication.reviewNote && (
                  <div className="pt-2 border-t border-[#b3cde0]">
                    <span className="text-gray-500 block mb-1">Review Note</span>
                    <p className="text-gray-700 dark:text-gray-300 italic">{existingApplication.reviewNote}</p>
                  </div>
                )}
                {existingApplication.rejectionReason && (
                  <div className="pt-2 border-t border-[#b3cde0]">
                    <span className="text-gray-500 block mb-1">Rejection Reason</span>
                    <p className="text-red-600 italic">{existingApplication.rejectionReason}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ─── Approved: full stall owner dashboard with tabs ─────
    const TABS: { id: StallDashTab; label: string; icon: React.ReactNode }[] = [
      { id: 'details', label: 'My Stall', icon: <Store className="w-4 h-4" /> },
      { id: 'qr', label: 'QR Code', icon: <QrCode className="w-4 h-4" /> },
      { id: 'feedback', label: 'Feedback', icon: <MessageSquare className="w-4 h-4" /> },
    ];

    const handleTabChange = (tab: StallDashTab) => {
      setActiveTab(tab);
      if (tab ===
   'qr') generateQr(existingApplication);
      if (tab ===
   'feedback' && existingApplication.stallId) fetchFeedback(existingApplication.stallId);
    };

    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-4 pt-6 pb-16 text-white">
          <div className="max-w-3xl mx-auto">
            <Link href="/events/stall-opportunities" className="inline-flex items-center gap-1.5 text-sm text-violet-200 hover:text-white mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to opportunities
            </Link>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Store className="w-5 h-5 text-violet-200" />
                  <h1 className="text-xl font-bold">{existingApplication.stallName}</h1>
                </div>
                <p className="text-violet-200 text-sm">{eventName}</p>
                {existingApplication.stallId && (
                  <p className="text-xs text-violet-300 font-mono mt-1">ID: {existingApplication.stallId}</p>
                )}
              </div>
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1.5 rounded-full">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className="text-sm font-medium">{s.label}</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{feedbackData?.summary.totalFeedback ?? '—'}</p>
                <p className="text-xs text-violet-200 mt-0.5">Reviews</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">
                  {feedbackData?.summary.overallAvg ? feedbackData.summary.overallAvg.toFixed(1) : '—'}
                </p>
                <p className="text-xs text-violet-200 mt-0.5">Avg Score</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
                <p className="text-2xl font-bold capitalize">{existingApplication.stallType?.replace('_', ' ') ?? '—'}</p>
                <p className="text-xs text-violet-200 mt-0.5">Stall Type</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-3xl mx-auto px-4 -mt-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#b3cde0] dark:border-gray-700 shadow-ev overflow-hidden">
            {/* Tab Bar */}
            <div className="flex border-b border-[#b3cde0] dark:border-gray-700">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                    activeTab ===
   tab.id
                      ? 'text-violet-600 border-b-2 border-violet-600 bg-violet-50/50 dark:bg-violet-900/10'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ─── Tab: My Stall Details ─── */}
            {activeTab ===
   'details' && (
              <div className="p-5 space-y-5">
                {/* Basic Info */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Stall Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { icon: <Store className="w-4 h-4 text-violet-500" />, label: 'Stall Name', value: existingApplication.stallName },
                      { icon: <Hash className="w-4 h-4 text-violet-500" />, label: 'Stall ID', value: existingApplication.stallId || '(pending assignment)' },
                      { icon: <Package className="w-4 h-4 text-violet-500" />, label: 'Stall Type', value: STALL_TYPES.find(t => t.value ===
   existingApplication.stallType)?.label },
                      { icon: <Badge className="w-4 h-4 text-violet-500" />, label: 'Category', value: existingApplication.category || '—' },
                    ].map(({ icon, label, value }) => (
                      <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                        <div className="mt-0.5">{icon}</div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                          <p className="text-sm font-medium text-ev-900 dark:text-white mt-0.5">{value || '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Business Info */}
                {(existingApplication.businessName || existingApplication.businessDescription) && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Business Details</h3>
                    <div className="space-y-2">
                      {existingApplication.businessName && (
                        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Business Name</p>
                          <p className="text-sm font-medium text-ev-900 dark:text-white mt-0.5">{existingApplication.businessName}</p>
                        </div>
                      )}
                      {existingApplication.businessDescription && (
                        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Description</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 leading-relaxed">{existingApplication.businessDescription}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Products */}
                {existingApplication.products && existingApplication.products.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Products / Services</h3>
                    <div className="flex flex-wrap gap-2">
                      {existingApplication.products.map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-sm rounded-full border border-violet-200 dark:border-violet-700">
                          <Package className="w-3 h-3" /> {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Infrastructure */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Infrastructure</h3>
                  <div className="flex flex-wrap gap-2">
                    {existingApplication.spaceRequired && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg">
                        <BarChart2 className="w-3.5 h-3.5" /> {existingApplication.spaceRequired} sq ft
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${existingApplication.electricityRequired ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 line-through'}`}>
                      <Zap className="w-3.5 h-3.5" /> Electricity
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${existingApplication.waterRequired ? 'bg-ev-50 dark:bg-ev-900/20 text-ev-800 dark:text-ev-200 border border-ev-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 line-through'}`}>
                      <Droplets className="w-3.5 h-3.5" /> Water
                    </span>
                  </div>
                  {existingApplication.specialRequirements && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Special requirements: </span>
                      {existingApplication.specialRequirements}
                    </p>
                  )}
                </div>

                {/* Dates */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Application Timeline</h3>
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4" />
                      Applied: {new Date(existingApplication.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    {existingApplication.reviewedAt && (
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        Approved: {new Date(existingApplication.reviewedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                  {existingApplication.reviewNote && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Note from organizer</p>
                      <p className="text-sm text-green-800 dark:text-green-300 italic">{existingApplication.reviewNote}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Tab: QR Code ─── */}
            {activeTab ===
   'qr' && (
              <div className="p-6 flex flex-col items-center text-center">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-ev-900 dark:text-white mb-1">Customer Feedback QR Code</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Print and display this at your stall. Customers scan it to leave feedback.
                  </p>
                </div>

                {stallQrDataUrl ? (
                  <>
                    <div className="p-4 bg-white rounded-2xl border-2 border-violet-200 shadow-lg inline-block mb-4">
                      <img src={stallQrDataUrl} alt="Stall QR" className="w-52 h-52" />
                    </div>
                    <p className="text-xs font-mono text-gray-500 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg mb-5">
                      {existingApplication.stallId}
                    </p>
                    <a
                      href={stallQrDataUrl}
                      download={`stall-qr-${existingApplication.stallId}.png`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors shadow-ev"
                    >
                      <Download className="w-4 h-4" /> Download QR Code
                    </a>
                    <p className="text-xs text-gray-400 mt-4">
                      Scan URL: {typeof window !== 'undefined' ? window.location.origin : ''}{existingApplication.qrCode || `/events/${eventId}/stalls/${existingApplication.stallId}/feedback`}
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <div className="w-52 h-52 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />
                    <p className="text-sm text-gray-400">Generating QR code…</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── Tab: Feedback ─── */}
            {activeTab ===
   'feedback' && (
              <div className="p-5">
                {feedbackLoading ? (
                  <div className="space-y-3 py-4">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />)}
                  </div>
                ) : feedbackData ? (
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-violet-700 dark:text-violet-300">
                          {feedbackData.summary.totalFeedback}
                        </p>
                        <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">Total Reviews</p>
                      </div>
                      <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-violet-700 dark:text-violet-300">
                          {feedbackData.summary.overallAvg > 0 ? feedbackData.summary.overallAvg.toFixed(1) : '—'}
                        </p>
                        <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">Overall Average /10</p>
                      </div>
                    </div>

                    {/* Per-Criterion Bars */}
                    {feedbackData.summary.totalFeedback > 0 && feedbackData.summary.perCriterion && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Breakdown by Criteria</h3>
                        <div className="space-y-3">
                          {feedbackData.summary.perCriterion.map(({ label, avg }) => (
                            <div key={label}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-700 dark:text-gray-300">{label}</span>
                                <span className="font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
                                  {avg.toFixed(1)}<span className="text-gray-400 font-normal text-xs">/10</span>
                                </span>
                              </div>
                              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${(avg / 10) * 100}%`,
                                    background: avg >= 7 ? '#7c3aed' : avg >= 4 ? '#f59e0b' : '#ef4444',
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Feedback */}
                    {feedbackData.feedback.length > 0 ? (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                          Recent Feedback ({feedbackData.pagination.total})
                        </h3>
                        <div className="space-y-3">
                          {feedbackData.feedback.map((fb) => {
                            const avg = fb.points.reduce((a, b) => a + b, 0) / fb.points.length;
                            return (
                              <div key={fb.id} className="p-4 rounded-xl border border-[#b3cde0] dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                    <span className="text-sm font-semibold text-ev-900 dark:text-white">
                                      {avg.toFixed(1)}<span className="text-gray-400 font-normal text-xs">/10</span>
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-400">
                                    {new Date(fb.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  </span>
                                </div>
                                {fb.shortDescription && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">"{fb.shortDescription}"</p>
                                )}
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {fb.points.map((p, i) => (
                                    <span
                                      key={i}
                                      title={STALL_FEEDBACK_LABELS[i]}
                                      className={`text-xs px-2 py-0.5 rounded-full ${p >= 7 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : p >= 4 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}
                                    >
                                      {STALL_FEEDBACK_LABELS[i]?.split(' ')[0]}: {p}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10">
                        <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No feedback yet</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Share your QR code with customers to start collecting feedback
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <TrendingUp className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading feedback data…</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 py-6 px-4">
      <div className="max-w-2xl mx-auto">

        <Link href="/events/stall-opportunities" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-ev-700 mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to opportunities
        </Link>

        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-6 h-6 text-ev-700" />
            <h1 className="text-xl font-bold text-ev-900 dark:text-white">Apply for Stall</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{eventName}</p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => s.id < step && setStep(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${step ===
   s.id
                    ? 'bg-ev-700 text-white'
                    : s.id < step
                      ? 'bg-ev-100 text-ev-800 dark:bg-ev-900/20 dark:text-ev-200 cursor-pointer'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-default'
                  }`}
              >
                {s.id < step ? <CheckCircle className="w-3.5 h-3.5" /> : <span>{s.id}</span>}
                {s.label}
              </button>
              {i < STEPS.length - 1 && <div className="w-3 h-px bg-gray-200 dark:bg-gray-600 shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#b3cde0] dark:border-gray-700 p-6 space-y-6">

          {/* ─── Step 1: Stall Info ─── */}
          {step ===
   1 && (
            <>
              <h2 className="font-semibold text-ev-900 dark:text-white">Stall Information</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Stall Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.stallName}
                  onChange={(e) => update({ stallName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-700 outline-none"
                  placeholder="e.g. Spicy Bites, Artisan Crafts"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stall Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STALL_TYPES.map((t) => (
                    <label
                      key={t.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.stallType ===
   t.value
                          ? 'border-[#b3cde0] bg-ev-50/50 dark:bg-ev-900/10'
                          : 'border-[#b3cde0] dark:border-gray-600 hover:border-gray-300'
                        }`}
                    >
                      <input
                        type="radio"
                        name="stallType"
                        value={t.value}
                        checked={form.stallType ===
   t.value}
                        onChange={() => update({ stallType: t.value })}
                        className="mt-0.5 w-4 h-4 text-ev-700"
                      />
                      <div>
                        <p className="text-sm font-medium text-ev-900 dark:text-white">{t.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category (optional)</label>
                <input
                  type="text"
                  value={form.category || ''}
                  onChange={(e) => update({ category: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-700 outline-none"
                  placeholder="e.g. Fast food, Electronics, Jewellery"
                />
              </div>
            </>
          )}

          {/* ─── Step 2: Business Details ─── */}
          {step ===
   2 && (
            <>
              <h2 className="font-semibold text-ev-900 dark:text-white">Business Details</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Business / Brand Name</label>
                <input
                  type="text"
                  value={form.businessName || ''}
                  onChange={(e) => update({ businessName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-700 outline-none"
                  placeholder="Your business or brand name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Business Description</label>
                <textarea
                  value={form.businessDescription || ''}
                  onChange={(e) => update({ businessDescription: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-700 outline-none resize-none"
                  placeholder="Describe what your business does, what you'll sell, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Products / Services (optional)</label>
                <div className="space-y-2">
                  {form.products.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={p}
                        onChange={(e) => updateProduct(i, e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-700 outline-none"
                        placeholder={`Product / service ${i + 1}`}
                      />
                      {form.products.length > 1 && (
                        <button type="button" onClick={() => removeProduct(i)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addProduct}
                  className="mt-2 inline-flex items-center gap-1 text-sm text-ev-700 hover:text-ev-800 font-medium"
                >
                  <Plus className="w-4 h-4" /> Add product / service
                </button>
              </div>
            </>
          )}

          {/* ─── Step 3: Infrastructure ─── */}
          {step ===
   3 && (
            <>
              <h2 className="font-semibold text-ev-900 dark:text-white">Infrastructure Requirements</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Space Required (sq ft)</label>
                <input
                  type="number"
                  min={1}
                  value={form.spaceRequired ?? ''}
                  onChange={(e) => update({ spaceRequired: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-700 outline-none"
                  placeholder="e.g. 100"
                />
              </div>

              <div className="flex gap-4">
                <label className={`flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${form.electricityRequired ? 'border-[#b3cde0] bg-ev-50/50' : 'border-[#b3cde0] dark:border-gray-600 hover:border-gray-300'}`}>
                  <input
                    type="checkbox"
                    checked={form.electricityRequired || false}
                    onChange={(e) => update({ electricityRequired: e.target.checked })}
                    className="w-4 h-4 text-ev-700"
                  />
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium text-ev-900 dark:text-white">Electricity Required</span>
                  </div>
                </label>

                <label className={`flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${form.waterRequired ? 'border-[#b3cde0] bg-ev-50/50' : 'border-[#b3cde0] dark:border-gray-600 hover:border-gray-300'}`}>
                  <input
                    type="checkbox"
                    checked={form.waterRequired || false}
                    onChange={(e) => update({ waterRequired: e.target.checked })}
                    className="w-4 h-4 text-ev-700"
                  />
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-ev-700" />
                    <span className="text-sm font-medium text-ev-900 dark:text-white">Water Required</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Special Requirements</label>
                <textarea
                  value={form.specialRequirements || ''}
                  onChange={(e) => update({ specialRequirements: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-700 outline-none resize-none"
                  placeholder="Any other setup or infrastructure requirements..."
                />
              </div>
            </>
          )}

          {/* ─── Step 4: Documents ─── */}
          {step ===
   4 && (
            <>
              <h2 className="font-semibold text-ev-900 dark:text-white">Documents & Compliance</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                These are optional but may be required depending on event organizer requirements.
              </p>

              {form.stallType ===
   'food' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    FSSAI / Food License Number
                  </label>
                  <input
                    type="text"
                    value={form.foodLicenseNumber || ''}
                    onChange={(e) => update({ foodLicenseNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-700 outline-none"
                    placeholder="FSSAI license number"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">GST Number (if applicable)</label>
                <input
                  type="text"
                  value={form.gstNumber || ''}
                  onChange={(e) => update({ gstNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-700 outline-none"
                  placeholder="15-digit GST number"
                />
              </div>

              <div className="p-4 bg-ev-50 dark:bg-ev-900/20 rounded-lg border border-ev-200 dark:border-ev-800">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-ev-700 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-ev-800 dark:text-ev-200">Document uploads</p>
                    <p className="text-xs text-ev-700 dark:text-ev-400 mt-0.5">
                      Physical documents may be required on the event day. The organizer will contact you if additional documents are needed.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ─── Step 5: Review & Submit ─── */}
          {step ===
   5 && (
            <>
              <h2 className="font-semibold text-ev-900 dark:text-white">Review & Submit</h2>

              <div className="space-y-3">
                {/* Summary Cards */}
                {[
                  { label: 'Stall Name', value: form.stallName },
                  { label: 'Stall Type', value: STALL_TYPES.find(t => t.value ===
   form.stallType)?.label },
                  { label: 'Category', value: form.category || '—' },
                  { label: 'Business Name', value: form.businessName || '—' },
                  { label: 'Space Required', value: form.spaceRequired ? `${form.spaceRequired} sq ft` : '—' },
                  { label: 'Electricity', value: form.electricityRequired ? 'Yes' : 'No' },
                  { label: 'Water', value: form.waterRequired ? 'Yes' : 'No' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-[#b3cde0]/30 dark:border-gray-700 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{label}</span>
                    <span className="font-medium text-ev-900 dark:text-white">{value || '—'}</span>
                  </div>
                ))}
              </div>

              {/* Terms */}
              <div className={`p-4 rounded-lg border ${form.termsAccepted ? 'border-ev-200 bg-ev-50/30 dark:bg-ev-900/10' : 'border-[#b3cde0] dark:border-gray-700'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.termsAccepted}
                    onChange={(e) => update({ termsAccepted: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-ev-700"
                  />
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    I confirm that all information provided is accurate. I agree to abide by the event organizer's stall guidelines, pay any applicable stall fees, and maintain my stall responsibly during the event.
                  </div>
                </label>
              </div>

              {!form.termsAccepted && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Please accept the terms to submit your application
                </div>
              )}
            </>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step ===
   1}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#b3cde0] dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {step < STEPS.length ? (
            <button
              type="button"
              onClick={() => {
                // Basic validation per step
                if (step ===
   1 && !form.stallName.trim()) {
                  toast({ type: 'error', message: 'Please enter a stall name' });
                  return;
                }
                setStep((s) => s + 1);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-ev-700 text-white text-sm font-medium rounded-lg hover:bg-ev-800 transition-colors"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !form.termsAccepted}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-ev-700 text-white text-sm font-medium rounded-lg hover:bg-ev-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting && <Skeleton className="w-4 h-4 rounded-full" />}
              Submit Application
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
