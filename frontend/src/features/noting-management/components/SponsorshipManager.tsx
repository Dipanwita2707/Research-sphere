'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, ChevronDown, ChevronUp, User, Building2, IndianRupee, Package, Upload, X, Search, UserPlus, FileText, Lock, Save, AlertTriangle } from 'lucide-react';
import type { SponsorData, InKindItem, SponsorType, ContributionType, PaymentStatus, PaymentMethod, AssignedUser, ReceiptMeta, OriginSource, InKindDeliveryStatus } from './FestivalForm';
import { notingService } from '../services/noting.service';

// Style constants (matching EventFormFields)
const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:border-sgt-500 focus:ring-4 focus:ring-sgt-500/10 focus-visible:ring-2 focus-visible:ring-sgt-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 transition-all duration-200 outline-none hover:border-gray-300 dark:hover:border-gray-600 disabled:opacity-60 disabled:cursor-not-allowed';
const labelCls = 'block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1';

const SPONSOR_TYPES: { value: SponsorType; label: string }[] = [
  { value: 'corporate', label: 'Corporate' },
  { value: 'individual', label: 'Individual' },
  { value: 'organization', label: 'Organization' },
  { value: 'other', label: 'Other' },
];

const CONTRIBUTION_TYPES: { value: ContributionType; label: string }[] = [
  { value: 'cash', label: '💰 Cash' },
  { value: 'in_kind', label: '📦 In-Kind' },
  { value: 'both', label: '💰+📦 Both' },
];

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
  { value: 'not_received', label: 'Not Received' },
];

const IN_KIND_DELIVERY_STATUS_OPTIONS: { value: InKindDeliveryStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
  { value: 'not_received', label: 'Not Received' },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod | ''; label: string }[] = [
  { value: '', label: 'Select method' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'net_banking', label: 'Net Banking' },
  { value: 'other', label: 'Other' },
];

/** Migrate old-format sponsor `{ name, amount, type, notes }` to new SponsorData */
function migrateSponsor(s: any): SponsorData {
  if (s && s.contributionType) {
    // Already new format — fill in any missing new fields
    const migrated: SponsorData = {
      ...s,
      id: s.id || undefined,
      originSource: s.originSource || undefined,
      paymentMethodOtherLabel: s.paymentMethodOtherLabel || '',
      receipt: s.receipt || null,
      sponsorLogo: s.sponsorLogo || null,
      cashAssignedTo: s.cashAssignedTo || null,
      savedAt: s.savedAt || undefined,
      originalSnapshot: s.originalSnapshot || undefined,
      inKindItems: (s.inKindItems || []).map((item: any) => ({
        ...item,
        assignedTo: item.assignedTo || null,
        deliveryStatus: item.deliveryStatus || 'pending',
      })),
    };
    // Auto-capture original snapshot for noting sponsors that don't have one
    if (migrated.originSource ===
   'noting' && !migrated.originalSnapshot && !migrated.savedAt) {
      migrated.originalSnapshot = {
        cashAmount: migrated.cashAmount,
        paymentStatus: migrated.paymentStatus,
        paymentMethod: migrated.paymentMethod,
        transactionId: migrated.transactionId,
        receipt: migrated.receipt,
        inKindItems: migrated.inKindItems?.map(item => ({ ...item })),
      };
    }
    return migrated;
  }
  return {
    name: s?.name || '',
    sponsorType: 'corporate',
    contactPerson: '',
    designation: '',
    phone: '',
    email: '',
    notes: s?.notes || '',
    contributionType: s?.type ===
   'in_kind' ? 'in_kind' : 'cash',
    cashAmount: s?.type !== 'in_kind' ? (s?.amount || '') : '',
    paymentStatus: 'pending',
    paymentMethod: '',
    paymentMethodOtherLabel: '',
    transactionId: '',
    receipt: null,
    sponsorLogo: s?.sponsorLogo || null,
    cashAssignedTo: null,
    inKindItems: s?.type ===
   'in_kind' && s?.notes
      ? [{ itemName: s.notes, category: '', quantity: 1 as number | '', estimatedValue: '' as number | '', description: '', assignedTo: null, deliveryStatus: 'pending' as InKindDeliveryStatus }]
      : [],
  };
}

function SponsorLogoPreview({ logo, sponsorName, onZoom }: { logo?: ReceiptMeta | null; sponsorName: string; onZoom?: (url: string, name: string) => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!logo?.filePath) {
      setPreviewUrl(null);
      return;
    }

    notingService.viewAttachment(logo.filePath)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setPreviewUrl(url);
      })
      .catch(() => {
        if (active) setPreviewUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [logo?.filePath]);

  if (!logo) return null;

  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20 p-2 inline-block cursor-pointer hover:shadow-md transition-shadow" onClick={() => previewUrl && onZoom?.(previewUrl, sponsorName)}>
      {previewUrl ? (
        <img src={previewUrl} alt={`${sponsorName || 'Sponsor'} logo`} className="h-10 w-auto max-w-xs rounded border border-gray-200 dark:border-gray-700 bg-white object-contain" />
      ) : (
        <div className="h-10 w-16 rounded border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex items-center justify-center text-[9px] text-gray-400 text-center px-1">
          {logo.fileName}
        </div>
      )}
    </div>
  );
}

