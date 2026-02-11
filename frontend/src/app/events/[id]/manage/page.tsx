'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
// @ts-ignore
import 'react-quill/dist/quill.snow.css';
import {
  ArrowLeft,
  Lock,
  Save,
  AlertCircle,
  Calendar,
  MapPin,
  Users,
  IndianRupee,
  Loader2,
  ExternalLink,
  Upload,
  X,
  Plus,
  Trash2,
  Globe,
  Phone,
  Mail,
  User,
  Award,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event, OpportunityMode, ParticipationType } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

interface FAQ {
  question: string;
  answer: string;
}

export default function ManageEventPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

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
  const [opportunityMode, setOpportunityMode] = useState<OpportunityMode>('online');
  const [participationType, setParticipationType] = useState<ParticipationType>('individual');
  const [minTeamSize, setMinTeamSize] = useState<number | ''>('');
  const [maxTeamSize, setMaxTeamSize] = useState<number | ''>('');
  const [interCollegeAllowed, setInterCollegeAllowed] = useState(false);
  const [interSpecializationAllowed, setInterSpecializationAllowed] = useState(false);

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

  useEffect(() => {
    loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      const data = await eventService.getEvent(eventId);
      setEvent(data);

      setDescription(data.description || '');
      setLongDescription(data.longDescription || '');
      setVenue(data.venue || '');
      setMaxCapacity(data.maxCapacity || '');
      setRegistrationFee(data.registrationFee || '');
      setRegistrationStartDate(data.registrationStartDate?.split('T')[0] || '');
      setRegistrationEndDate(data.registrationEndDate?.split('T')[0] || '');

      setBannerImageUrl(data.bannerImageUrl || '');
      setLogoImageUrl(data.logoImageUrl || '');
      setBannerPreview(data.bannerImageUrl || '');
      setLogoPreview(data.logoImageUrl || '');

      setOpportunityMode(data.opportunityMode || 'online');
      setParticipationType(data.participationType || 'individual');
      setMinTeamSize(data.minTeamSize || '');
      setMaxTeamSize(data.maxTeamSize || '');
      setInterCollegeAllowed(data.interCollegeAllowed || false);
      setInterSpecializationAllowed(data.interSpecializationAllowed || false);

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
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to load event' });
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

  const addFAQ = () => setFaqs([...faqs, { question: '', answer: '' }]);
  const updateFAQ = (i: number, field: 'question' | 'answer', v: string) => {
    const u = [...faqs]; u[i][field] = v; setFaqs(u);
  };
  const removeFAQ = (i: number) => setFaqs(faqs.filter((_, idx) => idx !== i));

  const buildUpdateData = () => {
    const updateData: any = {
      description: description.trim(),
      longDescription: longDescription.trim() || null,
      venue: venue.trim(),
      maxCapacity: maxCapacity ? Number(maxCapacity) : null,
      registrationStartDate: registrationStartDate || null,
      registrationEndDate: registrationEndDate || null,
      bannerImageUrl: bannerImageUrl || null,
      logoImageUrl: logoImageUrl || null,
      opportunityMode,
      participationType,
      minTeamSize: participationType === 'team' ? Number(minTeamSize) : null,
      maxTeamSize: participationType === 'team' ? Number(maxTeamSize) : null,
      interCollegeAllowed: participationType === 'team' ? interCollegeAllowed : null,
      interSpecializationAllowed: participationType === 'team' ? interSpecializationAllowed : null,
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
    };
    if (event?.paymentType === 'paid') {
      updateData.registrationFee = registrationFee ? Number(registrationFee) : null;
    }
    return updateData;
  };

  const validateForm = (): boolean => {
    if (!venue.trim()) { toast({ type: 'error', message: 'Venue is required' }); return false; }
    if (maxCapacity && maxCapacity < 1) { toast({ type: 'error', message: 'Max capacity must be at least 1' }); return false; }
    if (event?.paymentType === 'paid' && (!registrationFee || registrationFee < 1)) { toast({ type: 'error', message: 'Registration fee is required for paid events' }); return false; }
    if (registrationStartDate && registrationEndDate && new Date(registrationEndDate) < new Date(registrationStartDate)) { toast({ type: 'error', message: 'Registration end date must be after registration start date' }); return false; }
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
    if (!validateForm()) return;

    try {
      setSaving(true);
      const updated = await eventService.updateEvent(eventId, buildUpdateData());
      setEvent(updated);
      toast({ type: 'success', message: 'Event saved successfully' });
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to save event' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!event) return;
    if (!validateForm()) return;

    // Extra publish validations
    if (!registrationStartDate || !registrationEndDate) { toast({ type: 'error', message: 'Registration dates are required before publishing' }); return; }

    try {
      setPublishing(true);
      // Save first
      await eventService.updateEvent(eventId, buildUpdateData());
      // Then publish
      const published = await eventService.publishEvent(eventId);
      setEvent(published);
      toast({ type: 'success', message: 'Event published successfully! It is now visible to everyone.' });
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to publish event' });
    } finally {
      setPublishing(false);
    }
  };

  // --- Loading ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-sgt-600" />
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
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Manage Event</h1>
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

          {/* ── Document Body ── */}
          <div className="px-8 py-6 space-y-7">

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
                      {new Date(event.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 font-medium min-w-[80px]">End:</span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(event.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Event Logo <span className="text-xs text-gray-400 font-normal">(Recommended: 300×300px)</span>
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
                    <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-md cursor-pointer hover:border-sgt-400 transition-colors">
                      <Upload className="w-5 h-5 text-gray-300 mb-1" />
                      <p className="text-[10px] text-gray-400 text-center">Upload</p>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload('logo', f); }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </section>

            {/* ====== Description ====== */}
            <section>
              <SectionLabel>Description</SectionLabel>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Short Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className={inputClass}
                    placeholder="Brief summary shown in event cards..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Detailed Description
                  </label>
                  <div className="noting-description-editor border rounded-md bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus-within:border-sgt-500 transition-colors">
                    {typeof window !== 'undefined' && ReactQuill && (
                      <ReactQuill
                        theme="snow"
                        value={longDescription}
                        onChange={setLongDescription}
                        modules={quillModules}
                        className="noting-quill-editor"
                        placeholder="Provide comprehensive event details, agenda, highlights..."
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Use formatting to make content engaging and readable</p>
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
                  {event.paymentType === 'paid' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Registration Fee (₹) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={registrationFee}
                        onChange={(e) => setRegistrationFee(e.target.value ? Number(e.target.value) : '')}
                        min="1"
                        className={inputClass}
                        placeholder="Amount in INR"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ====== Registration Period ====== */}
            <section>
              <SectionLabel>Registration Period</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={registrationStartDate}
                    onChange={(e) => setRegistrationStartDate(e.target.value)}
                    max={event.startDate.split('T')[0]}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={registrationEndDate}
                    onChange={(e) => setRegistrationEndDate(e.target.value)}
                    min={registrationStartDate}
                    max={event.startDate.split('T')[0]}
                    className={inputClass}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Registration period must be before the event start date ({event.startDate.split('T')[0]}). Leave empty to allow registration anytime.</p>
            </section>

            {/* ====== Participation & Mode ====== */}
            <section>
              <SectionLabel>Participation & Mode</SectionLabel>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Side by Side: Participation Type + Opportunity Mode */}
                <div className="grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-600">
                  {/* Participation Type */}
                  <div className="bg-white dark:bg-gray-800 p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Participation Type</label>
                    <div className="flex flex-col gap-2">
                      <label className={radioClass(participationType === 'individual')}>
                        <input type="radio" name="participationType" checked={participationType === 'individual'} onChange={() => setParticipationType('individual')} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium">Individual</span>
                        </div>
                      </label>
                      <label className={radioClass(participationType === 'team')}>
                        <input type="radio" name="participationType" checked={participationType === 'team'} onChange={() => setParticipationType('team')} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                        <div className="flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium">Team</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Opportunity Mode */}
                  <div className="bg-white dark:bg-gray-800 p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mode of Opportunity</label>
                    <div className="flex flex-col gap-2">
                      {(['online', 'offline', 'hybrid'] as OpportunityMode[]).map((mode) => (
                        <label key={mode} className={radioClass(opportunityMode === mode)}>
                          <input type="radio" name="opportunityMode" checked={opportunityMode === mode} onChange={() => setOpportunityMode(mode)} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500" />
                          <span className="text-sm font-medium capitalize">{mode}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Team Configuration (Conditional) */}
                {participationType === 'team' && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Team Configuration
                    </p>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Min Team Size <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={minTeamSize}
                          onChange={(e) => setMinTeamSize(e.target.value ? Number(e.target.value) : '')}
                          min="1"
                          className={inputClass}
                          placeholder="e.g., 2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Max Team Size <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={maxTeamSize}
                          onChange={(e) => setMaxTeamSize(e.target.value ? Number(e.target.value) : '')}
                          min="1"
                          className={inputClass}
                          placeholder="e.g., 5"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className={checkboxClass(interCollegeAllowed)}>
                        <input type="checkbox" checked={interCollegeAllowed} onChange={(e) => setInterCollegeAllowed(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded focus:ring-sgt-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Allow inter-college teams</span>
                      </label>
                      <label className={checkboxClass(interSpecializationAllowed)}>
                        <input type="checkbox" checked={interSpecializationAllowed} onChange={(e) => setInterSpecializationAllowed(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded focus:ring-sgt-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Allow inter-specialization teams</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ====== Contact & Communication ====== */}
            <section>
              <SectionLabel>Contact & Communication</SectionLabel>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact Person Name</label>
                  <input type="text" value={contactPersonName} onChange={(e) => setContactPersonName(e.target.value)} className={inputClass} placeholder="Full name of event coordinator" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact Email</label>
                    <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} placeholder="contact@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact Mobile</label>
                    <input type="tel" value={contactMobile} onChange={(e) => setContactMobile(e.target.value)} className={inputClass} placeholder="+91 XXXXX XXXXX" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Alternate Contact</label>
                    <input type="tel" value={alternateContact} onChange={(e) => setAlternateContact(e.target.value)} className={inputClass} placeholder="+91 XXXXX XXXXX" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Event Website</label>
                    <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className={inputClass} placeholder="https://example.com" />
                  </div>
                </div>
                {/* Social Media */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Social Media Links</label>
                  <div className="space-y-2">
                    {['Instagram', 'Twitter', 'LinkedIn', 'Facebook'].map((platform) => (
                      <div key={platform} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-400 w-20 shrink-0">{platform}</span>
                        <input
                          type="url"
                          value={socialMediaLinks[platform.toLowerCase()] || ''}
                          onChange={(e) => setSocialMediaLinks(prev => ({ ...prev, [platform.toLowerCase()]: e.target.value }))}
                          className={inputClass}
                          placeholder={`${platform} profile or page URL`}
                        />
                      </div>
                    ))}
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
                  <textarea value={eligibilityCriteria} onChange={(e) => setEligibilityCriteria(e.target.value)} rows={2} className={inputClass} placeholder="Who can participate? Any restrictions?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Rules & Guidelines</label>
                  <textarea value={rulesAndGuidelines} onChange={(e) => setRulesAndGuidelines(e.target.value)} rows={3} className={inputClass} placeholder="Event rules, code of conduct, guidelines..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Prize Details</label>
                  <textarea value={prizeDetails} onChange={(e) => setPrizeDetails(e.target.value)} rows={2} className={inputClass} placeholder="Winner prizes, rewards, certificates, etc." />
                </div>
                <label className={checkboxClass(certificateAvailable)}>
                  <input type="checkbox" checked={certificateAvailable} onChange={(e) => setCertificateAvailable(e.target.checked)} className="w-4 h-4 text-sgt-600 rounded focus:ring-sgt-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Certificates will be provided to participants</span>
                </label>
              </div>
            </section>

            {/* ====== FAQs ====== */}
            <section>
              <SectionLabel>FAQs (Optional)</SectionLabel>
              {faqs.length > 0 && (
                <div className="space-y-2 mb-3">
                  {faqs.map((faq, i) => (
                    <div key={i} className="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 p-3 space-y-2">
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => updateFAQ(i, 'question', e.target.value)}
                        className={inputClass}
                        placeholder="Question"
                      />
                      <textarea
                        value={faq.answer}
                        onChange={(e) => updateFAQ(i, 'answer', e.target.value)}
                        rows={2}
                        className={inputClass}
                        placeholder="Answer"
                      />
                      <button
                        onClick={() => removeFAQ(i)}
                        type="button"
                        className="p-1.5 text-gray-300 hover:text-red-500 rounded-md transition-colors"
                        title="Remove FAQ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={addFAQ}
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sgt-600 dark:text-sgt-400 hover:bg-sgt-50 dark:hover:bg-sgt-900/10 rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add FAQ
              </button>
            </section>

          </div>

          {/* ── Document Footer — Action Buttons ── */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-8 py-4 bg-gray-50 dark:bg-gray-900/20">
            <div className="flex flex-wrap items-center justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || publishing}
                  className="px-5 py-2.5 bg-sgt-600 text-white text-sm font-medium rounded-md hover:bg-sgt-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Draft
                </button>
                {event.status === 'draft' && (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={saving || publishing}
                    className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    Save & Publish
                  </button>
                )}
                {event.status === 'published' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-md">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Published
                  </span>
                )}
              </div>
              <Link
                href="/events/my-events"
                className="px-5 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-white dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

