'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Plus, Trash2, Upload, FileText, GripVertical, Clock, CheckCircle, User, Send, Save, Paperclip, AlertCircle, List, Calendar } from 'lucide-react';
import { notingService } from '@/features/noting-management/services/noting.service';
import type { NoteConfig, CreatorInfo, CreateNotePayload } from '@/features/noting-management/types/noting.types';
import {
  EventTypeSelector,
  StallConfigSection,
  FestivalForm,
  EventFormFields,
  defaultStallConfig,
  defaultFestivalForm,
  defaultVenueForm,
} from '@/features/noting-management/components';
import type { NotingEventType, StallConfig, FestivalFormData, VenueFormData } from '@/features/noting-management/components';
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
const FILE_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file
const AMOUNT_MAX = 10_00_000; // 10 lakh

const DEBOUNCE_SYNC_MS = 400;
const DEBOUNCE_AUTOSAVE_MS = 2000;

/** Build event payload from shared VenueFormData (used for venue & stall) */
function venueFormDataToEventPayload(v: VenueFormData): Record<string, unknown> {
  if (!v.eventName?.trim() || !v.eventType || !v.eventStartDate || !v.eventEndDate || !v.eventPaymentType) return {};
  const payload: Record<string, unknown> = {
    eventName: v.eventName.trim(),
    eventType: v.eventType,
    eventStartDate: v.eventStartDate,
    eventEndDate: v.eventEndDate,
    eventPaymentType: v.eventPaymentType,
    eventParticipationType: v.eventParticipationType,
    eventApproxCapacity: v.eventApproxCapacity !== '' ? Number(v.eventApproxCapacity) : null,
    eventDutyLeaveAvailable: v.eventDutyLeaveAvailable,
    eventDutyLeaveEligibility: v.eventDutyLeaveAvailable && v.eventDutyLeaveEligibility.length > 0 ? v.eventDutyLeaveEligibility : null,
    eventDutyLeaveRoleType: v.eventDutyLeaveAvailable ? v.eventDutyLeaveRoleType : null,
    eventHasSponsorship: v.eventHasSponsorship,
    eventSponsors: v.eventHasSponsorship ? v.eventSponsors.map((s) => ({ ...s, amount: s.amount === '' ? 0 : Number(s.amount) })) : null,
    eventHasResources: v.eventHasResources,
    eventResources: v.eventHasResources ? v.eventResources.map((r) => ({
      type: r.type,
      description: r.description,
      pricePerPiece: r.pricePerPiece !== '' && r.pricePerPiece != null ? Number(r.pricePerPiece) : null,
      quantity: r.quantity !== '' && r.quantity != null ? Number(r.quantity) : null,
    })) : null,
    eventCertification: v.eventCertification,
    eventCapacityFixed: v.eventCapacityFixed !== '' && v.eventCapacityFixed != null ? Number(v.eventCapacityFixed) : null,
    eventPrizesAwards: (v.eventHasPrizes && v.eventPrizesAwards.length > 0) ? v.eventPrizesAwards.map((p, idx) => ({
      position: p.position === '' ? idx + 1 : Number(p.position),
      rank: p.rank,
      title: p.title,
      prizeType: p.prizeType,
      prizeAmount: p.prizeAmount === '' ? undefined : Number(p.prizeAmount),
      additionalPerks: p.additionalPerks ? p.additionalPerks.split(',').map((x) => x.trim()).filter(Boolean) : null,
      sortOrder: idx,
    })) : null,
  };
  if (v.eventPaymentType === 'paid') {
    payload.eventRegistrationFeeIndividual = v.eventParticipationType === 'individual' && v.eventRegistrationFeeIndividual !== '' ? Number(v.eventRegistrationFeeIndividual) : null;
    payload.eventRegistrationFeeTeam = v.eventParticipationType === 'team' && v.eventRegistrationFeeTeam !== '' ? Number(v.eventRegistrationFeeTeam) : null;
  }
  return payload;
}