interface SponsorshipManagerProps {
  sponsors: SponsorData[];
  onChange: (sponsors: SponsorData[]) => void;
  disabled?: boolean;
  /** Per-sponsor lock: base fields read-only but fulfillment fields editable */
  notingLocked?: boolean;
  onUploadReceipt?: (file: File) => Promise<{ filePath: string; fileName: string } | null>;
  onUploadSponsorLogo?: (file: File) => Promise<{ filePath: string; fileName: string } | null>;
  searchEmployees?: (query: string) => Promise<Array<{ id: string; uid: string; displayName: string; department?: string }>>;
  /** Called after a per-sponsor save — parent should persist to backend */
  onSponsorSaved?: (updatedSponsors: SponsorData[]) => void;
}

export const SponsorshipManager: React.FC<SponsorshipManagerProps> = ({ sponsors, onChange, disabled, notingLocked, onUploadReceipt, onUploadSponsorLogo, searchEmployees, onSponsorSaved }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(sponsors.length > 0 ? 0 : null);
  const [assignSearchQuery, setAssignSearchQuery] = useState<Record<string, string>>({});
  const [assignSearchResults, setAssignSearchResults] = useState<Record<string, Array<{ id: string; uid: string; displayName: string; department?: string }>>>({});
  const [assignSearchLoading, setAssignSearchLoading] = useState<Record<string, boolean>>({});
  const [uploadingReceipt, setUploadingReceipt] = useState<number | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState<number | null>(null);
  const [logoErrors, setLogoErrors] = useState<Record<number, string>>({});
  const receiptInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const logoInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  // Confirmation modal state for per-sponsor save
  const [confirmSaveIndex, setConfirmSaveIndex] = useState<number | null>(null);
  // Logo zoom modal state
  const [zoomedLogo, setZoomedLogo] = useState<{ url: string; name: string } | null>(null);

  // Debounced employee search
  useEffect(() => {
    if (!searchEmployees) return;
    const timers: Record<string, NodeJS.Timeout> = {};
    Object.entries(assignSearchQuery).forEach(([key, q]) => {
      if (q.trim().length < 2) {
        setAssignSearchResults(prev => ({ ...prev, [key]: [] }));
        return;
      }
      setAssignSearchLoading(prev => ({ ...prev, [key]: true }));
      timers[key] = setTimeout(async () => {
        try {
          const results = await searchEmployees(q.trim());
          setAssignSearchResults(prev => ({ ...prev, [key]: results }));
        } catch {
          setAssignSearchResults(prev => ({ ...prev, [key]: [] }));
        } finally {
          setAssignSearchLoading(prev => ({ ...prev, [key]: false }));
        }
      }, 500);
    });
    return () => Object.values(timers).forEach(clearTimeout);
  }, [assignSearchQuery, searchEmployees]);

  // Ensure all sponsors are in new format
  const normalizedSponsors = sponsors.map(migrateSponsor);

  const handleReceiptUpload = useCallback(async (sponsorIdx: number, file: File) => {
    if (!onUploadReceipt) return;
    setUploadingReceipt(sponsorIdx);
    try {
      const result = await onUploadReceipt(file);
      if (result) {
        const next = normalizedSponsors.map((s, i) => i ===
   sponsorIdx ? { ...s, receipt: result } : s);
        onChange(next);
      }
    } finally {
      setUploadingReceipt(null);
    }
  }, [normalizedSponsors, onChange, onUploadReceipt]);

  const handleLogoUpload = useCallback(async (sponsorIdx: number, file: File) => {
    if (!onUploadSponsorLogo) return;
    setUploadingLogo(sponsorIdx);
    setLogoErrors((prev) => ({ ...prev, [sponsorIdx]: '' }));
    try {
      const result = await onUploadSponsorLogo(file);
      if (result) {
        const next = normalizedSponsors.map((s, i) => i ===
   sponsorIdx ? { ...s, sponsorLogo: result } : s);
        onChange(next);
        setLogoErrors((prev) => ({ ...prev, [sponsorIdx]: '' }));
      } else {
        setLogoErrors((prev) => ({ ...prev, [sponsorIdx]: 'Failed to upload logo' }));
      }
    } catch (err) {
      setLogoErrors((prev) => ({ ...prev, [sponsorIdx]: 'Upload error' }));
    } finally {
      setUploadingLogo(null);
    }
  }, [normalizedSponsors, onChange, onUploadSponsorLogo]);

  const updateSponsor = useCallback((index: number, patch: Partial<SponsorData>) => {
    const next = normalizedSponsors.map((s, i) => i ===
   index ? { ...s, ...patch } : s);
    onChange(next);
  }, [normalizedSponsors, onChange]);

  const addSponsor = useCallback(() => {
    const isManualOnEventPage = !!notingLocked;
    const newSponsor: SponsorData = {
      name: '',
      sponsorType: 'corporate',
      contactPerson: '',
      designation: '',
      phone: '',
      email: '',
      notes: '',
      contributionType: 'cash',
      cashAmount: '',
      // Manual sponsors on event page: payment already received (no pending option)
      paymentStatus: isManualOnEventPage ? 'received' : 'pending',
      paymentMethod: '',
      paymentMethodOtherLabel: '',
      transactionId: '',
      receipt: null,
      sponsorLogo: null,
      cashAssignedTo: null,
      inKindItems: [],
      ...(isManualOnEventPage ? { id: crypto.randomUUID(), originSource: 'event' as OriginSource } : {}),
    };
    onChange([...normalizedSponsors, newSponsor]);
    setExpandedIndex(normalizedSponsors.length);
  }, [normalizedSponsors, onChange, notingLocked]);

  const removeSponsor = useCallback((index: number) => {
    const next = normalizedSponsors.filter((_, i) => i !== index);
    onChange(next);
    if (expandedIndex ===
   index) setExpandedIndex(null);
    else if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1);
  }, [normalizedSponsors, onChange, expandedIndex]);

  // In-kind item helpers
  const addInKindItem = useCallback((sponsorIdx: number) => {
    const s = normalizedSponsors[sponsorIdx];
    const newItem: InKindItem = { itemName: '', category: '', quantity: '', estimatedValue: '', description: '', assignedTo: null };
    updateSponsor(sponsorIdx, { inKindItems: [...s.inKindItems, newItem] });
  }, [normalizedSponsors, updateSponsor]);

  const removeInKindItem = useCallback((sponsorIdx: number, itemIdx: number) => {
    const s = normalizedSponsors[sponsorIdx];
    updateSponsor(sponsorIdx, { inKindItems: s.inKindItems.filter((_, i) => i !== itemIdx) });
  }, [normalizedSponsors, updateSponsor]);

  const updateInKindItem = useCallback((sponsorIdx: number, itemIdx: number, patch: Partial<InKindItem>) => {
    const s = normalizedSponsors[sponsorIdx];
    const items = s.inKindItems.map((it, i) => i ===
   itemIdx ? { ...it, ...patch } : it);
    updateSponsor(sponsorIdx, { inKindItems: items });
  }, [normalizedSponsors, updateSponsor]);

  // Save & lock a single sponsor
  const confirmAndSaveSponsor = useCallback((index: number) => {
    const next = normalizedSponsors.map((s, i) =>
      i ===
   index ? { ...s, savedAt: new Date().toISOString() } : s
    );
    onChange(next);
    setConfirmSaveIndex(null);
    // Persist to backend immediately so savedAt survives refresh
    onSponsorSaved?.(next);
  }, [normalizedSponsors, onChange, onSponsorSaved]);

  // Summary totals
  const totalCash = normalizedSponsors.reduce((sum, s) => {
    if ((s.contributionType ===
   'cash' || s.contributionType ===
   'both') && s.cashAmount !== '') {
      return sum + Number(s.cashAmount);
    }
    return sum;
  }, 0);

  const totalInKindValue = normalizedSponsors.reduce((sum, s) => {
    if (s.contributionType ===
   'in_kind' || s.contributionType ===
   'both') {
      return sum + s.inKindItems.reduce((iSum, item) => {
        const qty = item.quantity !== '' ? Number(item.quantity) : 0;
        const val = item.estimatedValue !== '' ? Number(item.estimatedValue) : 0;
        return iSum + (qty * val);
      }, 0);
    }
    return sum;
  }, 0);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
      {/* Summary bar */}
      {normalizedSponsors.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 font-medium">
            {normalizedSponsors.length} Sponsor{normalizedSponsors.length !== 1 ? 's' : ''}
          </div>
          {totalCash > 0 && (
            <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 font-medium">
              💰 ₹{totalCash.toLocaleString()} Cash
            </div>
          )}
          {totalInKindValue > 0 && (
            <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-800 font-medium">
              📦 ₹{totalInKindValue.toLocaleString()} In-Kind (est.)
            </div>
          )}
        </div>
      )}

      {/* Sponsor cards */}
      {normalizedSponsors.map((sponsor, i) => {
        const isExpanded = expandedIndex ===
   i;
        const showCash = sponsor.contributionType ===
   'cash' || sponsor.contributionType ===
   'both';
        const showInKind = sponsor.contributionType ===
   'in_kind' || sponsor.contributionType ===
   'both';
        // Lock base fields for noting-origin sponsors.
        const isFromNoting = notingLocked && (sponsor.originSource ===
   'noting' || (!sponsor.originSource && sponsor.originSource !== 'event'));
        const isManualOnEventPage = notingLocked && sponsor.originSource ===
   'event';
        const isSponsorSaved = !!sponsor.savedAt;
        const baseLocked = disabled || isFromNoting || isSponsorSaved;
        const fulfillmentLocked = disabled || isSponsorSaved;
        const cashPaymentReceived = sponsor.paymentStatus ===
   'received' || sponsor.paymentStatus ===
   'partial';

        // Status options: manual sponsors on event page can't choose 'pending'
        const statusOptions = (isManualOnEventPage && !isSponsorSaved)
          ? PAYMENT_STATUS_OPTIONS.filter(s => s.value !== 'pending')
          : PAYMENT_STATUS_OPTIONS;

        // Diff data for noting sponsors
        const snap = sponsor.originalSnapshot;
        const hasDiff = isSponsorSaved && isFromNoting && snap;

        return (
          <div key={i} className={`rounded-xl border overflow-hidden shadow-sm transition-all hover:shadow-md ${isSponsorSaved ? 'border-emerald-300 dark:border-emerald-700' : 'border-gray-200 dark:border-gray-700'}`}>
            {/* Header */}
            <div
              className={`flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors ${isExpanded ? 'bg-sgt-50/50 dark:bg-sgt-900/20 border-b border-gray-200 dark:border-gray-700' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
              onClick={() => setExpandedIndex(isExpanded ? null : i)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-1.5 rounded-lg shrink-0 ${isSponsorSaved ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-sgt-100 dark:bg-sgt-900/30 text-sgt-600 dark:text-sgt-400'}`}>
                  {isSponsorSaved ? <Lock className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {sponsor.name || `Sponsor ${i + 1}`}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {SPONSOR_TYPES.find(t => t.value ===
   sponsor.sponsorType)?.label || 'Corporate'}
                    {sponsor.contributionType ===
   'both' ? ' • Cash + In-Kind' : sponsor.contributionType ===
   'in_kind' ? ' • In-Kind' : ' • Cash'}
                    {showCash && sponsor.cashAmount !== '' ? ` • ₹${Number(sponsor.cashAmount).toLocaleString()}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isSponsorSaved && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-700">Saved & Locked</span>
                )}
                {isFromNoting && !isSponsorSaved && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full border border-violet-200 dark:border-violet-700">From Noting</span>
                )}
                {isManualOnEventPage && !isSponsorSaved && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded-full border border-sky-200 dark:border-sky-700">Added Here</span>
                )}
                <button type="button" disabled={disabled || isFromNoting || isSponsorSaved} onClick={(e) => { e.stopPropagation(); removeSponsor(i); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <Trash2 className="w-4 h-4" />
                </button>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="bg-white dark:bg-gray-800/50 p-4 space-y-5">
                {/* ── Sponsor Information ── */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Sponsor Information
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Sponsor Name <span className="text-red-500">*</span></label>
                      <input type="text" disabled={baseLocked} value={sponsor.name} onChange={(e) => updateSponsor(i, { name: e.target.value })} placeholder="e.g. ABC Corp" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Sponsor Type <span className="text-red-500">*</span></label>
                      <select disabled={baseLocked} value={sponsor.sponsorType} onChange={(e) => updateSponsor(i, { sponsorType: e.target.value as SponsorType })} className={inputCls}>
                        {SPONSOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Contact Person <span className="text-red-500">*</span></label>
                      <input type="text" disabled={baseLocked} value={sponsor.contactPerson} onChange={(e) => updateSponsor(i, { contactPerson: e.target.value })} placeholder="Full name" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Designation <span className="text-red-500">*</span></label>
                      <input type="text" disabled={baseLocked} value={sponsor.designation} onChange={(e) => updateSponsor(i, { designation: e.target.value })} placeholder="e.g. Marketing Head" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Phone <span className="text-red-500">*</span></label>
                      <input type="tel" disabled={baseLocked} value={sponsor.phone} onChange={(e) => updateSponsor(i, { phone: e.target.value })} placeholder="10-digit mobile" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Email <span className="text-red-500">*</span></label>
                      <input type="email" disabled={baseLocked} value={sponsor.email} onChange={(e) => updateSponsor(i, { email: e.target.value })} placeholder="sponsor@example.com" className={inputCls} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                    <div>
                      <label className={labelCls}>Sponsor Logo <span className="text-red-500">*</span></label>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Logo required for sponsor identification</p>
                      {sponsor.sponsorLogo ? (
                        <div className="space-y-2">
                          <SponsorLogoPreview logo={sponsor.sponsorLogo} sponsorName={sponsor.name} onZoom={(url, name) => setZoomedLogo({ url, name })} />
                          {!baseLocked && (
                            <button type="button" onClick={() => updateSponsor(i, { sponsorLogo: null })} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                              <X className="w-3.5 h-3.5" />
                              Remove Logo
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            ref={(el) => { logoInputRefs.current[i] = el; }}
                            type="file"
                            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(i, f); e.target.value = ''; }}
                          />
                          <button
                            type="button"
                            disabled={baseLocked || !onUploadSponsorLogo || uploadingLogo ===
   i}
                            onClick={() => logoInputRefs.current[i]?.click()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-sgt-400 hover:text-sgt-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {uploadingLogo ===
   i ? (
                              <span className="animate-spin w-3.5 h-3.5 border-2 border-gray-300 border-t-sgt-500 rounded-full" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            {uploadingLogo ===
   i ? 'Uploading...' : 'Upload Logo'}
                          </button>
                          <span className="text-[10px] text-gray-400">JPG, PNG only</span>
                        </div>
                      )}
                      {logoErrors[i] && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{logoErrors[i]}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className={labelCls}>Notes</label>
                    <textarea disabled={baseLocked} value={sponsor.notes} onChange={(e) => updateSponsor(i, { notes: e.target.value })} placeholder="Additional notes about this sponsor..." rows={2} className={`${inputCls} resize-none`} />
                  </div>
                </div>

                <div className="w-full h-px bg-gray-100 dark:bg-gray-700" />

                {/* ── Contribution Type ── */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Contribution Type</p>
                  <div className="flex flex-wrap gap-2">
                    {CONTRIBUTION_TYPES.map(ct => (
                      <button
                        key={ct.value}
                        type="button"
                        disabled={baseLocked}
                        onClick={() => updateSponsor(i, { contributionType: ct.value })}
                        className={`px-4 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${sponsor.contributionType ===
   ct.value
                          ? 'border-sgt-500 bg-sgt-50 dark:bg-sgt-900/30 text-sgt-700 dark:text-sgt-300 shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {ct.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Cash Details ── */}
                {showCash && (
                  <>
                    <div className="w-full h-px bg-gray-100 dark:bg-gray-700" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                        <IndianRupee className="w-3.5 h-3.5" /> Cash Contribution
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Amount <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                            <input type="number" min={0} disabled={fulfillmentLocked} value={sponsor.cashAmount} onChange={(e) => updateSponsor(i, { cashAmount: e.target.value ===
   '' ? '' : Number(e.target.value) })} placeholder="0" className={`${inputCls} pl-6`} />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Payment Status</label>
                          <select disabled={fulfillmentLocked} value={sponsor.paymentStatus} onChange={(e) => {
                            const newStatus = e.target.value as PaymentStatus;
                            const patch: Partial<SponsorData> = { paymentStatus: newStatus };
                            if (newStatus ===
   'pending' || newStatus ===
   'not_received') {
                              patch.paymentMethod = '';
                              patch.paymentMethodOtherLabel = '';
                              patch.transactionId = '';
                              patch.receipt = null;
                            }
                            updateSponsor(i, patch);
                          }} className={inputCls}>
                            {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                        {/* Payment details only shown when payment is received/partial */}
                        {cashPaymentReceived && (
                          <>
                            <div>
                              <label className={labelCls}>Payment Method <span className="text-red-500">*</span></label>
                              <select disabled={fulfillmentLocked} value={sponsor.paymentMethod} onChange={(e) => updateSponsor(i, { paymentMethod: e.target.value as PaymentMethod | '' })} className={inputCls}>
                                {PAYMENT_METHOD_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                              </select>
                            </div>
                            {sponsor.paymentMethod ===
   'other' && (
                              <div>
                                <label className={labelCls}>Specify Payment Method</label>
                                <input type="text" disabled={fulfillmentLocked} value={sponsor.paymentMethodOtherLabel} onChange={(e) => updateSponsor(i, { paymentMethodOtherLabel: e.target.value })} placeholder="e.g. Cheque, DD" className={inputCls} />
                              </div>
                            )}
                            {sponsor.paymentMethod && sponsor.paymentMethod !== 'cash' && (
                              <div>
                                <label className={labelCls}>Transaction ID <span className="text-red-500">*</span></label>
                                <input type="text" disabled={fulfillmentLocked} value={sponsor.transactionId} onChange={(e) => updateSponsor(i, { transactionId: e.target.value })} placeholder="e.g. TXN123456" className={inputCls} />
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Receipt upload — only when payment received/partial */}
                      {cashPaymentReceived && (
                        <div className="mt-3">
                          <label className={labelCls}>Payment Receipt <span className="text-red-500">*</span></label>
                          {sponsor.receipt ? (
                            <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="text-sm text-emerald-700 dark:text-emerald-300 truncate flex-1">{sponsor.receipt.fileName}</span>
                              {!fulfillmentLocked && (
                                <button type="button" onClick={() => updateSponsor(i, { receipt: null })} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors shrink-0">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                ref={(el) => { receiptInputRefs.current[i] = el; }}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,image/*"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(i, f); e.target.value = ''; }}
                              />
                              <button
                                type="button"
                                disabled={fulfillmentLocked || !onUploadReceipt || uploadingReceipt ===
   i}
                                onClick={() => receiptInputRefs.current[i]?.click()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-sgt-400 hover:text-sgt-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {uploadingReceipt ===
   i ? (
                                  <span className="animate-spin w-3.5 h-3.5 border-2 border-gray-300 border-t-sgt-500 rounded-full" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5" />
                                )}
                                {uploadingReceipt ===
   i ? 'Uploading...' : 'Upload Receipt'}
                              </button>
                              <span className="text-[10px] text-gray-400">PDF, JPG, PNG</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Cash responsibility assignment */}
                      {searchEmployees && (
                        <div className="mt-3">
                          <label className={labelCls}>
                            <span className="flex items-center gap-1"><UserPlus className="w-3 h-3" /> Assigned To (Cash)</span>
                          </label>
                          {sponsor.cashAssignedTo ? (
                            <div className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium px-2.5 py-1.5 rounded-full">
                              {sponsor.cashAssignedTo.displayName}
                              <span className="text-indigo-400">({sponsor.cashAssignedTo.uid})</span>
                              {!fulfillmentLocked && (
                                <button type="button" onClick={() => updateSponsor(i, { cashAssignedTo: null })} className="hover:text-red-500 ml-0.5">
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                  type="text"
                                  disabled={fulfillmentLocked}
                                  value={assignSearchQuery[`cash-${i}`] || ''}
                                  onChange={(e) => setAssignSearchQuery(prev => ({ ...prev, [`cash-${i}`]: e.target.value }))}
                                  placeholder="Search team member..."
                                  className={`${inputCls} !pl-8 !py-1.5`}
                                />
                                {assignSearchLoading[`cash-${i}`] && (
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin w-3.5 h-3.5 border-2 border-gray-300 border-t-sgt-500 rounded-full" />
                                )}
                              </div>
                              {(assignSearchQuery[`cash-${i}`] || '').trim().length >= 2 && (
                                <div className="max-h-32 overflow-y-auto rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                  {(assignSearchResults[`cash-${i}`] || []).length ===
   0 && !assignSearchLoading[`cash-${i}`] && (
                                    <p className="px-3 py-2 text-xs text-gray-500 text-center">No users found</p>
                                  )}
                                  {(assignSearchResults[`cash-${i}`] || []).map(u => (
                                    <button key={u.id} type="button" onClick={() => { updateSponsor(i, { cashAssignedTo: { id: u.id, uid: u.uid, displayName: u.displayName, department: u.department } }); setAssignSearchQuery(prev => ({ ...prev, [`cash-${i}`]: '' })); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left text-sm">
                                      <span className="font-medium text-gray-900 dark:text-white">{u.displayName}</span>
                                      <span className="text-xs text-gray-400">({u.uid})</span>
                                      {u.department && <span className="text-xs text-gray-400 ml-auto truncate max-w-[120px]">{u.department}</span>}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── In-Kind Items ── */}
                {showInKind && (
                  <>
                    <div className="w-full h-px bg-gray-100 dark:bg-gray-700" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                        <Package className="w-3.5 h-3.5" /> In-Kind Contributions
                      </p>
                      {sponsor.inKindItems.length > 0 && (
                        <div className="space-y-3 mb-3">
                          {sponsor.inKindItems.map((item, j) => {
                            const itemTotal = (item.quantity !== '' && item.estimatedValue !== '') ? Number(item.quantity) * Number(item.estimatedValue) : null;
                            return (
                              <div key={j} className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                  <div>
                                    <label className={labelCls}>Item Name <span className="text-red-500">*</span></label>
                                    <input type="text" disabled={baseLocked} value={item.itemName} onChange={(e) => updateInKindItem(i, j, { itemName: e.target.value })} placeholder="e.g. T-shirts, Water bottles" className={inputCls} />
                                  </div>
                                  <div>
                                    <label className={labelCls}>Category</label>
                                    <input type="text" disabled={baseLocked} value={item.category} onChange={(e) => updateInKindItem(i, j, { category: e.target.value })} placeholder="e.g. Merchandise, Food" className={inputCls} />
                                  </div>
                                  <div>
                                    <label className={labelCls}>Quantity</label>
                                    <input type="number" min={0} disabled={baseLocked} value={item.quantity} onChange={(e) => updateInKindItem(i, j, { quantity: e.target.value ===
   '' ? '' : Number(e.target.value) })} placeholder="0" className={inputCls} />
                                  </div>
                                  <div>
                                    <label className={labelCls}>Est. Value (per unit)</label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                                      <input type="number" min={0} disabled={baseLocked} value={item.estimatedValue} onChange={(e) => updateInKindItem(i, j, { estimatedValue: e.target.value ===
   '' ? '' : Number(e.target.value) })} placeholder="0" className={`${inputCls} pl-6`} />
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-3 flex items-end gap-3">
                                  <div className="flex-1">
                                    <label className={labelCls}>Description</label>
                                    <input type="text" disabled={baseLocked} value={item.description} onChange={(e) => updateInKindItem(i, j, { description: e.target.value })} placeholder="Brief description..." className={inputCls} />
                                  </div>
                                  <div className="w-36">
                                    <label className={labelCls}>Delivery Status</label>
                                    <select disabled={fulfillmentLocked} value={item.deliveryStatus || 'pending'} onChange={(e) => updateInKindItem(i, j, { deliveryStatus: e.target.value as InKindDeliveryStatus })} className={inputCls}>
                                      {IN_KIND_DELIVERY_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                  </div>
                                  {itemTotal !== null && (
                                    <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold whitespace-nowrap">
                                      Total: ₹{itemTotal.toLocaleString()}
                                    </div>
                                  )}
                                  <button type="button" disabled={baseLocked} onClick={() => removeInKindItem(i, j)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                {/* In-kind item assignment */}
                                {searchEmployees && (
                                  <div className="mt-2">
                                    <label className={labelCls}>
                                      <span className="flex items-center gap-1"><UserPlus className="w-3 h-3" /> Responsible Person</span>
                                    </label>
                                    {item.assignedTo ? (
                                      <div className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium px-2.5 py-1.5 rounded-full">
                                        {item.assignedTo.displayName}
                                        <span className="text-indigo-400">({item.assignedTo.uid})</span>
                                        {!fulfillmentLocked && (
                                          <button type="button" onClick={() => updateInKindItem(i, j, { assignedTo: null })} className="hover:text-red-500 ml-0.5">
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <div className="relative">
                                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                          <input
                                            type="text"
                                            disabled={fulfillmentLocked}
                                            value={assignSearchQuery[`item-${i}-${j}`] || ''}
                                            onChange={(e) => setAssignSearchQuery(prev => ({ ...prev, [`item-${i}-${j}`]: e.target.value }))}
                                            placeholder="Search team member..."
                                            className={`${inputCls} !pl-8 !py-1.5`}
                                          />
                                          {assignSearchLoading[`item-${i}-${j}`] && (
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin w-3.5 h-3.5 border-2 border-gray-300 border-t-sgt-500 rounded-full" />
                                          )}
                                        </div>
                                        {(assignSearchQuery[`item-${i}-${j}`] || '').trim().length >= 2 && (
                                          <div className="max-h-32 overflow-y-auto rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                            {(assignSearchResults[`item-${i}-${j}`] || []).length ===
   0 && !assignSearchLoading[`item-${i}-${j}`] && (
                                              <p className="px-3 py-2 text-xs text-gray-500 text-center">No users found</p>
                                            )}
                                            {(assignSearchResults[`item-${i}-${j}`] || []).map(u => (
                                              <button key={u.id} type="button" onClick={() => { updateInKindItem(i, j, { assignedTo: { id: u.id, uid: u.uid, displayName: u.displayName, department: u.department } }); setAssignSearchQuery(prev => ({ ...prev, [`item-${i}-${j}`]: '' })); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left text-sm">
                                                <span className="font-medium text-gray-900 dark:text-white">{u.displayName}</span>
                                                <span className="text-xs text-gray-400">({u.uid})</span>
                                                {u.department && <span className="text-xs text-gray-400 ml-auto truncate max-w-[120px]">{u.department}</span>}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <button type="button" disabled={baseLocked} onClick={() => addInKindItem(i)} className="w-full py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-500 hover:text-sgt-600 hover:border-sgt-400 hover:bg-sgt-50/70 dark:hover:bg-sgt-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                        <Plus className="w-3.5 h-3.5" /> Add In-Kind Item
                      </button>
                    </div>
                  </>
                )}

                {/* ── Diff Table (for saved noting sponsors) ── */}
                {hasDiff && (
                  <>
                    <div className="w-full h-px bg-gray-100 dark:bg-gray-700" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Change History — Noting vs Actual</p>
                      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-300">Field</th>
                              <th className="text-left px-3 py-2 font-semibold text-violet-600 dark:text-violet-400">Noting Value</th>
                              <th className="text-left px-3 py-2 font-semibold text-emerald-600 dark:text-emerald-400">Updated Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {(() => {
                              const rows: { field: string; from: string; to: string }[] = [];
                              const fmt = (v: any) => v ===
   '' || v ===
   null || v ===
   undefined ? '—' : String(v);
                              const fmtAmt = (v: any) => v ===
   '' || v ===
   null || v ===
   undefined ? '—' : `₹${Number(v).toLocaleString()}`;
                              const fmtStatus = (v: any) => {
                                const map: Record<string, string> = { pending: 'Pending', received: 'Received', partial: 'Partial', not_received: 'Not Received' };
                                return map[v] || '—';
                              };
                              const fmtMethod = (v: any) => {
                                const map: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', net_banking: 'Net Banking', other: 'Other' };
                                return map[v] || '—';
                              };

                              if (fmt(snap.paymentStatus) !== fmt(sponsor.paymentStatus))
                                rows.push({ field: 'Status', from: fmtStatus(snap.paymentStatus), to: fmtStatus(sponsor.paymentStatus) });
                              if (fmt(snap.cashAmount) !== fmt(sponsor.cashAmount))
                                rows.push({ field: 'Amount', from: fmtAmt(snap.cashAmount), to: fmtAmt(sponsor.cashAmount) });
                              if (fmt(snap.paymentMethod) !== fmt(sponsor.paymentMethod))
                                rows.push({ field: 'Payment Method', from: fmtMethod(snap.paymentMethod), to: fmtMethod(sponsor.paymentMethod) });
                              if (fmt(snap.transactionId) !== fmt(sponsor.transactionId))
                                rows.push({ field: 'Transaction ID', from: fmt(snap.transactionId), to: fmt(sponsor.transactionId) });
                              if (JSON.stringify(snap.receipt) !== JSON.stringify(sponsor.receipt))
                                rows.push({ field: 'Receipt', from: snap.receipt?.fileName || '—', to: sponsor.receipt?.fileName || '—' });

                              // In-kind item delivery status changes
                              if (Array.isArray(snap.inKindItems) && Array.isArray(sponsor.inKindItems)) {
                                for (let k = 0; k < Math.max(snap.inKindItems.length, sponsor.inKindItems.length); k++) {
                                  const oldItem = snap.inKindItems[k];
                                  const newItem = sponsor.inKindItems[k];
                                  if (oldItem && newItem && oldItem.deliveryStatus !== newItem.deliveryStatus) {
                                    rows.push({
                                      field: `${newItem.itemName || `Item ${k + 1}`} — Delivery`,
                                      from: fmtStatus(oldItem.deliveryStatus),
                                      to: fmtStatus(newItem.deliveryStatus),
                                    });
                                  }
                                }
                              }

                              if (rows.length ===
   0) rows.push({ field: 'No changes', from: '—', to: '—' });
                              return rows.map((r, idx) => (
                                <tr key={idx} className="bg-white dark:bg-gray-800">
                                  <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{r.field}</td>
                                  <td className="px-3 py-2 text-violet-600 dark:text-violet-400">{r.from}</td>
                                  <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold">{r.to}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}

                {/* ── Save Sponsor Button (only on event manage page, not yet saved) ── */}
                {notingLocked && !isSponsorSaved && !disabled && (
                  <>
                    <div className="w-full h-px bg-gray-100 dark:bg-gray-700" />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setConfirmSaveIndex(i); }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors"
                      >
                        <Save className="w-4 h-4" /> Save Sponsor
                      </button>
                    </div>
                  </>
                )}

                {/* Saved timestamp */}
                {isSponsorSaved && (
                  <>
                    <div className="w-full h-px bg-gray-100 dark:bg-gray-700" />
                    <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Saved & locked on {new Date(sponsor.savedAt!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Confirmation Modal — rendered via Portal to escape parent stacking contexts */}
      {confirmSaveIndex !== null && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmSaveIndex(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Save Sponsor Entry</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  After saving, this sponsor entry <strong>cannot be edited again</strong>. Do you want to continue?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setConfirmSaveIndex(null)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => confirmAndSaveSponsor(confirmSaveIndex)} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors">
                Confirm Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Sponsor button */}
      <button type="button" disabled={disabled} onClick={addSponsor} className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-500 hover:text-sgt-600 hover:border-sgt-400 hover:bg-sgt-50/70 dark:hover:bg-sgt-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
        <Plus className="w-4 h-4" /> Add Sponsor
      </button>

      {/* Logo Zoom Modal */}
      {zoomedLogo && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setZoomedLogo(null)}>
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomedLogo(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-white dark:bg-gray-700 shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div className="p-6 flex flex-col items-center justify-center gap-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{zoomedLogo.name} Logo</p>
              <img
                src={zoomedLogo.url}
                alt={`${zoomedLogo.name} logo zoomed`}
                className="max-w-full max-h-[60vh] object-contain rounded-lg border border-gray-200 dark:border-gray-700"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
