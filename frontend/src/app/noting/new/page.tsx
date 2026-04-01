'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Plus, Trash2, Upload, FileText, GripVertical, Clock, CheckCircle, XCircle, User, Send, Save, Paperclip, AlertCircle, List, Calendar, RotateCcw, ArrowRight, ThumbsUp, ThumbsDown, CornerDownLeft, Copy } from 'lucide-react';
import { notingService } from '@/features/noting-management/services/noting.service';
import type { NotingPermissions } from '@/features/noting-management/services/noting.service';
import type { NoteConfig, CreatorInfo, CreateNotePayload, NoteHistoryEntry } from '@/features/noting-management/types/noting.types';
import { useNotingPermissions, useNotingConfig, useCreatorInfo, useFacilitatorClubs } from '@/features/noting-management/hooks/useNoting';
import {
  EventTypeSelector,
  defaultStallConfig,
  defaultFestivalForm,
  defaultVenueForm,
} from '@/features/noting-management/components';
import type { NotingEventType, StallConfig, FestivalFormData, VenueFormData } from '@/features/noting-management/components';
import { defaultEventVisibilityForm } from '@/features/event-management/components/EventSettingsForm';
import type { EventVisibilityFormData } from '@/features/event-management/components/EventSettingsForm';

// Dynamic imports for MUI-heavy form components (~90 KB DateTimePicker bundle)
const FestivalForm = dynamic(
  () => import('@/features/noting-management/components/FestivalForm').then(mod => ({ default: mod.FestivalForm })),
  { ssr: false },
);
const StallConfigSection = dynamic(
  () => import('@/features/noting-management/components/StallConfigSection').then(mod => ({ default: mod.StallConfigSection })),
  { ssr: false },
);
const EventFormFields = dynamic(
  () => import('@/features/noting-management/components/EventFormFields').then(mod => ({ default: mod.EventFormFields })),
  { ssr: false },
);
const EventSettingsForm = dynamic(
  () => import('@/features/event-management/components/EventSettingsForm').then(mod => ({ default: mod.EventSettingsForm })),
  { ssr: false },
);
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { useNotingDraftStore } from '@/features/noting-management/stores/notingDraftStore';
import { useAuthStore } from '@/shared/auth/authStore';
import {
  reportingStructureService,
  type ReportingDepartmentOption,
} from '@/shared/services/reportingStructure.service';
import {
  sanitizeAnnexures,
  sanitizeEventVisibilitySettings,
  sanitizeFestivalFormData,
  sanitizeNoteDescription,
  sanitizeNotePoints,
  sanitizeStallConfig,
  sanitizeVenueFormData,
  validateBaseNoteSubmission,
  validateFestivalSubmission,
  validateVenueEventSubmission,
} from '@/features/noting-management/validation/noting.validation';
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
const DEBOUNCE_AUTOSAVE_MS = 5000;