/** Convert note from API to VenueFormData for draft load */
function noteToVenueFormData(note: Record<string, unknown>): VenueFormData {
  const sponsors = Array.isArray(note.eventSponsors) ? (note.eventSponsors as any[]) : [];
  const resources = Array.isArray(note.eventResources) ? (note.eventResources as any[]) : [];
  const prizes = Array.isArray(note.eventPrizesAwards) ? (note.eventPrizesAwards as any[]) : [];
  return {
    eventName: (note.eventName as string) || '',
    eventType: (note.eventType as string) || '',
    eventStartDate: (note.eventStartDate as string) || '',
    eventEndDate: (note.eventEndDate as string) || '',
    eventPaymentType: (note.eventPaymentType as 'free' | 'paid') || 'free',
    eventParticipationType: (note.eventParticipationType as 'individual' | 'team') || 'individual',
    eventRegistrationFeeIndividual: (note.eventRegistrationFeeIndividual as number) ?? '',
    eventRegistrationFeeTeam: (note.eventRegistrationFeeTeam as number) ?? '',
    eventApproxCapacity: (note.eventApproxCapacity as number) ?? '',
    eventCapacityFixed: (note.eventCapacityFixed as number) ?? '',
    eventDutyLeaveAvailable: (note.eventDutyLeaveAvailable as boolean | null) ?? null,
    eventDutyLeaveEligibility: Array.isArray(note.eventDutyLeaveEligibility) ? ((note.eventDutyLeaveEligibility as string[]).includes('students') ? ['ug', 'pg', 'phd'] : (note.eventDutyLeaveEligibility as string[])) : [],
    eventDutyLeaveRoleType: (note.eventDutyLeaveRoleType as 'participants' | 'organizers' | 'both') || undefined,
    eventHasSponsorship: (note.eventHasSponsorship as boolean | null) ?? null,
    eventSponsors: sponsors.map((s) => ({ name: s.name || '', amount: s.amount ?? '', type: s.type || 'cash', notes: s.notes || '' })),
    eventHasResources: (note.eventHasResources as boolean | null) ?? null,
    eventResources: resources.map((r) => ({ type: r.type || '', description: r.description || '', pricePerPiece: r.pricePerPiece ?? '', quantity: r.quantity ?? '' })),
    eventCertification: (note.eventCertification as boolean | null) ?? null,
    eventHasPrizes: prizes.length > 0 ? true : null,
    eventPrizesAwards: prizes.map((p) => ({
      position: p.position ?? '',
      rank: p.rank || '',
      title: p.title || '',
      prizeType: p.prizeType || 'cash',
      prizeAmount: p.prizeAmount ?? '',
      additionalPerks: typeof p.additionalPerks === 'string' ? p.additionalPerks : Array.isArray(p.additionalPerks) ? (p.additionalPerks as string[]).join(', ') : undefined,
    })),
  };
}

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
    if (user && (user.role?.name === 'student' || user.userType === 'student')) {
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

  // Event-specific fields — venue & stall use shared venueFormData (same form as festival sub-events)
  const [isEventNoting, setIsEventNoting] = useState(false);
  const [venueFormData, setVenueFormData] = useState<VenueFormData>({ ...defaultVenueForm });

  // Stall & Festival noting type fields
  const [notingEventType, setNotingEventType] = useState<NotingEventType | null>(null);
  const [stallConfig, setStallConfig] = useState<StallConfig>({ ...defaultStallConfig });
  const [festivalData, setFestivalData] = useState<FestivalFormData>({ ...defaultFestivalForm });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutosavingRef = useRef(false);
  // PERF: Track last-saved form snapshot to avoid re-firing autosave when
  // object references change but actual values haven't.
  const lastSavedSnapshotRef = useRef<string>("");
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

      const noteObj = note as unknown as Record<string, unknown>;
      if (noteObj.notingEventType === 'venue' || noteObj.notingEventType === 'stall') {
        setVenueFormData(noteToVenueFormData(noteObj));
      } else if (noteObj.eventName || noteObj.eventType) {
        setVenueFormData(noteToVenueFormData(noteObj));
      }

      // Restore stall & festival type fields
      if ((note as any).notingEventType) setNotingEventType((note as any).notingEventType as NotingEventType);
      if ((note as any).stallConfig) setStallConfig((note as any).stallConfig);
      if ((note as any).festivalMeta || Array.isArray((note as any).subEvents)) {
        setFestivalData((prev) => ({
          ...prev,
          festivalName: (note as any).festivalMeta?.name || prev.festivalName,
          startDate: (note as any).festivalMeta?.startDate || prev.startDate,
          endDate: (note as any).festivalMeta?.endDate || prev.endDate,
          description: (note as any).festivalMeta?.description || prev.description,
          coordinator: (note as any).festivalMeta?.coordinator || prev.coordinator,
          subEvents: Array.isArray((note as any).subEvents) ? (note as any).subEvents.map((se: { id?: string; eventType?: string; venueFormData?: Record<string, unknown>; stallConfig?: unknown }) => ({
            id: se.id || crypto.randomUUID(),
            eventType: (se.eventType || 'venue') as 'venue' | 'stall',
            venueFormData: noteToVenueFormData(se.venueFormData || (se as Record<string, unknown>)),
            stallConfig: se.stallConfig,
          })) : prev.subEvents,
          currentStage: 'review' as const,
        }));
      }

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
    setVenueFormData({ ...defaultVenueForm });
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
      setVenueFormData(defaultVenueForm);
    }
  }, [subcategory, config]);

  // Auto-fill Overall Coordinator with noting creator's UID when Festival is selected
  useEffect(() => {
    if (notingEventType === 'festival' && creatorInfo && !festivalData.coordinator?.trim()) {
      const uid = creatorInfo.employeeIdOrStudentId || creatorInfo.name || '';
      if (uid) {
        setFestivalData((prev) => ({ ...prev, coordinator: uid }));
      }
    }
  }, [notingEventType, creatorInfo, festivalData.coordinator]);

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
      if (isEventNoting && (notingEventType === 'venue' || notingEventType === 'stall')) {
        Object.assign(eventPayload, venueFormDataToEventPayload(venueFormData));
      }

      // Stall & festival type fields (set outside inner condition to support all notingEventType values)
      if (isEventNoting && notingEventType) {
        eventPayload.notingEventType = notingEventType;
        if (notingEventType === 'stall') {
          eventPayload.stallConfig = stallConfig;
        }
        if (notingEventType === 'festival') {
          eventPayload.festivalMeta = {
            name: festivalData.festivalName,
            startDate: festivalData.startDate,
            endDate: festivalData.endDate,
            description: festivalData.description,
            coordinator: festivalData.coordinator,
          };
          eventPayload.subEvents = festivalData.subEvents.map((se) => ({
            id: se.id,
            eventType: se.eventType,
            venueFormData: venueFormDataToEventPayload(se.venueFormData),
            stallConfig: se.stallConfig,
          }));
          // Override event fields with festival meta so backend approval flow works
          if (festivalData.festivalName && festivalData.startDate && festivalData.endDate) {
            eventPayload.eventName = festivalData.festivalName;
            eventPayload.eventStartDate = festivalData.startDate;
            eventPayload.eventEndDate = festivalData.endDate;
            eventPayload.eventType = 'fest';
            eventPayload.eventPaymentType = 'free';
          }
        }
      }

      // PERF: Compare JSON snapshot to skip no-op autosaves.
      // This prevents re-firing when object references change but values haven't.
      const snapshot = JSON.stringify({ ...payload, ...eventPayload });
      if (snapshot === lastSavedSnapshotRef.current) return;
      lastSavedSnapshotRef.current = snapshot;

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
    amount, points, annexures, isEventNoting, venueFormData, notingEventType, stallConfig, festivalData, setDraftId,
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
    const oversized = arr.filter((f) => f.size > FILE_MAX_SIZE_BYTES);
    if (oversized.length > 0) {
      toast({ type: 'error', message: `File size must not exceed 5MB. ${oversized.map((f) => f.name).join(', ')} ${oversized.length === 1 ? 'is' : 'are'} too large.` });
      return;
    }
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

    if (isEventNoting && (notingEventType === 'venue' || notingEventType === 'stall')) {
      Object.assign(basePayload, venueFormDataToEventPayload(venueFormData));
    }
    if (isEventNoting) {
      // Stall & Festival type
      (basePayload as any).notingEventType = notingEventType || 'venue';
      if (notingEventType === 'stall') {
        (basePayload as any).stallConfig = stallConfig;
      }
      if (notingEventType === 'festival') {
        (basePayload as any).festivalMeta = {
          name: festivalData.festivalName,
          startDate: festivalData.startDate,
          endDate: festivalData.endDate,
          description: festivalData.description,
          coordinator: festivalData.coordinator,
        };
        (basePayload as any).subEvents = festivalData.subEvents.map((se) => ({
          id: se.id,
          eventType: se.eventType,
          venueFormData: venueFormDataToEventPayload(se.venueFormData),
          stallConfig: se.stallConfig,
        }));
        // For festival, use festival meta as the "event" fields (so approval flow works)
        if (festivalData.festivalName && festivalData.startDate && festivalData.endDate) {
          (basePayload as any).eventName = festivalData.festivalName;
          (basePayload as any).eventStartDate = festivalData.startDate;
          (basePayload as any).eventEndDate = festivalData.endDate;
          (basePayload as any).eventType = 'fest';
          (basePayload as any).eventPaymentType = 'free';
        }
      }
    }

    return basePayload;
  }, [category, subcategory, description, approvalPeriod, recurringFrequency, policyCompliance, amountRequired, amount, points, annexures, isEventNoting, venueFormData, notingEventType, stallConfig, festivalData]);

  const handleSubmit = (asDraft: boolean) => {
    if (!config) return;
    if (!asDraft) {
      // Classification
      if (!subcategory?.trim()) {
        toast({ type: 'error', message: 'Please select a subcategory from the dropdown.' });
        return;
      }
      // Description (strip HTML for empty check — ReactQuill can have <p><br></p>)
      if (!plainTextDescription.trim()) {
        toast({ type: 'error', message: 'Please add a description explaining your request.' });
        return;
      }
      if (overLimit) {
        toast({ type: 'error', message: `Description exceeds the word limit. Please reduce to ${MAX_WORDS} words (currently: ${wordCount} words).` });
        return;
      }
      // Requirements & Points — at least one non-empty point
      const validPoints = dedupePoints(points);
      if (validPoints.length === 0) {
        toast({ type: 'error', message: 'Please add at least one requirement point in the Requirements & Points section.' });
        return;
      }
      // Additional Details
      if (policyCompliance === null || policyCompliance === undefined) {
        toast({ type: 'error', message: 'Please select Policy Compliance: choose "Yes, complies" or "No" in Additional Details.' });
        return;
      }
      if (approvalPeriod === 'recurring' && !recurringFrequency?.trim()) {
        toast({ type: 'error', message: 'Please select a frequency (e.g. Monthly, Weekly) when Approval Period is Recurring.' });
        return;
      }
      if (amountRequired && (amount === '' || Number(amount) < 0 || isNaN(Number(amount)))) {
        toast({ type: 'error', message: 'Please enter a valid amount (₹) when "Amount required" is selected.' });
        return;
      }
      if (amountRequired && Number(amount) > AMOUNT_MAX) {
        toast({ type: 'error', message: 'Amount cannot exceed ₹10,00,000 (10 lakh). Please reduce the amount.' });
        return;
      }
      // Event Details
      if (isEventNoting) {
        if (!notingEventType) {
          toast({ type: 'error', message: 'Please select Event Structure: Venue Event, Stall-Based Event, or Fest.' });
          return;
        }
        if (notingEventType === 'festival') {
          if (!festivalData.festivalName?.trim()) { toast({ type: 'error', message: 'Please enter the Festival Name.' }); return; }
          if (!festivalData.startDate) { toast({ type: 'error', message: 'Please select the Festival Start Date.' }); return; }
          if (!festivalData.endDate) { toast({ type: 'error', message: 'Please select the Festival End Date.' }); return; }
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          if (festivalData.startDate && new Date(festivalData.startDate) < todayStart) {
            toast({ type: 'error', message: 'Festival Start Date cannot be in the past. Please select a future date.' }); return;
          }
          if (festivalData.startDate && festivalData.endDate && new Date(festivalData.endDate) < new Date(festivalData.startDate)) {
            toast({ type: 'error', message: 'Festival End Date should be after Start Date. Please correct the dates.' }); return;
          }
          if (festivalData.subEvents.length === 0) {
            toast({ type: 'error', message: 'Please add at least one sub-event to the festival.' }); return;
          }
          for (let i = 0; i < festivalData.subEvents.length; i++) {
            const se = festivalData.subEvents[i];
            const v = se.venueFormData;
            const label = `Sub-Event #${i + 1}`;
            if (!v.eventName?.trim()) { toast({ type: 'error', message: `${label}: Please enter the Event Name.` }); return; }
            if (!v.eventType) { toast({ type: 'error', message: `${label}: Please select the Event Type.` }); return; }
            if (!v.eventStartDate) { toast({ type: 'error', message: `${label}: Please select the Start Date.` }); return; }
            if (!v.eventEndDate) { toast({ type: 'error', message: `${label}: Please select the End Date.` }); return; }
            const subToday = new Date();
            subToday.setHours(0, 0, 0, 0);
            if (v.eventStartDate && new Date(v.eventStartDate) < subToday) {
              toast({ type: 'error', message: `${label}: Start Date cannot be in the past. Please select a future date.` }); return;
            }
            if (v.eventStartDate && v.eventEndDate && new Date(v.eventEndDate) < new Date(v.eventStartDate)) {
              toast({ type: 'error', message: `${label}: End Date should be after Start Date. Please correct the dates.` }); return;
            }
            if (v.eventHasSponsorship === true) {
              const valid = (v.eventSponsors || []).filter((s) => s?.name?.trim());
              if (valid.length === 0) { toast({ type: 'error', message: `${label}: Please add at least one sponsor with a name when Sponsorship is enabled.` }); return; }
            }
            if (v.eventHasResources === true) {
              const valid = (v.eventResources || []).filter((r) => (r?.type || '').trim() || (r?.description || '').trim());
              if (valid.length === 0) { toast({ type: 'error', message: `${label}: Please add at least one resource when Resources are enabled.` }); return; }
            }
            if (v.eventDutyLeaveAvailable === true && !v.eventDutyLeaveRoleType) {
              toast({ type: 'error', message: `${label}: Please select Duty Leave eligibility when Duty Leave is enabled.` }); return;
            }
            if (se.eventType === 'stall' && se.stallConfig) {
              const sc = se.stallConfig;
              if (sc.enableStudentApplied && (sc.maxStudentStalls == null || sc.maxStudentStalls < 1)) {
                toast({ type: 'error', message: `${label}: Please enter Max Student Stalls (min 1) when Student-Applied Stalls is enabled.` }); return;
              }
              if (sc.enableCreatorMade && (sc.creatorStalls || []).some((cs) => !(cs?.name || '').trim())) {
                toast({ type: 'error', message: `${label}: Each creator-made stall must have a name.` }); return;
              }
            }
            if (!v.eventPaymentType) { toast({ type: 'error', message: `${label}: Please select Payment Type (Free or Paid).` }); return; }
            if (v.eventPaymentType === 'paid') {
              if (v.eventParticipationType === 'individual' && (v.eventRegistrationFeeIndividual === '' || Number(v.eventRegistrationFeeIndividual) < 0)) {
                toast({ type: 'error', message: `${label}: Please enter the Participation Fee (₹) for paid events.` }); return;
              }
              if (v.eventParticipationType === 'team' && (v.eventRegistrationFeeTeam === '' || Number(v.eventRegistrationFeeTeam) < 0)) {
                toast({ type: 'error', message: `${label}: Please enter the Fee per Team (₹) for paid events.` }); return;
              }
            }
          }
        }
        if (notingEventType === 'venue' || notingEventType === 'stall') {
          const v = venueFormData;
          if (!v.eventName?.trim()) { toast({ type: 'error', message: 'Please enter the Event Name.' }); return; }
          if (!v.eventType) { toast({ type: 'error', message: 'Please select the Event Type (e.g. Workshop, Seminar).' }); return; }
          if (!v.eventStartDate) { toast({ type: 'error', message: 'Please select the Event Start Date.' }); return; }
          if (!v.eventEndDate) { toast({ type: 'error', message: 'Please select the Event End Date.' }); return; }
          const evtToday = new Date();
          evtToday.setHours(0, 0, 0, 0);
          if (v.eventStartDate && new Date(v.eventStartDate) < evtToday) {
            toast({ type: 'error', message: 'Event Start Date cannot be in the past. Please select a future date.' }); return;
          }
          if (new Date(v.eventEndDate) < new Date(v.eventStartDate)) { toast({ type: 'error', message: 'Event End Date should be after Start Date. Please correct the dates.' }); return; }
          if (!v.eventPaymentType) { toast({ type: 'error', message: 'Please select Payment Type: Free or Paid.' }); return; }
          if (v.eventPaymentType === 'paid') {
            if (v.eventParticipationType === 'individual' && (v.eventRegistrationFeeIndividual === '' || Number(v.eventRegistrationFeeIndividual) < 0)) {
              toast({ type: 'error', message: 'Please enter the Participation Fee (₹) for paid individual events.' }); return;
            }
            if (v.eventParticipationType === 'team' && (v.eventRegistrationFeeTeam === '' || Number(v.eventRegistrationFeeTeam) < 0)) {
              toast({ type: 'error', message: 'Please enter the Fee per Team (₹) for paid team events.' }); return;
            }
          }
          if (v.eventHasSponsorship === true) {
            const valid = (v.eventSponsors || []).filter((s) => s?.name?.trim());
            if (valid.length === 0) { toast({ type: 'error', message: 'Please add at least one sponsor with a name when Sponsorship is enabled.' }); return; }
          }
          if (v.eventHasResources === true) {
            const valid = (v.eventResources || []).filter((r) => (r?.type || '').trim() || (r?.description || '').trim());
            if (valid.length === 0) { toast({ type: 'error', message: 'Please add at least one resource when Resources are enabled.' }); return; }
          }
          if (v.eventDutyLeaveAvailable === true && !v.eventDutyLeaveRoleType) {
            toast({ type: 'error', message: 'Please select who is eligible for Duty Leave when Duty Leave is enabled.' }); return;
          }
          if (notingEventType === 'stall' && stallConfig) {
            if (stallConfig.enableStudentApplied && (stallConfig.maxStudentStalls == null || stallConfig.maxStudentStalls < 1)) {
              toast({ type: 'error', message: 'Please enter Max Student Stalls (min 1) when Student-Applied Stalls is enabled.' }); return;
            }
            if (stallConfig.enableCreatorMade && (stallConfig.creatorStalls || []).some((cs) => !(cs?.name || '').trim())) {
              toast({ type: 'error', message: 'Each creator-made stall must have a name.' }); return;
            }
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

    if (isEventNoting && (notingEventType === 'venue' || notingEventType === 'stall')) {
      Object.assign(updatePayload, venueFormDataToEventPayload(venueFormData));
    }

    // Stall & festival type fields
    if (isEventNoting && notingEventType) {
      updatePayload.notingEventType = notingEventType;
      if (notingEventType === 'stall') {
        updatePayload.stallConfig = stallConfig;
      }
      if (notingEventType === 'festival') {
        updatePayload.festivalMeta = {
          name: festivalData.festivalName,
          startDate: festivalData.startDate,
          endDate: festivalData.endDate,
          description: festivalData.description,
          coordinator: festivalData.coordinator,
        };
        updatePayload.subEvents = festivalData.subEvents.map((se) => ({
          id: se.id,
          eventType: se.eventType,
          venueFormData: venueFormDataToEventPayload(se.venueFormData),
          stallConfig: se.stallConfig,
        }));
        // Override event fields with festival meta so backend approval flow works
        if (festivalData.festivalName && festivalData.startDate && festivalData.endDate) {
          updatePayload.eventName = festivalData.festivalName;
          updatePayload.eventStartDate = festivalData.startDate;
          updatePayload.eventEndDate = festivalData.endDate;
          updatePayload.eventType = 'fest';
          updatePayload.eventPaymentType = 'free';
        }
      }
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

  const baseValid = Boolean(
    subcategory?.trim() &&
    plainTextDescription.trim() &&
    !overLimit &&
    dedupePoints(points).length > 0 &&
    policyCompliance !== null &&
    (approvalPeriod !== 'recurring' || recurringFrequency?.trim()) &&
    (!amountRequired || (amount !== '' && Number(amount) >= 0 && !isNaN(Number(amount)) && Number(amount) <= AMOUNT_MAX))
  );
  const allSubEventsValid = festivalData.subEvents.length > 0 && festivalData.subEvents.every((se) => {
    const v = se.venueFormData;
    const base = v.eventName?.trim() && v.eventType && v.eventStartDate && v.eventEndDate &&
      new Date(v.eventEndDate) >= new Date(v.eventStartDate) && v.eventPaymentType;
    if (!base) return false;
    if (v.eventPaymentType === 'paid') {
      return v.eventParticipationType === 'individual'
        ? (v.eventRegistrationFeeIndividual !== '' && Number(v.eventRegistrationFeeIndividual) >= 0)
        : (v.eventRegistrationFeeTeam !== '' && Number(v.eventRegistrationFeeTeam) >= 0);
    }
    return true;
  });
  const eventValid = !isEventNoting || (
    notingEventType &&
    (
      (notingEventType === 'festival' && festivalData.festivalName?.trim() && festivalData.startDate && festivalData.endDate &&
        new Date(festivalData.endDate) >= new Date(festivalData.startDate) && allSubEventsValid) ||
      ((notingEventType === 'venue' || notingEventType === 'stall') &&
        venueFormData.eventName?.trim() && venueFormData.eventType && venueFormData.eventStartDate &&
        venueFormData.eventEndDate && new Date(venueFormData.eventEndDate) >= new Date(venueFormData.eventStartDate) &&
        venueFormData.eventPaymentType &&
        (venueFormData.eventPaymentType !== 'paid' ||
          (venueFormData.eventParticipationType === 'individual' ? (venueFormData.eventRegistrationFeeIndividual !== '' && Number(venueFormData.eventRegistrationFeeIndividual) >= 0) :
            (venueFormData.eventRegistrationFeeTeam !== '' && Number(venueFormData.eventRegistrationFeeTeam) >= 0))))
    )
  );
  const canSubmit = baseValid && eventValid;

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
                <SectionLabel>Description <span className="text-red-500">*</span></SectionLabel>
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
                <SectionLabel>Requirements & Points <span className="text-red-500">*</span></SectionLabel>
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
                  <p className="text-xs text-gray-400 mb-3">PDF, Word, Excel, Images, ZIP • Max 5MB per file</p>
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
                  <SectionLabel>Event Details <span className="text-red-500">*</span></SectionLabel>

                  {/* ── EventTypeSelector GATE ── */}
                  <EventTypeSelector
                    value={notingEventType}
                    onChange={(t) => {
                      setNotingEventType(t);
                      if (t !== 'stall') setStallConfig({ ...defaultStallConfig });
                      if (t !== 'festival') {
                        setFestivalData({ ...defaultFestivalForm });
                      } else {
                        setFestivalData({
                          ...defaultFestivalForm,
                          coordinator: creatorInfo?.employeeIdOrStudentId || creatorInfo?.name || '',
                        });
                      }
                      if (t !== 'venue' && t !== 'stall') setVenueFormData({ ...defaultVenueForm });
                    }}
                    disabled={isEditingExistingDraft}
                  />

                  {/* Festival form — replaces normal event fields */}
                  {notingEventType === 'festival' && (
                    <FestivalForm
                      data={festivalData}
                      onChange={setFestivalData}
                      disabled={isEditingExistingDraft}
                      coordinatorReadOnly={true}
                    />
                  )}

                  {/* Venue / Stall — shared EventFormFields (venue form UI everywhere) */}
                  {(notingEventType === 'venue' || notingEventType === 'stall') && (
                    <>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Event name, type, dates, and payment type will be <strong>locked</strong> after approval and cannot be changed.
                      </p>
                      <div className="space-y-4">
                        <EventFormFields
                          data={venueFormData}
                          onChange={setVenueFormData}
                          disabled={isEditingExistingDraft}
                          showCapacityFixed={true}
                          fieldsetPrefix="venue"
                        />
                      </div>
                      {notingEventType === 'stall' && (
                        <div className="mt-4">
                          <StallConfigSection
                            config={stallConfig}
                            onChange={setStallConfig}
                            disabled={isEditingExistingDraft}
                          />
                        </div>
                      )}
                    </>
                  )}
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Approval Period <span className="text-red-500">*</span></label>
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Policy Compliance <span className="text-red-500">*</span></label>
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
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">Budget / Amount <span className="text-red-500">*</span></label>
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
                              max={AMOUNT_MAX}
                              step={1}
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                              placeholder="Max ₹10 lakh"
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
                  disabled={submitting || !canSubmit}
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

    </>
  );
}
