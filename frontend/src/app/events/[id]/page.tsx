'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, MapPin, Users, Loader2, UserPlus, Clock,
  Globe, Mail, Phone, User, Award, FileText, ChevronDown, ChevronUp,
  ExternalLink, CheckCircle2, IndianRupee, Settings, Monitor, Building2,
  Wifi, Shield, HelpCircle, Trophy, GraduationCap,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';

const EVENT_TYPE_LABELS: Record<string, string> = {
  seminar: 'Seminar', workshop: 'Workshop', fest: 'Fest',
  conference: 'Conference', competition: 'Competition',
  cultural: 'Cultural', technical: 'Technical', sports: 'Sports', other: 'Other',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', dot: 'bg-gray-400' },
  published: { label: 'Published', color: 'bg-sgt-50 text-sgt-700 dark:bg-sgt-900/20 dark:text-sgt-300', dot: 'bg-sgt-500' },
  ongoing: { label: 'Live Now', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300', dot: 'bg-emerald-500' },
  completed: { label: 'Completed', color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300', dot: 'bg-purple-500' },
  cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300', dot: 'bg-red-500' },
};

const MODE_ICONS: Record<string, React.ReactNode> = {
  online: <Monitor className="w-4 h-4" />,
  offline: <Building2 className="w-4 h-4" />,
  hybrid: <Wifi className="w-4 h-4" />,
};

/* Card wrapper — all-sides blue border + shadow */
const CARD = 'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt';

/* ─── Section label ("ABOUT", "DATES", etc.) ─── */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">{children}</h3>
);

/* ─── Inline info row (icon + label + value) ─── */
const InfoRow = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 text-gray-400 dark:text-gray-500 shrink-0">{icon}</span>
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="text-sm text-gray-900 dark:text-white mt-0.5">{children}</div>
    </div>
  </div>
);

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { toast } = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    try {
      const authStr = localStorage.getItem('auth-storage');
      if (authStr) {
        const auth = JSON.parse(authStr);
        setCurrentUserId(auth?.state?.user?.id ?? null);
      }
    } catch {}
  }, []);

  const fetchEvent = async () => {
    setLoading(true);
    try {
      const data = await eventService.getEventById(id);
      setEvent(data);
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to load event' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isCreator = event?.createdBy?.id === currentUserId;
  const isRegistered = !!event?.userRegistration;
  const canRegister = event?.status === 'published' && !isCreator && !isRegistered;

  const handleRegister = async () => {
    if (!event) return;
    setRegistering(true);
    try {
      await eventService.registerForEvent(event.id);
      toast({ type: 'success', message: 'Successfully registered for event! Check your QR code in My Registrations.' });
      fetchEvent();
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to register' });
    } finally {
      setRegistering(false);
    }
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtTime = (d: string) =>
    new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtShort = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const isUpcoming = event && new Date(event.startDate) > new Date();
  const isOngoing = event && new Date(event.startDate) <= new Date() && new Date(event.endDate) >= new Date();
  const registrationOpen = event?.registrationEndDate ? new Date(event.registrationEndDate) >= new Date() : true;
  const capacityPercent = event?.maxCapacity ? Math.min(100, Math.round((event.currentRegistrations / event.maxCapacity) * 100)) : 0;
  const hasSocialLinks = event?.socialMediaLinks && Object.values(event.socialMediaLinks).some(v => v);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-sgt-600" />
      </div>
    );
  }

  // ── Not Found ──
  if (!event) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Event Not Found</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">The event you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/events" className="inline-flex items-center gap-2 px-5 py-2.5 bg-sgt-600 text-white text-sm font-medium rounded-md hover:bg-sgt-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.draft;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">

      {/* ══════ HERO BANNER ══════ */}
      {event.bannerImageUrl ? (
        <div className="relative w-full h-56 sm:h-64 md:h-72 bg-gray-200 dark:bg-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.bannerImageUrl} alt={event.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute top-4 left-4">
            <Link href="/events" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm text-sm text-gray-700 dark:text-gray-200 rounded-md hover:bg-white transition-colors shadow-sm">
              <ArrowLeft className="w-4 h-4" /> Events
            </Link>
          </div>
        </div>
      ) : (
        <div className="pt-6 px-4">
          <div className="max-w-[950px] mx-auto">
            <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-sgt-600 transition-colors mb-5">
              <ArrowLeft className="w-4 h-4" /> Back to Events
            </Link>
          </div>
        </div>
      )}

      {/* ══════ MAIN CONTENT ══════ */}
      <div className="max-w-[950px] mx-auto px-4 pb-12" style={{ marginTop: event.bannerImageUrl ? '-3rem' : '0' }}>

        {/* Header Card — Title + Quick Info + Register CTA */}
        <div className={`relative ${CARD} overflow-hidden mb-6`}>
          <div className="px-6 sm:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              {/* Logo */}
              {event.logoImageUrl && (
                <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 overflow-hidden shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={event.logoImageUrl} alt="Logo" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Title area */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md ${statusCfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                  </span>
                  <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {EVENT_TYPE_LABELS[event.eventType]}
                  </span>
                  {event.paymentType === 'free' ? (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">FREE</span>
                  ) : (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">₹{event.registrationFee}</span>
                  )}
                  {event.opportunityMode && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                      {MODE_ICONS[event.opportunityMode]} {event.opportunityMode}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight">{event.name}</h1>
                {event.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">{event.description}</p>
                )}

                {/* Quick meta row */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {fmtShort(event.startDate)}
                    {event.startDate !== event.endDate && <> &ndash; {fmtShort(event.endDate)}</>}
                  </span>
                  {event.venue && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-gray-400" /> {event.venue}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-gray-400" />
                    {event.currentRegistrations}{event.maxCapacity ? ` / ${event.maxCapacity}` : ''} registered
                  </span>
                </div>

                {/* Creator badge */}
                {isCreator && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-sgt-50 dark:bg-sgt-900/20 border border-sgt-100 dark:border-sgt-800 rounded-md text-sm">
                    <Shield className="w-3.5 h-3.5 text-sgt-600 dark:text-sgt-400" />
                    <span className="font-medium text-sgt-700 dark:text-sgt-300">You are the organizer</span>
                    <span className="text-gray-300">|</span>
                    <Link href={`/events/${event.id}/manage`} className="font-medium text-sgt-600 dark:text-sgt-400 hover:underline flex items-center gap-1">
                      <Settings className="w-3.5 h-3.5" /> Manage
                    </Link>
                  </div>
                )}
              </div>

              {/* Register / Registered CTA */}
              <div className="shrink-0 sm:text-right space-y-2">
                {isRegistered && event.userRegistration && (
                  <>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Registered</span>
                    </div>
                    <Link
                      href="/events/registrations"
                      className="block px-5 py-2.5 bg-sgt-600 text-white text-sm font-medium rounded-md hover:bg-sgt-700 transition-colors text-center"
                    >
                      View QR & Ticket
                    </Link>
                  </>
                )}
                {canRegister && (
                  <button
                    onClick={handleRegister}
                    disabled={registering}
                    className="px-6 py-3 bg-sgt-600 text-white text-sm font-semibold rounded-md hover:bg-sgt-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
                  >
                    {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Register for Event
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Capacity bar */}
          {event.maxCapacity && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-6 sm:px-8 py-3 bg-gray-50 dark:bg-gray-900/20">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <span>Registration capacity</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">{capacityPercent}% filled</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${capacityPercent >= 90 ? 'bg-red-500' : capacityPercent >= 70 ? 'bg-amber-500' : 'bg-sgt-500'}`}
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ══════ TWO-COLUMN LAYOUT ══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ─── LEFT COLUMN (2/3) ─── */}
          <div className="lg:col-span-2 space-y-6">

            {/* About / Long Description */}
            {event.longDescription && (
              <div className={`${CARD} p-6 sm:p-8`}>
                <SectionLabel>About This Event</SectionLabel>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed
                    prose-headings:text-gray-900 dark:prose-headings:text-white prose-headings:font-semibold
                    prose-a:text-sgt-600 prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-gray-900 dark:prose-strong:text-white
                    prose-ul:pl-4 prose-ol:pl-4"
                  dangerouslySetInnerHTML={{ __html: event.longDescription }}
                />
              </div>
            )}

            {/* If no long description, show short description */}
            {!event.longDescription && event.description && (
              <div className={`${CARD} p-6 sm:p-8`}>
                <SectionLabel>About This Event</SectionLabel>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{event.description}</p>
              </div>
            )}

            {/* Date & Venue Card */}
            <div className={`${CARD} p-6 sm:p-8`}>
              <SectionLabel>Date & Venue</SectionLabel>
              <div className="grid sm:grid-cols-2 gap-5">
                <InfoRow icon={<Calendar className="w-4 h-4" />} label="Event Dates">
                  <p className="font-medium">{fmt(event.startDate)}</p>
                  {event.startDate !== event.endDate && (
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">to {fmt(event.endDate)}</p>
                  )}
                </InfoRow>
                {event.venue && (
                  <InfoRow icon={<MapPin className="w-4 h-4" />} label="Venue">
                    <p className="font-medium">{event.venue}</p>
                  </InfoRow>
                )}
                {event.opportunityMode && (
                  <InfoRow icon={MODE_ICONS[event.opportunityMode]} label="Mode">
                    <p className="font-medium capitalize">{event.opportunityMode}</p>
                  </InfoRow>
                )}
                {(event.registrationStartDate || event.registrationEndDate) && (
                  <InfoRow icon={<Clock className="w-4 h-4" />} label="Registration Period">
                    {event.registrationStartDate && <p>{fmtShort(event.registrationStartDate)}</p>}
                    {event.registrationStartDate && event.registrationEndDate && <span className="text-xs text-gray-400"> to </span>}
                    {event.registrationEndDate && <p>{fmtShort(event.registrationEndDate)}</p>}
                  </InfoRow>
                )}
              </div>
            </div>

            {/* Participation & Mode */}
            {(event.participationType || event.opportunityMode) && (
              <div className={`${CARD} p-6 sm:p-8`}>
                <SectionLabel>Participation Details</SectionLabel>
                <div className="grid sm:grid-cols-2 gap-4">
                  {event.participationType && (
                    <div className="flex items-center gap-3 p-3 rounded-md bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
                      {event.participationType === 'individual'
                        ? <User className="w-5 h-5 text-sgt-600 dark:text-sgt-400" />
                        : <Users className="w-5 h-5 text-sgt-600 dark:text-sgt-400" />
                      }
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{event.participationType} Participation</p>
                        {event.participationType === 'team' && event.minTeamSize && event.maxTeamSize && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">Team size: {event.minTeamSize} – {event.maxTeamSize} members</p>
                        )}
                      </div>
                    </div>
                  )}
                  {event.participationType === 'team' && (
                    <>
                      {event.interCollegeAllowed && (
                        <div className="flex items-center gap-3 p-3 rounded-md bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          <p className="text-sm font-medium text-gray-900 dark:text-white">Inter-college teams allowed</p>
                        </div>
                      )}
                      {event.interSpecializationAllowed && (
                        <div className="flex items-center gap-3 p-3 rounded-md bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          <p className="text-sm font-medium text-gray-900 dark:text-white">Inter-specialization teams allowed</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Eligibility & Rules */}
            {(event.eligibilityCriteria || event.rulesAndGuidelines) && (
              <div className={`${CARD} p-6 sm:p-8`}>
                <SectionLabel>Eligibility & Rules</SectionLabel>
                <div className="space-y-5">
                  {event.eligibilityCriteria && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-gray-400" /> Eligibility
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed pl-6">{event.eligibilityCriteria}</p>
                    </div>
                  )}
                  {event.rulesAndGuidelines && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-gray-400" /> Rules & Guidelines
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed pl-6">{event.rulesAndGuidelines}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prizes & Certificates */}
            {(event.prizeDetails || event.certificateAvailable) && (
              <div className={`${CARD} p-6 sm:p-8`}>
                <SectionLabel>Prizes & Recognition</SectionLabel>
                {event.prizeDetails && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-500" /> Prize Details
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed pl-6">{event.prizeDetails}</p>
                  </div>
                )}
                {event.certificateAvailable && (
                  <div className="flex items-center gap-3 p-3 rounded-md bg-sgt-50/50 dark:bg-sgt-900/10 border border-sgt-100 dark:border-sgt-800">
                    <Award className="w-5 h-5 text-sgt-600 dark:text-sgt-400" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Certificates will be provided to participants</p>
                  </div>
                )}
              </div>
            )}

            {/* FAQs */}
            {event.faqs && event.faqs.length > 0 && (
              <div className={`${CARD} p-6 sm:p-8`}>
                <SectionLabel>Frequently Asked Questions</SectionLabel>
                <div className="space-y-2">
                  {event.faqs.map((faq, i) => (
                    <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-md overflow-hidden">
                      <button
                        onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-sgt-500 shrink-0" />
                          {faq.question}
                        </span>
                        {expandedFaq === i
                          ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                        }
                      </button>
                      {expandedFaq === i && (
                        <div className="px-4 pb-3 pl-10">
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT COLUMN (1/3) — Sidebar ─── */}
          <div className="space-y-6">

            {/* Registration Stats */}
            <div className={`${CARD} p-6`}>
              <SectionLabel>Registration</SectionLabel>
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{event.currentRegistrations}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {event.maxCapacity ? `of ${event.maxCapacity} spots` : 'participants'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${
                      event.paymentType === 'free'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                    }`}>
                      {event.paymentType === 'free' ? 'FREE' : `₹${event.registrationFee}`}
                    </span>
                  </div>
                </div>

                {event.maxCapacity && (
                  <div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${capacityPercent >= 90 ? 'bg-red-500' : capacityPercent >= 70 ? 'bg-amber-500' : 'bg-sgt-500'}`}
                        style={{ width: `${capacityPercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{event.maxCapacity - event.currentRegistrations} spots remaining</p>
                  </div>
                )}

                {/* Registration deadline */}
                {event.registrationEndDate && (
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Registration closes</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{fmtShort(event.registrationEndDate)}</p>
                  </div>
                )}

                {/* CTA */}
                {canRegister && (
                  <button
                    onClick={handleRegister}
                    disabled={registering}
                    className="w-full px-5 py-2.5 bg-sgt-600 text-white text-sm font-semibold rounded-md hover:bg-sgt-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Register Now
                  </button>
                )}
                {isRegistered && (
                  <Link
                    href="/events/registrations"
                    className="block w-full px-5 py-2.5 bg-sgt-600 text-white text-sm font-medium rounded-md hover:bg-sgt-700 text-center transition-colors"
                  >
                    View QR & Ticket
                  </Link>
                )}
              </div>
            </div>

            {/* Your Registration (if registered) */}
            {isRegistered && event.userRegistration && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-emerald-300 dark:border-emerald-700 shadow-sgt p-6">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Your Registration</h3>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Registration ID</p>
                    <p className="text-sm font-mono text-gray-900 dark:text-white">{event.userRegistration.registrationId}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Status</p>
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded mt-0.5">
                      {event.userRegistration.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Registered On</p>
                    <p className="text-sm text-gray-900 dark:text-white">{fmtShort(event.userRegistration.registeredAt)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Contact Information */}
            {(event.contactPersonName || event.contactEmail || event.contactMobile || event.websiteUrl) && (
              <div className={`${CARD} p-6`}>
                <SectionLabel>Contact</SectionLabel>
                <div className="space-y-3">
                  {event.contactPersonName && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <User className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-900 dark:text-white font-medium">{event.contactPersonName}</span>
                    </div>
                  )}
                  {event.contactEmail && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                      <a href={`mailto:${event.contactEmail}`} className="text-sgt-600 dark:text-sgt-400 hover:underline truncate">{event.contactEmail}</a>
                    </div>
                  )}
                  {event.contactMobile && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                      <a href={`tel:${event.contactMobile}`} className="text-gray-900 dark:text-white">{event.contactMobile}</a>
                    </div>
                  )}
                  {event.alternateContact && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-400">{event.alternateContact} <span className="text-xs text-gray-400">(Alt)</span></span>
                    </div>
                  )}
                  {event.websiteUrl && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                      <a href={event.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sgt-600 dark:text-sgt-400 hover:underline truncate flex items-center gap-1">
                        {event.websiteUrl.replace(/^https?:\/\//, '')} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Social Media */}
                {hasSocialLinks && (
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">Social Media</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(event.socialMediaLinks!).filter(([, v]) => v).map(([platform, url]) => (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-sgt-50 hover:text-sgt-700 dark:hover:bg-sgt-900/20 dark:hover:text-sgt-300 transition-colors capitalize"
                        >
                          {platform}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Organizer */}
            {event.createdBy && (
              <div className={`${CARD} p-6`}>
                <SectionLabel>Organized By</SectionLabel>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sgt-50 dark:bg-sgt-900/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-sgt-600 dark:text-sgt-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{event.createdBy.name}</p>
                    {event.createdBy.email && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{event.createdBy.email}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Event ID */}
            <div className={`${CARD} p-6`}>
              <SectionLabel>Event Reference</SectionLabel>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-gray-400 uppercase">Event ID</span>
                  <span className="px-2.5 py-1 rounded-md bg-sgt-50 dark:bg-sgt-900/20 border border-sgt-100 dark:border-sgt-800 font-mono text-xs font-semibold text-sgt-700 dark:text-sgt-300">
                    {event.eventId}
                  </span>
                </div>
                {event.notingId && event.note && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-gray-400 uppercase">Noting</span>
                    <Link href={`/noting/${event.notingId}`} className="text-xs text-sgt-600 dark:text-sgt-400 hover:underline flex items-center gap-1">
                      View Noting <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-gray-400 uppercase">Published</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{event.publishedAt ? fmtShort(event.publishedAt) : 'Not yet'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