/** Build event payload from shared VenueFormData (used for venue & stall) */
function venueFormDataToEventPayload(v: VenueFormData): Record<string, unknown> {
  const sanitizedVenue = sanitizeVenueFormData(v);
  if (!sanitizedVenue.eventName?.trim() || !sanitizedVenue.eventType || !sanitizedVenue.eventStartDate || !sanitizedVenue.eventEndDate || !sanitizedVenue.eventPaymentType) return {};
  const payload: Record<string, unknown> = {
    eventName: sanitizedVenue.eventName.trim(),
    eventType: sanitizedVenue.eventType,
    eventStartDate: sanitizedVenue.eventStartDate,
    eventEndDate: sanitizedVenue.eventEndDate,
    eventPaymentType: sanitizedVenue.eventPaymentType,
    eventParticipationType: sanitizedVenue.eventParticipationType,
    eventApproxCapacity: sanitizedVenue.eventApproxCapacity !== '' ? Number(sanitizedVenue.eventApproxCapacity) : null,
    eventDutyLeaveAvailable: sanitizedVenue.eventDutyLeaveAvailable,
    eventDutyLeaveEligibility: sanitizedVenue.eventDutyLeaveAvailable && sanitizedVenue.eventDutyLeaveEligibility.length > 0 ? sanitizedVenue.eventDutyLeaveEligibility : null,
    eventDutyLeaveRoleType: sanitizedVenue.eventDutyLeaveAvailable ? sanitizedVenue.eventDutyLeaveRoleType : null,
    eventHasSponsorship: sanitizedVenue.eventHasSponsorship,
    eventSponsors: sanitizedVenue.eventHasSponsorship ? sanitizedVenue.eventSponsors.map((s) => ({
      ...s,
      id: s.id || crypto.randomUUID(),
      originSource: 'noting' as const,
      cashAmount: s.cashAmount === '' ? 0 : Number(s.cashAmount),
      inKindItems: (s.inKindItems || []).map((item) => ({
        ...item,
        quantity: item.quantity === '' ? 0 : Number(item.quantity),
        estimatedValue: item.estimatedValue === '' ? 0 : Number(item.estimatedValue),
      })),
    })) : null,
    eventHasResources: sanitizedVenue.eventHasResources,
    eventResources: sanitizedVenue.eventHasResources ? sanitizedVenue.eventResources.map((r) => ({
      type: r.type,
      description: r.description,
      pricePerPiece: r.pricePerPiece !== '' && r.pricePerPiece != null ? Number(r.pricePerPiece) : null,
      quantity: r.quantity !== '' && r.quantity != null ? Number(r.quantity) : null,
    })) : null,
    eventCertification: sanitizedVenue.eventCertification,
    eventCapacityFixed: sanitizedVenue.eventCapacityFixed !== '' && sanitizedVenue.eventCapacityFixed != null ? Number(sanitizedVenue.eventCapacityFixed) : null,
    eventPrizesAwards: (sanitizedVenue.eventHasPrizes && sanitizedVenue.eventPrizesAwards.length > 0) ? sanitizedVenue.eventPrizesAwards.map((p, idx) => ({
      position: p.position === '' ? idx + 1 : Number(p.position),
      rank: p.rank,
      title: p.title,
      prizeType: p.prizeType,
      prizeAmount: p.prizeAmount === '' ? undefined : Number(p.prizeAmount),
      additionalPerks: p.additionalPerks ? p.additionalPerks.split(',').map((x) => x.trim()).filter(Boolean) : null,
      sortOrder: idx,
    })) : null,
  };
  if (sanitizedVenue.eventPaymentType === 'paid') {
    payload.eventRegistrationFeeIndividual = sanitizedVenue.eventParticipationType === 'individual' && sanitizedVenue.eventRegistrationFeeIndividual !== '' ? Number(sanitizedVenue.eventRegistrationFeeIndividual) : null;
    payload.eventRegistrationFeeTeam = sanitizedVenue.eventParticipationType === 'team' && sanitizedVenue.eventRegistrationFeeTeam !== '' ? Number(sanitizedVenue.eventRegistrationFeeTeam) : null;
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
    eventSponsors: sponsors.map((s: any) => ({
      name: s.name || '',
      sponsorType: s.sponsorType || 'corporate',
      contactPerson: s.contactPerson || '',
      designation: s.designation || '',
      phone: s.phone || '',
      email: s.email || '',
      notes: s.notes || '',
      contributionType: s.contributionType || (s.type === 'in_kind' ? 'in_kind' : 'cash'),
      cashAmount: s.cashAmount ?? (s.amount ?? ''),
      paymentStatus: s.paymentStatus || 'pending',
      paymentMethod: s.paymentMethod || '',
      paymentMethodOtherLabel: s.paymentMethodOtherLabel || '',
      transactionId: s.transactionId || '',
      receipt: s.receipt || null,
      sponsorLogo: s.sponsorLogo || null,
      cashAssignedTo: s.cashAssignedTo || null,
      // Preserve identity & origin for locking
      id: s.id || undefined,
      originSource: s.originSource || undefined,
      inKindItems: Array.isArray(s.inKindItems) ? s.inKindItems.map((item: any) => ({
        itemName: item.itemName || '',
        category: item.category || '',
        quantity: item.quantity ?? '',
        estimatedValue: item.estimatedValue ?? '',
        description: item.description || '',
        assignedTo: item.assignedTo || null,
        deliveryStatus: item.deliveryStatus || 'pending',
      })) : [],
    })),
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
    departmentId: s.departmentId,
    departmentScope: s.departmentScope,
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

  // ── Student access check — noting is blocked for ALL students ─────────────
  const isStudentUser = user && (user.role?.name === 'student' || user.userType === 'student');
  const { data: notingPerms = null, isLoading: notingPermsLoading } = useNotingPermissions();
  useEffect(() => {
    if (isStudentUser) {
      toast({ type: 'error', message: 'Students are not allowed to access the noting system' });
      router.push('/dashboard');
    }
  }, [isStudentUser, router, toast]);

  useEffect(() => {
    if (!user || isStudentUser || notingPermsLoading || !notingPerms) return;
    if (!notingPerms.noting_create) {
      toast({ type: 'error', message: 'You do not have permission to create notings' });
      router.push('/noting');
    }
  }, [isStudentUser, notingPerms, notingPermsLoading, router, toast, user]);

  const [config, setConfig] = useState<NoteConfig | null>(null);
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);
  const [departmentOptions, setDepartmentOptions] = useState<ReportingDepartmentOption[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [notingIdPreview, setNotingIdPreview] = useState<string>('');
  const [notingYearAndSequence, setNotingYearAndSequence] = useState<{ year: string; sequence: string } | null>(null);

  // PERF FIX: Use TanStack Query hooks for config and creator info instead of
  // raw notingService calls. Config has 24h staleTime, creatorInfo has 10min.
  // Navigating to /noting/new no longer fires 2 network requests that could be free.
  const { data: cachedConfig, isLoading: configLoading } = useNotingConfig();
  const { data: cachedCreatorInfo, isLoading: creatorInfoLoading } = useCreatorInfo();
  const loading = configLoading || creatorInfoLoading;

  // Sync TanStack Query data into local state (used by form logic downstream)
  useEffect(() => {
    if (cachedConfig && !config) {
      setConfig(cachedConfig);
      if (!getInitialFromStore().subcategory && cachedConfig.categories[0]?.subcategories?.[0]?.value) {
        setSubcategory(cachedConfig.categories[0].subcategories[0].value);
      }
    }
  }, [cachedConfig, config]);
  useEffect(() => {
    if (cachedCreatorInfo && !creatorInfo) setCreatorInfo(cachedCreatorInfo);
  }, [cachedCreatorInfo, creatorInfo]);

  useEffect(() => {
    let mounted = true;

    const loadDepartmentOptions = async () => {
      try {
        setDepartmentsLoading(true);
        const response = await reportingStructureService.getDepartmentOptions({
          withHierarchyOnly: true,
        });
        if (!mounted) return;
        setDepartmentOptions(response.data || []);
      } catch {
        if (!mounted) return;
        setDepartmentOptions([]);
      } finally {
        if (mounted) setDepartmentsLoading(false);
      }
    };

    loadDepartmentOptions();

    return () => {
      mounted = false;
    };
  }, []);

  const [actionInProgress, setActionInProgress] = useState<'submit' | 'draft' | 'discard' | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [isRevertedNote, setIsRevertedNote] = useState(false);
  const [revertHistory, setRevertHistory] = useState<NoteHistoryEntry[]>([]);
  // Derived from URL — no useState needed; updates instantly when Next.js redirects
  const isEditingExistingDraft = !!draftIdFromUrl;

  // Initialize with empty values for new notes, or from store if editing a draft
  const initial = draftIdFromUrl ? getInitialFromStore() : {
    category: 'academic' as 'academic' | 'administrative',
    subcategory: '',
    departmentId: '',
    departmentScope: '' as '' | 'school' | 'central',
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
  const [departmentId, setDepartmentId] = useState(initial.departmentId);
  const [departmentScope, setDepartmentScope] = useState<'' | 'school' | 'central'>(initial.departmentScope);

  const isChairperson = notingPerms?.isClubChairperson === true;
  const effectiveCategory = isChairperson ? 'academic' : category;
  const effectiveSubcategory = isChairperson ? 'events' : subcategory;
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

  // Optional club association for event notings
  const [eventClubId, setEventClubId] = useState<string | null>(null);
  // Event visibility/settings for noting form
  const [eventVisibilitySettings, setEventVisibilitySettings] = useState<EventVisibilityFormData>({ ...defaultEventVisibilityForm });
  const { data: facilitatorClubs = [], isLoading: facilitatorClubsLoading } = useFacilitatorClubs({
    enabled: isEventNoting && !isStudentUser,
  });

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

  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // Config + Creator info now fetched via TanStack Query hooks above (useNotingConfig, useCreatorInfo)
  // No raw useEffect needed — the hooks handle caching, loading state, and error handling.

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
      if (note.status === 'reverted' && note.history) {
        setRevertHistory(note.history);
      }

      hydrateFromNote({
        category: note.category,
        subcategory: note.subcategory,
        departmentId: (note as any).departmentId,
        departmentScope: (note as any).departmentScope,
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
      setDepartmentId(s.departmentId);
      setDepartmentScope(s.departmentScope);
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
      // Restore club association
      if ((note as any).eventClubId) setEventClubId((note as any).eventClubId);
      // Restore event visibility/settings
      if ((note as any).eventVisibilitySettings) {
        setEventVisibilitySettings({ ...defaultEventVisibilityForm, ...(note as any).eventVisibilitySettings });
      }
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
          // Only the creator can edit a reverted note
          if (note.status === 'reverted' && note.createdById !== user?.id) {
            toast({ type: 'error', message: 'Only the creator can edit a reverted note' });
            router.push(`/noting/${note.id}`);
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

    // No ?draft= param — check if autosave already created a backend draft during
    // a previous in-progress session. If so, redirect to it so data is restored.
    const existingDraftId = useNotingDraftStore.getState().draftId;
    if (existingDraftId) {
      router.replace(`/noting/new?draft=${encodeURIComponent(existingDraftId)}`);
      return; // init effect will re-run with the new draftIdFromUrl
    }

    // Genuinely new note — clear any stale local-storage state and start fresh
    clearDraft();
    setCategory('academic');
    setSubcategory(config.categories[0]?.subcategories?.[0]?.value ?? '');
    setDepartmentId('');
    setDepartmentScope('');
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
    setRevertHistory([]);
    setNotingIdPreview('');
    setNotingYearAndSequence(null);
    setDraftLoaded(true);
  }, [config, draftLoaded, draftIdFromUrl, hydrateFromNote, setDraftId, toast, clearDraft, router, user?.id]);

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
      notingService.previewNotingId(effectiveCategory, effectiveSubcategory).then((r) => {
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
  }, [effectiveCategory, effectiveSubcategory, draftIdFromUrl, notingIdPreview, notingYearAndSequence]);

  // NOTE: subcategory is cleared only on explicit user-driven category changes
  // (inline in the radio onChange handlers below). The old useEffect approach
  // also fired when loadDraftIntoForm() programmatically set category, which
  // erased the subcategory that was just restored from the draft.

  useEffect(() => {
    if (!effectiveSubcategory || !config) {
      setIsEventNoting(false);
      return;
    }
    const eventKeywords = ['event', 'workshop', 'seminar', 'conference', 'function', 'celebration'];
    const isEvent = eventKeywords.some(keyword => effectiveSubcategory.toLowerCase().includes(keyword));
    setIsEventNoting(isEvent);

    if (!isEvent) {
      setVenueFormData(defaultVenueForm);
    }
  }, [effectiveSubcategory, config]);

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
        category: effectiveCategory,
        subcategory: effectiveSubcategory,
        departmentId,
        departmentScope,
        description: sanitizeNoteDescription(description),
        approvalPeriod,
        recurringFrequency,
        policyCompliance,
        amountRequired,
        amount,
        points: sanitizeNotePoints(points),
        attachments: sanitizeAnnexures(annexures).filter((a) => a.filePath && !a.uploading).map((a) => ({
          filePath: a.filePath,
          fileName: a.fileName.trim() || a.filePath,
          fileDescription: a.fileDescription?.trim() || undefined,
        })),
      });
      syncTimeoutRef.current = null;
    }, DEBOUNCE_SYNC_MS);
    return () => { syncTimeoutRef.current && clearTimeout(syncTimeoutRef.current); };
  }, [
    draftLoaded, effectiveCategory, effectiveSubcategory, departmentId, departmentScope, description, approvalPeriod,
    recurringFrequency, policyCompliance, amountRequired, amount,
    points, annexures, setForm,
  ]);

  useEffect(() => {
    if (!draftLoaded || !config) return;
    const hasMinimum = effectiveCategory && effectiveSubcategory;
    if (!hasMinimum) return;

    // Prevent multiple autosaves from running simultaneously
    if (isAutosavingRef.current) return;

    autosaveTimeoutRef.current && clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => {
      // Double check to prevent race condition
      if (isAutosavingRef.current) return;

      const payload = {
        category: effectiveCategory,
        subcategory: effectiveSubcategory,
        departmentId: departmentId || null,
        departmentScope: departmentScope || null,
        description: sanitizeNoteDescription(description).trim(),
        approvalPeriod,
        recurringFrequency: (approvalPeriod === 'recurring' && recurringFrequency ? recurringFrequency : undefined) as CreateNotePayload['recurringFrequency'],
        policyCompliance: policyCompliance ?? undefined,
        amountRequired,
        amount: amountRequired && amount ? Number(amount) : undefined,
        points: dedupePoints(sanitizeNotePoints(points)),
        attachments: sanitizeAnnexures(annexures)
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
          eventPayload.stallConfig = sanitizeStallConfig(stallConfig);
        }
        if (false && notingEventType === 'festival') {
          const sanitizedFestivalData = sanitizeFestivalFormData(festivalData);
          eventPayload.festivalMeta = {
            name: sanitizedFestivalData.festivalName,
            startDate: sanitizedFestivalData.startDate,
            endDate: sanitizedFestivalData.endDate,
            description: sanitizedFestivalData.description,
            coordinator: sanitizedFestivalData.coordinator,
          };
          eventPayload.subEvents = sanitizedFestivalData.subEvents.map((se) => ({
            id: se.id,
            eventType: se.eventType,
            venueFormData: venueFormDataToEventPayload(se.venueFormData),
            stallConfig: se.stallConfig,
          }));
          // Override event fields with festival meta so backend approval flow works
          if (sanitizedFestivalData.festivalName && sanitizedFestivalData.startDate && sanitizedFestivalData.endDate) {
            eventPayload.eventName = sanitizedFestivalData.festivalName;
            eventPayload.eventStartDate = sanitizedFestivalData.startDate;
            eventPayload.eventEndDate = sanitizedFestivalData.endDate;
            eventPayload.eventType = 'fest';
            eventPayload.eventPaymentType = 'free';
          }
        }
        // Add event visibility settings if configured
        if (eventVisibilitySettings?.visibleToRoles && eventVisibilitySettings.visibleToRoles.length > 0) {
          eventPayload.eventVisibilitySettings = sanitizeEventVisibilitySettings(eventVisibilitySettings);
        }
      }

      // PERF: Compare JSON snapshot to skip no-op autosaves.
      // This prevents re-firing when object references change but values haven't.
      const snapshot = JSON.stringify({ ...payload, ...eventPayload });
      if (snapshot === lastSavedSnapshotRef.current) return;
      lastSavedSnapshotRef.current = snapshot;

      if (draftId) {
        const updatePayload: any = {
          category: effectiveCategory,
          subcategory: effectiveSubcategory,
          departmentId: payload.departmentId,
          departmentScope: payload.departmentScope,
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
    draftLoaded, config, draftId, effectiveCategory, effectiveSubcategory, departmentId, departmentScope, description,
    approvalPeriod, recurringFrequency, policyCompliance, amountRequired,
    amount, points, annexures, isEventNoting, venueFormData, notingEventType, stallConfig, festivalData, eventVisibilitySettings, setDraftId,
  ]);

  // Strip HTML tags and count words for the rich text editor
  const getPlainTextFromHtml = (html: string) => {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  };

  const plainTextDescription = typeof window !== 'undefined'
    ? getPlainTextFromHtml(sanitizeNoteDescription(description))
    : sanitizeNoteDescription(description).replace(/<[^>]*>/g, '');
  const wordCount = plainTextDescription.trim() ? plainTextDescription.trim().split(/\s+/).length : 0;
  const overLimit = wordCount > MAX_WORDS;

  const addPoint = () => { setPoints((p) => [...p, '']); clearFieldError('points'); };
  const removePoint = (i: number) => { setPoints((p) => p.filter((_, idx) => idx !== i)); clearFieldError('points'); };
  const updatePoint = (i: number, v: string) => {
    setPoints((p) => {
      const n = [...p];
      n[i] = sanitizeNotePoints([v])[0] || '';
      return n;
    });
    clearFieldError('points');
  };

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
    clearFieldError('points');
  };

  // ── Sponsor receipt upload helper ──
  const handleSponsorReceiptUpload = useCallback(async (file: File): Promise<{ filePath: string; fileName: string } | null> => {
    try {
      const filePath = await notingService.uploadAttachment(file);
      return { filePath, fileName: file.name };
    } catch {
      toast({ type: 'error', message: `Failed to upload receipt: ${file.name}` });
      return null;
    }
  }, [toast]);

  const handleSponsorLogoUpload = useCallback(async (file: File): Promise<{ filePath: string; fileName: string } | null> => {
    const isAllowedType = ['image/jpeg', 'image/png'].includes(file.type);
    const isAllowedName = /\.(jpe?g|png)$/i.test(file.name);

    if (!isAllowedType && !isAllowedName) {
      toast({ type: 'error', message: 'Only JPG and PNG sponsor logos are allowed.' });
      return null;
    }

    try {
      const filePath = await notingService.uploadAttachment(file);
      return { filePath, fileName: file.name };
    } catch {
      toast({ type: 'error', message: `Failed to upload logo: ${file.name}` });
      return null;
    }
  }, [toast]);

  // ── Sponsor assignment search helper ──
  const handleSponsorSearchEmployees = useCallback(async (query: string) => {
    const results = await notingService.searchEmployees(query);
    return results.map(u => ({ id: u.id, uid: u.uid, displayName: u.displayName, department: u.department }));
  }, []);

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
      n[index] = sanitizeAnnexures([{ ...n[index], ...updates }])[0];
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
    const sanitizedDescription = sanitizeNoteDescription(description);
    const sanitizedPoints = dedupePoints(sanitizeNotePoints(points));
    const sanitizedAnnexures = sanitizeAnnexures(annexures);
    const sanitizedVenueFormData = sanitizeVenueFormData(venueFormData);
    const sanitizedFestivalData = sanitizeFestivalFormData(festivalData);
    const sanitizedVisibilitySettings = sanitizeEventVisibilitySettings(
      eventVisibilitySettings,
    );
    const basePayload: CreateNotePayload = {
      category: effectiveCategory,
      subcategory: effectiveSubcategory,
      departmentId: departmentId || null,
      departmentScope: departmentScope || null,
      description: sanitizedDescription.trim(),
      approvalPeriod,
      recurringFrequency: (approvalPeriod === 'recurring' && recurringFrequency ? recurringFrequency : undefined) as CreateNotePayload['recurringFrequency'],
      policyCompliance: policyCompliance ?? undefined,
      amountRequired,
      amount: amountRequired && amount ? Number(amount) : undefined,
      points: sanitizedPoints,
      attachments: sanitizedAnnexures
        .filter((a) => a.filePath && !a.uploading)
        .map((a) => ({ filePath: a.filePath, fileName: a.fileName.trim() || a.filePath, fileDescription: a.fileDescription?.trim() || undefined })),
      submit: false,
    };

    if (isEventNoting && (notingEventType === 'venue' || notingEventType === 'stall')) {
      Object.assign(basePayload, venueFormDataToEventPayload(sanitizedVenueFormData));
    }
    if (isEventNoting) {
      // Stall & Festival type
      (basePayload as any).notingEventType = notingEventType || 'venue';
      if (notingEventType === 'stall') {
        (basePayload as any).stallConfig = sanitizeStallConfig(stallConfig);
      }
      // Optional club association
      if (eventClubId) {
        basePayload.eventClubId = eventClubId;
      }
      // Event visibility/settings
      (basePayload as any).eventVisibilitySettings = sanitizedVisibilitySettings;
      if (notingEventType === 'festival') {
        (basePayload as any).festivalMeta = {
          name: sanitizedFestivalData.festivalName,
          startDate: sanitizedFestivalData.startDate,
          endDate: sanitizedFestivalData.endDate,
          description: sanitizedFestivalData.description,
          coordinator: sanitizedFestivalData.coordinator,
        };
        (basePayload as any).subEvents = sanitizedFestivalData.subEvents.map((se) => ({
          id: se.id,
          eventType: se.eventType,
          venueFormData: venueFormDataToEventPayload(se.venueFormData),
          stallConfig: se.stallConfig,
        }));
        // For festival, use festival meta as the "event" fields (so approval flow works)
        if (sanitizedFestivalData.festivalName && sanitizedFestivalData.startDate && sanitizedFestivalData.endDate) {
          (basePayload as any).eventName = sanitizedFestivalData.festivalName;
          (basePayload as any).eventStartDate = sanitizedFestivalData.startDate;
          (basePayload as any).eventEndDate = sanitizedFestivalData.endDate;
          (basePayload as any).eventType = 'fest';
          (basePayload as any).eventPaymentType = 'free';
        }
      }
    }

    return basePayload;
  }, [effectiveCategory, effectiveSubcategory, departmentId, departmentScope, description, approvalPeriod, recurringFrequency, policyCompliance, amountRequired, amount, points, annexures, isEventNoting, venueFormData, notingEventType, stallConfig, festivalData, eventClubId, eventVisibilitySettings]);

  const scrollToSection = (id: string) => {
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleSubmit = (asDraft: boolean) => {
    if (!config || actionInProgress) return;
    if (!asDraft) {
      // Collect all base-field validation errors at once
      const baseValidation = validateBaseNoteSubmission({
        subcategory: effectiveSubcategory,
        departmentId,
        departmentScope,
        description,
        approvalPeriod,
        recurringFrequency,
        policyCompliance,
        amountRequired,
        amount,
        points,
      });
      const errors: Record<string, string> = { ...baseValidation.fieldErrors };
      if (false) {
      if (!subcategory?.trim()) {
        errors.subcategory = 'Please select a subcategory.';
      }
      if (!plainTextDescription.trim()) {
        errors.description = 'Please add a description explaining your request.';
      } else if (overLimit) {
        errors.description = `Description exceeds the word limit (${wordCount}/${MAX_WORDS} words).`;
      }
      const validPoints = dedupePoints(points);
      if (validPoints.length === 0) {
        errors.points = 'Please add at least one requirement point.';
      }
      if (policyCompliance === null || policyCompliance === undefined) {
        errors.policyCompliance = 'Please select Policy Compliance.';
      }
      if (approvalPeriod === 'recurring' && !recurringFrequency?.trim()) {
        errors.recurringFrequency = 'Please select a frequency for recurring approval.';
      }
      if (amountRequired && (amount === '' || Number(amount) < 0 || isNaN(Number(amount)))) {
        errors.amount = 'Please enter a valid amount (₹).';
      } else if (amountRequired && Number(amount) <= 1) {
        errors.amount = 'Amount must be greater than ₹1.';
      } else if (amountRequired && Number(amount) > AMOUNT_MAX) {
        errors.amount = 'Amount cannot exceed ₹10,00,000 (10 lakh).';
      }

      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        toast({ type: 'error', message: 'Please fill all required fields.' });
        const firstErrorField = Object.keys(errors)[0];
        setTimeout(() => {
          document.getElementById(`field-${firstErrorField}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        return;
      }
      setFieldErrors({});

      // Event Details
      if (isEventNoting) {
        if (!notingEventType) {
          toast({ type: 'error', message: 'Please select Event Structure: Venue Event, Stall-Based Event, or Fest.' });
          scrollToSection('section-event-details'); return;
        }
        if (notingEventType === 'festival') {
          const festivalValidation = validateFestivalSubmission(
            festivalData,
            eventVisibilitySettings,
          );
          if (festivalValidation.message) {
            toast({ type: 'error', message: festivalValidation.message });
            scrollToSection(festivalValidation.sectionId || 'section-event-details');
            return;
          }
        }
        if (false && (notingEventType === 'venue' || notingEventType === 'stall')) {
          const venueValidation = validateVenueEventSubmission(
            venueFormData,
            eventVisibilitySettings,
            notingEventType === 'stall' ? stallConfig : undefined,
          );
          if (venueValidation.message) {
            toast({ type: 'error', message: venueValidation.message || 'Please review the venue details.' });
            scrollToSection(venueValidation.sectionId || 'section-event-details');
            return;
          }
        }
        if (notingEventType === 'festival') {
          if (!festivalData.festivalName?.trim()) { toast({ type: 'error', message: 'Please enter the Festival Name.' }); scrollToSection('section-event-details'); return; }
          if (!festivalData.startDate) { toast({ type: 'error', message: 'Please select the Festival Start Date.' }); scrollToSection('section-event-details'); return; }
          if (!festivalData.endDate) { toast({ type: 'error', message: 'Please select the Festival End Date.' }); scrollToSection('section-event-details'); return; }
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          if (festivalData.startDate && new Date(festivalData.startDate) < todayStart) {
            toast({ type: 'error', message: 'Festival Start Date cannot be in the past. Please select a future date.' }); scrollToSection('section-event-details'); return;
          }
          if (festivalData.startDate && festivalData.endDate && new Date(festivalData.endDate) < new Date(festivalData.startDate)) {
            toast({ type: 'error', message: 'Festival End Date should be after Start Date. Please correct the dates.' }); scrollToSection('section-event-details'); return;
          }
          if (festivalData.subEvents.length === 0) {
            toast({ type: 'error', message: 'Please add at least one sub-event to the festival.' }); scrollToSection('section-event-details'); return;
          }
          for (let i = 0; i < festivalData.subEvents.length; i++) {
            const se = festivalData.subEvents[i];
            const v = se.venueFormData;
            const label = `Sub-Event #${i + 1}`;
            if (!v.eventName?.trim()) { toast({ type: 'error', message: `${label}: Please enter the Event Name.` }); scrollToSection('section-event-details'); return; }
            if (!v.eventType) { toast({ type: 'error', message: `${label}: Please select the Event Type.` }); scrollToSection('section-event-details'); return; }
            if (!v.eventStartDate) { toast({ type: 'error', message: `${label}: Please select the Start Date.` }); scrollToSection('section-event-details'); return; }
            if (!v.eventEndDate) { toast({ type: 'error', message: `${label}: Please select the End Date.` }); scrollToSection('section-event-details'); return; }
            const subToday = new Date();
            subToday.setHours(0, 0, 0, 0);
            if (v.eventStartDate && new Date(v.eventStartDate) < subToday) {
              toast({ type: 'error', message: `${label}: Start Date cannot be in the past. Please select a future date.` }); scrollToSection('section-event-details'); return;
            }
            if (v.eventStartDate && v.eventEndDate && new Date(v.eventEndDate) < new Date(v.eventStartDate)) {
              toast({ type: 'error', message: `${label}: End Date should be after Start Date. Please correct the dates.` }); scrollToSection('section-event-details'); return;
            }
            if (v.eventApproxCapacity === '' || v.eventApproxCapacity === undefined) { toast({ type: 'error', message: `${label}: Please enter the Approximate Capacity.` }); scrollToSection('section-event-details'); return; }
            if (v.eventDutyLeaveAvailable === null) {
              toast({ type: 'error', message: `${label}: Please select Yes or No for Duty Leave Required.` }); scrollToSection('section-event-details'); return;
            }
            if (v.eventDutyLeaveAvailable === true && !v.eventDutyLeaveRoleType) {
              toast({ type: 'error', message: `${label}: Please select Duty Leave eligibility when Duty Leave is enabled.` }); scrollToSection('section-event-details'); return;
            }
            if (v.eventHasSponsorship === null) {
              toast({ type: 'error', message: `${label}: Please select Yes or No for Sponsorship Available.` }); scrollToSection('section-event-details'); return;
            }
            if (v.eventHasSponsorship === true) {
              const valid = (v.eventSponsors || []).filter((s) => s?.name?.trim());
              if (valid.length === 0) { toast({ type: 'error', message: `${label}: Please add at least one sponsor with a name when Sponsorship is enabled.` }); scrollToSection('section-event-details'); return; }
              // Validate all required sponsor information
              const allSponsors = (v.eventSponsors || []).filter((s) => s?.name?.trim());
              for (const sponsor of allSponsors) {
                if (!sponsor.sponsorType) {
                  toast({ type: 'error', message: `${label}: Sponsor "${sponsor.name}" - Sponsor Type is required.` }); scrollToSection('section-event-details'); return;
                }
                if (!sponsor.contactPerson?.trim()) {
                  toast({ type: 'error', message: `${label}: Sponsor "${sponsor.name}" - Contact Person is required.` }); scrollToSection('section-event-details'); return;
                }
                if (!sponsor.designation?.trim()) {
                  toast({ type: 'error', message: `${label}: Sponsor "${sponsor.name}" - Designation is required.` }); scrollToSection('section-event-details'); return;
                }
                if (!sponsor.phone?.trim()) {
                  toast({ type: 'error', message: `${label}: Sponsor "${sponsor.name}" - Phone number is required.` }); scrollToSection('section-event-details'); return;
                }
                if (!sponsor.email?.trim()) {
                  toast({ type: 'error', message: `${label}: Sponsor "${sponsor.name}" - Email is required.` }); scrollToSection('section-event-details'); return;
                }
                const emailRegex = /^\S+@\S+\.\S+$/;
                if (!emailRegex.test(sponsor.email)) {
                  toast({ type: 'error', message: `${label}: Sponsor "${sponsor.name}" - Please enter a valid email address.` }); scrollToSection('section-event-details'); return;
                }
                if (!sponsor.sponsorLogo?.filePath) {
                  toast({ type: 'error', message: `${label}: Sponsor "${sponsor.name}" - Logo is required. Please upload a JPG or PNG file.` }); scrollToSection('section-event-details'); return;
                }
              }
            }
            if (v.eventHasResources === null) {
              toast({ type: 'error', message: `${label}: Please select Yes or No for Event Resources.` }); scrollToSection('section-event-details'); return;
            }
            if (v.eventHasResources === true) {
              const valid = (v.eventResources || []).filter((r) => (r?.type || '').trim() || (r?.description || '').trim());
              if (valid.length === 0) { toast({ type: 'error', message: `${label}: Please add at least one resource when Resources are enabled.` }); scrollToSection('section-event-details'); return; }
            }
            if (v.eventCertification === null) {
              toast({ type: 'error', message: `${label}: Please select Yes or No for Certificates.` }); scrollToSection('section-event-details'); return;
            }
            if (v.eventHasPrizes === null) {
              toast({ type: 'error', message: `${label}: Please select Yes or No for Prizes & Winners.` }); scrollToSection('section-event-details'); return;
            }
            if (v.eventHasPrizes === true && (v.eventPrizesAwards || []).length === 0) {
              toast({ type: 'error', message: `${label}: Please add at least one prize when Prizes & Winners is enabled.` }); scrollToSection('section-event-details'); return;
            }
            if (se.eventType === 'stall' && se.stallConfig) {
              const sc = se.stallConfig;
              if (sc.enableStudentApplied && (sc.maxStudentStalls == null || sc.maxStudentStalls < 1)) {
                toast({ type: 'error', message: `${label}: Please enter Max Student Stalls (min 1) when Student-Applied Stalls is enabled.` }); scrollToSection('section-event-details'); return;
              }
              if (sc.enableCreatorMade && (sc.creatorStalls || []).some((cs) => !(cs?.name || '').trim())) {
                toast({ type: 'error', message: `${label}: Each creator-made stall must have a name.` }); scrollToSection('section-event-details'); return;
              }
            }
            if (!v.eventPaymentType) { toast({ type: 'error', message: `${label}: Please select Payment Type (Free or Paid).` }); scrollToSection('section-event-details'); return; }
            if (v.eventPaymentType === 'paid') {
              if (v.eventParticipationType === 'individual' && (v.eventRegistrationFeeIndividual === '' || Number(v.eventRegistrationFeeIndividual) < 0)) {
                toast({ type: 'error', message: `${label}: Please enter the Participation Fee (₹) for paid events.` }); scrollToSection('section-event-details'); return;
              }
              if (v.eventParticipationType === 'team' && (v.eventRegistrationFeeTeam === '' || Number(v.eventRegistrationFeeTeam) < 0)) {
                toast({ type: 'error', message: `${label}: Please enter the Fee per Team (₹) for paid events.` }); scrollToSection('section-event-details'); return;
              }
            }
          }
          // Festival-level event visibility settings validation
          if (eventVisibilitySettings.visibleToRoles.length === 0) {
            toast({ type: 'error', message: 'Please select at least one role in Audience Visibility settings.' }); scrollToSection('section-event-settings'); return;
          }
        }
        if (notingEventType === 'venue' || notingEventType === 'stall') {
          const v = venueFormData;
          if (!v.eventName?.trim()) { toast({ type: 'error', message: 'Please enter the Event Name.' }); scrollToSection('section-event-details'); return; }
          if (!v.eventType) { toast({ type: 'error', message: 'Please select the Event Type (e.g. Workshop, Seminar).' }); scrollToSection('section-event-details'); return; }
          if (!v.eventStartDate) { toast({ type: 'error', message: 'Please select the Event Start Date.' }); scrollToSection('section-event-details'); return; }
          if (!v.eventEndDate) { toast({ type: 'error', message: 'Please select the Event End Date.' }); scrollToSection('section-event-details'); return; }
          const evtToday = new Date();
          evtToday.setHours(0, 0, 0, 0);
          if (v.eventStartDate && new Date(v.eventStartDate) < evtToday) {
            toast({ type: 'error', message: 'Event Start Date cannot be in the past. Please select a future date.' }); scrollToSection('section-event-details'); return;
          }
          if (new Date(v.eventEndDate) < new Date(v.eventStartDate)) { toast({ type: 'error', message: 'Event End Date should be after Start Date. Please correct the dates.' }); scrollToSection('section-event-details'); return; }
          if (!v.eventPaymentType) { toast({ type: 'error', message: 'Please select Payment Type: Free or Paid.' }); scrollToSection('section-event-details'); return; }
          if (v.eventPaymentType === 'paid') {
            if (v.eventParticipationType === 'individual' && (v.eventRegistrationFeeIndividual === '' || Number(v.eventRegistrationFeeIndividual) < 0)) {
              toast({ type: 'error', message: 'Please enter the Participation Fee (₹) for paid individual events.' }); scrollToSection('section-event-details'); return;
            }
            if (v.eventParticipationType === 'team' && (v.eventRegistrationFeeTeam === '' || Number(v.eventRegistrationFeeTeam) < 0)) {
              toast({ type: 'error', message: 'Please enter the Fee per Team (₹) for paid team events.' }); scrollToSection('section-event-details'); return;
            }
          }
          if (v.eventApproxCapacity === '' || v.eventApproxCapacity === undefined) { toast({ type: 'error', message: 'Please enter the Approximate Capacity.' }); scrollToSection('section-event-details'); return; }
          if (v.eventDutyLeaveAvailable === null) { toast({ type: 'error', message: 'Please select Yes or No for Duty Leave Required.' }); scrollToSection('section-event-details'); return; }
          if (v.eventDutyLeaveAvailable === true && !v.eventDutyLeaveRoleType) {
            toast({ type: 'error', message: 'Please select who is eligible for Duty Leave when Duty Leave is enabled.' }); scrollToSection('section-event-details'); return;
          }
          if (v.eventHasSponsorship === null) { toast({ type: 'error', message: 'Please select Yes or No for Sponsorship Available.' }); scrollToSection('section-event-details'); return; }
          if (v.eventHasSponsorship === true) {
            const valid = (v.eventSponsors || []).filter((s) => s?.name?.trim());
            if (valid.length === 0) { toast({ type: 'error', message: 'Please add at least one sponsor with a name when Sponsorship is enabled.' }); scrollToSection('section-event-details'); return; }
            // Validate all required sponsor information
            const allSponsors = (v.eventSponsors || []).filter((s) => s?.name?.trim());
            for (const sponsor of allSponsors) {
              if (!sponsor.sponsorType) {
                toast({ type: 'error', message: `Sponsor "${sponsor.name}" - Sponsor Type is required.` }); scrollToSection('section-event-details'); return;
              }
              if (!sponsor.contactPerson?.trim()) {
                toast({ type: 'error', message: `Sponsor "${sponsor.name}" - Contact Person is required.` }); scrollToSection('section-event-details'); return;
              }
              if (!sponsor.designation?.trim()) {
                toast({ type: 'error', message: `Sponsor "${sponsor.name}" - Designation is required.` }); scrollToSection('section-event-details'); return;
              }
              if (!sponsor.phone?.trim()) {
                toast({ type: 'error', message: `Sponsor "${sponsor.name}" - Phone number is required.` }); scrollToSection('section-event-details'); return;
              }
              if (!sponsor.email?.trim()) {
                toast({ type: 'error', message: `Sponsor "${sponsor.name}" - Email is required.` }); scrollToSection('section-event-details'); return;
              }
              const emailRegex = /^\S+@\S+\.\S+$/;
              if (!emailRegex.test(sponsor.email)) {
                toast({ type: 'error', message: `Sponsor "${sponsor.name}" - Please enter a valid email address.` }); scrollToSection('section-event-details'); return;
              }
              if (!sponsor.sponsorLogo?.filePath) {
                toast({ type: 'error', message: `Sponsor "${sponsor.name}" - Logo is required. Please upload a JPG or PNG file.` }); scrollToSection('section-event-details'); return;
              }
            }
          }
          if (v.eventHasResources === null) { toast({ type: 'error', message: 'Please select Yes or No for Event Resources.' }); scrollToSection('section-event-details'); return; }
          if (v.eventHasResources === true) {
            const valid = (v.eventResources || []).filter((r) => (r?.type || '').trim() || (r?.description || '').trim());
            if (valid.length === 0) { toast({ type: 'error', message: 'Please add at least one resource when Resources are enabled.' }); scrollToSection('section-event-details'); return; }
          }
          if (v.eventCertification === null) { toast({ type: 'error', message: 'Please select Yes or No for Certificates.' }); scrollToSection('section-event-details'); return; }
          if (v.eventHasPrizes === null) { toast({ type: 'error', message: 'Please select Yes or No for Prizes & Winners.' }); scrollToSection('section-event-details'); return; }
          if (v.eventHasPrizes === true && (v.eventPrizesAwards || []).length === 0) {
            toast({ type: 'error', message: 'Please add at least one prize when Prizes & Winners is enabled.' }); scrollToSection('section-event-details'); return;
          }
          if (notingEventType === 'stall' && stallConfig) {
            if (stallConfig.enableStudentApplied && (stallConfig.maxStudentStalls == null || stallConfig.maxStudentStalls < 1)) {
              toast({ type: 'error', message: 'Please enter Max Student Stalls (min 1) when Student-Applied Stalls is enabled.' }); scrollToSection('section-event-details'); return;
            }
            if (stallConfig.enableCreatorMade && (stallConfig.creatorStalls || []).some((cs) => !(cs?.name || '').trim())) {
              toast({ type: 'error', message: 'Each creator-made stall must have a name.' }); scrollToSection('section-event-details'); return;
            }
          }
          // Event visibility settings validation
          if (eventVisibilitySettings.visibleToRoles.length === 0) {
            toast({ type: 'error', message: 'Please select at least one role in Audience Visibility settings.' }); scrollToSection('section-event-settings'); return;
          }
        }
      }
    }

    const payload = buildPayload();
    const updatePayload: any = {
      category: effectiveCategory,
      subcategory: effectiveSubcategory,
      departmentId: payload.departmentId,
      departmentScope: payload.departmentScope,
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
      // Optional club association
      updatePayload.eventClubId = eventClubId || null;
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
      // Add event visibility settings
      if (eventVisibilitySettings?.visibleToRoles && eventVisibilitySettings.visibleToRoles.length > 0) {
        updatePayload.eventVisibilitySettings = eventVisibilitySettings;
      }
    }

    if (payload.approvalPeriod === 'one_time') updatePayload.recurringFrequency = null;
    else if (payload.recurringFrequency) updatePayload.recurringFrequency = payload.recurringFrequency;
    if (payload.amountRequired === true) {
      if (payload.amount !== undefined && !Number.isNaN(payload.amount)) updatePayload.amount = payload.amount;
    }

    setActionInProgress(asDraft ? 'draft' : 'submit');
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
        .finally(() => setActionInProgress(null));
    } else if (asDraft && draftId) {
      notingService
        .updateDraft(draftId, updatePayload)
        .then((res) => onSuccess(res.message || 'Draft saved', draftId))
        .catch(onError)
        .finally(() => setActionInProgress(null));
    } else {
      notingService
        .create({ ...payload, submit: !asDraft })
        .then((res) => onSuccess(res.message || (asDraft ? 'Draft saved' : 'Note submitted'), res.data?.id ?? ''))
        .catch(onError)
        .finally(() => setActionInProgress(null));
    }
  };

  const handleDiscardDraft = () => {
    if (actionInProgress) return;
    setActionInProgress('discard');
    const doDiscard = () => {
      isAutosavingRef.current = false;
      clearDraft();
      const s = useNotingDraftStore.getState();
      setCategory(s.category);
      setSubcategory(s.subcategory);
      setDepartmentId(s.departmentId);
      setDepartmentScope(s.departmentScope);
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
      setActionInProgress(null);
      toast({ type: 'success', message: 'Draft discarded' });
    };
    if (draftId) {
      notingService.deleteDraft(draftId)
        .then(doDiscard)
        .catch(() => { doDiscard(); });
    } else {
      doDiscard();
    }
  };

  // isChairperson, effectiveCategory, effectiveSubcategory are declared near the top (after category/subcategory state)

  if (loading || notingPermsLoading || departmentsLoading || !config) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center">
        <PageSkeleton message="Loading form..." />
      </div>
    );
  }

  if (!isStudentUser && notingPerms && !notingPerms.noting_create) {
    return null;
  }

  // For chairpersons: only show 'events' subcategory under 'academic'
  const allSubcategories = config.categories.find((c) => c.value === effectiveCategory)?.subcategories ?? [];
  const subcategories = isChairperson
    ? allSubcategories.filter((s) => s.value === 'events')
    : allSubcategories;

  const baseValid = Boolean(
    effectiveSubcategory?.trim() &&
    departmentId &&
    departmentScope &&
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
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 py-4 sm:py-6 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Navigation */}
          <Link href="/noting" className="inline-flex items-center gap-1.5 text-sm text-[#6497b1] dark:text-gray-400 hover:text-[#005b96] transition-all duration-200 mb-5">
            <ArrowLeft className="w-4 h-4" />
            Back to Noting
          </Link>

          {/* ===== A4 Document Sheet ===== */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#b3cde0]/40 dark:border-gray-700 shadow-[0_2px_8px_rgba(100,151,177,0.1)] overflow-hidden">

            {/* Document Header */}
            <div className="border-b border-[#b3cde0]/30 dark:border-gray-700 px-4 sm:px-8 py-4 sm:py-5">
              <h1 className="text-xl font-bold text-[#011f4b] dark:text-white">
                {isRevertedNote ? 'Edit Reverted Note' : isEditingExistingDraft ? 'Edit Draft Note' : 'Create New Note'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {isRevertedNote ? 'This note was returned for modifications. Review remarks, make changes, and resubmit.' : isEditingExistingDraft ? 'Update your draft and submit when ready.' : 'Fill in the details below. All actions are logged and auditable.'}
              </p>
              {notingIdPreview && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#b3cde0]/20 dark:bg-[#005b96]/10 border border-[#b3cde0]/40 dark:border-[#005b96]/30">
                  <span className="text-[10px] font-semibold text-[#6497b1] uppercase">Note ID</span>
                  <span className="font-mono text-sm font-semibold text-[#005b96] dark:text-[#b3cde0]">{notingIdPreview}</span>
                </div>
              )}
            </div>

            {/* Document Body */}
            <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-6 sm:space-y-7">

              {/* ===== Category & Subcategory ===== */}
              <section>
                <SectionLabel>Classification</SectionLabel>
                {isChairperson && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    As a Club Chairperson, you can only create Event notings.
                  </p>
                )}
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <label className={`flex items-center gap-3 p-3 border rounded-xl transition-all duration-200 ${isChairperson ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${category === 'academic' ? 'border-[#6497b1] bg-[#b3cde0]/10 dark:bg-[#005b96]/10' : 'border-[#b3cde0]/40 dark:border-gray-600 hover:border-[#6497b1]'
                        }`}>
                        <input type="radio" name="category" checked={effectiveCategory === 'academic'} onChange={() => { if (!isChairperson && category !== 'academic') { setCategory('academic'); setSubcategory(''); } }} disabled={isChairperson} className="w-4 h-4 text-[#005b96] focus:ring-[#005b96]/40" />
                        <span className="text-sm font-medium">Academic</span>
                      </label>
                      <label className={`flex items-center gap-3 p-3 border rounded-xl transition-all duration-200 ${isChairperson ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${category === 'administrative' ? 'border-[#6497b1] bg-[#b3cde0]/10 dark:bg-[#005b96]/10' : 'border-[#b3cde0]/40 dark:border-gray-600 hover:border-[#6497b1]'
                        }`}>
                        <input type="radio" name="category" checked={effectiveCategory === 'administrative'} onChange={() => { if (!isChairperson && category !== 'administrative') { setCategory('administrative'); setSubcategory(''); } }} disabled={isChairperson} className="w-4 h-4 text-[#005b96] focus:ring-[#005b96]/40" />
                        <span className="text-sm font-medium">Administrative</span>
                      </label>
                    </div>
                  </div>
                  <div id="field-subcategory">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subcategory <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={effectiveSubcategory}
                      onChange={(e) => { if (!isChairperson) setSubcategory(e.target.value); clearFieldError('subcategory'); }}
                      disabled={isChairperson}
                      className={`w-full px-3 py-3 text-sm border rounded-xl bg-white dark:bg-gray-700 text-[#011f4b] dark:text-white focus:ring-1 focus:ring-[#005b96]/40 focus:border-[#005b96] outline-none transition-all duration-200 ${isChairperson ? 'opacity-60 cursor-not-allowed' : ''} ${fieldErrors.subcategory ? 'border-red-500 ring-1 ring-red-500' : 'border-[#b3cde0]/50 dark:border-gray-600'}`}
                    >
                      <option value="">Select subcategory</option>
                      {subcategories.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    {fieldErrors.subcategory && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.subcategory}</p>
                    )}
                  </div>

                  <div id="field-department" className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Department <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={departmentId && departmentScope ? `${departmentScope}:${departmentId}` : ''}
                      onChange={(e) => {
                        const [scope, id] = e.target.value.split(':');
                        if (!scope || !id) {
                          setDepartmentScope('');
                          setDepartmentId('');
                        } else {
                          setDepartmentScope(scope as 'school' | 'central');
                          setDepartmentId(id);
                        }
                        clearFieldError('departmentId');
                        clearFieldError('departmentScope');
                      }}
                      className={`w-full px-3 py-3 text-sm border rounded-xl bg-white dark:bg-gray-700 text-[#011f4b] dark:text-white focus:ring-1 focus:ring-[#005b96]/40 focus:border-[#005b96] outline-none transition-all duration-200 ${(fieldErrors.departmentId || fieldErrors.departmentScope) ? 'border-red-500 ring-1 ring-red-500' : 'border-[#b3cde0]/50 dark:border-gray-600'}`}
                    >
                      <option value="">Select department</option>
                      <optgroup label="School Departments">
                        {departmentOptions
                          .filter((department) => department.scope === 'school')
                          .map((department) => (
                            <option key={`school:${department.id}`} value={`school:${department.id}`}>
                              {department.displayLabel}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Central Departments">
                        {departmentOptions
                          .filter((department) => department.scope === 'central')
                          .map((department) => (
                            <option key={`central:${department.id}`} value={`central:${department.id}`}>
                              {department.displayLabel}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                    {(fieldErrors.departmentId || fieldErrors.departmentScope) && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {fieldErrors.departmentId || fieldErrors.departmentScope}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Select Club (Optional) — only for faculty facilitators on event notings ── */}
                {!isStudentUser && isEventNoting && (facilitatorClubs.length > 0 || facilitatorClubsLoading) && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Select Your Club{" "}
                      <span className="text-xs text-gray-400 dark:text-gray-500">(Optional)</span>
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      If you select a club, its Chairperson will automatically get full management permissions for the event created from this noting.
                    </p>
                    {facilitatorClubsLoading ? (
                      <p className="text-xs text-gray-400">Loading your clubs…</p>
                    ) : (
                      <select
                        value={eventClubId || ''}
                        onChange={(e) => setEventClubId(e.target.value || null)}
                        className="w-full rounded-xl border border-[#b3cde0]/50 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-[#011f4b] dark:text-gray-100 focus:ring-2 focus:ring-[#005b96]/40 focus:border-[#005b96] transition-all duration-200"
                      >
                        <option value="">— No club selected —</option>
                        {facilitatorClubs.map((club) => (
                          <option key={club.id} value={club.id}>
                            {club.name}{club.categoryName ? ` (${club.categoryName})` : ''}{club.chairpersonName ? ` — Chairperson: ${club.chairpersonName}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </section>

              {/* ===== Description ===== */}
              <section id="field-description">
                <SectionLabel>Description <span className="text-red-500">*</span></SectionLabel>
                <div className={`noting-description-editor border rounded-xl bg-white dark:bg-gray-700 transition-all duration-200 ${fieldErrors.description ? 'border-red-500 ring-1 ring-red-500' : overLimit ? 'border-red-400' : 'border-[#b3cde0]/50 dark:border-gray-600 focus-within:border-[#005b96]'}`}>
                  <ReactQuill
                    theme="snow"
                    value={description}
                    onChange={(value) => { setDescription(sanitizeNoteDescription(value)); clearFieldError('description'); }}
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
                {fieldErrors.description && !overLimit && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.description}</p>
                )}
              </section>

              {/* ===== Requirements / Points ===== */}
              <section id="field-points">
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
                      className={`flex gap-2 items-center p-2.5 rounded-xl border transition-all duration-200 ${pointDraggedIndex === i
                        ? 'opacity-50 border-[#6497b1] bg-[#b3cde0]/10 dark:bg-[#005b96]/10'
                        : pointDropTargetIndex === i
                          ? 'border-[#6497b1] bg-[#b3cde0]/10 dark:bg-[#005b96]/10'
                          : 'border-[#b3cde0]/40 dark:border-gray-600 hover:border-[#6497b1]'
                        }`}
                    >
                      <span className="text-[#b3cde0] cursor-grab active:cursor-grabbing hover:text-[#005b96] transition-all duration-200" title="Drag to reorder">
                        <GripVertical className="w-4 h-4" />
                      </span>
                      <span className="flex items-center justify-center w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">
                        {i + 1}
                      </span>
                      <input
                        type="text"
                        value={p}
                        onChange={(e) => updatePoint(i, e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-[#b3cde0]/50 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#011f4b] dark:text-white focus:ring-1 focus:ring-[#005b96]/40 focus:border-[#005b96] outline-none transition-all duration-200"
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
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#005b96] dark:text-[#b3cde0] hover:bg-[#b3cde0]/10 dark:hover:bg-[#005b96]/10 rounded-xl transition-all duration-200"
                >
                  <Plus className="w-4 h-4" />
                  Add another point
                </button>
                {fieldErrors.points && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.points}</p>
                )}
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
                  className={`rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 ${fileDropActive
                    ? 'border-[#6497b1] bg-[#b3cde0]/10 dark:bg-[#005b96]/10'
                    : 'border-[#b3cde0]/40 dark:border-gray-600 hover:border-[#6497b1]'
                    }`}
                >
                  <Upload className={`w-6 h-6 mx-auto mb-2 ${fileDropActive ? 'text-[#005b96]' : 'text-[#b3cde0]'}`} />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {fileDropActive ? 'Drop files here' : 'Drag and drop files here'}
                  </p>
                  <p className="text-xs text-gray-400 mb-3">PDF, Word, Excel, Images, ZIP • Max 5MB per file</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#005b96] text-white text-sm font-medium rounded-xl hover:bg-[#03396c] transition-all duration-200 shadow-[0_2px_8px_rgba(0,91,150,0.25)]"
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
                                className="w-full px-3 py-1.5 text-sm border border-[#b3cde0]/50 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#011f4b] dark:text-white focus:ring-1 focus:ring-[#005b96]/40 focus:border-[#005b96] outline-none transition-all duration-200"
                                placeholder="File name"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-gray-400 mb-1">Description / Purpose</label>
                              <textarea
                                value={a.fileDescription}
                                onChange={(e) => updateAnnexure(i, { fileDescription: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-1.5 text-sm border border-[#b3cde0]/50 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#011f4b] dark:text-white focus:ring-1 focus:ring-[#005b96]/40 focus:border-[#005b96] outline-none transition-all duration-200"
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
                <section id="section-event-details">
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
                  />



                  {/* Festival form — replaces normal event fields */}
                  {notingEventType === 'festival' && (
                    <FestivalForm
                      data={festivalData}
                      onChange={setFestivalData}
                      coordinatorReadOnly={true}
                      onUploadReceipt={handleSponsorReceiptUpload}
                      onUploadSponsorLogo={handleSponsorLogoUpload}
                      searchEmployees={handleSponsorSearchEmployees}
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
                          showCapacityFixed={true}
                          fieldsetPrefix="venue"
                          onUploadReceipt={handleSponsorReceiptUpload}
                          onUploadSponsorLogo={handleSponsorLogoUpload}
                          searchEmployees={handleSponsorSearchEmployees}
                        />
                      </div>
                      {notingEventType === 'stall' && (
                        <div className="mt-4">
                          <StallConfigSection
                            config={stallConfig}
                            onChange={setStallConfig}
                          />
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}

              {/* ===== Event Visibility & Settings ===== */}
              {isEventNoting && notingEventType && (
                <section id="section-event-settings" className="space-y-5 mt-5">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-[#b3cde0]/30 dark:border-gray-700">
                    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">Event Visibility & Settings</h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Configure who can see this event and extra pass settings. These will be <strong>locked</strong> after noting approval.
                  </p>
                  <EventSettingsForm
                    data={eventVisibilitySettings}
                    onChange={setEventVisibilitySettings}
                  />
                </section>
              )}

              {/* ===== Additional Details ===== */}
              <section>
                <SectionLabel>Additional Details</SectionLabel>
                <div className="rounded-xl border border-[#b3cde0]/30 dark:border-gray-700 overflow-hidden">
                  {/* Approval Period & Policy Compliance - Side by Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[#b3cde0]/20 dark:bg-gray-600">
                    {/* Approval Period */}
                    <div id="field-recurringFrequency" className="bg-white dark:bg-gray-800 p-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Approval Period <span className="text-red-500">*</span></label>
                      <div className="flex flex-col gap-2">
                        <label className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer transition-all duration-200 ${approvalPeriod === 'one_time' ? 'border-[#6497b1] bg-[#b3cde0]/10 dark:bg-[#005b96]/10' : 'border-[#b3cde0]/40 dark:border-gray-600 hover:border-[#6497b1]'
                          }`}>
                          <input type="radio" name="period" checked={approvalPeriod === 'one_time'} onChange={() => setApprovalPeriod('one_time')} className="w-4 h-4 text-[#005b96] focus:ring-[#005b96]/40" />
                          <span className="text-sm font-medium">One-time</span>
                        </label>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <label className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer transition-all duration-200 flex-1 ${approvalPeriod === 'recurring' ? 'border-[#6497b1] bg-[#b3cde0]/10 dark:bg-[#005b96]/10' : 'border-[#b3cde0]/40 dark:border-gray-600 hover:border-[#6497b1]'
                            }`}>
                            <input type="radio" name="period" checked={approvalPeriod === 'recurring'} onChange={() => setApprovalPeriod('recurring')} className="w-4 h-4 text-[#005b96] focus:ring-[#005b96]/40" />
                            <span className="text-sm font-medium">Recurring</span>
                          </label>
                          {approvalPeriod === 'recurring' && (
                            <select
                              value={recurringFrequency}
                              onChange={(e) => { setRecurringFrequency(e.target.value); clearFieldError('recurringFrequency'); }}
                              className="flex-1 px-3 py-2.5 text-sm border border-[#b3cde0]/50 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:ring-1 focus:ring-[#005b96]/40 focus:border-[#005b96] outline-none transition-all duration-200"
                            >
                              <option value="">Select frequency</option>
                              {config.recurringFrequencyOptions.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                      {fieldErrors.recurringFrequency && (
                        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.recurringFrequency}</p>
                      )}
                    </div>

                    {/* Policy Compliance */}
                    <div id="field-policyCompliance" className="bg-white dark:bg-gray-800 p-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Policy Compliance <span className="text-red-500">*</span></label>
                      <div className="flex flex-col gap-2">
                        <label className={`flex items-center gap-2 p-2.5 border rounded-md cursor-pointer transition-colors ${policyCompliance === 'yes' ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}>
                          <input type="radio" name="policyCompliance" checked={policyCompliance === 'yes'} onChange={() => { setPolicyCompliance('yes'); clearFieldError('policyCompliance'); }} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" />
                          <span className="text-sm font-medium">Yes, complies</span>
                        </label>
                        <label className={`flex items-center gap-2 p-2.5 border rounded-md cursor-pointer transition-colors ${policyCompliance === 'no' ? 'border-red-400 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                          }`}>
                          <input type="radio" name="policyCompliance" checked={policyCompliance === 'no'} onChange={() => { setPolicyCompliance('no'); clearFieldError('policyCompliance'); }} className="w-4 h-4 text-red-600 focus:ring-red-500" />
                          <span className="text-sm font-medium">No</span>
                        </label>
                      </div>
                      {fieldErrors.policyCompliance && (
                        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.policyCompliance}</p>
                      )}
                    </div>
                  </div>

                  {/* Budget / Amount */}
                  <div id="field-amount" className="p-4 border-t border-[#b3cde0]/30 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">Budget / Amount <span className="text-red-500">*</span></label>
                      <div className="flex flex-col sm:flex-row gap-3 flex-1 sm:items-center">
                        <label className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer transition-all duration-200 flex-1 ${!amountRequired ? 'border-[#6497b1] bg-[#b3cde0]/10 dark:bg-[#005b96]/10' : 'border-[#b3cde0]/40 dark:border-gray-600 hover:border-[#6497b1]'
                          }`}>
                          <input type="radio" name="amountReq" checked={!amountRequired} onChange={() => { setAmountRequired(false); clearFieldError('amount'); }} className="w-4 h-4 text-[#005b96] focus:ring-[#005b96]/40" />
                          <span className="text-sm font-medium">No amount</span>
                        </label>
                        <label className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer transition-all duration-200 flex-1 ${amountRequired ? 'border-[#6497b1] bg-[#b3cde0]/10 dark:bg-[#005b96]/10' : 'border-[#b3cde0]/40 dark:border-gray-600 hover:border-[#6497b1]'
                          }`}>
                          <input type="radio" name="amountReq" checked={amountRequired} onChange={() => { setAmountRequired(true); clearFieldError('amount'); }} className="w-4 h-4 text-[#005b96] focus:ring-[#005b96]/40" />
                          <span className="text-sm font-medium">Amount required</span>
                        </label>
                        {amountRequired && (
                          <div className="relative flex-1 shrink-0 w-full sm:w-40">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₹</span>
                            <input
                              type="number"
                              min={1}
                              max={AMOUNT_MAX}
                              step={1}
                              value={amount}
                              onChange={(e) => {
                                const val = e.target.value;
                                // Only accept integers (no decimals)
                                if (val === '' || /^\d+$/.test(val)) {
                                  setAmount(val);
                                  clearFieldError('amount');
                                }
                              }}
                              className={`w-full pl-8 pr-3 py-2.5 text-sm border rounded-xl bg-white dark:bg-gray-700 focus:ring-1 focus:ring-[#005b96]/40 focus:border-[#005b96] outline-none transition-all duration-200 ${fieldErrors.amount ? 'border-red-500 ring-1 ring-red-500' : 'border-[#b3cde0]/50 dark:border-gray-600'}`}
                              placeholder="Max ₹10 lakh"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {fieldErrors.amount && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.amount}</p>
                    )}
                  </div>
                </div>
              </section>

              {/* ===== Creator Info ===== */}
              {creatorInfo && (
                <section>
                  <SectionLabel>Created By</SectionLabel>
                  <div className="bg-[#f8fafc] dark:bg-gray-900/20 rounded-xl border border-[#b3cde0]/30 dark:border-gray-700 p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
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

            {/* Approval Trail for Reverted Notes */}
            {isRevertedNote && revertHistory.length > 0 && (
              <div className="px-4 sm:px-8 py-4 sm:py-6">
                <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="inline-block w-8 h-px bg-gradient-to-r from-[#005b96] to-transparent" />
                  Approval Trail
                  <span className="text-[10px] font-normal text-gray-300 dark:text-gray-600 ml-1">
                    ({revertHistory.length} {revertHistory.length === 1 ? 'entry' : 'entries'})
                  </span>
                </h3>
                <div className="max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                  {revertHistory.map((h, idx) => {
                    let iconColor = 'bg-gray-400';
                    let badgeBg = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
                    let lineColor = '#d1d5db';
                    let Icon: React.ElementType = Clock;
                    const action = h.action.toLowerCase();

                    if (action.includes('submit')) {
                      Icon = Send; iconColor = 'bg-gradient-to-br from-[#005b96] to-[#011f4b]'; lineColor = '#005b96';
                      badgeBg = 'bg-[#b3cde0]/20 text-[#005b96] dark:bg-[#005b96]/10 dark:text-[#b3cde0] ring-1 ring-[#b3cde0]/40';
                    } else if (action.includes('approve')) {
                      Icon = CheckCircle; iconColor = 'bg-gradient-to-br from-emerald-400 to-emerald-600'; lineColor = '#10b981';
                      badgeBg = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 ring-1 ring-emerald-200';
                    } else if (action === 'recommended') {
                      Icon = ThumbsUp; iconColor = 'bg-gradient-to-br from-blue-400 to-blue-600'; lineColor = '#3b82f6';
                      badgeBg = 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ring-1 ring-blue-200';
                    } else if (action === 'not_recommended') {
                      Icon = ThumbsDown; iconColor = 'bg-gradient-to-br from-rose-400 to-rose-600'; lineColor = '#f43f5e';
                      badgeBg = 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 ring-1 ring-rose-200';
                    } else if (action.includes('reject')) {
                      Icon = XCircle; iconColor = 'bg-gradient-to-br from-red-400 to-red-600'; lineColor = '#ef4444';
                      badgeBg = 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 ring-1 ring-red-200';
                    } else if (action.includes('revert')) {
                      Icon = RotateCcw; iconColor = 'bg-gradient-to-br from-orange-400 to-orange-600'; lineColor = '#f97316';
                      badgeBg = 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 ring-1 ring-orange-200';
                    } else if (action.includes('forward')) {
                      Icon = ArrowRight; iconColor = 'bg-gradient-to-br from-[#6497b1] to-[#005b96]'; lineColor = '#005b96';
                      badgeBg = 'bg-[#b3cde0]/20 text-[#005b96] dark:bg-[#005b96]/10 dark:text-[#b3cde0] ring-1 ring-[#b3cde0]/40';
                    } else if (action === 'copy_sent') {
                      Icon = Copy; iconColor = 'bg-gradient-to-br from-indigo-400 to-indigo-600'; lineColor = '#6366f1';
                      badgeBg = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-1 ring-indigo-200';
                    }

                    const isLast = idx === revertHistory.length - 1;
                    const actionLabel = h.action.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

                    return (
                      <div key={h.id} className="flex group" style={{ animation: `fadeInUp 0.4s ease-out ${idx * 0.08}s both` }}>
                        <div className="flex flex-col items-center flex-shrink-0" style={{ width: '32px' }}>
                          <div className="relative z-10">
                            <div className={`h-7 w-7 rounded-full ${iconColor} shadow-lg flex items-center justify-center ring-[3px] ring-white dark:ring-gray-800`}>
                              <Icon className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                            </div>
                          </div>
                          {!isLast && (
                            <div className="w-[2px] flex-1 rounded-full my-1" style={{ backgroundColor: lineColor, opacity: 0.3 }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-5 pl-3">
                          <div className={`rounded-xl border transition-all duration-300 ${
                            isLast ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm' : 'bg-gray-50/80 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/40'
                          }`}>
                            <div className="p-3.5">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${badgeBg}`}>
                                  <Icon className="w-3 h-3" />
                                  {actionLabel}
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap">
                                  {new Date(h.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[12px] text-gray-600 dark:text-gray-300">
                                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center flex-shrink-0">
                                  <User className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400" />
                                </div>
                                <span className="font-medium truncate">
                                  {h.performedBy?.employeeDetails?.displayName || h.performedBy?.uid || '—'}
                                </span>
                                {h.performedBy?.uid && (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono bg-gray-100 dark:bg-gray-700/50 px-1.5 py-0.5 rounded">
                                    {h.performedBy.uid}
                                  </span>
                                )}
                              </div>
                              {h.remarks && (
                                <div className="mt-2.5 pl-3 py-1.5 border-l-2 border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/20 rounded-r-md">
                                  <p className="text-[12px] text-gray-600 dark:text-gray-300 italic leading-relaxed">
                                    &ldquo;{h.remarks}&rdquo;
                                  </p>
                                </div>
                              )}
                              {h.nextHolder && (
                                <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#b3cde0]/20 dark:bg-[#005b96]/10 text-[#005b96] dark:text-[#b3cde0]">
                                    <CornerDownLeft className="w-3 h-3" />
                                    <span className="text-[11px] font-semibold">
                                      Assigned: {h.nextHolder.employeeDetails?.displayName || h.nextHolder.uid || '—'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Document Footer — Action Buttons */}
            <div className="border-t border-[#b3cde0]/30 dark:border-gray-700 px-4 sm:px-8 py-4 bg-[#f8fafc] dark:bg-gray-900/20">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={!!actionInProgress}
                  className="px-5 py-2.5 bg-[#005b96] text-white text-sm font-medium rounded-xl hover:bg-[#03396c] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-200 shadow-[0_2px_8px_rgba(0,91,150,0.25)]"
                >
                  {actionInProgress === 'submit' ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
                  {isRevertedNote ? 'Send for Reapproval' : 'Send for Approval'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={!!actionInProgress}
                  className="px-5 py-2.5 border border-[#b3cde0]/50 dark:border-gray-600 text-[#03396c] dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-white dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-200"
                >
                  {actionInProgress === 'draft' ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
                  Save as Draft
                </button>
                {!isRevertedNote && (draftId || category || subcategory || description.trim() || points.some((p) => p.trim())) && (
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    disabled={!!actionInProgress}
                    className="ml-auto px-4 py-2.5 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-200"
                  >
                    {actionInProgress === 'discard' ? <LoadingSpinner size="sm" /> : <Trash2 className="w-4 h-4" />}
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
