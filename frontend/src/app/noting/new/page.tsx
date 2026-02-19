'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Plus, Trash2, Upload, FileText, GripVertical, Clock, CheckCircle, IndianRupee, User, Send, Save, Paperclip, AlertCircle, List, Calendar, Award, Trophy, Medal, Briefcase, ShoppingBag, Ticket, Star, Settings, X } from 'lucide-react';
import { notingService } from '@/features/noting-management/services/noting.service';
import type { NoteConfig, CreatorInfo, CreateNotePayload } from '@/features/noting-management/types/noting.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { useNotingDraftStore } from '@/features/noting-management/stores/notingDraftStore';
import { useAuthStore } from '@/shared/auth/authStore';
import 'react-quill/dist/quill.snow.css';

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

export interface AnnexureEntry {
  _id?: string;
  filePath: string;
  fileName: string;
  fileDescription: string;
  uploading?: boolean;
}

const MAX_WORDS = 500;

// Prize type matching Event manage page exactly
type PrizeType = 'cash' | 'certificate' | 'internship' | 'merchandise' | 'trophy' | 'scholarship' | 'voucher' | 'custom';

interface NotingPrize {
  position: number;
  rank: string;
  title: string;
  description?: string;
  prizeType: PrizeType;
  prizeAmount?: number;
  additionalPerks?: string[];
  sortOrder: number;
  isActive: boolean;
}

const PRIZE_TYPE_OPTIONS: { value: PrizeType; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'Cash', icon: <IndianRupee className="w-4 h-4" /> },
  { value: 'certificate', label: 'Certificate', icon: <Award className="w-4 h-4" /> },
  { value: 'trophy', label: 'Trophy', icon: <Trophy className="w-4 h-4" /> },
  { value: 'internship', label: 'Internship', icon: <Briefcase className="w-4 h-4" /> },
  { value: 'scholarship', label: 'Scholarship', icon: <Medal className="w-4 h-4" /> },
  { value: 'merchandise', label: 'Merchandise', icon: <ShoppingBag className="w-4 h-4" /> },
  { value: 'voucher', label: 'Voucher', icon: <Ticket className="w-4 h-4" /> },
  { value: 'custom', label: 'Custom', icon: <Star className="w-4 h-4" /> },
];

const PERK_OPTIONS = ['Certificate', 'Pre-placement Interview', 'Pre-placement Offer', 'Goodies', 'Mentorship'];

const DEBOUNCE_SYNC_MS = 400;
const DEBOUNCE_AUTOSAVE_MS = 2000;

function getInitialFromStore() {
  const s = useNotingDraftStore.getState();
  return {
    category: s.category,
    subcategory: s.subcategory,
    description: s.description,
    approvalPeriod: s.approvalPeriod,
    recurringFrequency: s.recurringFrequency,
    policyCompliance: s.policyCompliance,
    amountRequired: s.amountRequired,
    amount: s.amount,
    points: s.points.length ? s.points : [''],
    attachments: s.attachments.map((a) => ({ filePath: a.filePath, fileName: a.fileName, fileDescription: a.fileDescription ?? '' })),
  };
}

