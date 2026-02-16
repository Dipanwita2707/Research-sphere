'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, MapPin, Users, UserPlus, Clock,
  Globe, Mail, Phone, User, Award, FileText, ChevronDown, ChevronUp,
  ExternalLink, CheckCircle2, IndianRupee, Settings, Monitor, Building2,
  Wifi, Shield, HelpCircle, Trophy, GraduationCap, Sparkles, MousePointerClick,
  Medal, Briefcase, ShoppingBag, Ticket, Star, Gift,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    try {
      const authStr = localStorage.getItem('auth-storage');
      if (authStr) {
        const auth = JSON.parse(authStr);
        const user = auth?.state?.user;
        setCurrentUserId(user?.id ?? null);
        
        // Get user name from various possible fields
        let userName = 'User';
        if (user) {
          if (user.firstName && user.lastName) {
            userName = `${user.firstName} ${user.lastName}`;
          } else if (user.firstName) {
            userName = user.firstName;
          } else if (user.employee?.displayName) {
            userName = user.employee.displayName;
          } else if (user.uid) {
            userName = user.uid;
          } else if (user.username) {
            userName = user.username;
          }
        }
        
        setCurrentUser({
          name: userName,
          email: user?.email || '',
        });
      }
    } catch { }
  }, []);

  const fetchEvent = async () => {
    setLoading(true);
    try {
      const data = await eventService.getEventById(id);
      setEvent(data);
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isCreator = event?.createdBy?.id === currentUserId;
  const isRegistered = !!event?.userRegistration && event?.userRegistration?.status === 'confirmed';
  const hasIncompleteRegistration = !!event?.userRegistration && event?.userRegistration?.status === 'incomplete_team';
  const isTeamBased = event?.participationType === 'team';
  const registrationOpen = event?.registrationEndDate ? new Date(event.registrationEndDate) >= new Date() : true;
  const canRegister = event?.status === 'published' && !isCreator && !event?.userRegistration && !isTeamBased && registrationOpen;

  const handleRegister = () => {
    if (!event) return;
    // ALL registrations go through the dynamic form — no legacy one-click
    router.push(`/events/${event.id}/registration`);
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtTime = (d: string) =>
    new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtShort = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const isUpcoming = event && new Date(event.startDate) > new Date();
  const isOngoing = event && new Date(event.startDate) <= new Date() && new Date(event.endDate) >= new Date();
  const capacityPercent = event?.maxCapacity ? Math.min(100, Math.round((event.currentRegistrations / event.maxCapacity) * 100)) : 0;
  const hasSocialLinks = event?.socialMediaLinks && Object.values(event.socialMediaLinks).some(v => v);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <PageSkeleton message="Loading event..." />
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16" style={{ marginTop: event.bannerImageUrl ? '-4rem' : '0' }}>

        {/* Header Card — Title + Quick Info + Register CTA */}
        <div className={`relative ${CARD} overflow-hidden mb-6 sm:mb-8`}>
          <div className="px-4 sm:px-6 md:px-10 py-6 sm:py-8">
            <div className="flex flex-col md:flex-row md:items-start gap-8">
              {/* Logo */}
              {event.logoImageUrl && (
                <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 overflow-hidden shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={event.logoImageUrl} alt="Logo" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Title area */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${statusCfg.color}`}>
                    <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                  </span>
                  <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {EVENT_TYPE_LABELS[event.eventType]}
                  </span>
                  {event.paymentType === 'free' ? (
                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">FREE</span>
                  ) : (
                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">₹{event.registrationFee}</span>
                  )}
                  {event.opportunityMode && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {MODE_ICONS[event.opportunityMode]} {event.opportunityMode}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight mb-3">{event.name}</h1>
                {event.description && (
                  <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 line-clamp-2 max-w-4xl leading-relaxed">{event.description}</p>
                )}

                {/* Quick meta row */}
                <div className="flex flex-wrap items-center gap-6 mt-6 text-sm font-medium text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900 dark:text-white">{fmtShort(event.startDate)}</span>
                    {event.startDate !== event.endDate && <span className="text-gray-900 dark:text-white">&ndash; {fmtShort(event.endDate)}</span>}
                  </span>
                  {event.venue && (
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-900 dark:text-white">{event.venue}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900 dark:text-white">{event.currentRegistrations}{event.maxCapacity ? ` / ${event.maxCapacity}` : ''} registered</span>
                  </span>
                </div>

                {/* Creator badge */}
                {isCreator && (
                  <div className="mt-5 inline-flex items-center gap-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg text-sm transition-colors">
                    <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-semibold text-indigo-700 dark:text-indigo-300">You are the organizer</span>
                    <span className="text-indigo-300/50">|</span>
                    <Link href={`/events/${event.id}/manage`} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 group">
                      <Settings className="w-4 h-4 transition-transform group-hover:rotate-90" /> Manage Event
                    </Link>
                  </div>
                )}
              </div>

              {/* Register / Registered CTA */}
              <div className="shrink-0 md:text-right space-y-3 pt-2">
                {isRegistered && event.userRegistration && (
                  <div className="flex flex-col gap-3 items-start md:items-end">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-full">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                      <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">Registered</span>
                    </div>
                    <Link
                      href="/events/registrations"
                      className="inline-flex items-center justify-center px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-sm w-full md:w-auto"
                    >
                      View Ticket
                    </Link>
                  </div>
                )}
                
                {hasIncompleteRegistration && event.userRegistration && (
                  <div className="flex flex-col gap-3 items-start md:items-end">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-full">
                      <Users className="w-5 h-5 text-orange-700 dark:text-orange-400" />
                      <span className="text-sm font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wide">Incomplete Team</span>
                    </div>
                    <Link
                      href={`/events/${event.id}/registration/team`}
                      className="inline-flex items-center justify-center px-6 py-3 bg-orange-600 dark:bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-700 dark:hover:bg-orange-600 transition-all shadow-sm w-full md:w-auto"
                    >
                      Setup Team
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══════ GRID LAYOUT ══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">

          {/* ─── LEFT COLUMN (8/12) ─── */}
          <div className="lg:col-span-8 space-y-8">

            {/* ─── UNIFIED MAIN CONTENT CARD ─── */}
            <div className={`${CARD} divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden`}>

              {/* 1. ABOUT SECTION */}
              <div className="p-8 sm:p-10">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  About This Event
                </h3>
                {event.longDescription ? (
                  <div
                    className="prose prose-lg dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed
                      prose-headings:text-gray-900 dark:prose-headings:text-white prose-headings:font-bold prose-headings:mb-4 prose-headings:mt-8
                      prose-p:mt-0 prose-p:mb-5 prose-p:leading-8
                      prose-a:text-blue-600 prose-a:font-semibold prose-a:no-underline hover:prose-a:underline
                      prose-strong:text-gray-900 dark:prose-strong:text-white prose-strong:font-bold
                      prose-ul:pl-5 prose-ol:pl-5 prose-li:my-2"
                    dangerouslySetInnerHTML={{ __html: event.longDescription }}
                  />
                ) : (
                  <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {event.description || "No description provided for this event."}
                  </p>
                )}
              </div>



              {/* 3. KEY HIGHLIGHTS GRID (Structure & Schedule) */}
              <div className="p-8 sm:p-10 bg-gray-50/60 dark:bg-gray-800/60">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-wider text-sm opacity-70">Structure & Schedule</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  {/* Date */}
                  <div className="flex gap-4">
                    <div className="mt-1 p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600"><Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Timeline</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white">{fmt(event.startDate)}</p>
                      {event.startDate !== event.endDate && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">to {fmt(event.endDate)}</p>
                      )}
                    </div>
                  </div>

                  {/* Venue */}
                  {event.venue && (
                    <div className="flex gap-4">
                      <div className="mt-1 p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600"><MapPin className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Venue</p>
                        <p className="text-base font-bold text-gray-900 dark:text-white">{event.venue}</p>
                      </div>
                    </div>
                  )}

                  {/* Mode */}
                  {event.opportunityMode && (
                    <div className="flex gap-4">
                      <div className="mt-1 p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600 text-purple-600 dark:text-purple-400">{MODE_ICONS[event.opportunityMode]}</div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Mode</p>
                        <p className="text-base font-bold text-gray-900 dark:text-white capitalize">{event.opportunityMode}</p>
                      </div>
                    </div>
                  )}

                  {/* Participation Type */}
                  {event.participationType && (
                    <div className="flex gap-4">
                      <div className="mt-1 p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600 text-emerald-600 dark:text-emerald-400">
                        {event.participationType === 'individual'
                          ? <User className="w-5 h-5" />
                          : <Users className="w-5 h-5" />
                        }
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Participation</p>
                        <p className="text-base font-bold text-gray-900 dark:text-white capitalize">
                          {event.participationType} {event.participationType === 'team' && `(${event.minTeamSize}-${event.maxTeamSize} members)`}
                        </p>
                        {event.participationType === 'team' && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {event.interCollegeAllowed && (
                              <span className="inline-flex items-center text-[10px] uppercase font-bold bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded border border-gray-200 dark:border-gray-600">Inter-College</span>
                            )}
                            {event.interSpecializationAllowed && (
                              <span className="inline-flex items-center text-[10px] uppercase font-bold bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded border border-gray-200 dark:border-gray-600">Inter-Spec</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sponsorship */}
                  {(event.hasSponsorship && Array.isArray(event.sponsors) && event.sponsors.length > 0) && (
                    <div className="flex gap-4 md:col-span-2">
                      <div className="mt-1 p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600 text-amber-600 dark:text-amber-400">
                        <IndianRupee className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sponsorship</p>
                        <div className="space-y-1.5">
                          {event.sponsors.map((s, i) => (
                            <div key={i} className="text-sm text-gray-900 dark:text-white">
                              <span className="font-medium">{s.name}</span>
                              {s.type === 'cash' ? (
                                <span className="text-gray-600 dark:text-gray-300"> — ₹ {Number(s.amount || 0).toLocaleString()}</span>
                              ) : (
                                <span className="text-gray-600 dark:text-gray-300"> — In-kind: {s.notes || '—'}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Resources */}
                  {(event.hasResources && Array.isArray(event.resources) && event.resources.length > 0) && (
                    <div className="flex gap-4 md:col-span-2">
                      <div className="mt-1 p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600 text-indigo-600 dark:text-indigo-400">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Resources</p>
                        <div className="space-y-1.5">
                          {event.resources.map((r, i) => (
                            <div key={i} className="text-sm text-gray-900 dark:text-white">
                              <span className="font-medium capitalize">{r.category}</span> — {r.type}
                              {r.description && <span className="text-gray-600 dark:text-gray-300">: {r.description}</span>}
                              {r.estimatedCost != null && <span className="text-gray-600 dark:text-gray-300"> (₹ {Number(r.estimatedCost).toLocaleString()})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reg Dates */}
                  {(event.registrationStartDate || event.registrationEndDate) && (
                    <div className="flex gap-4 sm:col-span-2 border-t border-gray-200 dark:border-gray-700/50 pt-6 mt-2">
                      <div className="mt-1 p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600"><Clock className="w-5 h-5 text-orange-500" /></div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Registration Timeline</p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                          {event.registrationStartDate && (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-500">Opens</span>
                              <span className="text-sm font-bold text-gray-900 dark:text-white">{fmtShort(event.registrationStartDate)}</span>
                            </div>
                          )}
                          {event.registrationStartDate && event.registrationEndDate && (
                            <div className="hidden sm:block w-8 h-[1px] bg-gray-300 dark:bg-gray-600" />
                          )}
                          {event.registrationEndDate && (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-500">Closes</span>
                              <span className="text-sm font-bold text-gray-900 dark:text-white">{fmtShort(event.registrationEndDate)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. RULES & ELIGIBILITY */}
              {(event.eligibilityCriteria || event.rulesAndGuidelines) && (
                <div className="p-8 sm:p-10">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-wider text-sm opacity-70">Guidelines</h3>
                  <div className="flex flex-col gap-8">
                    {event.eligibilityCriteria && (
                      <div className="flex gap-5">
                        <div className="shrink-0 w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center ring-4 ring-blue-50/50 dark:ring-blue-900/10">
                          <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">Eligibility Criteria</h4>
                          <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{event.eligibilityCriteria}</p>
                        </div>
                      </div>
                    )}
                    {event.rulesAndGuidelines && (
                      <div className="flex gap-5">
                        <div className="shrink-0 w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center ring-4 ring-red-50/50 dark:ring-red-900/10">
                          <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">Rules & Regulations</h4>
                          <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{event.rulesAndGuidelines}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. FAQs */}
              {event.faqs && event.faqs.length > 0 && (
                <div className="p-8 sm:p-10 bg-gray-50/30 dark:bg-gray-800/30">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-wider text-sm opacity-70">Frequently Asked Questions</h3>
                  <div className="space-y-4">
                    {event.faqs.map((faq, i) => (
                      <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm hover:border-gray-300 transition-colors">
                        <button
                          onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                          className="w-full flex items-center justify-between px-6 py-4 text-left"
                        >
                          <span className="text-base font-semibold text-gray-900 dark:text-white">{faq.question}</span>
                          {expandedFaq === i ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-4 text-gray-400" />}
                        </button>
                        {expandedFaq === i && (
                          <div className="px-6 pb-6 text-base text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-700 pt-4">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. PRIZE POOL SECTION (Moved to Bottom) */}
              {/* 5. PRIZE SECTION - High-Impact Reference Design */}
              {(event.prizeDetails || event.certificateAvailable || (event.prizes && event.prizes.length > 0)) && (
                <div className="p-8 sm:p-10 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/50">

                  {/* Section Label */}
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                      Rewards and Prizes
                    </h3>
                  </div>

                  <div className="space-y-6">
                    {/* 1. Dynamic Prizes List */}
                    {event.prizes && event.prizes.length > 0 && event.prizes.sort((a, b) => a.sortOrder - b.sortOrder).map((prize, idx) => (
                      <div
                        key={prize.id || idx}
                        className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
                      >
                        {/* Left Accent Bar Gradient */}
                        <div className="absolute top-0 bottom-0 left-0 w-2 bg-gradient-to-b from-emerald-400 to-emerald-600"></div>

                        {/* Subtle Gradient Glow on Left Side */}
                        <div className="absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-emerald-900/20 pointer-events-none"></div>

                        <div className="relative flex flex-col md:flex-row items-center p-6 md:p-8 gap-6 md:gap-10">

                          {/* Amount Section */}
                          <div className="flex-shrink-0 w-full md:w-48 text-left md:text-center border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 pb-4 md:pb-0 pr-0 md:pr-8">
                            {prize.prizeAmount && prize.prizeAmount > 0 ? (
                              <div className="flex flex-col items-start md:items-center">
                                <span className="text-3xl md:text-4xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight">
                                  ₹{prize.prizeAmount.toLocaleString()}
                                </span>
                                <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-widest mt-1">
                                  CASH
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-start md:items-center">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-full mb-2">
                                  <Trophy className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <span className="text-sm font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-widest">
                                  REWARD
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Content Section */}
                          <div className="flex-1 min-w-0 text-left">
                            <h4 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                              {prize.position === 1 ? 'Winner' :
                                prize.position === 2 ? '1st Runner Up' :
                                  prize.position === 3 ? '2nd Runner Up' : prize.rank}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">
                              {prize.title} {prize.prizeType !== 'cash' && `• ${prize.prizeType}`}
                            </p>
                            {prize.description && (
                              <p className="text-xs text-gray-400 mt-1 max-w-lg line-clamp-1">{prize.description}</p>
                            )}
                          </div>

                          {/* Right Badge - Certificate, etc. */}
                          <div className="flex-shrink-0 self-start md:self-center">
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full shadow-sm">
                              <Award className="w-4 h-4 text-orange-500" />
                              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Certificate</span>
                            </div>
                          </div>

                        </div>
                      </div>
                    ))}

                    {/* 2. Participation Certificate Card (Always at bottom if enabled) */}
                    {event.certificateAvailable && (
                      <div className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                        {/* No green bar for participation, lighter touch or gray */}
                        <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gray-200 dark:bg-gray-600"></div>

                        <div className="relative flex flex-col md:flex-row items-center p-6 md:p-8 gap-6 md:gap-10">

                          {/* Icon Section (Replaces Amount) */}
                          <div className="flex-shrink-0 w-full md:w-48 flex justify-start md:justify-center border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 pb-4 md:pb-0 pr-0 md:pr-8">
                            <div className="relative w-16 h-16">
                              <Gift className="w-full h-full text-blue-500 transform group-hover:scale-110 transition-transform duration-300 drop-shadow-md" />
                            </div>
                          </div>

                          {/* Content Section */}
                          <div className="flex-1 min-w-0 text-left">
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                              Participation Certificate
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                              Awarded to all eligible participants
                            </p>
                          </div>

                          {/* Right Badge */}
                          <div className="flex-shrink-0 self-start md:self-center">
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full shadow-sm">
                              <Award className="w-4 h-4 text-gray-400" />
                              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Certificate</span>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* 3. General Prizes Text Card (if description exists but no specific prizes configured) */}
                    {!event.prizes?.length && event.prizeDetails && (
                      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
                        <div className="flex items-start gap-6">
                          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl">
                            <Trophy className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Winner Rewards</h4>
                            <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                              {event.prizeDetails}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              )}

            </div>
          </div>

          {/* ─── RIGHT COLUMN (4/12) — Sidebar ─── */}
          <div className="lg:col-span-4 space-y-8">

            {/* Registration Card - Clean & Professional */}
            {!isRegistered && !hasIncompleteRegistration && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-6">

                {/* Header Row: Days Left & Eligibility Status */}
                <div className="flex items-start justify-between">
                  {event.registrationEndDate && new Date(event.registrationEndDate) >= new Date() ? (
                    <div className="flex flex-col">
                      <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {Math.ceil((new Date(event.registrationEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}
                      </span>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Days Left</span>
                    </div>
                  ) : event.registrationEndDate && new Date(event.registrationEndDate) < new Date() ? (
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-red-600 dark:text-red-400">Closed</span>
                      <span className="text-xs text-gray-500">Registration Ended</span>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">Register Now</span>
                      <span className="text-xs text-gray-500">Limited Time</span>
                    </div>
                  )}

                  {currentUser && !isCreator && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-100 dark:border-emerald-800">
                      <Sparkles className="w-3.5 h-3.5 fill-current" />
                      <span className="text-xs font-bold">You are eligible</span>
                    </div>
                  )}
                </div>

                {/* User Profile - Minimalist */}
                {currentUser && !isCreator && (
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-sm shrink-0">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{currentUser.name}</p>
                      <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                    </div>
                  </div>
                )}

                {/* Action Section */}
                <div className="space-y-3">
                  {!registrationOpen && !isCreator && !event?.userRegistration ? (
                    <div className="w-full py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm font-bold rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4" />
                      Registration Closed
                    </div>
                  ) : (
                    <>
                      {canRegister && (
                        <button
                          onClick={handleRegister}
                          className="group relative w-full py-3.5 bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-bold rounded-xl overflow-hidden transition-all hover:shadow-lg active:scale-[0.98]"
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            Register Now
                            <ArrowLeft className="w-4 h-4 rotate-180 transition-transform group-hover:translate-x-1" />
                          </span>
                        </button>
                      )}
                      {isTeamBased && event?.status === 'published' && !isCreator && !event?.userRegistration && registrationOpen && (
                        <Link
                          href={`/events/${event.id}/registration`}
                          className="group relative block w-full py-3.5 bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-bold rounded-xl overflow-hidden transition-all hover:shadow-lg active:scale-[0.98] text-center"
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            Register Team
                            <ArrowLeft className="w-4 h-4 rotate-180 transition-transform group-hover:translate-x-1" />
                          </span>
                        </Link>
                      )}
                    </>
                  )}

                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <div className="flex -space-x-1.5 grayscale opacity-70">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 border border-white dark:border-gray-800" />
                      ))}
                    </div>
                    <p>{event.currentRegistrations || 0} registered recently</p>
                  </div>
                </div>

              </div>
            )}

            {/* Show Stats When Registered */}
            {isRegistered && (
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
                      <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${event.paymentType === 'free'
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
                      <p className="text-[10px] text-gray-400 mt-1">{Math.max(0, event.maxCapacity - (event.currentRegistrations || 0))} spots remaining</p>
                    </div>
                  )}

                  {/* Registration deadline */}
                  {event.registrationEndDate && (
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">Registration closes</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{fmtShort(event.registrationEndDate)}</p>
                    </div>
                  )}

                  {/* View Ticket CTA */}
                  <Link
                    href="/events/registrations"
                    className="block w-full px-5 py-2.5 bg-sgt-600 text-white text-sm font-medium rounded-md hover:bg-sgt-700 text-center transition-colors"
                  >
                    View QR & Ticket
                  </Link>
                </div>
              </div>
            )}

            {/* Incomplete Team Registration */}
            {hasIncompleteRegistration && event.userRegistration && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-orange-300 dark:border-orange-700 shadow-sgt p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-300">Action Required</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Your registration is incomplete. Please setup your team to complete the registration process.
                </p>
                <div className="space-y-2.5 mb-4">
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Registration ID</p>
                    <p className="text-sm font-mono text-gray-900 dark:text-white">{event.userRegistration.registrationId}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Status</p>
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded mt-0.5">
                      INCOMPLETE TEAM
                    </span>
                  </div>
                </div>
                <Link
                  href={`/events/${event.id}/registration/team`}
                  className="block w-full px-5 py-2.5 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 text-center transition-colors"
                >
                  Setup Team Now
                </Link>
              </div>
            )}

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
