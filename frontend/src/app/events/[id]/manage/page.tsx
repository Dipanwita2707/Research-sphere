'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
// @ts-ignore
import 'react-quill/dist/quill.snow.css';
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Save,
  AlertCircle,
  Users,
  IndianRupee,
  ExternalLink,
  Upload,
  X,
  Plus,
  Trash2,
  User,
  Award,
  FileText,
  Gift,
  CheckCircle,
  GripVertical,
  Trophy,
  Medal,
  Briefcase,
  ShoppingBag,
  Ticket,
  Star,
  Settings,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { notingService } from '@/features/noting-management/services/noting.service';
import type { Event, OpportunityMode, ParticipationType, EventPrize, PrizeType, EventCustomField, EventFieldType } from '@/features/event-management/types/event.types';
import {
  sanitizeManageEventInput,
  validateManageEventForm,
} from '@/features/event-management/validation/manageEvent.validation';
import { SponsorshipManager } from '@/features/noting-management/components/SponsorshipManager';
import type { SponsorData } from '@/features/noting-management/components/FestivalForm';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import {
  sanitizeDigitsInput,
  sanitizeEmailInput,
  sanitizePlainTextInput,
  sanitizeUrlInput,
} from '@/shared/utils/inputSanitizers';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

interface FAQ {
  question: string;
  answer: string;
}

type EventResourceRow = {
  category: string;
  type: string;
  description: string;
  estimatedCost?: number;
  pricePerPiece?: number;
  quantity?: number;
};

// Step configuration
const STEPS = [
  { id: 1, name: 'Basic Info', icon: FileText },
  { id: 2, name: 'Participation', icon: Users },
  { id: 3, name: 'Prizes & Questions', icon: Gift },
];

// Prize type options with icons
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

// Additional perk options
const PERK_OPTIONS = ['Certificate', 'Pre-placement Interview', 'Pre-placement Offer', 'Goodies', 'Mentorship'];
const MAX_DESCRIPTION_WORDS = 10;
const MAX_CONTACT_MOBILE_DIGITS = 10;

// Custom field type options
const FIELD_TYPE_OPTIONS: { value: EventFieldType; label: string }[] = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'file', label: 'File Upload' },
];

