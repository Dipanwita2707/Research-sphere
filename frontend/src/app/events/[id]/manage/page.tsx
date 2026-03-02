'use client';

import React, { useState, useEffect } from 'react';
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
import type { Event, OpportunityMode, ParticipationType, EventPrize, PrizeType, EventCustomField, EventFieldType } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

interface FAQ {
  question: string;
  answer: string;
}

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
  const [hasSponsorship, setHasSponsorship] = useState<boolean | null>(null);
  const [sponsors, setSponsors] = useState<Array<{ name: string; amount: number; type: string; notes?: string }>>([]);
  const [showSponsorshipPublicly, setShowSponsorshipPublicly] = useState(false);
  const [hasResources, setHasResources] = useState<boolean | null>(null);
  const [resources, setResources] = useState<Array<{ category: string; type: string; description: string; estimatedCost?: number }>>([]);

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

  const handleRemoveImage = (type: 'banner' | 'logo') => {
    if (type === 'banner') { setBannerPreview(''); setBannerImageUrl(''); }
    else { setLogoPreview(''); setLogoImageUrl(''); }
  };

  // ──── Validation helpers ────
  const countWords = (str: string) => str.trim().split(/\s+/).filter(Boolean).length;
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  type FieldErrorMap = Record<string, string>;

  const runValidation = (forPublish = false): FieldErrorMap => {
    const errors: FieldErrorMap = {};
    if (forPublish && !logoImageUrl) {
      errors.logo = 'Event logo is required before publishing.';
    }
    if (!description.trim()) {
      errors.description = 'Short description is required.';
    } else if (countWords(description) > 10) {
      errors.description = `Short description must be 10 words or fewer (currently ${countWords(description)} words).`;
    }
    const longDescPlain = longDescription.replace(/<[^>]*>/g, '').trim();
    if (!longDescPlain) {
      errors.longDescription = 'Detailed description is required.';
    }
    if (!registrationStartDate) {
      errors.registrationStartDate = 'Registration start date is required.';
    }
    if (!registrationEndDate) {
      errors.registrationEndDate = 'Registration end date is required.';
    }
    if (registrationStartDate && registrationEndDate && new Date(registrationEndDate) < new Date(registrationStartDate)) {
      errors.registrationEndDate = 'End date must be after start date.';
    }
    if (!contactPersonName.trim()) {
      errors.contactPersonName = 'Contact person name is required.';
    } else if (contactPersonName.trim().length < 2) {
      errors.contactPersonName = 'Contact person name must be at least 2 characters.';
    }
    if (!contactEmail.trim()) {
      errors.contactEmail = 'Contact email is required.';
    } else if (!isValidEmail(contactEmail)) {
      errors.contactEmail = 'Please enter a valid email address.';
    }
    if (!opportunityMode) {
      errors.opportunityMode = 'Please select a mode of opportunity.';
    }
    return errors;
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
      { field: 'registrationStartDate', step: 1 },
      { field: 'registrationEndDate', step: 1 },
      { field: 'contactPersonName', step: 1 },
      { field: 'contactEmail', step: 1 },
      { field: 'opportunityMode', step: 2 },
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
    const u = [...faqs]; u[i][field] = v; setFaqs(u);
  };
  const removeFAQ = (i: number) => setFaqs(faqs.filter((_, idx) => idx !== i));

  // Prize management
  const openAddPrize = () => {
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
    setEditingPrize({ ...prize });
    setShowPrizeModal(true);
  };

  const savePrize = () => {
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
    const updateData: any = {
      // Step 1: Basic Info
      description: description.trim(),
      longDescription: longDescription.trim() || null,
      venue: venue.trim(),
      maxCapacity: maxCapacity ? Number(maxCapacity) : null,
      registrationStartDate: registrationStartDate || null,
      registrationEndDate: registrationEndDate || null,
      bannerImageUrl: bannerImageUrl || null,
      logoImageUrl: logoImageUrl || null,
      contactPersonName: contactPersonName.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactMobile: contactMobile.trim() || null,
      alternateContact: alternateContact.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      socialMediaLinks: Object.keys(socialMediaLinks).filter(k => socialMediaLinks[k]).length > 0 ? socialMediaLinks : null,
      eligibilityCriteria: eligibilityCriteria.trim() || null,
      rulesAndGuidelines: rulesAndGuidelines.trim() || null,
      prizeDetails: prizeDetails.trim() || null,
      certificateAvailable,
      faqs: faqs.filter(f => f.question && f.answer).length > 0 ? faqs.filter(f => f.question && f.answer) : null,

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
      hasSponsorship: hasSponsorship ?? null,
      sponsors: hasSponsorship && sponsors.length > 0 ? sponsors : null,
      showSponsorshipPublicly: hasSponsorship && sponsors.length > 0 ? showSponsorshipPublicly : false,
      hasResources: hasResources ?? null,
      resources: hasResources && resources.length > 0 ? resources : null,
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
    // Run inline-error validation
    const errors = runValidation(forPublish);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstError(errors);
      return false;
    }
    // Additional non-inline checks
    if (!venue.trim()) { toast({ type: 'error', message: 'Venue is required' }); return false; }
    if (maxCapacity && maxCapacity < 1) { toast({ type: 'error', message: 'Max capacity must be at least 1' }); return false; }
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
    if (registrationEndDate && event && new Date(registrationEndDate) > new Date(event.startDate)) { toast({ type: 'error', message: 'Registration must close before the event starts' }); return false; }
    if (registrationStartDate && event && new Date(registrationStartDate) > new Date(event.startDate)) { toast({ type: 'error', message: 'Registration must open before the event starts' }); return false; }
    if (participationType === 'team') {
      if (!minTeamSize || !maxTeamSize) { toast({ type: 'error', message: 'Team size is required for team participation' }); return false; }
      if (Number(minTeamSize) > Number(maxTeamSize)) { toast({ type: 'error', message: 'Min team size cannot be greater than max team size' }); return false; }
    }
    return true;
  };

  const handleSave = async () => {
    if (!event) return;
    if (!validateForm(false)) return;

    try {
      setSaving(true);
      const updated = await eventService.updateEvent(eventId, buildUpdateData());
      
      // Save prizes if enabled
      if (prizesEnabled && prizes.length > 0) {
        await eventService.bulkUpsertPrizes(eventId, prizes);
      }
      
      setEvent(updated);
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
      if (prizesEnabled && prizes.length > 0) {
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <PageSkeleton message="Loading event..." />
      </div>
    );
  }

  // --- Not Found ---
  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Event Not Found</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">The event you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/events" className="inline-flex items-center gap-2 px-5 py-2.5 bg-sgt-600 text-white text-sm font-medium rounded-md hover:bg-sgt-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Events
          </Link>
        </div>
      </div>
    );
  }

  // --- Design tokens (matching Noting UI) ---
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">{children}</h3>
  );

  const inputClass = 'w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none';
  const inputErrClass = (field: string) => fieldErrors[field] ? 'border-red-400 dark:border-red-500 focus:ring-red-400 focus:border-red-400' : '';
  const FieldError = ({ field }: { field: string }) => fieldErrors[field] ? (
    <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" />{fieldErrors[field]}</p>
  ) : null;

  const radioClass = (active: boolean) =>
    `flex items-center gap-2.5 p-3 border rounded-md cursor-pointer transition-colors ${active ? 'border-sgt-400 bg-sgt-50/50 dark:bg-sgt-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`;

  const checkboxClass = (active: boolean) =>
    `flex items-center gap-3 p-2.5 border rounded-md cursor-pointer transition-colors ${active ? 'border-sgt-400 bg-sgt-50/50 dark:bg-sgt-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`;

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    published: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-[850px] mx-auto">
        {/* Navigation */}
        <Link
          href="/events/my-events"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-sgt-600 transition-colors mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Events
        </Link>

        {/* ===== A4 Document Sheet ===== */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

          {/* ── Document Header ── */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-8 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Event Update</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Update event details and configuration. Locked fields were set during noting approval.
                </p>
              </div>
              <span className={`px-3 py-1.5 rounded-md text-xs font-semibold shrink-0 ${statusColors[event.status] || statusColors.draft}`}>
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
              </span>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-sgt-50 dark:bg-sgt-900/20 border border-sgt-100 dark:border-sgt-800">
              <span className="text-[10px] font-semibold text-gray-400 uppercase">Event ID</span>
              <span className="font-mono text-sm font-semibold text-sgt-700 dark:text-sgt-300">{event.eventId}</span>
            </div>
          </div>

          {/* ── Step Navigation ── */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-8 py-4 bg-gray-50 dark:bg-gray-900/30">
            <div className="flex items-center gap-3">
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                return (
                  <React.Fragment key={step.id}>
                    <button
                      onClick={() => setCurrentStep(step.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive ? 'bg-sgt-600 text-white' : isCompleted ? 'bg-sgt-100 text-sgt-700 dark:bg-sgt-900/20 dark:text-sgt-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      <span>{step.name}</span>
                    </button>
                    {idx < STEPS.length - 1 && <div className={`h-0.5 w-8 ${currentStep > step.id ? 'bg-sgt-400' : 'bg-gray-200 dark:bg-gray-600'}`} />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* ── Document Body ── */}
          <div className="px-8 py-6 space-y-7">

            {/* ====== STEP 1: Basic Information ====== */}
            {currentStep === 1 && (
              <>
            {/* ====== Locked Fields (from Noting) ====== */}
            <section>
              <SectionLabel>Locked Fields (from Noting)</SectionLabel>
              <div className="bg-gray-50 dark:bg-gray-900/20 rounded-md border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-start gap-2 mb-3">
                  <Lock className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    These fields were set during noting approval and cannot be modified.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-gray-400 font-medium min-w-[80px]">Name:</span>
                    <span className="text-gray-900 dark:text-white font-medium">{event.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 font-medium min-w-[80px]">Type:</span>
                    <span className="text-gray-900 dark:text-white capitalize">{event.eventType}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 font-medium min-w-[80px]">Start:</span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(event.startDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 font-medium min-w-[80px]">End:</span>
                    <span className="text-gray-900 dark:text-white">
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
                    <span className="text-gray-900 dark:text-white capitalize">{participationType || event.participationType || 'individual'}</span>
                  </div>
                  {event.notingId && (
                    <div className="flex gap-2 items-center">
                      <span className="text-gray-400 font-medium min-w-[80px]">Noting:</span>
                      <Link href={`/noting/${event.notingId}`} className="text-sgt-600 hover:text-sgt-700 dark:text-sgt-400 flex items-center gap-1 text-sm">
                        View Noting <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ====== Event Branding ====== */}
            <section>
              <SectionLabel>Event Branding</SectionLabel>
              <div className="space-y-4">
                {/* Banner */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Event Banner <span className="text-xs text-gray-400 font-normal">(Recommended: 1200×400px)</span>
                  </label>
                  {bannerPreview ? (
                    <div className="relative group rounded-md overflow-hidden border border-gray-200 dark:border-gray-600">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={bannerPreview} alt="Banner" className="w-full h-40 object-cover" />
                      <button
                        onClick={() => handleRemoveImage('banner')}
                        type="button"
                        className="absolute top-2 right-2 p-1.5 bg-white/90 dark:bg-gray-800/90 text-red-500 rounded-md opacity-0 group-hover:opacity-100 transition-opacity border border-gray-200 dark:border-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-md cursor-pointer hover:border-sgt-400 transition-colors">
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
                {/* Logo */}
                <div id="field-logo">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Event Logo <span className="text-xs text-gray-400 font-normal">(Recommended: 300×300px)</span> <span className="text-red-500">*</span>
                  </label>
                  {logoPreview ? (
                    <div className="relative group rounded-md overflow-hidden border border-gray-200 dark:border-gray-600 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoPreview} alt="Logo" className="w-24 h-24 object-cover" />
                      <button
                        onClick={() => handleRemoveImage('logo')}
                        type="button"
                        className="absolute top-1 right-1 p-1 bg-white/90 dark:bg-gray-800/90 text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-gray-200 dark:border-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed rounded-md cursor-pointer hover:border-sgt-400 transition-colors ${fieldErrors.logo ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'}`}>
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
              </div>
            </section>

            {/* ====== Description ====== */}
            <section>
              <SectionLabel>Description</SectionLabel>
              <div className="space-y-4">
                <div id="field-description">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Short Description <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-gray-400 ml-2">(max 10 words)</span>
                  </label>
                  <div className="relative">
                    <textarea
                      value={description}
                      onChange={(e) => { setDescription(e.target.value); if (submitAttempted) blurField('description'); }}
                      onBlur={() => blurField('description')}
                      rows={3}
                      className={`${inputClass} ${inputErrClass('description')}`}
                      placeholder="Brief summary shown in event cards..."
                    />
                    <span className={`absolute bottom-2 right-2 text-[10px] ${countWords(description) > 10 ? 'text-red-500' : 'text-gray-400'}`}>
                      {countWords(description)}/10
                    </span>
                  </div>
                  <FieldError field="description" />
                </div>
                <div id="field-longDescription">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Detailed Description <span className="text-red-500">*</span>
                  </label>
                  <div className={`noting-description-editor border rounded-md bg-white dark:bg-gray-700 transition-colors ${fieldErrors.longDescription ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-600 focus-within:border-sgt-500'}`}>
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
            <section>
              <SectionLabel>Venue & Capacity</SectionLabel>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Venue <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className={inputClass}
                    placeholder="e.g., Main Auditorium, Seminar Hall 1"
                    required
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                        Registration Fee (₹) <span className="text-red-500">*</span>
                        {event.notingId && <Lock className="w-3.5 h-3.5 text-amber-500" />}
                      </label>
                      {event.notingId ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md cursor-not-allowed">
                          <IndianRupee className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{registrationFee !== '' ? registrationFee : '—'}</span>
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
                      <p className="mt-1 text-xs text-gray-400">Each participant will be charged this fee individually at the time of registration.</p>
                    </div>
                  )}
                  {event.paymentType === 'paid' && participationType === 'team' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                        Team Registration Fee (₹) <span className="text-red-500">*</span>
                        {event.notingId && <Lock className="w-3.5 h-3.5 text-amber-500" />}
                      </label>
                      {event.notingId ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md cursor-not-allowed">
                          <IndianRupee className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{teamRegistrationFee !== '' ? teamRegistrationFee : '—'}</span>
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
                      <p className="mt-1 text-xs text-gray-400">This is the total fee charged per team. It will be split equally among all team members based on the max team size set below.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ====== Additional Details (from Noting) ====== */}
            <section>
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
                      <input type="radio" checked={dutyLeaveAvailable === false} onChange={() => { if (!event.notingId) { setDutyLeaveAvailable(false); setDutyLeaveEligibility([]); } }} disabled={!!event.notingId} className="sr-only" />
                      <span>No</span>
                    </label>
                  </div>
                  {dutyLeaveAvailable && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {['students', 'faculty_teaching', 'faculty_non_teaching', 'staff'].map((opt) => {
                        const label = opt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                        const checked = dutyLeaveEligibility.includes(opt);
                        return (
                          <label key={opt} className={`flex items-center gap-1.5 text-sm ${event.notingId ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => !event.notingId && setDutyLeaveEligibility(prev => checked ? prev.filter(x => x !== opt) : [...prev, opt])}
                              disabled={!!event.notingId}
                              className="w-4 h-4 text-sgt-600 rounded disabled:cursor-not-allowed"
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
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
                          className="w-4 h-4 text-sgt-600 rounded"
                        />
                        Show sponsorship to users on event page (creator decides at publish)
                      </label>
                      {sponsors.map((s, i) => (
                        <div key={i} className="flex gap-2 items-start p-2 border border-gray-200 dark:border-gray-600 rounded-md">
                          <input value={s.name} onChange={(e) => !event.notingId && setSponsors(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Sponsor name" disabled={!!event.notingId} className={`${inputClass} flex-1 disabled:cursor-not-allowed`} />
                          <select value={s.type} onChange={(e) => !event.notingId && setSponsors(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} disabled={!!event.notingId} className={`${inputClass} w-28 disabled:cursor-not-allowed`}>
                            <option value="cash">Cash</option>
                            <option value="in_kind">In-kind</option>
                          </select>
                          {s.type === 'cash' ? (
                            <input type="number" value={s.amount || ''} onChange={(e) => !event.notingId && setSponsors(prev => prev.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} placeholder="Amount (₹)" disabled={!!event.notingId} className={`${inputClass} w-28 disabled:cursor-not-allowed`} />
                          ) : (
                            <input type="text" value={s.notes || ''} onChange={(e) => !event.notingId && setSponsors(prev => prev.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} placeholder="Describe in-kind (e.g. Laptops, Food)" disabled={!!event.notingId} className={`${inputClass} flex-1 min-w-[180px] disabled:cursor-not-allowed`} />
                          )}
                          {!event.notingId && <button type="button" onClick={() => setSponsors(prev => prev.filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">×</button>}
                        </div>
                      ))}
                      {!event.notingId && <button type="button" onClick={() => setSponsors(prev => [...prev, { name: '', amount: 0, type: 'cash' }])} className="text-sm text-sgt-600 hover:text-sgt-700">+ Add sponsor</button>}
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
                    <div className="mt-2 space-y-2">
                      {resources.map((r, i) => (
                        <div key={i} className="flex gap-2 items-start p-2 border border-gray-200 dark:border-gray-600 rounded-md">
                          <select value={r.category} onChange={(e) => !event.notingId && setResources(prev => prev.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} disabled={!!event.notingId} className={`${inputClass} w-28 disabled:cursor-not-allowed`}>
                            <option value="internal">Internal</option>
                            <option value="external">External</option>
                          </select>
                          <input value={r.type} onChange={(e) => !event.notingId && setResources(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} placeholder="Type" disabled={!!event.notingId} className={`${inputClass} w-32 disabled:cursor-not-allowed`} />
                          <input value={r.description} onChange={(e) => !event.notingId && setResources(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Description" disabled={!!event.notingId} className={`${inputClass} flex-1 disabled:cursor-not-allowed`} />
                          <input type="number" value={r.estimatedCost ?? ''} onChange={(e) => !event.notingId && setResources(prev => prev.map((x, j) => j === i ? { ...x, estimatedCost: e.target.value ? Number(e.target.value) : undefined } : x))} placeholder="Cost (₹)" disabled={!!event.notingId} className={`${inputClass} w-24 disabled:cursor-not-allowed`} />
                          {!event.notingId && <button type="button" onClick={() => setResources(prev => prev.filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">×</button>}
                        </div>
                      ))}
                      {!event.notingId && <button type="button" onClick={() => setResources(prev => [...prev, { category: 'internal', type: '', description: '' }])} className="text-sm text-sgt-600 hover:text-sgt-700">+ Add resource</button>}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ====== Registration Period ====== */}
            <section>
              <SectionLabel>Registration Period</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
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
            <section>
              <SectionLabel>Contact & Communication</SectionLabel>
              <div className="space-y-4">
                <div id="field-contactPersonName">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact Person Name <span className="text-red-500">*</span></label>
                  <input type="text" value={contactPersonName}
                    onChange={(e) => { setContactPersonName(e.target.value); if (submitAttempted) blurField('contactPersonName'); }}
                    onBlur={() => blurField('contactPersonName')}
                    className={`${inputClass} ${inputErrClass('contactPersonName')}`} placeholder="Full name of event coordinator" />
                  <FieldError field="contactPersonName" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div id="field-contactEmail">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact Email <span className="text-red-500">*</span></label>
                    <input type="email" value={contactEmail}
                      onChange={(e) => { setContactEmail(e.target.value); if (submitAttempted) blurField('contactEmail'); }}
                      onBlur={() => blurField('contactEmail')}
                      className={`${inputClass} ${inputErrClass('contactEmail')}`} placeholder="contact@example.com" />
                    <FieldError field="contactEmail" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact Mobile</label>
                    <input type="tel" value={contactMobile} onChange={(e) => setContactMobile(e.target.value)} className={inputClass} placeholder="+91 XXXXX XXXXX" />
                  </div>
                </div>
              </div>
            </section>

            {/* ====== Additional Details ====== */}
            <section>
              <SectionLabel>Additional Details</SectionLabel>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Eligibility Criteria</label>
                  <textarea value={eligibilityCriteria} onChange={(e) => setEligibilityCriteria(e.target.value)} rows={2} className={inputClass} placeholder="Who can participate?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Rules & Guidelines</label>
                  <textarea value={rulesAndGuidelines} onChange={(e) => setRulesAndGuidelines(e.target.value)} rows={2} className={inputClass} placeholder="Event rules..." />
                </div>
                <label className={`${checkboxClass(certificateAvailable)} ${event?.notingId ? 'opacity-75 cursor-not-allowed' : ''}`}>
                  <input type="checkbox" checked={certificateAvailable} onChange={(e) => !event?.notingId && setCertificateAvailable(e.target.checked)} disabled={!!event?.notingId} className="w-4 h-4 text-sgt-600 rounded focus:ring-sgt-500 disabled:cursor-not-allowed" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Certificates will be provided</span>
                  {event?.notingId && <Lock className="w-3.5 h-3.5 text-amber-500 ml-1" />}
                </label>
              </div>
            </section>

            {/* ====== FAQs (Step 1) ====== */}
            <section>
              <SectionLabel>FAQs (Optional)</SectionLabel>
              {faqs.length > 0 && (
                <div className="space-y-2 mb-3">
                  {faqs.map((faq, i) => (
                    <div key={i} className="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 p-3 space-y-2">
                      <input type="text" value={faq.question} onChange={(e) => updateFAQ(i, 'question', e.target.value)} className={inputClass} placeholder="Question" />
                      <textarea value={faq.answer} onChange={(e) => updateFAQ(i, 'answer', e.target.value)} rows={2} className={inputClass} placeholder="Answer" />
                      <button onClick={() => removeFAQ(i)} type="button" className="p-1.5 text-gray-300 hover:text-red-500 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={addFAQ} type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sgt-600 hover:bg-sgt-50 rounded-md transition-colors"><Plus className="w-4 h-4" /> Add FAQ</button>
            </section>
              </>
            )}

            {/* ====== STEP 2: Participation & Team Settings ====== */}
            {currentStep === 2 && (
              <>
            {/* ====== Participation & Capacity ====== */}
            {event.paymentType === 'paid' && (
              <section>
                <SectionLabel>Participation &amp; Capacity</SectionLabel>
                <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/20 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IndianRupee className="w-4 h-4 text-sgt-600" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {participationType === 'team' ? 'Fee per Team (₹)' : 'Participation Fee (₹)'}
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
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
                    <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-800">
                      <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
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
            <section>
              <SectionLabel>Participation & Mode</SectionLabel>
              {event.notingId && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Participation Type was set during noting approval and cannot be changed.
                  </p>
                </div>
              )}
              <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Side by Side: Participation Type + Opportunity Mode */}
                <div className="grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-600">
                  {/* Participation Type */}
                  <div className={`bg-white dark:bg-gray-800 p-4 ${event.notingId ? 'opacity-90' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Participation Type</label>
                    <div className="flex flex-col gap-2">
                      <label className={`${radioClass(participationType === 'individual')} ${event.notingId ? 'cursor-not-allowed opacity-75' : ''}`}>
                        <input type="radio" name="participationType" checked={participationType === 'individual'} onChange={() => !event.notingId && setParticipationType('individual')} disabled={!!event.notingId} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500 disabled:cursor-not-allowed" />
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium">Individual</span>
                        </div>
                      </label>
                      <label className={`${radioClass(participationType === 'team')} ${event.notingId ? 'cursor-not-allowed opacity-75' : ''}`}>
                        <input type="radio" name="participationType" checked={participationType === 'team'} onChange={() => !event.notingId && setParticipationType('team')} disabled={!!event.notingId} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500 disabled:cursor-not-allowed" />
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
                            className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm font-medium capitalize">{mode}</span>
                        </label>
                      ))}
                    </div>
                    <FieldError field="opportunityMode" />
                  </div>
                </div>

                {/* Team Configuration (Conditional) */}
                {participationType === 'team' && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Team Configuration
                    </p>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Min Team Size <span className="text-red-500">*</span></label>
                        <input type="number" value={minTeamSize} onChange={(e) => setMinTeamSize(e.target.value ? Number(e.target.value) : '')} min="1" className={inputClass} placeholder="e.g., 2" />
                      </div>
                      <div>
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
                      <div className="mt-3 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                          <IndianRupee className="w-3.5 h-3.5 shrink-0" />
                          Total team fee ₹{teamRegistrationFee} will be equally divided among {maxTeamSize} members.
                          &nbsp;<span className="font-semibold">Per-member: ₹{(Number(teamRegistrationFee) / Number(maxTeamSize)).toFixed(2)}</span>.
                          No participant will be charged more than this amount.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <label className={checkboxClass(allowCrossInstituteTeams)}>
                        <input type="checkbox" checked={allowCrossInstituteTeams} onChange={(e) => setAllowCrossInstituteTeams(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Allow Cross-Institute Teams</span>
                      </label>
                      <label className={checkboxClass(interCollegeAllowed)}>
                        <input type="checkbox" checked={interCollegeAllowed} onChange={(e) => setInterCollegeAllowed(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Allow Inter-College Teams</span>
                      </label>
                      <label className={checkboxClass(allowTeamEditAfterSubmission)}>
                        <input type="checkbox" checked={allowTeamEditAfterSubmission} onChange={(e) => setAllowTeamEditAfterSubmission(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Allow Team Edit After Submission</span>
                      </label>
                      <label className={checkboxClass(autoApproveTeams)}>
                        <input type="checkbox" checked={autoApproveTeams} onChange={(e) => setAutoApproveTeams(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Auto-approve Teams</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ====== Registration Control Settings ====== */}
            <section>
              <SectionLabel>Registration Control Settings</SectionLabel>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Registration Cap (Overall Limit)</label>
                    <input type="number" value={registrationCap} onChange={(e) => setRegistrationCap(e.target.value ? Number(e.target.value) : '')} min="1" className={inputClass} placeholder="Leave empty for unlimited" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className={checkboxClass(autoApproveRegistration)}>
                    <input type="checkbox" checked={autoApproveRegistration} onChange={(e) => setAutoApproveRegistration(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Auto-approve Registrations</span>
                  </label>
                  <label className={checkboxClass(showParticipantsPublicly)}>
                    <input type="checkbox" checked={showParticipantsPublicly} onChange={(e) => setShowParticipantsPublicly(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Show Participants Publicly</span>
                  </label>
                  <label className={checkboxClass(allowWithdrawRegistration)}>
                    <input type="checkbox" checked={allowWithdrawRegistration} onChange={(e) => setAllowWithdrawRegistration(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Allow Withdraw Registration</span>
                  </label>
                  <label className={checkboxClass(allowEditAfterSubmission)}>
                    <input type="checkbox" checked={allowEditAfterSubmission} onChange={(e) => setAllowEditAfterSubmission(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Allow Edit After Submission</span>
                  </label>
                  {participationType === 'team' && (
                    <label className={checkboxClass(lockTeamAfterDeadline)}>
                      <input type="checkbox" checked={lockTeamAfterDeadline} onChange={(e) => setLockTeamAfterDeadline(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Lock Team After Deadline</span>
                    </label>
                  )}
                </div>
              </div>
            </section>

            {/* ====== Team Discovery Settings ====== */}
            {participationType === 'team' && (
              <section>
                <SectionLabel>Team Discovery Settings</SectionLabel>
                <div className="rounded-md border border-gray-200 dark:border-gray-700 p-4">
                  <div className="grid grid-cols-2 gap-2">
                    <label className={checkboxClass(lookingForTeammatesEnabled)}>
                      <input type="checkbox" checked={lookingForTeammatesEnabled} onChange={(e) => setLookingForTeammatesEnabled(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Enable &quot;Looking for Teammates&quot;</span>
                    </label>
                    <label className={checkboxClass(allowPublicTeamListing)}>
                      <input type="checkbox" checked={allowPublicTeamListing} onChange={(e) => setAllowPublicTeamListing(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Allow Public Team Listing</span>
                    </label>
                    <label className={checkboxClass(allowJoinRequests)}>
                      <input type="checkbox" checked={allowJoinRequests} onChange={(e) => setAllowJoinRequests(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Allow Join Requests</span>
                    </label>
                    <label className={checkboxClass(allowInviteSystem)}>
                      <input type="checkbox" checked={allowInviteSystem} onChange={(e) => setAllowInviteSystem(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
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
            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Prize Configuration</SectionLabel>
                <label className={`flex items-center gap-2 ${event?.notingId ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
                  {event?.notingId && <Lock className="w-3.5 h-3.5 text-amber-500" />}
                  <span className="text-sm text-gray-600 dark:text-gray-400">Enable Prizes</span>
                  <input type="checkbox" checked={prizesEnabled} onChange={(e) => !event?.notingId && setPrizesEnabled(e.target.checked)} disabled={!!event?.notingId} className="w-5 h-5 text-sgt-600 rounded focus:ring-sgt-500 disabled:cursor-not-allowed" />
                </label>
              </div>

              {prizesEnabled && (
                <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 px-4 py-2">
                    <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />Once the event is live, prize amounts cannot be reduced.</p>
                  </div>
                  
                  <div className="p-4 space-y-3">
                    {prizes.map((prize, idx) => (
                      <div key={prize.id || idx} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="w-14 h-14 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                          {prize.prizeType === 'trophy' ? <Trophy className="w-6 h-6 text-blue-600" /> : prize.prizeType === 'cash' ? <IndianRupee className="w-6 h-6 text-blue-600" /> : <Award className="w-6 h-6 text-blue-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 dark:text-white">{prize.rank}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{prize.prizeType === 'cash' && prize.prizeAmount ? `₹${prize.prizeAmount.toLocaleString()}` : prize.title || PRIZE_TYPE_OPTIONS.find(p => p.value === prize.prizeType)?.label || 'Prize'}</p>
                          {prize.additionalPerks && prize.additionalPerks.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {prize.additionalPerks.map((perk, i) => <span key={i} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full">{perk}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditPrize(prize)} className="p-2 text-gray-400 hover:text-sgt-600 transition-colors"><Settings className="w-4 h-4" /></button>
                          <button onClick={() => deletePrize(prize.id!)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                    
                    <button onClick={openAddPrize} className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg text-gray-500 hover:border-sgt-400 hover:text-sgt-600 transition-colors">
                      <Plus className="w-5 h-5" /><span className="font-medium">Add Prize</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* ====== Custom Registration Questions ====== */}
            <section>
              <SectionLabel>Custom Registration Questions</SectionLabel>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <label className={checkboxClass(requireFormSubmission)}>
                    <input type="checkbox" checked={requireFormSubmission} onChange={(e) => setRequireFormSubmission(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Require form submission before team creation</span>
                  </label>
                </div>
                
                <div className="p-4 space-y-3">
                  {customFields.map((field, idx) => (
                    <div key={field.id || idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">{field.fieldLabel}</h4>
                          <p className="text-xs text-gray-500">{FIELD_TYPE_OPTIONS.find(t => t.value === field.fieldType)?.label || field.fieldType}{field.isRequired && <span className="ml-1 text-red-500">• Required</span>}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditField(field)} className="p-2 text-gray-400 hover:text-sgt-600 transition-colors"><Settings className="w-4 h-4" /></button>
                        <button onClick={() => deleteField(field.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                  
                  <button onClick={openAddField} className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg text-gray-500 hover:border-sgt-400 hover:text-sgt-600 transition-colors">
                    <Plus className="w-5 h-5" /><span className="font-medium">Add Question</span>
                  </button>
                </div>
              </div>
            </section>
              </>
            )}

          </div>

          {/* ── Document Footer — Action Buttons ── */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-8 py-4 bg-gray-50 dark:bg-gray-900/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {currentStep > 1 && (
                  <button onClick={() => setCurrentStep(currentStep - 1)} className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-white dark:hover:bg-gray-700 flex items-center gap-2 transition-colors">
                    <ArrowLeft className="w-4 h-4" />Previous
                  </button>
                )}
                {currentStep < STEPS.length && (
                  <button onClick={() => setCurrentStep(currentStep + 1)} className="px-4 py-2.5 bg-gray-700 dark:bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-800 flex items-center gap-2 transition-colors">
                    Next<ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={handleSave} disabled={saving || publishing} className="px-5 py-2.5 bg-sgt-600 text-white text-sm font-medium rounded-md hover:bg-sgt-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
                  {saving ? <Skeleton className="w-4 h-4 rounded-sm" /> : <Save className="w-4 h-4" />}Save Draft
                </button>
                <button type="button" onClick={handlePublish} disabled={saving || publishing} className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
                  {publishing ? <Skeleton className="w-4 h-4 rounded-sm" /> : <CheckCircle className="w-4 h-4" />}
                  {event.status === 'published' ? 'Update & Republish' : 'Save & Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Prize Modal ===== */}
      {showPrizeModal && editingPrize && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editingPrize.id?.startsWith('temp-') || !editingPrize.id ? 'Add Prize' : 'Edit Prize'}</h3>
              <button onClick={() => setShowPrizeModal(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Rank <span className="text-red-500">*</span></label>
                <input type="text" value={editingPrize.rank} onChange={(e) => setEditingPrize({ ...editingPrize, rank: e.target.value })} className={inputClass} placeholder="e.g., Winner, Runner-up" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Prize Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRIZE_TYPE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setEditingPrize({ ...editingPrize, prizeType: opt.value })} className={`flex flex-col items-center gap-1 p-3 rounded-md border transition-colors ${editingPrize.prizeType === opt.value ? 'border-sgt-500 bg-sgt-50 dark:bg-sgt-900/20 text-sgt-700' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'}`}>
                      {opt.icon}<span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {editingPrize.prizeType === 'cash' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Prize Amount (₹)</label>
                  <input type="number" value={editingPrize.prizeAmount || ''} onChange={(e) => setEditingPrize({ ...editingPrize, prizeAmount: e.target.value ? Number(e.target.value) : undefined })} className={inputClass} placeholder="Enter amount" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Additional Perks</label>
                <div className="flex flex-wrap gap-2">
                  {PERK_OPTIONS.map(perk => (
                    <button key={perk} type="button" onClick={() => { const perks = editingPrize.additionalPerks || []; setEditingPrize({ ...editingPrize, additionalPerks: perks.includes(perk) ? perks.filter(p => p !== perk) : [...perks, perk] }); }} className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${editingPrize.additionalPerks?.includes(perk) ? 'border-sgt-500 bg-sgt-50 text-sgt-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{perk}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Other Details</label>
                <textarea value={editingPrize.description || ''} onChange={(e) => setEditingPrize({ ...editingPrize, description: e.target.value })} rows={2} className={inputClass} placeholder="Additional description..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button type="button" onClick={() => setShowPrizeModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
              <button type="button" onClick={savePrize} className="px-4 py-2 bg-sgt-600 text-white text-sm font-medium rounded-md hover:bg-sgt-700 transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Custom Field Modal ===== */}
      {showFieldModal && editingField && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editingField.id ? 'Edit Question' : 'Add Question'}</h3>
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
                <input type="checkbox" checked={editingField.isRequired} onChange={(e) => setEditingField({ ...editingField, isRequired: e.target.checked })} className="w-4 h-4 text-sgt-600 rounded" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Required field</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button type="button" onClick={() => setShowFieldModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
              <button type="button" onClick={saveField} className="px-4 py-2 bg-sgt-600 text-white text-sm font-medium rounded-md hover:bg-sgt-700 transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