export default function NewNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIdFromUrl = searchParams.get('draft');
  const { toast } = useToast();
  const { setForm, clearDraft, hydrateFromNote, setDraftId, getPayload, draftId } = useNotingDraftStore();
  const { user } = useAuthStore();

  // Block students from accessing noting system
  useEffect(() => {
    if (user && user.role === 'student') {
      toast({ type: 'error', message: 'Students are not allowed to access the noting system' });
      router.push('/dashboard');
    }
  }, [user, router, toast]);

  const [config, setConfig] = useState<NoteConfig | null>(null);
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);
  const [notingIdPreview, setNotingIdPreview] = useState<string>('');
  const [notingYearAndSequence, setNotingYearAndSequence] = useState<{ year: string; sequence: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [isRevertedNote, setIsRevertedNote] = useState(false);
  const [isEditingExistingDraft, setIsEditingExistingDraft] = useState(!!draftIdFromUrl);

  // Initialize with empty values for new notes, or from store if editing a draft
  const initial = draftIdFromUrl ? getInitialFromStore() : {
    category: 'academic' as 'academic' | 'administrative',
    subcategory: '',
    description: '',
    approvalPeriod: 'one_time' as 'one_time' | 'recurring',
    recurringFrequency: '',
    policyCompliance: null as 'yes' | 'no' | null,
    amountRequired: false,
    amount: '',
    points: [''],
    attachments: [] as any[],
  };

  const [category, setCategory] = useState<'academic' | 'administrative'>(initial.category);
  const [subcategory, setSubcategory] = useState(initial.subcategory);
  const [description, setDescription] = useState(initial.description);
  const [approvalPeriod, setApprovalPeriod] = useState<'one_time' | 'recurring'>(initial.approvalPeriod);
  const [recurringFrequency, setRecurringFrequency] = useState(initial.recurringFrequency);
  const [policyCompliance, setPolicyCompliance] = useState<'yes' | 'no' | null>(initial.policyCompliance);
  const [amountRequired, setAmountRequired] = useState(initial.amountRequired);
  const [amount, setAmount] = useState(initial.amount);
  const [points, setPoints] = useState<string[]>(initial.points);
  const [annexures, setAnnexures] = useState<AnnexureEntry[]>(initial.attachments.map((a: any) => ({ filePath: a.filePath, fileName: a.fileName, fileDescription: a.fileDescription || '' })));

  // Event-specific fields
  const [isEventNoting, setIsEventNoting] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [eventPaymentType, setEventPaymentType] = useState<'free' | 'paid'>('free');
  const [eventParticipationType, setEventParticipationType] = useState<'individual' | 'team'>('individual');
  const [eventRegistrationFeeIndividual, setEventRegistrationFeeIndividual] = useState<number | ''>('');
  const [eventRegistrationFeeTeam, setEventRegistrationFeeTeam] = useState<number | ''>('');
  const [eventApproxCapacity, setEventApproxCapacity] = useState<number | ''>('');
  const [eventDutyLeaveAvailable, setEventDutyLeaveAvailable] = useState<boolean | null>(null);
  const [eventDutyLeaveEligibility, setEventDutyLeaveEligibility] = useState<string[]>([]);
  const [eventHasSponsorship, setEventHasSponsorship] = useState<boolean | null>(null);
  const [eventSponsors, setEventSponsors] = useState<Array<{ name: string; amount: number; type: 'cash' | 'in_kind'; notes?: string }>>([]);
  const [eventHasResources, setEventHasResources] = useState<boolean | null>(null);
  const [eventResources, setEventResources] = useState<Array<{ type: string; description: string; pricePerPiece: number | ''; quantity: number | ''; cost: number | '' }>>([]);
  const [eventCertification, setEventCertification] = useState<boolean | null>(null);
  const [eventCapacityFixed, setEventCapacityFixed] = useState<number | ''>('');
  const [eventPrizesAwards, setEventPrizesAwards] = useState<NotingPrize[]>([]);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [editingPrize, setEditingPrize] = useState<NotingPrize | null>(null);
  const [editingPrizeIndex, setEditingPrizeIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutosavingRef = useRef(false);
  const [fileDropActive, setFileDropActive] = useState(false);
  const [pointDraggedIndex, setPointDraggedIndex] = useState<number | null>(null);
  const [pointDropTargetIndex, setPointDropTargetIndex] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([notingService.getConfig(), notingService.getMyCreatorInfo()])
      .then(([c, creator]) => {
        setConfig(c);
        setCreatorInfo(creator);
        if (!getInitialFromStore().subcategory && c.categories[0]?.subcategories?.[0]?.value) {
          setSubcategory(c.categories[0].subcategories[0].value);
        }
      })
      .catch(() => toast({ type: 'error', message: 'Failed to load form config' }))
      .finally(() => setLoading(false));
  }, [toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isAutosavingRef.current = false;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!config || draftLoaded) return;

    const loadDraftIntoForm = (note: Awaited<ReturnType<typeof notingService.getById>>) => {
      setIsRevertedNote(note.status === 'reverted');

      hydrateFromNote({
        category: note.category,
        subcategory: note.subcategory,
        description: note.description ?? '',
        approvalPeriod: note.approvalPeriod,
        recurringFrequency: note.recurringFrequency ?? undefined,
        policyCompliant: note.policyCompliant ?? undefined,
        amountRequired: note.amountRequired,
        amount: note.amount,
        points: note.points ?? [],
        attachments: note.attachments ?? [],
      });
      setDraftId(note.id);
      const s = useNotingDraftStore.getState();
      setCategory(s.category);
      setSubcategory(s.subcategory);
      setDescription(s.description);
      setApprovalPeriod(s.approvalPeriod);
      setRecurringFrequency(s.recurringFrequency);
      setPolicyCompliance(s.policyCompliance);
      setAmountRequired(s.amountRequired);
      setAmount(s.amount);
      setPoints(s.points.length ? s.points : ['']);
      setAnnexures(s.attachments.map((a) => ({ filePath: a.filePath, fileName: a.fileName, fileDescription: a.fileDescription ?? '' })));

      if (note.eventName) setEventName(note.eventName);
      if (note.eventType) setEventType(note.eventType);
      if (note.eventStartDate) setEventStartDate(note.eventStartDate);
      if (note.eventEndDate) setEventEndDate(note.eventEndDate);
      if (note.eventPaymentType) setEventPaymentType(note.eventPaymentType);
      if ((note as any).eventParticipationType) setEventParticipationType((note as any).eventParticipationType);
      if ((note as any).eventRegistrationFeeIndividual != null) setEventRegistrationFeeIndividual((note as any).eventRegistrationFeeIndividual);
      if ((note as any).eventRegistrationFeeTeam != null) setEventRegistrationFeeTeam((note as any).eventRegistrationFeeTeam);
      if ((note as any).eventApproxCapacity != null) setEventApproxCapacity((note as any).eventApproxCapacity);
      if ((note as any).eventDutyLeaveAvailable != null) setEventDutyLeaveAvailable((note as any).eventDutyLeaveAvailable);
      if (Array.isArray((note as any).eventDutyLeaveEligibility)) setEventDutyLeaveEligibility((note as any).eventDutyLeaveEligibility);
      if ((note as any).eventHasSponsorship != null) setEventHasSponsorship((note as any).eventHasSponsorship);
      if (Array.isArray((note as any).eventSponsors)) setEventSponsors((note as any).eventSponsors);
      if ((note as any).eventHasResources != null) setEventHasResources((note as any).eventHasResources);
      if (Array.isArray((note as any).eventResources)) setEventResources((note as any).eventResources);
      if ((note as any).eventCertification != null) setEventCertification((note as any).eventCertification);
      if ((note as any).eventCapacityFixed != null) setEventCapacityFixed((note as any).eventCapacityFixed);
      if (Array.isArray((note as any).eventPrizesAwards)) setEventPrizesAwards((note as any).eventPrizesAwards);

      // Extract year and sequence from the existing draft's noting ID
      if (note.notingId) {
        setNotingIdPreview(note.notingId);
        // Extract year and sequence from format like: SGTU/ACAD/EVENT/2026/12345
        const parts = note.notingId.split('/');
        if (parts.length >= 2) {
          const year = parts[parts.length - 2];
          const sequence = parts[parts.length - 1];
          setNotingYearAndSequence({ year, sequence });
        }
      }

      setDraftLoaded(true);
    };

    if (draftIdFromUrl) {
      notingService
        .getById(draftIdFromUrl)
        .then((note) => {
          if (note.status !== 'draft' && note.status !== 'reverted') {
            toast({ type: 'error', message: 'This note cannot be edited' });
            setDraftLoaded(true);
            return;
          }
          loadDraftIntoForm(note);
        })
        .catch(() => {
          toast({ type: 'error', message: 'Failed to load draft' });
          setDraftLoaded(true);
        });
      return;
    }

    clearDraft();
    const freshState = useNotingDraftStore.getState();
    setCategory(freshState.category);
    setSubcategory(freshState.subcategory || (config.categories[0]?.subcategories?.[0]?.value ?? ''));
    setDescription('');
    setApprovalPeriod('one_time');
    setRecurringFrequency('');
    setPolicyCompliance(null);
    setAmountRequired(false);
    setAmount('');
    setPoints(['']);
    setAnnexures([]);
    setEventName('');
    setEventType('');
    setEventStartDate('');
    setEventEndDate('');
    setEventPaymentType('free');
    setIsRevertedNote(false);
    setNotingIdPreview('');
    setNotingYearAndSequence(null);
    setDraftLoaded(true);
  }, [config, draftLoaded, draftIdFromUrl, hydrateFromNote, setDraftId, toast, clearDraft]);

  useEffect(() => {
    if (!category || !subcategory) return;

    // If we already have year and sequence, rebuild the ID with new category/subcategory
    if (notingYearAndSequence) {
      const categoryPart = category === 'academic' ? 'ACAD' : 'ADMIN';
      const subcategoryPart = subcategory.toUpperCase().replace(/_/g, '-');
      const newId = `SGTU/${categoryPart}/${subcategoryPart}/${notingYearAndSequence.year}/${notingYearAndSequence.sequence}`;
      setNotingIdPreview(newId);
      return;
    }

    // For new notes without year/sequence yet, generate preview once
    if (!draftIdFromUrl && !notingIdPreview) {
      notingService.previewNotingId(category, subcategory).then((r) => {
        setNotingIdPreview(r.notingId);
        // Extract and store year and sequence
        const parts = r.notingId.split('/');
        if (parts.length >= 2) {
          const year = parts[parts.length - 2];
          const sequence = parts[parts.length - 1];
          setNotingYearAndSequence({ year, sequence });
        }
      });
    }
  }, [category, subcategory, draftIdFromUrl, notingIdPreview, notingYearAndSequence]);

  useEffect(() => {
    if (!config) return;
    setSubcategory('');
  }, [category, config]);

  useEffect(() => {
    if (!subcategory || !config) {
      setIsEventNoting(false);
      return;
    }
    const eventKeywords = ['event', 'workshop', 'seminar', 'conference', 'function', 'celebration'];
    const isEvent = eventKeywords.some(keyword => subcategory.toLowerCase().includes(keyword));
    setIsEventNoting(isEvent);

    if (!isEvent) {
      setEventName('');
      setEventType('');
      setEventStartDate('');
      setEventEndDate('');
      setEventPaymentType('free');
    }
  }, [subcategory, config]);

  useEffect(() => {
    if (!draftLoaded) return;
    syncTimeoutRef.current && clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      setForm({
        category,
        subcategory,
        description,
        approvalPeriod,
        recurringFrequency,
        policyCompliance,
        amountRequired,
        amount,
        points,
        attachments: annexures.filter((a) => a.filePath && !a.uploading).map((a) => ({
          filePath: a.filePath,
          fileName: a.fileName.trim() || a.filePath,
          fileDescription: a.fileDescription?.trim() || undefined,
        })),
      });
      syncTimeoutRef.current = null;
    }, DEBOUNCE_SYNC_MS);
    return () => { syncTimeoutRef.current && clearTimeout(syncTimeoutRef.current); };
  }, [
    draftLoaded, category, subcategory, description, approvalPeriod,
    recurringFrequency, policyCompliance, amountRequired, amount,
    points, annexures, setForm,
  ]);

  useEffect(() => {
    if (!draftLoaded || !config) return;
    const hasMinimum = category && subcategory;
    if (!hasMinimum) return;

    // Prevent multiple autosaves from running simultaneously
    if (isAutosavingRef.current) return;

    autosaveTimeoutRef.current && clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => {
      // Double check to prevent race condition
      if (isAutosavingRef.current) return;

      const payload = {
        category,
        subcategory,
        description: description.trim(),
        approvalPeriod,
        recurringFrequency: (approvalPeriod === 'recurring' && recurringFrequency ? recurringFrequency : undefined) as CreateNotePayload['recurringFrequency'],
        policyCompliance: policyCompliance ?? undefined,
        amountRequired,
        amount: amountRequired && amount ? Number(amount) : undefined,
        points: dedupePoints(points),
        attachments: annexures
          .filter((a) => a.filePath && !a.uploading)
          .map((a) => ({ filePath: a.filePath, fileName: a.fileName.trim() || a.filePath, fileDescription: a.fileDescription?.trim() || undefined })),
      };

      const eventPayload: any = {};
      if (isEventNoting && eventName && eventType && eventStartDate && eventEndDate && eventPaymentType) {
        eventPayload.eventName = eventName.trim();
        eventPayload.eventType = eventType;
        eventPayload.eventStartDate = eventStartDate;
        eventPayload.eventEndDate = eventEndDate;
        eventPayload.eventPaymentType = eventPaymentType;
        eventPayload.eventParticipationType = eventParticipationType;
        if (eventPaymentType === 'paid') {
          eventPayload.eventRegistrationFeeIndividual = eventParticipationType === 'individual' && eventRegistrationFeeIndividual !== '' ? Number(eventRegistrationFeeIndividual) : null;
          eventPayload.eventRegistrationFeeTeam = eventParticipationType === 'team' && eventRegistrationFeeTeam !== '' ? Number(eventRegistrationFeeTeam) : null;
        }
        eventPayload.eventApproxCapacity = eventApproxCapacity !== '' ? Number(eventApproxCapacity) : null;
        eventPayload.eventDutyLeaveAvailable = eventDutyLeaveAvailable;
        eventPayload.eventDutyLeaveEligibility = eventDutyLeaveAvailable ? eventDutyLeaveEligibility : null;
        eventPayload.eventHasSponsorship = eventHasSponsorship;
        eventPayload.eventSponsors = eventHasSponsorship ? eventSponsors : null;
        eventPayload.eventHasResources = eventHasResources;
        eventPayload.eventResources = eventHasResources ? eventResources : null;
        eventPayload.eventCertification = eventCertification;
        eventPayload.eventCapacityFixed = eventCapacityFixed !== '' ? Number(eventCapacityFixed) : null;
        eventPayload.eventPrizesAwards = eventPrizesAwards.length > 0 ? eventPrizesAwards : null;
      }

      if (draftId) {
        const updatePayload: any = {
          description: payload.description,
          approvalPeriod: payload.approvalPeriod,
          policyCompliance: payload.policyCompliance,
          amountRequired: payload.amountRequired,
          points: payload.points,
          attachments: payload.attachments,
          ...eventPayload,
        };
        if (payload.approvalPeriod === 'one_time') updatePayload.recurringFrequency = null;
        else if (payload.recurringFrequency) updatePayload.recurringFrequency = payload.recurringFrequency;
        if (payload.amountRequired !== true) {
          // controller will clear amount
        } else if (payload.amount !== undefined && !Number.isNaN(payload.amount)) {
          updatePayload.amount = payload.amount;
        }
        isAutosavingRef.current = true;
        notingService.updateDraft(draftId, updatePayload)
          .catch(() => { })
          .finally(() => { isAutosavingRef.current = false; });
      } else {
        isAutosavingRef.current = true;
        notingService
          .create({ ...payload, ...eventPayload, submit: false })
          .then((res) => {
            if (res.data?.id) {
              setDraftId(res.data.id);
            }
          })
          .catch(() => { })
          .finally(() => { isAutosavingRef.current = false; });
      }
      autosaveTimeoutRef.current = null;
    }, DEBOUNCE_AUTOSAVE_MS);
    return () => { autosaveTimeoutRef.current && clearTimeout(autosaveTimeoutRef.current); };
  }, [
    draftLoaded, config, draftId, category, subcategory, description,
    approvalPeriod, recurringFrequency, policyCompliance, amountRequired,
    amount, points, annexures, isEventNoting, eventName, eventType,
    eventStartDate, eventEndDate, eventPaymentType, eventParticipationType,
    eventRegistrationFeeIndividual, eventRegistrationFeeTeam, eventApproxCapacity,
    eventDutyLeaveAvailable, eventDutyLeaveEligibility, eventHasSponsorship,
    eventSponsors, eventHasResources, eventResources, eventCertification,
    eventCapacityFixed, eventPrizesAwards, setDraftId,
  ]);

  // Strip HTML tags and count words for the rich text editor
  const getPlainTextFromHtml = (html: string) => {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  };

  const plainTextDescription = typeof window !== 'undefined' ? getPlainTextFromHtml(description) : description.replace(/<[^>]*>/g, '');
  const wordCount = plainTextDescription.trim() ? plainTextDescription.trim().split(/\s+/).length : 0;
  const overLimit = wordCount > MAX_WORDS;

  const addPoint = () => setPoints((p) => [...p, '']);
  const removePoint = (i: number) => setPoints((p) => p.filter((_, idx) => idx !== i));
  const updatePoint = (i: number, v: string) => setPoints((p) => { const n = [...p]; n[i] = v; return n; });

  const movePoint = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setPoints((p) => {
      const n = [...p];
      const [removed] = n.splice(fromIndex, 1);
      n.splice(toIndex, 0, removed);
      return n;
    });
    setPointDraggedIndex(null);
    setPointDropTargetIndex(null);
  };

  const acceptFile = (file: File) =>
    /\.(pdf|doc|docx|xls|xlsx|txt|zip)$/i.test(file.name) || file.type.startsWith('image/');

  const processFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => acceptFile(f));
    if (!arr.length) return;
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const _id = `annex-${Date.now()}-${i}`;
      setAnnexures((prev) => [...prev, { _id, filePath: '', fileName: file.name, fileDescription: '', uploading: true }]);
      try {
        const filePath = await notingService.uploadAttachment(file);
        setAnnexures((prev) =>
          prev.map((a) => (a._id === _id ? { ...a, filePath, uploading: false } : a))
        );
      } catch {
        toast({ type: 'error', message: `Failed to upload ${file.name}` });
        setAnnexures((prev) => prev.filter((a) => a._id !== _id));
      }
    }
  };

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    await processFiles(files);
    e.target.value = '';
  };

  const onFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFileDropActive(false);
    const files = e.dataTransfer?.files;
    if (files?.length) processFiles(files);
  };

  const onFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDropActive(true);
  };

  const onFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setFileDropActive(false);
  };

  const updateAnnexure = (index: number, updates: Partial<AnnexureEntry>) => {
    setAnnexures((prev) => {
      const n = [...prev];
      n[index] = { ...n[index], ...updates };
      return n;
    });
  };

  const removeAnnexure = (index: number) => setAnnexures((prev) => prev.filter((_, i) => i !== index));

  const dedupePoints = (arr: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of arr) {
      const v = String(raw ?? '').trim();
      if (!v) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  };

  const buildPayload = useCallback((): CreateNotePayload => {
    const basePayload: CreateNotePayload = {
      category,
      subcategory,
      description: description.trim(),
      approvalPeriod,
      recurringFrequency: (approvalPeriod === 'recurring' && recurringFrequency ? recurringFrequency : undefined) as CreateNotePayload['recurringFrequency'],
      policyCompliance: policyCompliance ?? undefined,
      amountRequired,
      amount: amountRequired && amount ? Number(amount) : undefined,
      points: dedupePoints(points),
      attachments: annexures
        .filter((a) => a.filePath && !a.uploading)
        .map((a) => ({ filePath: a.filePath, fileName: a.fileName.trim() || a.filePath, fileDescription: a.fileDescription?.trim() || undefined })),
      submit: false,
    };

    if (isEventNoting && eventName && eventType && eventStartDate && eventEndDate && eventPaymentType) {
      (basePayload as any).eventName = eventName.trim();
      (basePayload as any).eventType = eventType;
      (basePayload as any).eventStartDate = eventStartDate;
      (basePayload as any).eventEndDate = eventEndDate;
      (basePayload as any).eventPaymentType = eventPaymentType;
      (basePayload as any).eventParticipationType = eventParticipationType;
      if (eventPaymentType === 'paid') {
        (basePayload as any).eventRegistrationFeeIndividual = eventParticipationType === 'individual' && eventRegistrationFeeIndividual !== '' ? Number(eventRegistrationFeeIndividual) : null;
        (basePayload as any).eventRegistrationFeeTeam = eventParticipationType === 'team' && eventRegistrationFeeTeam !== '' ? Number(eventRegistrationFeeTeam) : null;
      }
      (basePayload as any).eventApproxCapacity = eventApproxCapacity !== '' ? Number(eventApproxCapacity) : null;
      (basePayload as any).eventDutyLeaveAvailable = eventDutyLeaveAvailable;
      (basePayload as any).eventDutyLeaveEligibility = eventDutyLeaveAvailable ? eventDutyLeaveEligibility : null;
      (basePayload as any).eventHasSponsorship = eventHasSponsorship;
      (basePayload as any).eventSponsors = eventHasSponsorship ? eventSponsors : null;
      (basePayload as any).eventHasResources = eventHasResources;
      (basePayload as any).eventResources = eventHasResources ? eventResources : null;
      (basePayload as any).eventCertification = eventCertification;
      (basePayload as any).eventCapacityFixed = eventCapacityFixed !== '' ? Number(eventCapacityFixed) : null;
      (basePayload as any).eventPrizesAwards = eventPrizesAwards.length > 0 ? eventPrizesAwards : null;
    }

    return basePayload;
  }, [category, subcategory, description, approvalPeriod, recurringFrequency, policyCompliance, amountRequired, amount, points, annexures, isEventNoting, eventName, eventType, eventStartDate, eventEndDate, eventPaymentType, eventParticipationType, eventRegistrationFeeIndividual, eventRegistrationFeeTeam, eventApproxCapacity, eventDutyLeaveAvailable, eventDutyLeaveEligibility, eventHasSponsorship, eventSponsors, eventHasResources, eventResources, eventCertification, eventCapacityFixed, eventPrizesAwards]);

  const handleSubmit = (asDraft: boolean) => {
    if (!config) return;
    if (!asDraft) {
      if (!description.trim()) {
        toast({ type: 'error', message: 'Description is required' });
        return;
      }
      if (overLimit) {
        toast({ type: 'error', message: `Description must be at most ${MAX_WORDS} words` });
        return;
      }

      if (isEventNoting) {
        if (!eventName.trim()) { toast({ type: 'error', message: 'Event name is required' }); return; }
        if (!eventType) { toast({ type: 'error', message: 'Event type is required' }); return; }
        if (!eventStartDate) { toast({ type: 'error', message: 'Event start date is required' }); return; }
        if (!eventEndDate) { toast({ type: 'error', message: 'Event end date is required' }); return; }
        if (new Date(eventEndDate) < new Date(eventStartDate)) { toast({ type: 'error', message: 'Event end date must be after start date' }); return; }
        if (!eventPaymentType) { toast({ type: 'error', message: 'Event payment type is required' }); return; }
        if (eventPaymentType === 'paid') {
          if (eventParticipationType === 'individual' && (eventRegistrationFeeIndividual === '' || Number(eventRegistrationFeeIndividual) < 0)) {
            toast({ type: 'error', message: 'Participation fee (₹) is required for paid individual events' }); return;
          }
          if (eventParticipationType === 'team' && (eventRegistrationFeeTeam === '' || Number(eventRegistrationFeeTeam) < 0)) {
            toast({ type: 'error', message: 'Fee per team (₹) is required for paid team events' }); return;
          }
        }
      }
    }

    const payload = buildPayload();
    const updatePayload: any = {
      description: payload.description,
      approvalPeriod: payload.approvalPeriod,
      policyCompliance: payload.policyCompliance,
      amountRequired: payload.amountRequired,
      points: payload.points,
      attachments: payload.attachments,
    };

    if (isEventNoting && eventName && eventType && eventStartDate && eventEndDate && eventPaymentType) {
      updatePayload.eventName = eventName.trim();
      updatePayload.eventType = eventType;
      updatePayload.eventStartDate = eventStartDate;
      updatePayload.eventEndDate = eventEndDate;
      updatePayload.eventPaymentType = eventPaymentType;
      updatePayload.eventParticipationType = eventParticipationType;
      if (eventPaymentType === 'paid') {
        updatePayload.eventRegistrationFeeIndividual = eventParticipationType === 'individual' && eventRegistrationFeeIndividual !== '' ? Number(eventRegistrationFeeIndividual) : null;
        updatePayload.eventRegistrationFeeTeam = eventParticipationType === 'team' && eventRegistrationFeeTeam !== '' ? Number(eventRegistrationFeeTeam) : null;
      }
      updatePayload.eventApproxCapacity = eventApproxCapacity !== '' ? Number(eventApproxCapacity) : null;
      updatePayload.eventDutyLeaveAvailable = eventDutyLeaveAvailable;
      updatePayload.eventDutyLeaveEligibility = eventDutyLeaveAvailable ? eventDutyLeaveEligibility : null;
      updatePayload.eventHasSponsorship = eventHasSponsorship;
      updatePayload.eventSponsors = eventHasSponsorship ? eventSponsors : null;
      updatePayload.eventHasResources = eventHasResources;
      updatePayload.eventResources = eventHasResources ? eventResources : null;
      updatePayload.eventCertification = eventCertification;
      updatePayload.eventCapacityFixed = eventCapacityFixed !== '' ? Number(eventCapacityFixed) : null;
      updatePayload.eventPrizesAwards = eventPrizesAwards.length > 0 ? eventPrizesAwards : null;
    }

    if (payload.approvalPeriod === 'one_time') updatePayload.recurringFrequency = null;
    else if (payload.recurringFrequency) updatePayload.recurringFrequency = payload.recurringFrequency;
    if (payload.amountRequired === true) {
      if (payload.amount !== undefined && !Number.isNaN(payload.amount)) updatePayload.amount = payload.amount;
    }

    setSubmitting(true);
    const onSuccess = (message: string, id: string) => {
      isAutosavingRef.current = false;
      clearDraft();
      toast({ type: 'success', message });
      router.push(asDraft ? '/noting' : `/noting/${id}`);
    };
    const onError = (err: { response?: { data?: { message?: string } } }) => {
      toast({ type: 'error', message: getErrorMessage(err) });
    };

    if (!asDraft && draftId) {
      notingService
        .updateDraft(draftId, updatePayload)
        .then(() => notingService.submitDraft(draftId))
        .then((res) => onSuccess(res.message || 'Note submitted', draftId))
        .catch(onError)
        .finally(() => setSubmitting(false));
    } else if (asDraft && draftId) {
      notingService
        .updateDraft(draftId, updatePayload)
        .then((res) => onSuccess(res.message || 'Draft saved', draftId))
        .catch(onError)
        .finally(() => setSubmitting(false));
    } else {
      notingService
        .create({ ...payload, submit: !asDraft })
        .then((res) => onSuccess(res.message || (asDraft ? 'Draft saved' : 'Note submitted'), res.data?.id ?? ''))
        .catch(onError)
        .finally(() => setSubmitting(false));
    }
  };

  const handleDiscardDraft = () => {
    if (draftId) {
      notingService.deleteDraft(draftId).catch(() => { });
    }
    isAutosavingRef.current = false;
    clearDraft();
    const s = useNotingDraftStore.getState();
    setCategory(s.category);
    setSubcategory(s.subcategory);
    setDescription(s.description);
    setApprovalPeriod(s.approvalPeriod);
    setRecurringFrequency(s.recurringFrequency);
    setPolicyCompliance(s.policyCompliance);
    setAmountRequired(s.amountRequired);
    setAmount(s.amount);
    setPoints(s.points.length ? s.points : ['']);
    setAnnexures(s.attachments.map((a) => ({ filePath: a.filePath, fileName: a.fileName, fileDescription: a.fileDescription ?? '' })));
    setNotingIdPreview('');
    setNotingYearAndSequence(null);
    toast({ type: 'success', message: 'Draft discarded' });
  };

  if (loading || !config) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <PageSkeleton message="Loading form..." />
      </div>
    );
  }

  const subcategories = config.categories.find((c) => c.value === category)?.subcategories ?? [];

  // Label helper for sections
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">{children}</h3>
  );

  return (
    <>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 px-4 sm:px-6">
        <div className="max-w-[850px] mx-auto">
          {/* Navigation */}
          <Link href="/noting" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-sgt-600 transition-colors mb-5">
            <ArrowLeft className="w-4 h-4" />
            Back to Noting
          </Link>

          {/* ===== A4 Document Sheet ===== */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

            {/* Document Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-8 py-4 sm:py-5">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {isEditingExistingDraft ? 'Edit Draft Note' : 'Create New Note'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {isEditingExistingDraft ? 'Update your draft and submit when ready.' : 'Fill in the details below. All actions are logged and auditable.'}
              </p>
              {notingIdPreview && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-sgt-50 dark:bg-sgt-900/20 border border-sgt-100 dark:border-sgt-800">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Note ID</span>
                  <span className="font-mono text-sm font-semibold text-sgt-700 dark:text-sgt-300">{notingIdPreview}</span>
                </div>
              )}
            </div>

            {/* Document Body */}
            <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-6 sm:space-y-7">

              {/* ===== Category & Subcategory ===== */}
              <section>
                <SectionLabel>Classification</SectionLabel>
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <label className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition-colors ${category === 'academic' ? 'border-sgt-400 bg-sgt-50/50 dark:bg-sgt-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}>
                        <input type="radio" name="category" checked={category === 'academic'} onChange={() => setCategory('academic')} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                        <span className="text-sm font-medium">Academic</span>
                      </label>
                      <label className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition-colors ${category === 'administrative' ? 'border-sgt-400 bg-sgt-50/50 dark:bg-sgt-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}>
                        <input type="radio" name="category" checked={category === 'administrative'} onChange={() => setCategory('administrative')} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                        <span className="text-sm font-medium">Administrative</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subcategory <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      className="w-full px-3 py-3 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                    >
                      <option value="">Select subcategory</option>
                      {subcategories.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              {/* ===== Description ===== */}
              <section>
                <SectionLabel>Description</SectionLabel>
                <div className={`noting-description-editor border rounded-md bg-white dark:bg-gray-700 transition-colors ${overLimit ? 'border-red-400' : 'border-gray-200 dark:border-gray-600 focus-within:border-sgt-500'}`}>
                  <ReactQuill
                    theme="snow"
                    value={description}
                    onChange={setDescription}
                    placeholder="Describe your request in detail. Be clear and specific about what you need approval for..."
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        [{ 'indent': '-1' }, { 'indent': '+1' }],
                        ['blockquote'],
                        ['clean']
                      ]
                    }}
                    formats={['header', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'indent', 'blockquote']}
                    className="noting-quill-editor"
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <p className={`text-xs font-medium ${overLimit ? 'text-red-600' : 'text-gray-400'}`}>
                    {wordCount} / {MAX_WORDS} words
                  </p>
                  {overLimit && (
                    <span className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Exceeds word limit
                    </span>
                  )}
                </div>
              </section>

              {/* ===== Requirements / Points ===== */}
              <section>
                <SectionLabel>Requirements & Points</SectionLabel>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
                  <GripVertical className="w-3.5 h-3.5" />
                  Add requirement points. Drag the handle to reorder.
                </p>
                <div className="space-y-2">
                  {points.map((p, i) => (
                    <div
                      key={i}
                      draggable
                      onDragStart={() => setPointDraggedIndex(i)}
                      onDragOver={(e) => { e.preventDefault(); setPointDropTargetIndex(i); }}
                      onDragLeave={() => setPointDropTargetIndex(null)}
                      onDrop={(e) => { e.preventDefault(); if (pointDraggedIndex !== null) movePoint(pointDraggedIndex, i); }}
                      onDragEnd={() => { setPointDraggedIndex(null); setPointDropTargetIndex(null); }}
                      className={`flex gap-2 items-center p-2.5 rounded-md border transition-all ${pointDraggedIndex === i
                        ? 'opacity-50 border-sgt-300 bg-sgt-50 dark:bg-sgt-900/10'
                        : pointDropTargetIndex === i
                          ? 'border-sgt-300 bg-sgt-50 dark:bg-sgt-900/10'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                    >
                      <span className="text-gray-300 cursor-grab active:cursor-grabbing hover:text-sgt-500 transition-colors" title="Drag to reorder">
                        <GripVertical className="w-4 h-4" />
                      </span>
                      <span className="flex items-center justify-center w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">
                        {i + 1}
                      </span>
                      <input
                        type="text"
                        value={p}
                        onChange={(e) => updatePoint(i, e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                        placeholder={`Requirement point ${i + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removePoint(i)}
                        className="p-1.5 text-gray-300 hover:text-red-500 rounded-md transition-colors shrink-0"
                        title="Remove point"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addPoint}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sgt-600 dark:text-sgt-400 hover:bg-sgt-50 dark:hover:bg-sgt-900/10 rounded-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add another point
                </button>
              </section>

              {/* ===== Attachments ===== */}
              <section>
                <SectionLabel>Attachments & Annexure</SectionLabel>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*,.txt,.zip"
                  onChange={onFileSelect}
                  className="hidden"
                />
                <div
                  onDragOver={onFileDragOver}
                  onDragLeave={onFileDragLeave}
                  onDrop={onFileDrop}
                  className={`rounded-md border-2 border-dashed p-6 text-center transition-all ${fileDropActive
                    ? 'border-sgt-400 bg-sgt-50 dark:bg-sgt-900/10'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                >
                  <Upload className={`w-6 h-6 mx-auto mb-2 ${fileDropActive ? 'text-sgt-500' : 'text-gray-300'}`} />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {fileDropActive ? 'Drop files here' : 'Drag and drop files here'}
                  </p>
                  <p className="text-xs text-gray-400 mb-3">PDF, Word, Excel, Images, ZIP</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-sgt-600 text-white text-sm font-medium rounded-md hover:bg-sgt-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Choose files
                  </button>
                </div>

                {annexures.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Uploaded Files ({annexures.length})
                    </p>
                    {annexures.map((a, i) => (
                      <div
                        key={i}
                        className="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="p-1.5 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-600">
                              <FileText className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {a.uploading ? 'Uploading...' : (a.fileName || 'Unnamed file')}
                              </p>
                              {a.uploading && (
                                <p className="text-xs text-gray-400">Please wait...</p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAnnexure(i)}
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded-md transition-colors shrink-0"
                            title="Remove file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {!a.uploading && a.filePath && (
                          <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <div>
                              <label className="block text-[10px] font-medium text-gray-400 mb-1">Display Name</label>
                              <input
                                type="text"
                                value={a.fileName}
                                onChange={(e) => updateAnnexure(i, { fileName: e.target.value })}
                                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                                placeholder="File name"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-gray-400 mb-1">Description / Purpose</label>
                              <textarea
                                value={a.fileDescription}
                                onChange={(e) => updateAnnexure(i, { fileDescription: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                                placeholder="What is this file for?"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ===== Event Details (Conditional) ===== */}
              {isEventNoting && (
                <section>
                  <SectionLabel>Event Details</SectionLabel>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Event name, type, dates, and payment type will be <strong>locked</strong> after approval and cannot be changed.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Event Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={eventName}
                        onChange={(e) => setEventName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                        placeholder="Enter event name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Event Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                      >
                        <option value="">Select event type</option>
                        <option value="workshop">Workshop</option>
                        <option value="seminar">Seminar</option>
                        <option value="conference">Conference</option>
                        <option value="competition">Competition</option>
                        <option value="cultural">Cultural Event</option>
                        <option value="sports">Sports Event</option>
                        <option value="tech_fest">Tech Fest</option>
                        <option value="hackathon">Hackathon</option>
                        <option value="webinar">Webinar</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Start Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={eventStartDate}
                          onChange={(e) => setEventStartDate(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          End Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={eventEndDate}
                          onChange={(e) => setEventEndDate(e.target.value)}
                          min={eventStartDate}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Payment Type <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="eventPaymentType" value="free" checked={eventPaymentType === 'free'} onChange={(e) => setEventPaymentType(e.target.value as 'free' | 'paid')} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Free</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="eventPaymentType" value="paid" checked={eventPaymentType === 'paid'} onChange={(e) => setEventPaymentType(e.target.value as 'free' | 'paid')} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Paid</span>
                        </label>
                      </div>
                    </div>
                    {/* Participation Type & Fee (conditional) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Participation Type</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="eventParticipationType" value="individual" checked={eventParticipationType === 'individual'} onChange={(e) => setEventParticipationType(e.target.value as 'individual' | 'team')} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Individual</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="eventParticipationType" value="team" checked={eventParticipationType === 'team'} onChange={(e) => setEventParticipationType(e.target.value as 'individual' | 'team')} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Team</span>
                        </label>
                      </div>
                    </div>
                    {eventPaymentType === 'paid' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          {eventParticipationType === 'individual' ? 'Participation Fee (₹)' : 'Fee per Team (₹)'} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={eventParticipationType === 'individual' ? eventRegistrationFeeIndividual : eventRegistrationFeeTeam}
                          onChange={(e) => {
                            const v = e.target.value === '' ? '' : Number(e.target.value);
                            eventParticipationType === 'individual' ? setEventRegistrationFeeIndividual(v) : setEventRegistrationFeeTeam(v);
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                          placeholder={eventParticipationType === 'individual' ? 'e.g. 500' : 'e.g. 2000'}
                        />
                      </div>
                    )}
                    {/* Approximate Capacity (informational only) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Approximate Capacity</label>
                      <input
                        type="number"
                        min={1}
                        value={eventApproxCapacity}
                        onChange={(e) => setEventApproxCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                        placeholder="For planning only (optional)"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Used for estimation only, not strictly enforced</p>
                    </div>
                    {/* Duty Leave */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Duty Leave Available?</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="eventDutyLeave" value="yes" checked={eventDutyLeaveAvailable === true} onChange={() => setEventDutyLeaveAvailable(true)} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="eventDutyLeave" value="no" checked={eventDutyLeaveAvailable === false} onChange={() => { setEventDutyLeaveAvailable(false); setEventDutyLeaveEligibility([]); }} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">No</span>
                        </label>
                      </div>
                      {eventDutyLeaveAvailable && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {['students', 'faculty_teaching', 'faculty_non_teaching', 'staff'].map((opt) => (
                            <label key={opt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                              <input type="checkbox" checked={eventDutyLeaveEligibility.includes(opt)} onChange={(e) => setEventDutyLeaveEligibility((prev) => e.target.checked ? [...prev, opt] : prev.filter((x) => x !== opt))} className="w-3.5 h-3.5 text-sgt-600 focus:ring-sgt-500" />
                              <span className="text-sm capitalize">{opt.replace('_', ' ')}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Sponsorship */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Is there sponsorship?</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="eventSponsorship" value="yes" checked={eventHasSponsorship === true} onChange={() => setEventHasSponsorship(true)} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="eventSponsorship" value="no" checked={eventHasSponsorship === false} onChange={() => { setEventHasSponsorship(false); setEventSponsors([]); }} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">No</span>
                        </label>
                      </div>
                      {eventHasSponsorship && (
                        <div className="mt-2 space-y-2">
                          {eventSponsors.map((s, i) => (
                            <div key={i} className="flex flex-wrap gap-2 p-2 rounded-md border border-gray-200 dark:border-gray-600">
                              <input type="text" value={s.name} onChange={(e) => setEventSponsors((prev) => { const n = [...prev]; n[i] = { ...n[i], name: e.target.value }; return n; })} placeholder="Sponsor name" className="flex-1 min-w-[120px] px-2 py-1.5 text-sm border rounded" />
                              <select value={s.type} onChange={(e) => setEventSponsors((prev) => { const n = [...prev]; n[i] = { ...n[i], type: e.target.value as 'cash' | 'in_kind' }; return n; })} className="px-2 py-1.5 text-sm border rounded">
                                <option value="cash">Cash</option>
                                <option value="in_kind">In-kind</option>
                              </select>
                              {s.type === 'cash' ? (
                                <input type="number" min={0} value={s.amount || ''} onChange={(e) => setEventSponsors((prev) => { const n = [...prev]; n[i] = { ...n[i], amount: Number(e.target.value) || 0 }; return n; })} placeholder="Amount (₹)" className="w-28 px-2 py-1.5 text-sm border rounded" />
                              ) : (
                                <input type="text" value={s.notes || ''} onChange={(e) => setEventSponsors((prev) => { const n = [...prev]; n[i] = { ...n[i], notes: e.target.value }; return n; })} placeholder="Describe in-kind (e.g. Laptops, Food)" className="flex-1 min-w-[180px] px-2 py-1.5 text-sm border rounded" />
                              )}
                              <button type="button" onClick={() => setEventSponsors((prev) => prev.filter((_, j) => j !== i))} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => setEventSponsors((prev) => [...prev, { name: '', amount: 0, type: 'cash' }])} className="text-sm text-sgt-600 hover:text-sgt-700 font-medium flex items-center gap-1"><Plus className="w-4 h-4" /> Add sponsor</button>
                        </div>
                      )}
                    </div>
                    {/* Certification */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Certificate Available?</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Will participants receive a certificate? (Locked after approval)</p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="eventCertification" value="yes" checked={eventCertification === true} onChange={() => setEventCertification(true)} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="eventCertification" value="no" checked={eventCertification === false} onChange={() => setEventCertification(false)} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">No</span>
                        </label>
                      </div>
                    </div>
                    {/* Capacity Fixed (internal) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Capacity Fixed (Internal)</label>
                      <input
                        type="number"
                        min={1}
                        value={eventCapacityFixed}
                        onChange={(e) => setEventCapacityFixed(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                        placeholder="Internal capacity limit (locked after approval)"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">This is different from approx capacity. Not visible to users. Locked after approval.</p>
                    </div>
                    {/* Prizes/Awards - Same format as Event Manage page */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Prizes / Awards</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Configure prizes (locked after approval). Uses same format as event management.</p>
                      <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {eventPrizesAwards.length > 0 && (
                          <div className="p-3 space-y-2">
                            {eventPrizesAwards.map((prize, idx) => (
                              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                  {prize.prizeType === 'trophy' ? <Trophy className="w-5 h-5 text-blue-600" /> : prize.prizeType === 'cash' ? <IndianRupee className="w-5 h-5 text-blue-600" /> : <Award className="w-5 h-5 text-blue-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{prize.rank}</h4>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {prize.prizeType === 'cash' && prize.prizeAmount ? `₹${prize.prizeAmount.toLocaleString()}` : prize.title || PRIZE_TYPE_OPTIONS.find(p => p.value === prize.prizeType)?.label || 'Prize'}
                                  </p>
                                  {prize.additionalPerks && prize.additionalPerks.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {prize.additionalPerks.map((perk, i) => <span key={i} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full">{perk}</span>)}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => { setEditingPrize({ ...prize }); setEditingPrizeIndex(idx); setShowPrizeModal(true); }} className="p-1.5 text-gray-400 hover:text-sgt-600 transition-colors"><Settings className="w-4 h-4" /></button>
                                  <button type="button" onClick={() => setEventPrizesAwards((prev) => prev.filter((_, j) => j !== idx))} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className={eventPrizesAwards.length > 0 ? "p-3 border-t border-gray-200 dark:border-gray-600" : "p-3"}>
                          <button type="button" onClick={() => {
                            setEditingPrize({
                              position: eventPrizesAwards.length + 1,
                              rank: eventPrizesAwards.length === 0 ? 'Winner' : eventPrizesAwards.length === 1 ? 'First Runner Up' : eventPrizesAwards.length === 2 ? 'Second Runner Up' : `Position ${eventPrizesAwards.length + 1}`,
                              title: '',
                              prizeType: 'certificate',
                              sortOrder: eventPrizesAwards.length,
                              isActive: true,
                              additionalPerks: [],
                            });
                            setEditingPrizeIndex(null);
                            setShowPrizeModal(true);
                          }} className="w-full flex items-center justify-center gap-2 p-2.5 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg text-gray-500 hover:border-sgt-400 hover:text-sgt-600 transition-colors text-sm">
                            <Plus className="w-4 h-4" /><span className="font-medium">Add Prize</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Resources */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Are any resources required?</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="eventResources" value="yes" checked={eventHasResources === true} onChange={() => setEventHasResources(true)} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="eventResources" value="no" checked={eventHasResources === false} onChange={() => { setEventHasResources(false); setEventResources([]); }} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">No</span>
                        </label>
                      </div>
                      {eventHasResources && (
                        <div className="mt-3">
                          {/* Resource Table */}
                          <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-600">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50">
                                  <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Type</th>
                                  <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Description</th>
                                  <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Price/Piece (₹)</th>
                                  <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Quantity</th>
                                  <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Cost (₹)</th>
                                  <th className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-10"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-600">
                                {eventResources.map((r, i) => {
                                  const computedCost = (r.pricePerPiece !== '' && r.quantity !== '') ? Number(r.pricePerPiece) * Number(r.quantity) : '';
                                  return (
                                    <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                                      <td className="px-2 py-1.5">
                                        <input type="text" value={r.type} onChange={(e) => setEventResources((prev) => { const n = [...prev]; n[i] = { ...n[i], type: e.target.value }; return n; })} placeholder="e.g. Audio System" className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <input type="text" value={r.description} onChange={(e) => setEventResources((prev) => { const n = [...prev]; n[i] = { ...n[i], description: e.target.value }; return n; })} placeholder="Description" className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <input type="number" min={0} value={r.pricePerPiece} onChange={(e) => { const val = e.target.value === '' ? '' : Number(e.target.value); setEventResources((prev) => { const n = [...prev]; const cost = (val !== '' && n[i].quantity !== '') ? Number(val) * Number(n[i].quantity) : ''; n[i] = { ...n[i], pricePerPiece: val, cost }; return n; }); }} placeholder="₹0" className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <input type="number" min={1} value={r.quantity} onChange={(e) => { const val = e.target.value === '' ? '' : Number(e.target.value); setEventResources((prev) => { const n = [...prev]; const cost = (n[i].pricePerPiece !== '' && val !== '') ? Number(n[i].pricePerPiece) * Number(val) : ''; n[i] = { ...n[i], quantity: val, cost }; return n; }); }} placeholder="0" className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                          {computedCost !== '' ? `₹${Number(computedCost).toLocaleString('en-IN')}` : '—'}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <button type="button" onClick={() => setEventResources((prev) => prev.filter((_, j) => j !== i))} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4" /></button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              {eventResources.length > 0 && (
                                <tfoot>
                                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
                                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">Total Cost</td>
                                    <td className="px-3 py-2 text-sm font-bold text-gray-900 dark:text-white">
                                      ₹{eventResources.reduce((sum, r) => sum + (r.cost !== '' ? Number(r.cost) : 0), 0).toLocaleString('en-IN')}
                                    </td>
                                    <td></td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                          <button type="button" onClick={() => setEventResources((prev) => [...prev, { type: '', description: '', pricePerPiece: '', quantity: '', cost: '' }])} className="mt-2 text-sm text-sgt-600 hover:text-sgt-700 dark:text-sgt-400 font-medium flex items-center gap-1"><Plus className="w-4 h-4" /> Add resource</button>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* ===== Additional Details ===== */}
              <section>
                <SectionLabel>Additional Details</SectionLabel>
                <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Approval Period & Policy Compliance - Side by Side */}
                  <div className="grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-600">
                    {/* Approval Period */}
                    <div className="bg-white dark:bg-gray-800 p-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Approval Period</label>
                      <div className="flex flex-col gap-2">
                        <label className={`flex items-center gap-2 p-2.5 border rounded-md cursor-pointer transition-colors ${approvalPeriod === 'one_time' ? 'border-sgt-400 bg-sgt-50/50 dark:bg-sgt-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}>
                          <input type="radio" name="period" checked={approvalPeriod === 'one_time'} onChange={() => setApprovalPeriod('one_time')} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm font-medium">One-time</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <label className={`flex items-center gap-2 p-2.5 border rounded-md cursor-pointer transition-colors flex-1 ${approvalPeriod === 'recurring' ? 'border-sgt-400 bg-sgt-50/50 dark:bg-sgt-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                            }`}>
                            <input type="radio" name="period" checked={approvalPeriod === 'recurring'} onChange={() => setApprovalPeriod('recurring')} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                            <span className="text-sm font-medium">Recurring</span>
                          </label>
                          {approvalPeriod === 'recurring' && (
                            <select
                              value={recurringFrequency}
                              onChange={(e) => setRecurringFrequency(e.target.value)}
                              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                            >
                              <option value="">Select frequency</option>
                              {config.recurringFrequencyOptions.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Policy Compliance */}
                    <div className="bg-white dark:bg-gray-800 p-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Policy Compliance</label>
                      <div className="flex flex-col gap-2">
                        <label className={`flex items-center gap-2 p-2.5 border rounded-md cursor-pointer transition-colors ${policyCompliance === 'yes' ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}>
                          <input type="radio" name="policyCompliance" checked={policyCompliance === 'yes'} onChange={() => setPolicyCompliance('yes')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" />
                          <span className="text-sm font-medium">Yes, complies</span>
                        </label>
                        <label className={`flex items-center gap-2 p-2.5 border rounded-md cursor-pointer transition-colors ${policyCompliance === 'no' ? 'border-red-400 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}>
                          <input type="radio" name="policyCompliance" checked={policyCompliance === 'no'} onChange={() => setPolicyCompliance('no')} className="w-4 h-4 text-red-600 focus:ring-red-500" />
                          <span className="text-sm font-medium">No</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Budget / Amount */}
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">Budget / Amount</label>
                      <div className="flex gap-3 flex-1 items-center">
                        <label className={`flex items-center gap-2 p-2.5 border rounded-md cursor-pointer transition-colors flex-1 ${!amountRequired ? 'border-sgt-400 bg-sgt-50/50 dark:bg-sgt-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}>
                          <input type="radio" name="amountReq" checked={!amountRequired} onChange={() => setAmountRequired(false)} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm font-medium">No amount</span>
                        </label>
                        <label className={`flex items-center gap-2 p-2.5 border rounded-md cursor-pointer transition-colors flex-1 ${amountRequired ? 'border-sgt-400 bg-sgt-50/50 dark:bg-sgt-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}>
                          <input type="radio" name="amountReq" checked={amountRequired} onChange={() => setAmountRequired(true)} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm font-medium">Amount required</span>
                        </label>
                        {amountRequired && (
                          <div className="relative flex-1 shrink-0 w-40">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₹</span>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                              placeholder="Enter amount"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ===== Creator Info ===== */}
              {creatorInfo && (
                <section>
                  <SectionLabel>Created By</SectionLabel>
                  <div className="bg-gray-50 dark:bg-gray-900/20 rounded-md border border-gray-100 dark:border-gray-700 p-3">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      <div className="flex gap-2">
                        <span className="text-gray-400 font-medium min-w-[70px]">Name:</span>
                        <span className="text-gray-900 dark:text-white font-medium">{creatorInfo.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-400 font-medium min-w-[70px]">ID:</span>
                        <span className="text-gray-900 dark:text-white">{creatorInfo.employeeIdOrStudentId ?? '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-400 font-medium min-w-[70px]">Role:</span>
                        <span className="text-gray-900 dark:text-white">{creatorInfo.role}</span>
                      </div>
                      {creatorInfo.department && (
                        <div className="flex gap-2">
                          <span className="text-gray-400 font-medium min-w-[70px]">Dept:</span>
                          <span className="text-gray-900 dark:text-white">{creatorInfo.department}</span>
                        </div>
                      )}
                      {creatorInfo.school && (
                        <div className="flex gap-2">
                          <span className="text-gray-400 font-medium min-w-[70px]">School:</span>
                          <span className="text-gray-900 dark:text-white">{creatorInfo.school}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* Document Footer — Action Buttons */}
            <div className="border-t border-gray-200 dark:border-gray-700 px-8 py-4 bg-gray-50 dark:bg-gray-900/20">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting || !description.trim() || overLimit}
                  className="px-5 py-2.5 bg-sgt-600 text-white text-sm font-medium rounded-md hover:bg-sgt-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {submitting ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
                  {isRevertedNote ? 'Send for Reapproval' : 'Send for Approval'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="px-5 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {submitting && <LoadingSpinner size="sm" />}
                  <Save className="w-4 h-4" />
                  Save as Draft
                </button>
                {(draftId || category || subcategory || description.trim() || points.some((p) => p.trim())) && (
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    disabled={submitting}
                    className="ml-auto px-4 py-2.5 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/10 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Discard Draft
                  </button>
                )}
              </div>
            </div>
          </div>
        </div >
      </div >

      {/* Prize Modal */}
      {
        showPrizeModal && editingPrize && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPrizeModal(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editingPrizeIndex !== null ? 'Edit Prize' : 'Add Prize'}</h3>
                <button type="button" onClick={() => setShowPrizeModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                {/* Rank */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rank / Position Title</label>
                  <input type="text" value={editingPrize.rank} onChange={(e) => setEditingPrize({ ...editingPrize!, rank: e.target.value })} placeholder="e.g. Winner, First Runner Up" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 outline-none" />
                </div>
                {/* Prize Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Prize Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {PRIZE_TYPE_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button" onClick={() => setEditingPrize({ ...editingPrize!, prizeType: opt.value })} className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 text-xs font-medium transition-all ${editingPrize.prizeType === opt.value ? 'border-sgt-500 bg-sgt-50 dark:bg-sgt-900/20 text-sgt-700 dark:text-sgt-300' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'}`}>
                        {opt.icon}
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prize Title</label>
                  <input type="text" value={editingPrize.title} onChange={(e) => setEditingPrize({ ...editingPrize!, title: e.target.value })} placeholder="e.g. Gold Medal, Cash Prize" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 outline-none" />
                </div>
                {/* Amount (shown for cash type) */}
                {editingPrize.prizeType === 'cash' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prize Amount (₹)</label>
                    <input type="number" min={0} value={editingPrize.prizeAmount ?? ''} onChange={(e) => setEditingPrize({ ...editingPrize!, prizeAmount: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="Amount in ₹" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 outline-none" />
                  </div>
                )}
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
                  <textarea value={editingPrize.description || ''} onChange={(e) => setEditingPrize({ ...editingPrize!, description: e.target.value })} placeholder="Brief description of the prize" rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 outline-none resize-none" />
                </div>
                {/* Additional Perks */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Additional Perks</label>
                  <div className="flex flex-wrap gap-2">
                    {PERK_OPTIONS.map((perk) => {
                      const isSelected = editingPrize.additionalPerks?.includes(perk) ?? false;
                      return (
                        <button key={perk} type="button" onClick={() => {
                          const currentPerks = editingPrize.additionalPerks || [];
                          setEditingPrize({ ...editingPrize!, additionalPerks: isSelected ? currentPerks.filter(p => p !== perk) : [...currentPerks, perk] });
                        }} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${isSelected ? 'bg-sgt-100 dark:bg-sgt-900/30 border-sgt-300 dark:border-sgt-600 text-sgt-700 dark:text-sgt-300' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'}`}>
                          {perk}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setShowPrizeModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
                <button type="button" onClick={() => {
                  if (!editingPrize.rank.trim()) return;
                  if (editingPrizeIndex !== null) {
                    setEventPrizesAwards(prev => prev.map((p, i) => i === editingPrizeIndex ? editingPrize : p));
                  } else {
                    setEventPrizesAwards(prev => [...prev, editingPrize]);
                  }
                  setShowPrizeModal(false);
                  setEditingPrize(null);
                  setEditingPrizeIndex(null);
                }} className="px-4 py-2 text-sm font-medium text-white bg-sgt-600 hover:bg-sgt-700 rounded-lg transition-colors">{editingPrizeIndex !== null ? 'Update Prize' : 'Add Prize'}</button>
              </div>
            </div>
          </div>
        )
      }
    </>
  );
}