export default function ManageEventPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Validation
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Basic Information
  const [description, setDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [maxCapacity, setMaxCapacity] = useState<number | ''>('');
  const [registrationFee, setRegistrationFee] = useState<number | ''>('');
  const [registrationStartDate, setRegistrationStartDate] = useState('');
  const [registrationEndDate, setRegistrationEndDate] = useState('');

  // Event Branding
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [logoImageUrl, setLogoImageUrl] = useState('');
  const [bannerPreview, setBannerPreview] = useState('');
  const [logoPreview, setLogoPreview] = useState('');

  // Opportunity Mode & Participation
  const [opportunityMode, setOpportunityMode] = useState<OpportunityMode | null>(null);
  const [participationType, setParticipationType] = useState<ParticipationType>('individual');
  const [minTeamSize, setMinTeamSize] = useState<number | ''>('');
  const [maxTeamSize, setMaxTeamSize] = useState<number | ''>('');
  const [maxTeamLimit, setMaxTeamLimit] = useState<number | ''>('');
  const [interCollegeAllowed, setInterCollegeAllowed] = useState(false);
  const [interSpecializationAllowed, setInterSpecializationAllowed] = useState(false);

  // Additional Team Settings
  const [allowCrossInstituteTeams, setAllowCrossInstituteTeams] = useState(false);
  const [allowTeamEditAfterSubmission, setAllowTeamEditAfterSubmission] = useState(false);
  const [autoApproveTeams, setAutoApproveTeams] = useState(true);
  const [teamRegistrationDeadline, setTeamRegistrationDeadline] = useState('');

  // Registration Control Settings
  const [autoApproveRegistration, setAutoApproveRegistration] = useState(true);
  const [registrationCap, setRegistrationCap] = useState<number | ''>('');
  const [showParticipantsPublicly, setShowParticipantsPublicly] = useState(false);
  const [allowWithdrawRegistration, setAllowWithdrawRegistration] = useState(true);
  const [allowEditAfterSubmission, setAllowEditAfterSubmission] = useState(false);
  const [lockTeamAfterDeadline, setLockTeamAfterDeadline] = useState(true);

  // Team Discovery Settings
  const [lookingForTeammatesEnabled, setLookingForTeammatesEnabled] = useState(true);
  const [allowPublicTeamListing, setAllowPublicTeamListing] = useState(true);
  const [allowJoinRequests, setAllowJoinRequests] = useState(true);
  const [allowInviteSystem, setAllowInviteSystem] = useState(true);

  // Contact Details
  const [contactPersonName, setContactPersonName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [alternateContact, setAlternateContact] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [socialMediaLinks, setSocialMediaLinks] = useState<Record<string, string>>({});

  // Additional Information
  const [eligibilityCriteria, setEligibilityCriteria] = useState('');
  const [rulesAndGuidelines, setRulesAndGuidelines] = useState('');
  const [prizeDetails, setPrizeDetails] = useState('');
  const [certificateAvailable, setCertificateAvailable] = useState(false);
  const [faqs, setFaqs] = useState<FAQ[]>([]);

  // Prize Configuration
  const [prizesEnabled, setPrizesEnabled] = useState(false);
  const [prizes, setPrizes] = useState<EventPrize[]>([]);
  const [editingPrize, setEditingPrize] = useState<EventPrize | null>(null);
  const [showPrizeModal, setShowPrizeModal] = useState(false);

  // Custom Fields
  const [customFields, setCustomFields] = useState<EventCustomField[]>([]);
  const [editingField, setEditingField] = useState<EventCustomField | null>(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [requireFormSubmission, setRequireFormSubmission] = useState(false);

  // Extended fields (from Noting - editable)
  const [approxCapacity, setApproxCapacity] = useState<number | ''>('');
  const [teamRegistrationFee, setTeamRegistrationFee] = useState<number | ''>('');
  const [dutyLeaveAvailable, setDutyLeaveAvailable] = useState<boolean | null>(null);
  const [dutyLeaveEligibility, setDutyLeaveEligibility] = useState<string[]>([]);
  const [dutyLeaveRoleType, setDutyLeaveRoleType] = useState<'participants' | 'organizers' | 'both' | null>(null);
  const [hasSponsorship, setHasSponsorship] = useState<boolean | null>(null);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [showSponsorshipPublicly, setShowSponsorshipPublicly] = useState(false);
  const [hasResources, setHasResources] = useState<boolean | null>(null);
  const [resources, setResources] = useState<EventResourceRow[]>([]);

  // Sponsor receipt upload helper (reuses noting attachment endpoint)
  const handleSponsorReceiptUpload = useCallback(async (file: File): Promise<{ filePath: string; fileName: string } | null> => {
    try {
      const filePath = await notingService.uploadAttachment(file);
      return { filePath, fileName: file.name };
    } catch {
      toast({ type: 'error', message: `Failed to upload receipt: ${file.name}` });
      return null;
    }
  }, [toast]);

  // Sponsor assignment search helper
  const handleSponsorSearchEmployees = useCallback(async (query: string) => {
    const results = await notingService.searchEmployees(query);
    return results.map(u => ({ id: u.id, uid: u.uid, displayName: u.displayName, department: u.department }));
  }, []);

  // Per-sponsor save: persist savedAt to backend immediately
  const handleSponsorSaved = useCallback(async (updatedSponsors: any[]) => {
    if (!event) return;
    try {
      const updated = await eventService.updateEvent(eventId, { sponsors: updatedSponsors } as any);
      setEvent(updated);
      if (Array.isArray(updated.sponsors)) setSponsors(updated.sponsors);
      toast({ type: 'success', message: 'Sponsor saved & locked successfully' });
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    }
  }, [event, eventId, toast]);

  useEffect(() => {
    loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      const [data, existingPrizes, existingFields] = await Promise.all([
        eventService.getEvent(eventId),
        eventService.getPrizes(eventId).catch(() => []),
        eventService.getCustomFields(eventId).catch(() => []),
      ]);

      // ── Security: block users who cannot manage this event ──
      if (!(data as any).canManage) {
        toast({ type: 'error', message: 'You do not have permission to manage this event' });
        router.replace('/events');
        return;
      }

      setEvent(data);

      setDescription(data.description || '');
      setLongDescription(data.longDescription || '');
      setVenue(data.venue || '');
      setMaxCapacity(data.maxCapacity || '');
      setRegistrationFee(data.registrationFee || '');
      setRegistrationStartDate(data.registrationStartDate ? new Date(data.registrationStartDate).toISOString().slice(0, 16) : '');
      setRegistrationEndDate(data.registrationEndDate ? new Date(data.registrationEndDate).toISOString().slice(0, 16) : '');

      setBannerImageUrl(data.bannerImageUrl || '');
      setLogoImageUrl(data.logoImageUrl || '');
      setBannerPreview(data.bannerImageUrl || '');
      setLogoPreview(data.logoImageUrl || '');

      setOpportunityMode(data.opportunityMode || null);
      setParticipationType(data.participationType || 'individual');
      setMinTeamSize(data.minTeamSize || '');
      setMaxTeamSize(data.maxTeamSize || '');
      setMaxTeamLimit(data.maxTeamLimit || '');
      setInterCollegeAllowed(data.interCollegeAllowed || false);
      setInterSpecializationAllowed(data.interSpecializationAllowed || false);

      // New team settings
      setAllowCrossInstituteTeams(data.allowCrossInstituteTeams || false);
      setAllowTeamEditAfterSubmission(data.allowTeamEditAfterSubmission || false);
      setAutoApproveTeams(data.autoApproveTeams !== false);
      setTeamRegistrationDeadline(data.teamRegistrationDeadline?.split('T')[0] || '');

      // Registration control settings
      setAutoApproveRegistration(data.autoApproveRegistration !== false);
      setRegistrationCap(data.registrationCap || '');
      setShowParticipantsPublicly(data.showParticipantsPublicly || false);
      setAllowWithdrawRegistration(data.allowWithdrawRegistration !== false);
      setAllowEditAfterSubmission(data.allowEditAfterSubmission || false);
      setLockTeamAfterDeadline(data.lockTeamAfterDeadline !== false);

      // Team discovery settings
      setLookingForTeammatesEnabled(data.lookingForTeammatesEnabled !== false);
      setAllowPublicTeamListing(data.allowPublicTeamListing !== false);
      setAllowJoinRequests(data.allowJoinRequests !== false);
      setAllowInviteSystem(data.allowInviteSystem !== false);

      setContactPersonName(data.contactPersonName || '');
      setContactEmail(data.contactEmail || '');
      setContactMobile(data.contactMobile || '');
      setAlternateContact(data.alternateContact || '');
      setWebsiteUrl(data.websiteUrl || '');
      setSocialMediaLinks(data.socialMediaLinks || {});

      setEligibilityCriteria(data.eligibilityCriteria || '');
      setRulesAndGuidelines(data.rulesAndGuidelines || '');
      setPrizeDetails(data.prizeDetails || '');
      setCertificateAvailable(data.certificateAvailable || false);
      setFaqs(data.faqs || []);

      // Prize and custom fields
      setPrizesEnabled(data.prizesEnabled || false);
      setPrizes(existingPrizes);
      setCustomFields(existingFields);
      setRequireFormSubmission(data.requireFormSubmission || false);
      setApproxCapacity(data.approxCapacity ?? '');
      setTeamRegistrationFee(data.teamRegistrationFee ?? '');
      // When event is from noting, locked fields that are null should display as false (No) not as unselected
      const notingLocked = !!data.notingId;
      setDutyLeaveAvailable(data.dutyLeaveAvailable ?? (notingLocked ? false : null));
      setDutyLeaveEligibility(Array.isArray(data.dutyLeaveEligibility) ? data.dutyLeaveEligibility : []);
      setDutyLeaveRoleType(data.dutyLeaveRoleType ?? null);
      setHasSponsorship(data.hasSponsorship ?? (notingLocked ? false : null));
      setSponsors(Array.isArray(data.sponsors) ? data.sponsors : []);
      setShowSponsorshipPublicly(data.showSponsorshipPublicly ?? false);
      setHasResources(data.hasResources ?? (notingLocked ? false : null));
      setResources(Array.isArray(data.resources) ? data.resources : []);
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (type: 'banner' | 'logo', file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (type === 'banner') { setBannerPreview(result); setBannerImageUrl(result); }
      else { setLogoPreview(result); setLogoImageUrl(result); }
    };
    reader.readAsDataURL(file);
  };

  const getResourceTotal = (resource: EventResourceRow) => {
    if (resource.pricePerPiece != null && resource.quantity != null) {
      return Number(resource.pricePerPiece) * Number(resource.quantity);
    }
    return resource.estimatedCost;
  };

  const updateResourceField = (
    index: number,
    field: keyof EventResourceRow,
    value: string | number | undefined,
  ) => {
    setResources((prev) =>
      prev.map((resource, resourceIndex) => {
        if (resourceIndex !== index) return resource;

        const nextValue =
          typeof value === 'string'
            ? sanitizePlainTextInput(value, {
                maxLength: field === 'description' ? 300 : 120,
              })
            : value;
        const nextResource = { ...resource, [field]: nextValue };
        nextResource.estimatedCost = getResourceTotal(nextResource);
        return nextResource;
      }),
    );
  };

  const removeResourceAt = (index: number) => {
    setResources((prev) => prev.filter((_, resourceIndex) => resourceIndex !== index));
  };

  const addResourceRow = () => {
    setResources((prev) => [
      ...prev,
      {
        category: 'internal',
        type: '',
        description: '',
      },
    ]);
  };

  const handleRemoveImage = (type: 'banner' | 'logo') => {
    if (type === 'banner') { setBannerPreview(''); setBannerImageUrl(''); }
    else { setLogoPreview(''); setLogoImageUrl(''); }
  };

  // ──── Validation helpers ────
  const countWords = (str: string) => str.trim().split(/\s+/).filter(Boolean).length;
  const clampDescription = (value: string) => {
    const sanitized = sanitizePlainTextInput(value, { maxLength: 120 });
    const words = sanitized.trim().split(/\s+/).filter(Boolean);
    if (words.length <= MAX_DESCRIPTION_WORDS) return sanitized;
    return words.slice(0, MAX_DESCRIPTION_WORDS).join(' ');
  };
  const normalizeContactMobile = (value: string) =>
    sanitizeDigitsInput(value, { maxLength: MAX_CONTACT_MOBILE_DIGITS });

  type FieldErrorMap = Record<string, string>;

  const getValidationInput = (forPublish = false) => ({
    description,
    longDescription,
    venue,
    maxCapacity,
    registrationFee,
    teamRegistrationFee,
    registrationStartDate,
    registrationEndDate,
    logoImageUrl,
    opportunityMode,
    participationType,
    minTeamSize,
    maxTeamSize,
    contactPersonName,
    contactEmail,
    contactMobile,
    alternateContact,
    websiteUrl,
    socialMediaLinks,
    eligibilityCriteria,
    rulesAndGuidelines,
    prizeDetails,
    faqs,
    hasResources,
    resources,
    eventPaymentType: event?.paymentType ?? 'free',
    eventStartDate: event?.startDate,
    forPublish,
  });

  const runValidation = (forPublish = false): FieldErrorMap => {
    return validateManageEventForm(getValidationInput(forPublish)).fieldErrors;
  };

  const blurField = (fieldName: string, forPublish = false) => {
    const errs = runValidation(forPublish);
    setFieldErrors(prev => {
      const next = { ...prev };
      if (errs[fieldName]) next[fieldName] = errs[fieldName];
      else delete next[fieldName];
      return next;
    });
  };

  const scrollToFirstError = (errors: FieldErrorMap) => {
    const stepFieldMap: Array<{ field: string; step: number }> = [
      { field: 'logo', step: 1 },
      { field: 'description', step: 1 },
      { field: 'longDescription', step: 1 },
      { field: 'registrationFee', step: 1 },
      { field: 'teamRegistrationFee', step: 1 },
      { field: 'registrationStartDate', step: 1 },
      { field: 'registrationEndDate', step: 1 },
      { field: 'contactPersonName', step: 1 },
      { field: 'contactEmail', step: 1 },
      { field: 'contactMobile', step: 1 },
      { field: 'opportunityMode', step: 2 },
      { field: 'minTeamSize', step: 2 },
      { field: 'maxTeamSize', step: 2 },
    ];
    for (const { field, step } of stepFieldMap) {
      if (errors[field]) {
        setCurrentStep(step);
        setTimeout(() => {
          const el = document.getElementById(`field-${field}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
        break;
      }
    }
  };

  const addFAQ = () => setFaqs([...faqs, { question: '', answer: '' }]);
  const updateFAQ = (i: number, field: 'question' | 'answer', v: string) => {
    const u = [...faqs];
    u[i][field] = sanitizePlainTextInput(v, {
      maxLength: field === 'question' ? 200 : 500,
    });
    setFaqs(u);
  };
  const removeFAQ = (i: number) => setFaqs(faqs.filter((_, idx) => idx !== i));

  const isPrizeConfigLocked = !!event?.notingId;

  // Prize management
  const openAddPrize = () => {
    if (isPrizeConfigLocked) {
      toast({ type: 'error', message: 'Prize configuration is locked because it was defined in noting.' });
      return;
    }
    setEditingPrize({
      position: prizes.length + 1,
      rank: prizes.length === 0 ? 'Winner' : prizes.length === 1 ? 'First Runner Up' : prizes.length === 2 ? 'Second Runner Up' : `Position ${prizes.length + 1}`,
      title: '',
      prizeType: 'certificate',
      sortOrder: prizes.length,
      isActive: true,
      additionalPerks: [],
    });
    setShowPrizeModal(true);
  };

  const openEditPrize = (prize: EventPrize) => {
    if (isPrizeConfigLocked) {
      toast({ type: 'error', message: 'Prize configuration is locked because it was defined in noting.' });
      return;
    }
    setEditingPrize({ ...prize });
    setShowPrizeModal(true);
  };

  const savePrize = () => {
    if (isPrizeConfigLocked) {
      toast({ type: 'error', message: 'Prize configuration is locked because it was defined in noting.' });
      return;
    }
    if (!editingPrize || !editingPrize.rank.trim()) {
      toast({ type: 'error', message: 'Rank is required' });
      return;
    }
    if (editingPrize.id) {
      setPrizes(prizes.map(p => p.id === editingPrize.id ? editingPrize : p));
    } else {
      setPrizes([...prizes, { ...editingPrize, id: `temp-${Date.now()}` }]);
    }
    setShowPrizeModal(false);
    setEditingPrize(null);
  };

  const deletePrize = (prizeId: string) => {
    if (isPrizeConfigLocked) {
      toast({ type: 'error', message: 'Prize configuration is locked because it was defined in noting.' });
      return;
    }
    setPrizes(prizes.filter(p => p.id !== prizeId));
  };

  // Custom field management
  const openAddField = () => {
    setEditingField({
      id: '',
      fieldName: `field_${Date.now()}`,
      fieldLabel: '',
      fieldType: 'text',
      isRequired: false,
      placeholder: '',
      helpText: '',
      options: [],
      sortOrder: customFields.length,
      isActive: true,
    });
    setShowFieldModal(true);
  };

  const openEditField = (field: EventCustomField) => {
    setEditingField({ ...field });
    setShowFieldModal(true);
  };

  const saveField = async () => {
    if (!editingField || !editingField.fieldLabel.trim()) {
      toast({ type: 'error', message: 'Field label is required' });
      return;
    }
    try {
      if (editingField.id) {
        const updated = await eventService.updateCustomField(eventId, editingField.id, editingField);
        setCustomFields(customFields.map(f => f.id === editingField.id ? updated : f));
      } else {
        const created = await eventService.createCustomField(eventId, {
          ...editingField,
          fieldName: editingField.fieldLabel.toLowerCase().replace(/\s+/g, '_'),
        });
        setCustomFields([...customFields, created]);
      }
      setShowFieldModal(false);
      setEditingField(null);
      toast({ type: 'success', message: 'Field saved successfully' });
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    }
  };

  const deleteField = async (fieldId: string) => {
    try {
      await eventService.deleteCustomField(eventId, fieldId);
      setCustomFields(customFields.filter(f => f.id !== fieldId));
      toast({ type: 'success', message: 'Field deleted' });
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    }
  };

  const buildUpdateData = () => {
    const sanitized = sanitizeManageEventInput(getValidationInput());
    const sanitizedFaqs = sanitized.faqs.filter(
      (faq) => faq.question.trim() && faq.answer.trim(),
    );
    const sanitizedSocialMediaLinks = Object.fromEntries(
      Object.entries(sanitized.socialMediaLinks).filter(([, value]) => value),
    );
    const sanitizedResources = sanitized.resources
      .map((resource) => ({
        ...resource,
        estimatedCost: getResourceTotal(resource),
      }))
      .filter(
        (resource) =>
          resource.type.trim().length > 0 || resource.description.trim().length > 0,
      );

    const updateData: any = {
      // Step 1: Basic Info
      description: sanitized.description.trim(),
      longDescription: sanitized.longDescription.trim() || null,
      venue: sanitized.venue.trim(),
      maxCapacity: sanitized.maxCapacity ? Number(sanitized.maxCapacity) : null,
      registrationStartDate: sanitized.registrationStartDate || null,
      registrationEndDate: sanitized.registrationEndDate || null,
      bannerImageUrl: bannerImageUrl || null,
      logoImageUrl: sanitized.logoImageUrl || null,
      contactPersonName: sanitized.contactPersonName.trim() || null,
      contactEmail: sanitized.contactEmail.trim() || null,
      contactMobile: sanitized.contactMobile.trim() || null,
      alternateContact: sanitized.alternateContact.trim() || null,
      websiteUrl: sanitized.websiteUrl.trim() || null,
      socialMediaLinks: Object.keys(sanitizedSocialMediaLinks).length > 0 ? sanitizedSocialMediaLinks : null,
      eligibilityCriteria: sanitized.eligibilityCriteria.trim() || null,
      rulesAndGuidelines: sanitized.rulesAndGuidelines.trim() || null,
      prizeDetails: sanitized.prizeDetails.trim() || null,
      certificateAvailable,
      faqs: sanitizedFaqs.length > 0 ? sanitizedFaqs : null,

      // Step 2: Participation & Team Settings
      opportunityMode: opportunityMode as OpportunityMode,
      participationType,
      minTeamSize: participationType === 'team' ? (Number(minTeamSize) || null) : null,
      maxTeamSize: participationType === 'team' ? (Number(maxTeamSize) || null) : null,
      maxTeamLimit: participationType === 'team' ? (maxTeamLimit ? Number(maxTeamLimit) : null) : null,
      interCollegeAllowed: participationType === 'team' ? interCollegeAllowed : null,
      interSpecializationAllowed: participationType === 'team' ? interSpecializationAllowed : null,
      allowCrossInstituteTeams: participationType === 'team' ? allowCrossInstituteTeams : null,
      allowTeamEditAfterSubmission: participationType === 'team' ? allowTeamEditAfterSubmission : null,
      autoApproveTeams: participationType === 'team' ? autoApproveTeams : null,
      teamRegistrationDeadline: participationType === 'team' && teamRegistrationDeadline ? teamRegistrationDeadline : null,

      // Registration Control Settings
      autoApproveRegistration,
      registrationCap: registrationCap ? Number(registrationCap) : null,
      showParticipantsPublicly,
      allowWithdrawRegistration,
      allowEditAfterSubmission,
      lockTeamAfterDeadline: participationType === 'team' ? lockTeamAfterDeadline : null,

      // Team Discovery Settings
      lookingForTeammatesEnabled: participationType === 'team' ? lookingForTeammatesEnabled : null,
      allowPublicTeamListing: participationType === 'team' ? allowPublicTeamListing : null,
      allowJoinRequests: participationType === 'team' ? allowJoinRequests : null,
      allowInviteSystem: participationType === 'team' ? allowInviteSystem : null,

      // Step 3: Prizes
      prizesEnabled,
      requireFormSubmission,

      // Extended fields (from Noting)
      approxCapacity: approxCapacity ? Number(approxCapacity) : null,
      dutyLeaveAvailable: dutyLeaveAvailable ?? null,
      dutyLeaveEligibility: dutyLeaveEligibility.length > 0 ? dutyLeaveEligibility : null,
      dutyLeaveRoleType: dutyLeaveRoleType ?? null,
      hasSponsorship: hasSponsorship ?? null,
      sponsors: hasSponsorship && sponsors.length > 0 ? sponsors : null,
      showSponsorshipPublicly: hasSponsorship && sponsors.length > 0 ? showSponsorshipPublicly : false,
      hasResources: hasResources ?? null,
      resources: hasResources && sanitizedResources.length > 0 ? sanitizedResources : null,
    };
    // Fee is locked when from noting — do NOT override it via update payload
    if (event?.paymentType === 'paid' && !event?.notingId) {
      if (participationType === 'team') {
        updateData.teamRegistrationFee = teamRegistrationFee ? Number(teamRegistrationFee) : null;
      } else {
        updateData.registrationFee = registrationFee ? Number(registrationFee) : null;
      }
    }
    return updateData;
  };

  const validateForm = (forPublish = false): boolean => {
    setSubmitAttempted(true);
    const errors = runValidation(forPublish);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstError(errors);
      const firstMessage = Object.values(errors)[0];
      if (firstMessage) {
        toast({ type: 'error', message: firstMessage });
      }
      return false;
    }
    if (event?.paymentType === 'paid') {
      if (participationType === 'team') {
        const fee = Number(teamRegistrationFee);
        if (!teamRegistrationFee && teamRegistrationFee !== 0) { toast({ type: 'error', message: 'Participation fee must be at least ₹1.' }); return false; }
        if (isNaN(fee) || fee < 1) { toast({ type: 'error', message: 'Participation fee must be at least ₹1.' }); return false; }
      } else {
        const fee = Number(registrationFee);
        if (!registrationFee && registrationFee !== 0) { toast({ type: 'error', message: 'Participation fee must be at least ₹1.' }); return false; }
        if (isNaN(fee) || fee < 1) { toast({ type: 'error', message: 'Participation fee must be at least ₹1.' }); return false; }
      }
    }
    return true;
  };

  const handleNextStep = () => {
    const errors = runValidation(false);
    const stepFields = currentStep === 1
      ? ['description', 'longDescription', 'registrationFee', 'teamRegistrationFee', 'registrationStartDate', 'registrationEndDate', 'contactPersonName', 'contactEmail', 'contactMobile']
      : currentStep === 2
        ? ['opportunityMode', 'minTeamSize', 'maxTeamSize']
        : [];
    const stepErrors = Object.fromEntries(
      Object.entries(errors).filter(([field]) => stepFields.includes(field))
    );

    setSubmitAttempted(true);
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const field of stepFields) {
        delete next[field];
      }
      return { ...next, ...stepErrors };
    });

    if (Object.keys(stepErrors).length > 0) {
      toast({ type: 'error', message: 'Please fill the required fields before going to the next step.' });
      scrollToFirstError(stepErrors);
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
  };

  const handleSave = async () => {
    if (!event) return;
    if (!validateForm(false)) return;

    try {
      setSaving(true);
      const updated = await eventService.updateEvent(eventId, buildUpdateData());
      
      // Save prizes if enabled
      if (!isPrizeConfigLocked && prizesEnabled && prizes.length > 0) {
        await eventService.bulkUpsertPrizes(eventId, prizes);
      }
      
      setEvent(updated);
      // Re-sync sponsors from API response to persist savedAt/originalSnapshot
      if (Array.isArray(updated.sponsors)) setSponsors(updated.sponsors);
      toast({ type: 'success', message: 'Event saved successfully' });
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!event) return;
    if (!validateForm(true)) return;

    try {
      setPublishing(true);
      // Save first
      await eventService.updateEvent(eventId, buildUpdateData());
      
      // Save prizes if enabled
      if (!isPrizeConfigLocked && prizesEnabled && prizes.length > 0) {
        await eventService.bulkUpsertPrizes(eventId, prizes);
      }
      
      // Then publish
      const published = await eventService.publishEvent(eventId);
      setEvent(published);
      toast({ type: 'success', message: 'Event published successfully! It is now visible to everyone.' });
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setPublishing(false);
    }
  };

  // --- Loading ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center">
        <PageSkeleton message="Loading event..." />
      </div>
    );
  }

  // --- Not Found ---
  if (!event) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-ev-900 dark:text-white mb-1">Event Not Found</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">The event you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/events" className="inline-flex items-center gap-2 px-5 py-2.5 bg-ev-700 text-white text-sm font-medium rounded-md hover:bg-ev-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Events
          </Link>
        </div>
      </div>
    );
  }

  // --- Design tokens (matching Noting UI) ---
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">{children}</h3>
  );

  const sectionClass = 'border-t border-slate-200/80 dark:border-gray-700/80 pt-6';

  const inputClass = 'w-full px-3 py-2.5 text-sm border border-[#b3cde0] dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-ev-900 dark:text-white focus:ring-1 focus:ring-ev-700 focus:border-ev-700 outline-none';
  const inputErrClass = (field: string) => fieldErrors[field] ? 'border-red-400 dark:border-red-500 focus:ring-red-400 focus:border-red-400' : '';
  const FieldError = ({ field }: { field: string }) => fieldErrors[field] ? (
    <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" />{fieldErrors[field]}</p>
  ) : null;

  const radioClass = (active: boolean) =>
    `flex items-center gap-2.5 p-3 border rounded-md cursor-pointer transition-colors ${active ? 'border-[#b3cde0] bg-ev-50/50 dark:bg-ev-900/10' : 'border-[#b3cde0] dark:border-gray-600 hover:border-gray-300'}`;

  const checkboxClass = (active: boolean) =>
    `flex items-center gap-3 p-2.5 border rounded-md cursor-pointer transition-colors ${active ? 'border-[#b3cde0] bg-ev-50/50 dark:bg-ev-900/10' : 'border-[#b3cde0] dark:border-gray-600 hover:border-gray-300'}`;

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    published: 'bg-ev-50 text-ev-800 dark:bg-ev-900/20 dark:text-ev-200',
    ongoing: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    completed: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
    cancelled: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  };

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 py-6 px-4">
      <div className="max-w-[1280px] mx-auto">
        {/* Navigation */}
        <Link
          href="/events/my-events"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-ev-700 transition-colors mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Events
        </Link>

        {/* ===== A4 Document Sheet ===== */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-[#b3cde0] dark:border-gray-700 shadow-ev overflow-hidden">

          {/* ── Document Header ── */}
          <div className="border-b border-[#b3cde0] dark:border-gray-700 px-4 sm:px-8 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-ev-900 dark:text-white">Event Update</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Update event details and configuration. Locked fields were set during noting approval.
                </p>
              </div>
              <span className={`px-3 py-1.5 rounded-md text-xs font-semibold shrink-0 ${statusColors[event.status] || statusColors.draft}`}>
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
              </span>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-ev-50 dark:bg-ev-900/20 border border-ev-200 dark:border-ev-800">
              <span className="text-[10px] font-semibold text-gray-400 uppercase">Event ID</span>
              <span className="font-mono text-sm font-semibold text-ev-800 dark:text-ev-200">{event.eventId}</span>
            </div>
          </div>

          {/* ── Step Navigation ── */}
          <div className="border-b border-[#b3cde0] dark:border-gray-700 px-4 sm:px-8 py-4 bg-gray-50 dark:bg-gray-900/30">
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide">
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                return (
                  <React.Fragment key={step.id}>
                    <button
                      onClick={() => setCurrentStep(step.id)}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] ${
                        isActive ? 'bg-ev-700 text-white' : isCompleted ? 'bg-ev-100 text-ev-800 dark:bg-ev-900/20 dark:text-ev-200' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      <span>{step.name}</span>
                    </button>
                    {idx < STEPS.length - 1 && <div className={`h-0.5 w-8 ${currentStep > step.id ? 'bg-ev-400' : 'bg-gray-200 dark:bg-gray-600'}`} />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* ── Document Body ── */}
          <div className="px-4 sm:px-8 lg:px-10 py-6 space-y-0">

            {/* ====== STEP 1: Basic Information ====== */}
            {currentStep === 1 && (
              <>
            {/* ====== Locked Fields (from Noting) ====== */}
            <section className={sectionClass}>
              <SectionLabel>Locked Fields (from Noting)</SectionLabel>
              <div className="bg-gray-50 dark:bg-gray-900/20 rounded-md border border-[#b3cde0] dark:border-gray-700 p-4">
                <div className="flex items-start gap-2 mb-3">
                  <Lock className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    These fields were set during noting approval and cannot be modified.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-gray-400 font-medium min-w-[80px]">Name:</span>
                    <span className="text-ev-900 dark:text-white font-medium">{event.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 font-medium min-w-[80px]">Type:</span>
                    <span className="text-ev-900 dark:text-white capitalize">{event.eventType}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 font-medium min-w-[80px]">Start:</span>
                    <span className="text-ev-900 dark:text-white">
                      {new Date(event.startDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 font-medium min-w-[80px]">End:</span>
                    <span className="text-ev-900 dark:text-white">
                      {new Date(event.endDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-gray-400 font-medium min-w-[80px]">Payment:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      event.paymentType === 'free'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                    }`}>
                      {event.paymentType.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-gray-400 font-medium min-w-[80px]">Participation:</span>
                    <span className="text-ev-900 dark:text-white capitalize">{participationType || event.participationType || 'individual'}</span>
                  </div>
                  {event.notingId && (
                    <div className="flex gap-2 items-center">
                      <span className="text-gray-400 font-medium min-w-[80px]">Noting:</span>
                      <Link href={`/noting/${event.notingId}`} className="text-ev-700 hover:text-ev-800 dark:text-ev-400 flex items-center gap-1 text-sm">
                        View Noting <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ====== Event Branding & Description ====== */}
            <section className={sectionClass}>
              <SectionLabel>Event Logo & Short Description</SectionLabel>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Logo */}
                <div id="field-logo">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Event Logo <span className="text-xs text-gray-400 font-normal">(Recommended: 300×300px)</span> <span className="text-red-500">*</span>
                  </label>
                  {logoPreview ? (
                    <div className="relative group rounded-md overflow-hidden border border-[#b3cde0] dark:border-gray-600 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoPreview} alt="Logo" className="w-24 h-24 object-cover" />
                      <button
                        onClick={() => handleRemoveImage('logo')}
                        type="button"
                        className="absolute top-1 right-1 p-1 bg-white/90 dark:bg-gray-800/90 text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-[#b3cde0] dark:border-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed rounded-md cursor-pointer hover:border-[#b3cde0] transition-colors ${fieldErrors.logo ? 'border-red-400' : 'border-[#b3cde0] dark:border-gray-600'}`}>
                      <Upload className="w-5 h-5 text-gray-300 mb-1" />
                      <p className="text-[10px] text-gray-400 text-center">Upload</p>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleImageUpload('logo', f); setFieldErrors(p => { const n = {...p}; delete n.logo; return n; }); } }}
                      />
                    </label>
                  )}
                  <FieldError field="logo" />
                </div>

                {/* Short Description */}
                <div id="field-description">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Short Description <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-gray-400 ml-2">(max 10 words)</span>
                  </label>
                  <div className="relative">
                    <textarea
                      value={description}
                      onChange={(e) => {
                        setDescription(clampDescription(e.target.value));
                        if (submitAttempted) blurField('description');
                      }}
                      onBlur={() => blurField('description')}
                      rows={3}
                      className={`${inputClass} ${inputErrClass('description')}`}
                      placeholder="Brief summary shown in event cards..."
                    />
                    <span className={`absolute bottom-2 right-2 text-[10px] ${countWords(description) > MAX_DESCRIPTION_WORDS ? 'text-red-500' : 'text-gray-400'}`}>
                      {countWords(description)}/{MAX_DESCRIPTION_WORDS}
                    </span>
                  </div>
                  <FieldError field="description" />
                </div>
              </div>
            </section>

            {/* ====== Event Banner ====== */}
            <section className={sectionClass}>
              <SectionLabel>Event Banner</SectionLabel>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Event Banner <span className="text-xs text-gray-400 font-normal">(Recommended: 1200×400px)</span>
                  </label>
                  {bannerPreview ? (
                    <div className="relative group rounded-md overflow-hidden border border-[#b3cde0] dark:border-gray-600">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={bannerPreview} alt="Banner" className="w-full h-40 object-cover" />
                      <button
                        onClick={() => handleRemoveImage('banner')}
                        type="button"
                        className="absolute top-2 right-2 p-1.5 bg-white/90 dark:bg-gray-800/90 text-red-500 rounded-md opacity-0 group-hover:opacity-100 transition-opacity border border-[#b3cde0] dark:border-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-[#b3cde0] dark:border-gray-600 rounded-md cursor-pointer hover:border-[#b3cde0] transition-colors">
                      <Upload className="w-6 h-6 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Click to upload banner</p>
                      <p className="text-xs text-gray-400 mt-0.5">PNG, JPG up to 5MB</p>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload('banner', f); }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </section>

            {/* ====== Description ====== */}
            <section className={sectionClass}>
              <SectionLabel>Detailed Description</SectionLabel>
              <div className="space-y-4">
                <div id="field-longDescription">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Detailed Description <span className="text-red-500">*</span>
                  </label>
                  <div className={`noting-description-editor border rounded-md bg-white dark:bg-gray-700 transition-colors ${fieldErrors.longDescription ? 'border-red-400 dark:border-red-500' : 'border-[#b3cde0] dark:border-gray-600 focus-within:border-ev-700'}`}>
                    {typeof window !== 'undefined' && ReactQuill && (
                      <ReactQuill
                        theme="snow"
                        value={longDescription}
                        onChange={(v) => { setLongDescription(v); if (submitAttempted) blurField('longDescription'); }}
                        onBlur={() => blurField('longDescription')}
                        modules={quillModules}
                        className="noting-quill-editor"
                        placeholder="Provide comprehensive event details, agenda, highlights..."
                      />
                    )}
                  </div>
                  <FieldError field="longDescription" />
                  {!fieldErrors.longDescription && <p className="text-xs text-gray-400 mt-1.5">Use formatting to make content engaging and readable</p>}
                </div>
              </div>
            </section>

            {/* ====== Venue & Capacity ====== */}
            <section className={sectionClass}>
              <SectionLabel>Venue & Capacity</SectionLabel>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Venue <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) =>
                      setVenue(
                        sanitizePlainTextInput(e.target.value, {
                          maxLength: 200,
                        }),
                      )
                    }
                    className={inputClass}
                    placeholder="e.g., Main Auditorium, Seminar Hall 1"
                    required
                  />
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Maximum Capacity
                    </label>
                    <input
                      type="number"
                      value={maxCapacity}
                      onChange={(e) => setMaxCapacity(e.target.value ? Number(e.target.value) : '')}
                      min="1"
                      className={inputClass}
                      placeholder="Leave empty for unlimited"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Approx. Capacity <span className="text-xs text-gray-400 font-normal">(editable)</span>
                    </label>
                    <input
                      type="number"
                      value={approxCapacity}
                      onChange={(e) => setApproxCapacity(e.target.value ? Number(e.target.value) : '')}
                      min="1"
                      className={inputClass}
                      placeholder="Informational only"
                    />
                  </div>
                  {event.paymentType === 'paid' && participationType === 'individual' && (
                    <div id="field-registrationFee">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                        Registration Fee (₹) <span className="text-red-500">*</span>
                        {event.notingId && <Lock className="w-3.5 h-3.5 text-amber-500" />}
                      </label>
                      {event.notingId ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 dark:bg-gray-700/50 border border-[#b3cde0] dark:border-gray-600 rounded-md cursor-not-allowed">
                          <IndianRupee className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="text-sm font-semibold text-ev-900 dark:text-white">{registrationFee !== '' ? registrationFee : '—'}</span>
                          <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto">Locked from Noting</span>
                        </div>
                      ) : (
                        <input
                          type="number"
                          value={registrationFee}
                          onChange={(e) => setRegistrationFee(e.target.value ? Number(e.target.value) : '')}
                          min="1"
                          className={inputClass}
                          placeholder="Amount in INR"
                          required
                        />
                      )}
                      {!event.notingId && registrationFee !== '' && Number(registrationFee) < 1 && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" />Participation fee must be at least ₹1.</p>
                      )}
                    </div>
                  )}
                  {event.paymentType === 'paid' && participationType === 'team' && (
                    <div id="field-teamRegistrationFee">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                        Team Registration Fee (₹) <span className="text-red-500">*</span>
                        {event.notingId && <Lock className="w-3.5 h-3.5 text-amber-500" />}
                      </label>
                      {event.notingId ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 dark:bg-gray-700/50 border border-[#b3cde0] dark:border-gray-600 rounded-md cursor-not-allowed">
                          <IndianRupee className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="text-sm font-semibold text-ev-900 dark:text-white">{teamRegistrationFee !== '' ? teamRegistrationFee : '—'}</span>
                          <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto">Locked from Noting</span>
                        </div>
                      ) : (
                        <input
                          type="number"
                          value={teamRegistrationFee}
                          onChange={(e) => setTeamRegistrationFee(e.target.value ? Number(e.target.value) : '')}
                          min="1"
                          className={inputClass}
                          placeholder="Per team amount in INR"
                          required
                        />
                      )}
                      {!event.notingId && teamRegistrationFee !== '' && Number(teamRegistrationFee) < 1 && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" />Participation fee must be at least ₹1.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ====== Additional Details (from Noting) ====== */}
            <section className={sectionClass}>
              <SectionLabel>Additional Details (from Noting)</SectionLabel>
              {event.notingId && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Duty Leave, Sponsorship, and Resources were set during noting approval and cannot be changed. Approx. Capacity remains editable.
                  </p>
                </div>
              )}
              <div className="space-y-4">
                {/* Duty Leave */}
                <div className={event.notingId ? 'opacity-90' : ''}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Duty Leave</label>
                  <div className="flex gap-4">
                    <label className={`${checkboxClass(dutyLeaveAvailable === true)} ${event.notingId ? 'cursor-not-allowed' : ''}`}>
                      <input type="radio" checked={dutyLeaveAvailable === true} onChange={() => !event.notingId && setDutyLeaveAvailable(true)} disabled={!!event.notingId} className="sr-only" />
                      <span>Yes</span>
                    </label>
                    <label className={`${checkboxClass(dutyLeaveAvailable === false)} ${event.notingId ? 'cursor-not-allowed' : ''}`}>
                      <input type="radio" checked={dutyLeaveAvailable === false} onChange={() => { if (!event.notingId) { setDutyLeaveAvailable(false); setDutyLeaveEligibility([]); setDutyLeaveRoleType(null); } }} disabled={!!event.notingId} className="sr-only" />
                      <span>No</span>
                    </label>
                  </div>
                  {dutyLeaveAvailable && (
                    <div className="mt-2 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {([{ value: 'ug', label: 'UG' }, { value: 'pg', label: 'PG' }, { value: 'phd', label: 'PhD' }] as const).map((opt) => {
                          const checked = dutyLeaveEligibility.includes(opt.value);
                          return (
                            <label key={opt.value} className={`flex items-center gap-1.5 text-sm ${event.notingId ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => !event.notingId && setDutyLeaveEligibility(prev => checked ? prev.filter(x => x !== opt.value) : [...prev, opt.value])}
                                disabled={!!event.notingId}
                                className="w-4 h-4 text-ev-700 rounded disabled:cursor-not-allowed"
                              />
                              <span>{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Role Type</p>
                        <div className="flex flex-wrap gap-2">
                          {([{ value: 'participants', label: 'Participants' }, { value: 'organizers', label: 'Organizers' }, { value: 'both', label: 'Both' }] as const).map((opt) => (
                            <label key={opt.value} className={`flex items-center gap-1.5 text-sm ${event.notingId ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input
                                type="radio"
                                checked={dutyLeaveRoleType === opt.value}
                                onChange={() => !event.notingId && setDutyLeaveRoleType(opt.value)}
                                disabled={!!event.notingId}
                                className="w-4 h-4 text-ev-700 disabled:cursor-not-allowed"
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sponsorship */}
                <div className={event.notingId ? 'opacity-90' : ''}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sponsorship</label>
                  <div className="flex gap-4">
                    <label className={`${checkboxClass(hasSponsorship === true)} ${event.notingId ? 'cursor-not-allowed' : ''}`}>
                      <input type="radio" checked={hasSponsorship === true} onChange={() => !event.notingId && setHasSponsorship(true)} disabled={!!event.notingId} className="sr-only" />
                      <span>Yes</span>
                    </label>
                    <label className={`${checkboxClass(hasSponsorship === false)} ${event.notingId ? 'cursor-not-allowed' : ''}`}>
                      <input type="radio" checked={hasSponsorship === false} onChange={() => { if (!event.notingId) { setHasSponsorship(false); setSponsors([]); } }} disabled={!!event.notingId} className="sr-only" />
                      <span>No</span>
                    </label>
                  </div>
                  {hasSponsorship && (
                    <div className="mt-2 space-y-2">
                      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showSponsorshipPublicly}
                          onChange={(e) => setShowSponsorshipPublicly(e.target.checked)}
                          className="w-4 h-4 text-ev-700 rounded"
                        />
                        Show sponsorship to users on event page (creator decides at publish)
                      </label>
                      <SponsorshipManager
                        sponsors={sponsors as SponsorData[]}
                        onChange={setSponsors}
                        notingLocked={!!event.notingId}
                        onUploadReceipt={handleSponsorReceiptUpload}
                        searchEmployees={handleSponsorSearchEmployees}
                        onSponsorSaved={handleSponsorSaved}
                      />
                    </div>
                  )}
                </div>

                {/* Resources */}
                <div className={event.notingId ? 'opacity-90' : ''}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resources</label>
                  <div className="flex gap-4">
                    <label className={`${checkboxClass(hasResources === true)} ${event.notingId ? 'cursor-not-allowed' : ''}`}>
                      <input type="radio" checked={hasResources === true} onChange={() => !event.notingId && setHasResources(true)} disabled={!!event.notingId} className="sr-only" />
                      <span>Yes</span>
                    </label>
                    <label className={`${checkboxClass(hasResources === false)} ${event.notingId ? 'cursor-not-allowed' : ''}`}>
                      <input type="radio" checked={hasResources === false} onChange={() => { if (!event.notingId) { setHasResources(false); setResources([]); } }} disabled={!!event.notingId} className="sr-only" />
                      <span>No</span>
                    </label>
                  </div>
                  {hasResources && (
                    <div className="mt-4 animate-in fade-in slide-in-from-top-1">
                      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                              <tr>
                                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Resource / Item</th>
                                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Description</th>
                                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-32">Price/Unit</th>
                                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-24">Qty</th>
                                <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-32">Total</th>
                                <th className="px-4 py-3 w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800/50">
                              {resources.map((resource, index) => {
                                const computedCost = getResourceTotal(resource);
                                return (
                                  <tr key={index} className="group transition-colors even:bg-gray-50/30 hover:bg-gray-50/50 dark:even:bg-gray-800/30 dark:hover:bg-gray-700/20">
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={resource.type}
                                        onChange={(e) => updateResourceField(index, 'type', e.target.value)}
                                        placeholder="e.g. Mic, Podium"
                                        disabled={!!event.notingId}
                                        className={`${inputClass} disabled:cursor-not-allowed`}
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={resource.description}
                                        onChange={(e) => updateResourceField(index, 'description', e.target.value)}
                                        placeholder="Details..."
                                        disabled={!!event.notingId}
                                        className={`${inputClass} disabled:cursor-not-allowed`}
                                      />
                                    </td>
                                    <td className="p-2">
                                      <div className="relative">
                                        <IndianRupee className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                                        <input
                                          type="number"
                                          min={0}
                                          value={resource.pricePerPiece ?? ''}
                                          onChange={(e) => updateResourceField(index, 'pricePerPiece', e.target.value === '' ? undefined : Number(e.target.value))}
                                          placeholder="0"
                                          disabled={!!event.notingId}
                                          className={`${inputClass} pl-8 disabled:cursor-not-allowed`}
                                        />
                                      </div>
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        min={1}
                                        value={resource.quantity ?? ''}
                                        onChange={(e) => updateResourceField(index, 'quantity', e.target.value === '' ? undefined : Number(e.target.value))}
                                        placeholder="1"
                                        disabled={!!event.notingId}
                                        className={`${inputClass} disabled:cursor-not-allowed`}
                                      />
                                    </td>
                                    <td className="p-2">
                                      <div className="rounded-lg bg-gray-50 px-3 py-2 text-right text-sm font-semibold text-gray-700 dark:bg-gray-700/50 dark:text-gray-300">
                                        {computedCost != null ? `Rs. ${Number(computedCost).toLocaleString('en-IN')}` : '-'}
                                      </div>
                                    </td>
                                    <td className="p-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => removeResourceAt(index)}
                                        disabled={!!event.notingId}
                                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:hover:bg-red-900/20"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                              {resources.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                                    No resources added yet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                            {resources.length > 0 && (
                              <tfoot className="border-t border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50">
                                <tr>
                                  <td colSpan={4} className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">
                                    Total Estimated Cost
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                                    Rs. {resources.reduce((sum, resource) => sum + (getResourceTotal(resource) ?? 0), 0).toLocaleString('en-IN')}
                                  </td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addResourceRow}
                        disabled={!!event.notingId}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-sm font-medium text-gray-500 transition-all hover:border-ev-400 hover:bg-ev-50/70 hover:text-ev-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:hover:bg-ev-900/20"
                      >
                        <Plus className="h-4 w-4" /> Add Resource
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ====== Registration Period ====== */}
            <section className={sectionClass}>
              <SectionLabel>Registration Period</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div id="field-registrationStartDate">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Date & Time <span className="text-red-500">*</span></label>
                  <input
                    type="datetime-local"
                    value={registrationStartDate}
                    onChange={(e) => { setRegistrationStartDate(e.target.value); if (submitAttempted) blurField('registrationStartDate'); }}
                    onBlur={() => { if (submitAttempted) blurField('registrationStartDate'); }}
                    max={new Date(event.startDate).toISOString().slice(0, 16)}
                    className={`${inputClass} ${inputErrClass('registrationStartDate')}`}
                  />
                  <FieldError field="registrationStartDate" />
                </div>
                <div id="field-registrationEndDate">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Date & Time <span className="text-red-500">*</span></label>
                  <input
                    type="datetime-local"
                    value={registrationEndDate}
                    onChange={(e) => { setRegistrationEndDate(e.target.value); if (submitAttempted) blurField('registrationEndDate'); }}
                    onBlur={() => { if (submitAttempted) blurField('registrationEndDate'); }}
                    min={registrationStartDate}
                    max={new Date(event.startDate).toISOString().slice(0, 16)}
                    className={`${inputClass} ${inputErrClass('registrationEndDate')}`}
                  />
                  <FieldError field="registrationEndDate" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Registration must close before event starts ({new Date(event.startDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}).</p>
            </section>

            {/* ====== Contact & Communication ====== */}
            <section className={sectionClass}>
              <SectionLabel>Contact & Communication</SectionLabel>
              <div className="space-y-4">
                <div id="field-contactPersonName">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact Person Name <span className="text-red-500">*</span></label>
                  <input type="text" value={contactPersonName}
                    onChange={(e) => {
                      setContactPersonName(
                        sanitizePlainTextInput(e.target.value, {
                          maxLength: 120,
                        }),
                      );
                      if (submitAttempted) blurField('contactPersonName');
                    }}
                    onBlur={() => blurField('contactPersonName')}
                    className={`${inputClass} ${inputErrClass('contactPersonName')}`} placeholder="Full name of event coordinator" />
                  <FieldError field="contactPersonName" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div id="field-contactEmail">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact Email <span className="text-red-500">*</span></label>
                    <input type="email" value={contactEmail}
                      onChange={(e) => {
                        setContactEmail(sanitizeEmailInput(e.target.value));
                        if (submitAttempted) blurField('contactEmail');
                      }}
                      onBlur={() => blurField('contactEmail')}
                      className={`${inputClass} ${inputErrClass('contactEmail')}`} placeholder="contact@example.com" />
                    <FieldError field="contactEmail" />
                  </div>
                  <div id="field-contactMobile">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact Mobile</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={MAX_CONTACT_MOBILE_DIGITS}
                      value={contactMobile}
                      onChange={(e) => {
                        setContactMobile(normalizeContactMobile(e.target.value));
                        if (submitAttempted) blurField('contactMobile');
                      }}
                      onBlur={() => blurField('contactMobile')}
                      className={`${inputClass} ${inputErrClass('contactMobile')}`}
                      placeholder="10 digit mobile number"
                    />
                    <FieldError field="contactMobile" />
                  </div>
                </div>
              </div>
            </section>

            {/* ====== Additional Details ====== */}
            <section className={sectionClass}>
              <SectionLabel>Additional Details</SectionLabel>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Eligibility Criteria</label>
                  <textarea value={eligibilityCriteria} onChange={(e) => setEligibilityCriteria(sanitizePlainTextInput(e.target.value, { maxLength: 2000 }))} rows={2} className={inputClass} placeholder="Who can participate?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Rules & Guidelines</label>
                  <textarea value={rulesAndGuidelines} onChange={(e) => setRulesAndGuidelines(sanitizePlainTextInput(e.target.value, { maxLength: 4000 }))} rows={2} className={inputClass} placeholder="Event rules..." />
                </div>
                <label className={`${checkboxClass(certificateAvailable)} ${event?.notingId ? 'opacity-75 cursor-not-allowed' : ''}`}>
                  <input type="checkbox" checked={certificateAvailable} onChange={(e) => !event?.notingId && setCertificateAvailable(e.target.checked)} disabled={!!event?.notingId} className="w-4 h-4 text-ev-700 rounded focus:ring-ev-700 disabled:cursor-not-allowed" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Certificates will be provided</span>
                  {event?.notingId && <Lock className="w-3.5 h-3.5 text-amber-500 ml-1" />}
                </label>
              </div>
            </section>

            {/* ====== FAQs (Step 1) ====== */}
            <section className={sectionClass}>
              <SectionLabel>FAQs (Optional)</SectionLabel>
              {faqs.length > 0 && (
                <div className="space-y-2 mb-3">
                  {faqs.map((faq, i) => (
                    <div key={i} className="rounded-md border border-[#b3cde0] dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 p-3 space-y-2">
                      <input type="text" value={faq.question} onChange={(e) => updateFAQ(i, 'question', e.target.value)} className={inputClass} placeholder="Question" />
                      <textarea value={faq.answer} onChange={(e) => updateFAQ(i, 'answer', e.target.value)} rows={2} className={inputClass} placeholder="Answer" />
                      <button onClick={() => removeFAQ(i)} type="button" className="p-1.5 text-gray-300 hover:text-red-500 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={addFAQ} type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ev-700 hover:bg-ev-50 rounded-md transition-colors"><Plus className="w-4 h-4" /> Add FAQ</button>
            </section>
              </>
            )}

            {/* ====== STEP 2: Participation & Team Settings ====== */}
            {currentStep === 2 && (
              <>
            {/* ====== Participation & Capacity ====== */}
            {event.paymentType === 'paid' && (
              <section className={sectionClass}>
                <SectionLabel>Participation &amp; Capacity</SectionLabel>
                <div className="rounded-md border border-[#b3cde0] dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/20 border-b border-[#b3cde0]/30 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IndianRupee className="w-4 h-4 text-ev-700" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {participationType === 'team' ? 'Fee per Team (₹)' : 'Participation Fee (₹)'}
                      </span>
                      <span className="text-sm font-bold text-ev-900 dark:text-white">
                        ₹{participationType === 'team' ? (teamRegistrationFee || '—') : (registrationFee || '—')}
                      </span>
                    </div>
                    {event.notingId && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                        <Lock className="w-3.5 h-3.5" />
                        Locked from Noting
                      </div>
                    )}
                  </div>
                  {participationType === 'team' && teamRegistrationFee !== '' && maxTeamSize !== '' && Number(maxTeamSize) > 0 && (
                    <div className="px-4 py-3 bg-ev-50 dark:bg-ev-900/10 border-b border-ev-200 dark:border-ev-800">
                      <p className="text-xs text-ev-800 dark:text-ev-200 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 shrink-0" />
                        Total team fee will be equally divided among the maximum allowed team members.
                        &nbsp;<span className="font-semibold">Per-member fee: ₹{(Number(teamRegistrationFee) / Number(maxTeamSize)).toFixed(2)}</span>
                        &nbsp;(₹{teamRegistrationFee} ÷ {maxTeamSize} members)
                      </p>
                    </div>
                  )}
                  {participationType === 'team' && event.notingId && (
                    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/10">
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        The system will not exceed the approved total team fee of ₹{teamRegistrationFee} under any condition.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ====== Participation & Mode ====== */}
            <section className={sectionClass}>
              <SectionLabel>Participation & Mode</SectionLabel>
              {event.notingId && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Participation Type was set during noting approval and cannot be changed.
                  </p>
                </div>
              )}
              <div className="rounded-md border border-[#b3cde0] dark:border-gray-700 overflow-hidden">
                {/* Side by Side: Participation Type + Opportunity Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-200 dark:bg-gray-600">
                  {/* Participation Type */}
                  <div className={`bg-white dark:bg-gray-800 p-4 ${event.notingId ? 'opacity-90' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Participation Type</label>
                    <div className="flex flex-col gap-2">
                      <label className={`${radioClass(participationType === 'individual')} ${event.notingId ? 'cursor-not-allowed opacity-75' : ''}`}>
                        <input type="radio" name="participationType" checked={participationType === 'individual'} onChange={() => !event.notingId && setParticipationType('individual')} disabled={!!event.notingId} className="w-4 h-4 text-ev-700 focus:ring-ev-700 disabled:cursor-not-allowed" />
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium">Individual</span>
                        </div>
                      </label>
                      <label className={`${radioClass(participationType === 'team')} ${event.notingId ? 'cursor-not-allowed opacity-75' : ''}`}>
                        <input type="radio" name="participationType" checked={participationType === 'team'} onChange={() => !event.notingId && setParticipationType('team')} disabled={!!event.notingId} className="w-4 h-4 text-ev-700 focus:ring-ev-700 disabled:cursor-not-allowed" />
                        <div className="flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium">Team</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Opportunity Mode */}
                  <div id="field-opportunityMode" className="bg-white dark:bg-gray-800 p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mode of Opportunity <span className="text-red-500">*</span>
                    </label>
                    <div className={`flex flex-col gap-2 rounded-md ${fieldErrors.opportunityMode ? 'ring-1 ring-red-400 rounded-md p-1' : ''}`}>
                      {(['online', 'offline', 'hybrid'] as OpportunityMode[]).map((mode) => (
                        <label key={mode} className={radioClass(opportunityMode === mode)}>
                          <input type="radio" name="opportunityMode" checked={opportunityMode === mode}
                            onChange={() => { setOpportunityMode(mode); setFieldErrors(p => { const n = {...p}; delete n.opportunityMode; return n; }); }}
                            className="w-4 h-4 text-ev-700 focus:ring-ev-700" />
                          <span className="text-sm font-medium capitalize">{mode}</span>
                        </label>
                      ))}
                    </div>
                    <FieldError field="opportunityMode" />
                  </div>
                </div>

                {/* Team Configuration (Conditional) */}
                {participationType === 'team' && (
                  <div className="p-4 border-t border-[#b3cde0] dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Team Configuration
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div id="field-minTeamSize">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Min Team Size <span className="text-red-500">*</span></label>
                        <input type="number" value={minTeamSize} onChange={(e) => setMinTeamSize(e.target.value ? Number(e.target.value) : '')} min="1" className={inputClass} placeholder="e.g., 2" />
                      </div>
                      <div id="field-maxTeamSize">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Max Team Size <span className="text-red-500">*</span></label>
                        <input type="number" value={maxTeamSize} onChange={(e) => setMaxTeamSize(e.target.value ? Number(e.target.value) : '')} min="1" className={inputClass} placeholder="e.g., 5" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Max Teams Allowed</label>
                        <input type="number" value={maxTeamLimit} onChange={(e) => setMaxTeamLimit(e.target.value ? Number(e.target.value) : '')} min="1" className={inputClass} placeholder="Unlimited" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Team Registration Deadline</label>
                      <input type="date" value={teamRegistrationDeadline} onChange={(e) => setTeamRegistrationDeadline(e.target.value)} className={inputClass} />
                    </div>
                    {event.paymentType === 'paid' && teamRegistrationFee !== '' && maxTeamSize !== '' && Number(maxTeamSize) > 0 && (
                      <div className="mt-3 px-3 py-2 rounded-md bg-ev-50 dark:bg-ev-900/20 border border-ev-200 dark:border-ev-800">
                        <p className="text-xs text-ev-800 dark:text-ev-200 flex items-center gap-1.5">
                          <IndianRupee className="w-3.5 h-3.5 shrink-0" />
                          Total team fee ₹{teamRegistrationFee} will be equally divided among {maxTeamSize} members.
                          &nbsp;<span className="font-semibold">Per-member: ₹{(Number(teamRegistrationFee) / Number(maxTeamSize)).toFixed(2)}</span>.
                          No participant will be charged more than this amount.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <label className={checkboxClass(allowCrossInstituteTeams)}>
                        <input type="checkbox" checked={allowCrossInstituteTeams} onChange={(e) => setAllowCrossInstituteTeams(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Allow Cross-Institute Teams</span>
                      </label>
                      <label className={checkboxClass(interCollegeAllowed)}>
                        <input type="checkbox" checked={interCollegeAllowed} onChange={(e) => setInterCollegeAllowed(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Allow Inter-College Teams</span>
                      </label>
                      <label className={checkboxClass(allowTeamEditAfterSubmission)}>
                        <input type="checkbox" checked={allowTeamEditAfterSubmission} onChange={(e) => setAllowTeamEditAfterSubmission(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Allow Team Edit After Submission</span>
                      </label>
                      <label className={checkboxClass(autoApproveTeams)}>
                        <input type="checkbox" checked={autoApproveTeams} onChange={(e) => setAutoApproveTeams(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Auto-approve Teams</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ====== Registration Control Settings ====== */}
            <section className={sectionClass}>
              <SectionLabel>Registration Control Settings</SectionLabel>
              <div className="rounded-md border border-[#b3cde0] dark:border-gray-700 p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Registration Cap (Overall Limit)</label>
                    <input type="number" value={registrationCap} onChange={(e) => setRegistrationCap(e.target.value ? Number(e.target.value) : '')} min="1" className={inputClass} placeholder="Leave empty for unlimited" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={checkboxClass(autoApproveRegistration)}>
                    <input type="checkbox" checked={autoApproveRegistration} onChange={(e) => setAutoApproveRegistration(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Auto-approve Registrations</span>
                  </label>
                  <label className={checkboxClass(showParticipantsPublicly)}>
                    <input type="checkbox" checked={showParticipantsPublicly} onChange={(e) => setShowParticipantsPublicly(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Show Participants Publicly</span>
                  </label>
                  <label className={checkboxClass(allowWithdrawRegistration)}>
                    <input type="checkbox" checked={allowWithdrawRegistration} onChange={(e) => setAllowWithdrawRegistration(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Allow Withdraw Registration</span>
                  </label>
                  <label className={checkboxClass(allowEditAfterSubmission)}>
                    <input type="checkbox" checked={allowEditAfterSubmission} onChange={(e) => setAllowEditAfterSubmission(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Allow Edit After Submission</span>
                  </label>
                  {participationType === 'team' && (
                    <label className={checkboxClass(lockTeamAfterDeadline)}>
                      <input type="checkbox" checked={lockTeamAfterDeadline} onChange={(e) => setLockTeamAfterDeadline(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Lock Team After Deadline</span>
                    </label>
                  )}
                </div>
              </div>
            </section>

            {/* ====== Team Discovery Settings ====== */}
            {participationType === 'team' && (
              <section className={sectionClass}>
                <SectionLabel>Team Discovery Settings</SectionLabel>
                <div className="rounded-md border border-[#b3cde0] dark:border-gray-700 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className={checkboxClass(lookingForTeammatesEnabled)}>
                      <input type="checkbox" checked={lookingForTeammatesEnabled} onChange={(e) => setLookingForTeammatesEnabled(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Enable &quot;Looking for Teammates&quot;</span>
                    </label>
                    <label className={checkboxClass(allowPublicTeamListing)}>
                      <input type="checkbox" checked={allowPublicTeamListing} onChange={(e) => setAllowPublicTeamListing(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Allow Public Team Listing</span>
                    </label>
                    <label className={checkboxClass(allowJoinRequests)}>
                      <input type="checkbox" checked={allowJoinRequests} onChange={(e) => setAllowJoinRequests(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Allow Join Requests</span>
                    </label>
                    <label className={checkboxClass(allowInviteSystem)}>
                      <input type="checkbox" checked={allowInviteSystem} onChange={(e) => setAllowInviteSystem(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Allow Invite System</span>
                    </label>
                  </div>
                </div>
              </section>
            )}
              </>
            )}

            {/* ====== STEP 3: Prizes & Custom Questions ====== */}
            {currentStep === 3 && (
              <>
            {/* ====== Prize Configuration ====== */}
            <section className={sectionClass}>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Prize Configuration</SectionLabel>
                <label className={`flex items-center gap-2 ${isPrizeConfigLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
                  {isPrizeConfigLocked && <Lock className="w-3.5 h-3.5 text-amber-500" />}
                  <span className="text-sm text-gray-600 dark:text-gray-400">Enable Prizes</span>
                  <input type="checkbox" checked={prizesEnabled} onChange={(e) => !isPrizeConfigLocked && setPrizesEnabled(e.target.checked)} disabled={isPrizeConfigLocked} className="w-5 h-5 text-ev-700 rounded focus:ring-ev-700 disabled:cursor-not-allowed" />
                </label>
              </div>

              {prizesEnabled && (
                <div className="rounded-md border border-[#b3cde0] dark:border-gray-700 overflow-hidden">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 px-4 py-2">
                    <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />Once the event is live, prize amounts cannot be reduced.</p>
                  </div>

                  {isPrizeConfigLocked && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 px-4 py-2.5">
                      <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />These prizes were approved through noting and cannot be edited here.</p>
                    </div>
                  )}
                  
                  <div className="p-4 space-y-3">
                    {prizes.map((prize, idx) => (
                      <div key={prize.id || idx} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-[#b3cde0] dark:border-gray-600">
                        <div className="w-14 h-14 rounded-lg bg-ev-100 dark:bg-ev-900/30 flex items-center justify-center shrink-0">
                          {prize.prizeType === 'trophy' ? <Trophy className="w-6 h-6 text-ev-700" /> : prize.prizeType === 'cash' ? <IndianRupee className="w-6 h-6 text-ev-700" /> : <Award className="w-6 h-6 text-ev-700" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-ev-900 dark:text-white">{prize.rank}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{prize.prizeType === 'cash' && prize.prizeAmount ? `₹${prize.prizeAmount.toLocaleString()}` : prize.title || PRIZE_TYPE_OPTIONS.find(p => p.value === prize.prizeType)?.label || 'Prize'}</p>
                          {prize.additionalPerks && prize.additionalPerks.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {prize.additionalPerks.map((perk, i) => <span key={i} className="px-2 py-0.5 bg-ev-50 dark:bg-ev-900/20 text-ev-800 dark:text-ev-200 text-xs rounded-full">{perk}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditPrize(prize)} disabled={isPrizeConfigLocked} className="p-2 text-gray-400 hover:text-ev-700 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-gray-400"><Settings className="w-4 h-4" /></button>
                          <button onClick={() => deletePrize(prize.id!)} disabled={isPrizeConfigLocked} className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-gray-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                    
                    <button onClick={openAddPrize} disabled={isPrizeConfigLocked} className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-[#b3cde0] dark:border-gray-600 rounded-lg text-gray-500 hover:border-[#b3cde0] hover:text-ev-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-gray-500">
                      <Plus className="w-5 h-5" /><span className="font-medium">Add Prize</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* ====== Custom Registration Questions ====== */}
            <section className={sectionClass}>
              <SectionLabel>Custom Registration Questions</SectionLabel>
              <div className="rounded-md border border-[#b3cde0] dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-[#b3cde0] dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <label className={checkboxClass(requireFormSubmission)}>
                    <input type="checkbox" checked={requireFormSubmission} onChange={(e) => setRequireFormSubmission(e.target.checked)} className="w-4 h-4 text-ev-700 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Require form submission before team creation</span>
                  </label>
                </div>
                
                <div className="p-4 space-y-3">
                  {customFields.map((field, idx) => (
                    <div key={field.id || idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-[#b3cde0] dark:border-gray-600">
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                        <div>
                          <h4 className="font-medium text-ev-900 dark:text-white">{field.fieldLabel}</h4>
                          <p className="text-xs text-gray-500">{FIELD_TYPE_OPTIONS.find(t => t.value === field.fieldType)?.label || field.fieldType}{field.isRequired && <span className="ml-1 text-red-500">• Required</span>}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditField(field)} className="p-2 text-gray-400 hover:text-ev-700 transition-colors"><Settings className="w-4 h-4" /></button>
                        <button onClick={() => deleteField(field.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                  
                  <button onClick={openAddField} className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-[#b3cde0] dark:border-gray-600 rounded-lg text-gray-500 hover:border-[#b3cde0] hover:text-ev-700 transition-colors">
                    <Plus className="w-5 h-5" /><span className="font-medium">Add Question</span>
                  </button>
                </div>
              </div>
            </section>
              </>
            )}

          </div>

          {/* ── Document Footer — Action Buttons ── */}
          <div className="border-t border-[#b3cde0] dark:border-gray-700 px-4 sm:px-8 py-4 bg-gray-50 dark:bg-gray-900/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                {currentStep > 1 && (
                  <button onClick={() => setCurrentStep(currentStep - 1)} className="px-3 sm:px-4 py-2.5 min-h-[44px] border border-[#b3cde0] dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-white dark:hover:bg-gray-700 flex items-center gap-2 transition-colors">
                    <ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Previous</span>
                  </button>
                )}
                {currentStep < STEPS.length && (
                  <button onClick={handleNextStep} className="px-3 sm:px-4 py-2.5 min-h-[44px] bg-gray-700 dark:bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-800 flex items-center gap-2 transition-colors">
                    <span className="hidden sm:inline">Next</span><ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
              {currentStep === STEPS.length && (
                <div className="flex items-center gap-2 sm:gap-3">
                  <button type="button" onClick={handleSave} disabled={saving || publishing} className="px-3 sm:px-5 py-2.5 min-h-[44px] bg-ev-700 text-white text-sm font-medium rounded-md hover:bg-ev-800 disabled:opacity-50 flex items-center gap-2 transition-colors">
                    {saving ? <Skeleton className="w-4 h-4 rounded-sm" /> : <Save className="w-4 h-4" />}<span className="hidden sm:inline">Save Draft</span><span className="sm:hidden">Save</span>
                  </button>
                  <button type="button" onClick={handlePublish} disabled={saving || publishing} className="px-3 sm:px-5 py-2.5 min-h-[44px] bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
                    {publishing ? <Skeleton className="w-4 h-4 rounded-sm" /> : <CheckCircle className="w-4 h-4" />}
                    <span className="hidden sm:inline">{event.status === 'published' ? 'Update & Republish' : 'Save & Publish'}</span><span className="sm:hidden">Publish</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Prize Modal ===== */}
      {showPrizeModal && editingPrize && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#b3cde0] dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ev-900 dark:text-white">{editingPrize.id?.startsWith('temp-') || !editingPrize.id ? 'Add Prize' : 'Edit Prize'}</h3>
              <button onClick={() => setShowPrizeModal(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Rank <span className="text-red-500">*</span></label>
                <input type="text" value={editingPrize.rank} onChange={(e) => setEditingPrize({ ...editingPrize, rank: e.target.value })} disabled={isPrizeConfigLocked} className={inputClass} placeholder="e.g., Winner, Runner-up" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Prize Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRIZE_TYPE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setEditingPrize({ ...editingPrize, prizeType: opt.value })} disabled={isPrizeConfigLocked} className={`flex flex-col items-center gap-1 p-3 rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${editingPrize.prizeType === opt.value ? 'border-ev-700 bg-ev-50 dark:bg-ev-900/20 text-ev-800' : 'border-[#b3cde0] dark:border-gray-600 text-gray-500 hover:border-gray-300'}`}>
                      {opt.icon}<span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {editingPrize.prizeType === 'cash' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Prize Amount (₹)</label>
                  <input type="number" value={editingPrize.prizeAmount || ''} onChange={(e) => setEditingPrize({ ...editingPrize, prizeAmount: e.target.value ? Number(e.target.value) : undefined })} disabled={isPrizeConfigLocked} className={inputClass} placeholder="Enter amount" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Additional Perks</label>
                <div className="flex flex-wrap gap-2">
                  {PERK_OPTIONS.map(perk => (
                    <button key={perk} type="button" onClick={() => { const perks = editingPrize.additionalPerks || []; setEditingPrize({ ...editingPrize, additionalPerks: perks.includes(perk) ? perks.filter(p => p !== perk) : [...perks, perk] }); }} disabled={isPrizeConfigLocked} className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${editingPrize.additionalPerks?.includes(perk) ? 'border-ev-700 bg-ev-50 text-ev-800' : 'border-[#b3cde0] text-gray-500 hover:border-gray-300'}`}>{perk}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Other Details</label>
                <textarea value={editingPrize.description || ''} onChange={(e) => setEditingPrize({ ...editingPrize, description: e.target.value })} rows={2} disabled={isPrizeConfigLocked} className={inputClass} placeholder="Additional description..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#b3cde0] dark:border-gray-700 flex justify-end gap-3">
              <button type="button" onClick={() => setShowPrizeModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
              <button type="button" onClick={savePrize} disabled={isPrizeConfigLocked} className="px-4 py-2 bg-ev-700 text-white text-sm font-medium rounded-md hover:bg-ev-800 transition-colors disabled:cursor-not-allowed disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Custom Field Modal ===== */}
      {showFieldModal && editingField && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#b3cde0] dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ev-900 dark:text-white">{editingField.id ? 'Edit Question' : 'Add Question'}</h3>
              <button onClick={() => setShowFieldModal(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Question Label <span className="text-red-500">*</span></label>
                <input type="text" value={editingField.fieldLabel} onChange={(e) => setEditingField({ ...editingField, fieldLabel: e.target.value })} className={inputClass} placeholder="e.g., What is your experience?" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Field Type</label>
                <select value={editingField.fieldType} onChange={(e) => setEditingField({ ...editingField, fieldType: e.target.value as EventFieldType })} className={inputClass}>
                  {FIELD_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>

              {['dropdown', 'radio', 'checkbox'].includes(editingField.fieldType) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Options (one per line)</label>
                  <textarea value={Array.isArray(editingField.options) ? (editingField.options as string[]).join('\n') : ''} onChange={(e) => setEditingField({ ...editingField, options: e.target.value.split('\n').filter(Boolean) })} rows={4} className={inputClass} placeholder="Option 1&#10;Option 2&#10;Option 3" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Placeholder</label>
                <input type="text" value={editingField.placeholder || ''} onChange={(e) => setEditingField({ ...editingField, placeholder: e.target.value })} className={inputClass} placeholder="Hint text..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Help Text</label>
                <input type="text" value={editingField.helpText || ''} onChange={(e) => setEditingField({ ...editingField, helpText: e.target.value })} className={inputClass} placeholder="Additional instructions..." />
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editingField.isRequired} onChange={(e) => setEditingField({ ...editingField, isRequired: e.target.checked })} className="w-4 h-4 text-ev-700 rounded" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Required field</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-[#b3cde0] dark:border-gray-700 flex justify-end gap-3">
              <button type="button" onClick={() => setShowFieldModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
              <button type="button" onClick={saveField} className="px-4 py-2 bg-ev-700 text-white text-sm font-medium rounded-md hover:bg-ev-800 transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
