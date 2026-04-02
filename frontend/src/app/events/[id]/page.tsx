"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  User,
  Award,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  IndianRupee,
  Settings,
  Monitor,
  Building2,
  Wifi,
  Shield,
  Trophy,
  GraduationCap,
  Clock,
  Globe,
} from "lucide-react";
import { useEvent } from "@/features/event-management/hooks/useEvents";
import {
  EVENT_TYPE_LABELS,
  STATUS_CONFIG,
} from "@/features/event-management/constants";
import type { Event } from "@/features/event-management/types/event.types";
import { useAuthStore } from "@/shared/auth/authStore";
import { PageSkeleton } from "@/shared/components/PageSkeleton";
import { API_URL } from "@/shared/api/api";

const EventPrizesSection = dynamic(() => import("./components/EventPrizesSection"), { ssr: false });
const EventSidebar = dynamic(() => import("./components/EventSidebar"), { ssr: false });

const MODE_ICONS: Record<string, React.ReactNode> = {
  online: <Monitor className="w-4 h-4" />,
  offline: <Building2 className="w-4 h-4" />,
  hybrid: <Wifi className="w-4 h-4" />,
};

function resolveImageUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("http")) return raw;
  // Use same-origin in browser so img src goes through Next.js proxy (auth cookies sent)
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/v1/file-upload/download/${raw}`;
  }
  return `${API_URL}/file-upload/download/${raw}`;
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data: event, isLoading: loading } = useEvent(id);
  const { user } = useAuthStore();

  const searchParams = useSearchParams();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get("tab") || "overview";
  });

  const currentUserId = user?.id ?? null;
  const currentUser = useMemo(() => {
    if (!user) return null;
    let userName = "User";
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
    return { name: userName, email: user.email || "" };
  }, [user]);

  const isCreator = event?.createdBy?.id ===
   currentUserId;
  const isRegistered =
    !!event?.userRegistration &&
    event?.userRegistration?.status ===
   "confirmed";
  const hasIncompleteRegistration =
    !!event?.userRegistration &&
    event?.userRegistration?.status ===
   "incomplete_team";
  const hasPendingPayment =
    !!event?.userRegistration &&
    event?.userRegistration?.status ===
   "pending" &&
    event?.paymentType ===
   "paid";
  const isTeamBased = event?.participationType ===
   "team";
  const registrationOpen = event?.registrationEndDate
    ? new Date(event.registrationEndDate) >= new Date()
    : true;
  const canRegister =
    event?.status ===
   "published" &&
    !isCreator &&
    !event?.userRegistration &&
    !isTeamBased &&
    registrationOpen;

  const handleRegister = () => {
    if (!event) return;
    router.push(`/events/${event.id}/registration`);
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const fmtTime = (d: string) =>
    new Date(d).toLocaleString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const fmtCompact = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const isUpcoming = event && new Date(event.startDate) > new Date();
  const isOngoing =
    event &&
    new Date(event.startDate) <= new Date() &&
    new Date(event.endDate) >= new Date();
  const capacityPercent = event?.maxCapacity
    ? Math.min(
        100,
        Math.round((event.currentRegistrations / event.maxCapacity) * 100),
      )
    : 0;
  const hasSocialLinks =
    event?.socialMediaLinks &&
    Object.values(event.socialMediaLinks).some((v) => v);

  const publicRegistrationCount = event?.currentRegistrations || 0;

  const hasPrizesContent = !!(event?.prizeDetails || event?.certificateAvailable || (event?.prizes && event.prizes.length > 0));
  const hasGuidelinesContent = !!(event?.eligibilityCriteria || event?.rulesAndGuidelines);
  const hasFaqContent = !!(event?.faqs && event.faqs.length > 0);
  const hasContactContent = !!(event?.contactPersonName || event?.contactEmail || event?.contactMobile || event?.websiteUrl);

  const tabs = useMemo(() => {
    if (!event) return [];
    const t = [
      { id: "overview", label: "Overview", icon: <Globe className="w-4 h-4" /> },
      { id: "schedule", label: "Schedule", icon: <Calendar className="w-4 h-4" /> },
    ];
    if (hasGuidelinesContent) t.push({ id: "guidelines", label: "Rules", icon: <FileText className="w-4 h-4" /> });
    if (hasPrizesContent) t.push({ id: "prizes", label: "Prizes", icon: <Trophy className="w-4 h-4" /> });
    if (hasFaqContent) t.push({ id: "faq", label: "FAQ", icon: <ChevronDown className="w-4 h-4" /> });
    if (hasContactContent) t.push({ id: "contact", label: "Contact", icon: <User className="w-4 h-4" /> });
    return t;
  }, [event, hasGuidelinesContent, hasPrizesContent, hasFaqContent, hasContactContent]);

  const switchTab = (tabId: string) => {
    setActiveTab(tabId);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tabId);
    window.history.replaceState(null, "", url.toString());
  };

  if (loading) {
    return (
      <div className="ev-page flex items-center justify-center">
        <PageSkeleton message="Loading event..." />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="ev-page flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-bold text-ev-900 mb-1">Event Not Found</h2>
          <p className="text-sm text-ev-400 mb-5">The event you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/events" className="ev-btn">
            <ArrowLeft className="w-4 h-4" /> Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.draft;
  const durationLabel = event.startDate !== event.endDate
    ? `${fmtCompact(event.startDate)} - ${fmtCompact(event.endDate)}`
    : fmtCompact(event.startDate);
  const heroBackgroundUrl = event.bannerImageUrl
    ? resolveImageUrl(event.bannerImageUrl)
    : "";
  const heroLogoUrl = event.logoImageUrl ? resolveImageUrl(event.logoImageUrl) : "";

  return (
    <div className="ev-page min-h-screen bg-[#f4f8fc]">
      {/* ==========
   HERO BANNER ==========
   */}
      <section
        className="relative overflow-hidden min-h-[340px] lg:min-h-[380px]"
        style={heroBackgroundUrl
          ? {
              backgroundImage: `url("${heroBackgroundUrl}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundColor: "#003d6b",
            }
          : { background: "linear-gradient(135deg, #005b96 0%, #004a80 50%, #003d6b 100%)" }}
      >
        {heroBackgroundUrl && <div className="absolute inset-0 bg-[#00172f]/26" />}
        <div className="absolute inset-y-0 left-0 w-full lg:w-[64%] bg-gradient-to-r from-black/72 via-black/40 to-transparent" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Top bar */}
          <div className="flex items-center justify-between pt-5 pb-2">
            <div className="flex items-center gap-3">
              {publicRegistrationCount > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
                  <Users className="w-4 h-4" />
                  {publicRegistrationCount} Registered
                </span>
              )}
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold uppercase tracking-wider ${statusCfg.color}`}>
              <span className={`h-2 w-2 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
            </span>
          </div>

          <div className="pb-10 pt-4 lg:pb-12 lg:pt-6">
            <div className="flex max-w-4xl flex-col justify-center">
              {heroLogoUrl && (
                <div className="mb-4 inline-flex w-fit items-center rounded-xl bg-white/95 p-2 shadow-lg ring-1 ring-black/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroLogoUrl}
                    alt={`${event.name} logo`}
                    className="h-12 w-12 rounded-lg object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.75)] sm:text-5xl lg:text-[3.25rem]">
                {event.name}
              </h1>
              {event.description && (
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/90 drop-shadow-[0_3px_12px_rgba(0,0,0,0.75)] sm:text-lg">
                  {event.description}
                </p>
              )}

              {/* Meta chips - white boxes, bold text */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-ev-900 shadow-sm">
                  <Calendar className="w-4 h-4 text-sgt-600" />
                  {durationLabel}
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold capitalize text-ev-900 shadow-sm">
                  {event.participationType ===
   "team" ? <Users className="w-4 h-4 text-sgt-600" /> : <User className="w-4 h-4 text-sgt-600" />}
                  {event.participationType || "Individual"}
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold capitalize text-ev-900 shadow-sm">
                  {event.opportunityMode ? MODE_ICONS[event.opportunityMode] : <Building2 className="w-4 h-4 text-sgt-600" />}
                  {event.opportunityMode || "Offline"}
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-ev-900 shadow-sm">
                  <Award className="w-4 h-4 text-sgt-600" />
                  {EVENT_TYPE_LABELS[event.eventType]}
                </span>
                {event.paymentType ===
   "free" ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 shadow-sm">
                    Free Entry
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-amber-700 shadow-sm">
                    <IndianRupee className="w-4 h-4" />
                    ₹{event.registrationFee}
                  </span>
                )}
              </div>

              {/* Organizer */}
              {event.createdBy && (
                <div className="mt-5 inline-flex items-center gap-3 text-sm text-white/80">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-bold text-white">
                    {event.createdBy.name.charAt(0).toUpperCase()}
                  </span>
                  <span>Organized by: <span className="font-semibold text-white/90">{event.createdBy.name}</span></span>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {canRegister && (
                  <button
                    onClick={handleRegister}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:shadow-emerald-500/40 hover:brightness-110 active:scale-[0.98]"
                  >
                    Register Now
                    <ArrowLeft className="w-5 h-5 rotate-180" />
                  </button>
                )}
                {isTeamBased && event.status ===
   "published" && !isCreator && !event.userRegistration && registrationOpen && (
                  <Link
                    href={`/events/${event.id}/registration`}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:shadow-emerald-500/40 hover:brightness-110 active:scale-[0.98]"
                  >
                    Register Now
                    <ArrowLeft className="w-5 h-5 rotate-180" />
                  </Link>
                )}
                {isCreator && (
                  <Link
                    href={`/events/${event.id}/manage`}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-slate-900/85 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-black/25 transition hover:bg-slate-800/90"
                  >
                    <Settings className="w-4 h-4" />
                    Manage Event
                  </Link>
                )}
                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-slate-800/85 px-5 py-3 text-base font-medium text-white shadow-lg shadow-black/20 transition hover:bg-slate-700/90"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Events
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========
   STICKY TAB NAVIGATION ==========
   */}
      <div className="sticky top-0 z-40 border-b border-[#b3cde0]/40 bg-[#f7fbff]/95 shadow-sm backdrop-blur">
        <nav className="flex items-center justify-start gap-0 overflow-x-auto scrollbar-hide -mb-px min-w-0 px-4 sm:px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`relative flex items-center gap-2 whitespace-nowrap px-6 py-4 text-sm font-semibold transition-colors ${
                activeTab ===
   tab.id
                  ? "text-sgt-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:rounded-t-full after:bg-sgt-600"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ==========
   TWO-COLUMN CONTENT AREA ==========
   */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px]">
          {/* --- LEFT: Tab Content (only active tab shown) --- */}
          <div>
            {/* =====
   OVERVIEW TAB =====
   */}
            {activeTab ===
   "overview" && (
              <div className="space-y-6">
                <section className="rounded-2xl border border-[#b3cde0]/45 bg-white/95 shadow-[0_2px_12px_rgba(0,91,150,0.08)]">
                  <div className="border-b border-[#b3cde0]/35 px-6 py-4 sm:px-8">
                    <h2 className="text-lg font-bold text-ev-900">About</h2>
                  </div>
                  <div className="px-6 py-6 sm:px-8">
                    {event.longDescription ? (
                      <div
                        className="noting-description-content text-base leading-relaxed text-gray-700"
                        dangerouslySetInnerHTML={{ __html: event.longDescription }}
                      />
                    ) : (
                      <p className="text-base leading-relaxed text-gray-600 whitespace-pre-wrap">
                        {event.description || "No description provided for this event."}
                      </p>
                    )}

                    <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <div className="rounded-xl border border-[#b3cde0]/35 bg-[#f8fbff] p-4">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                          <Calendar className="w-4 h-4" />
                          <span className="text-xs font-semibold uppercase tracking-wider">Date</span>
                        </div>
                        <p className="text-sm font-bold text-ev-900">{fmt(event.startDate)}</p>
                        {event.startDate !== event.endDate && (
                          <p className="text-xs text-gray-500 mt-0.5">to {fmt(event.endDate)}</p>
                        )}
                      </div>
                      {event.venue && (
                        <div className="rounded-xl border border-[#b3cde0]/35 bg-[#f8fbff] p-4">
                          <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <MapPin className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Venue</span>
                          </div>
                          <p className="text-sm font-bold text-ev-900">{event.venue}</p>
                        </div>
                      )}
                      <div className="rounded-xl border border-[#b3cde0]/35 bg-[#f8fbff] p-4">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                          {event.participationType ===
   "individual" ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                          <span className="text-xs font-semibold uppercase tracking-wider">Format</span>
                        </div>
                        <p className="text-sm font-bold text-ev-900 capitalize">{event.participationType || "Individual"}</p>
                        {isTeamBased && (
                          <p className="text-xs text-gray-500 mt-0.5">{event.minTeamSize}-{event.maxTeamSize} members</p>
                        )}
                      </div>
                    </div>

                    {event.festivalNotingId && event.festivalMeta?.name && (
                      <div className="mt-4 inline-flex items-center rounded-lg bg-fuchsia-50 px-4 py-2 text-sm font-medium text-fuchsia-700 ring-1 ring-fuchsia-100">
                        Part of {event.festivalMeta.name}
                      </div>
                    )}

                    {isCreator && (
                      <div className="mt-6 flex items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                        <Shield className="w-4 h-4 shrink-0" />
                        <span className="font-semibold">You are managing this event</span>
                        <Link
                          href={`/events/${event.id}/manage`}
                          className="ml-auto inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          <Settings className="w-4 h-4" />
                          Control Panel
                        </Link>
                      </div>
                    )}
                  </div>
                </section>

                {/* Sponsors in Overview tab */}
                {event.showSponsorshipPublicly && event.hasSponsorship && Array.isArray(event.sponsors) && event.sponsors.length > 0 && (
                  <section className="rounded-2xl border border-[#b3cde0]/45 bg-white/95 shadow-[0_2px_12px_rgba(0,91,150,0.08)]">
                    <div className="border-b border-[#b3cde0]/35 px-6 py-4 sm:px-8">
                      <h2 className="text-lg font-bold text-ev-900">Our Partners</h2>
                    </div>
                    <div className="px-6 py-6 sm:px-8">
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                        {event.sponsors.map((s: any, i: number) => {
                          const isNewFormat = !!s.contributionType;
                          const SPONSOR_TYPE_LABELS: Record<string, string> = { corporate: "Corporate", individual: "Individual", organization: "Organization", other: "Other" };
                          return (
                            <div
                              key={i}
                              className="flex flex-col items-center rounded-xl border border-[#b3cde0]/35 bg-[#fbfdff] p-4 text-center transition hover:border-sgt-200 hover:shadow-sm"
                            >
                              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-sgt-50/50 text-sgt-600 overflow-hidden">
                                {s.sponsorLogo?.filePath ? (
                                  <img
                                    src={resolveImageUrl(s.sponsorLogo.filePath)}
                                    alt={s.name}
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <Building2 className="w-6 h-6" />
                                )}
                              </div>
                              <p className="mt-3 text-sm font-bold text-ev-900">{s.name}</p>
                              {isNewFormat && s.sponsorType && (
                                <p className="text-xs text-gray-500 mt-0.5">{SPONSOR_TYPE_LABELS[s.sponsorType] || "Partner"}</p>
                              )}
                              {!isNewFormat && s.type ===
   "cash" && s.amount && (
                                <p className="text-xs text-sgt-600 font-semibold mt-1">₹{Number(s.amount).toLocaleString()}</p>
                              )}
                              {isNewFormat && s.contributionType ===
   "cash" && s.cashAmount && (
                                <p className="text-xs text-sgt-600 font-semibold mt-1">₹{Number(s.cashAmount).toLocaleString()}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* =====
   SCHEDULE TAB =====
   */}
            {activeTab ===
   "schedule" && (
              <section className="py-2">
                <div className="relative">
                  {/* Single continuous vertical timeline line */}
                  {(event.rounds && event.rounds.length > 1) && (
                    <div
                      className="absolute left-7 top-7 bottom-7 w-0.5 bg-gray-200"
                      aria-hidden
                    />
                  )}
                  <div className="space-y-6">
                    {(event.rounds && event.rounds.length > 0 ? event.rounds : []).map((round, idx) => {
                      const rStart = new Date(round.startTime);
                      const rEnd = new Date(round.endTime);
                      const now = new Date();
                      const isLive = now >= rStart && now <= rEnd;
                      const isPast = now > rEnd;
                      const ROUND_TYPE_STYLES: Record<string, string> = {
                        elimination: "bg-amber-50 text-amber-700 ring-amber-200",
                        final: "bg-purple-50 text-purple-700 ring-purple-200",
                        general: "bg-blue-50 text-blue-700 ring-blue-200",
                      };
                      const ROUND_TYPE_LABELS: Record<string, string> = {
                        elimination: "Elimination Round",
                        final: "Final Round",
                        general: "General",
                      };
                      const typeStyle = ROUND_TYPE_STYLES[round.roundType || "general"] || ROUND_TYPE_STYLES.general;
                      const typeLabel = ROUND_TYPE_LABELS[round.roundType || "general"] || "General";
                      const modeLabel = event.opportunityMode ? event.opportunityMode.charAt(0).toUpperCase() + event.opportunityMode.slice(1) : "Offline";
                      const dateBoxBg = isLive ? "bg-red-50" : isPast ? "bg-gray-100" : "bg-indigo-50";
                      const dateBoxText = isLive ? "text-red-700" : isPast ? "text-gray-500" : "text-indigo-700";
                      return (
                        <div key={round.id} className="relative flex gap-4 sm:gap-6">
                          <div className="relative z-10 flex shrink-0 flex-col items-center">
                            <div className={`flex h-14 w-14 flex-col items-center justify-center rounded-lg ${dateBoxBg} ${dateBoxText}`}>
                              <span className="text-lg font-bold leading-none">{rStart.getDate()}</span>
                              <span className="text-[10px] font-medium uppercase">{rStart.toLocaleDateString("en-IN", { month: "short" })}</span>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1 rounded-2xl border border-[#b3cde0]/45 bg-white/95 p-5 shadow-[0_2px_12px_rgba(0,91,150,0.08)]">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-bold text-gray-900">{round.name}</h3>
                                {isLive && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600 ring-1 ring-red-100">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                    Live
                                  </span>
                                )}
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${typeStyle}`}>
                                  {typeLabel}
                                </span>
                              </div>
                              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-600">
                                <Globe className="w-3 h-3" />
                                {modeLabel}
                              </span>
                            </div>
                            {round.description && (
                              <p className="mt-2 text-sm text-gray-500">{round.description}</p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-4">
                              <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                                <div className="text-sm">
                                  <span className="font-medium text-gray-600">Start</span>
                                  <span className="ml-1.5 text-gray-700">{fmtTime(round.startTime)}</span>
                                </div>
                              </div>
                              <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                                <div className="text-sm">
                                  <span className="font-medium text-gray-600">End</span>
                                  <span className="ml-1.5 text-gray-700">{fmtTime(round.endTime)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {/* Fallback: no rounds created, show basic event timeline */}
                  {(!event.rounds || event.rounds.length ===
   0) && (() => {
                    const start = new Date(event.startDate);
                    const modeLabel = event.opportunityMode ? event.opportunityMode.charAt(0).toUpperCase() + event.opportunityMode.slice(1) : "Offline";
                    return (
                      <div className="relative flex gap-4 sm:gap-6">
                        <div className="relative z-10 flex shrink-0 flex-col items-center">
                          <div className="flex h-14 w-14 flex-col items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                            <span className="text-lg font-bold leading-none">{start.getDate()}</span>
                            <span className="text-[10px] font-medium uppercase">{start.toLocaleDateString("en-IN", { month: "short" })}</span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 rounded-2xl border border-[#b3cde0]/45 bg-white/95 p-5 shadow-[0_2px_12px_rgba(0,91,150,0.08)]">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-gray-900">{event.name}</h3>
                              {isOngoing && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600 ring-1 ring-red-100">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                  Live
                                </span>
                              )}
                              {isUpcoming && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700 ring-1 ring-sky-100">Upcoming</span>}
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">{EVENT_TYPE_LABELS[event.eventType]}</span>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-600">
                              <Globe className="w-3 h-3" />
                              {modeLabel}
                            </span>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-4">
                            <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                              <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                              <div className="text-sm">
                                <span className="font-medium text-gray-600">Start</span>
                                <span className="ml-1.5 text-gray-700">{fmtTime(event.startDate)}</span>
                              </div>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                              <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                              <div className="text-sm">
                                <span className="font-medium text-gray-600">End</span>
                                <span className="ml-1.5 text-gray-700">{fmtTime(event.endDate)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {isTeamBased && (
                    <div className="ml-20 flex flex-wrap gap-2">
                      {event.interCollegeAllowed && (
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm">Inter-College Allowed</span>
                      )}
                      {event.interSpecializationAllowed && (
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm">Inter-Specialization Allowed</span>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              </section>
            )}

            {/* =====
   RULES TAB =====
   */}
            {activeTab ===
   "guidelines" && hasGuidelinesContent && (
              <section className="rounded-2xl border border-[#b3cde0]/45 bg-white/95 shadow-[0_2px_12px_rgba(0,91,150,0.08)]">
                <div className="border-b border-[#b3cde0]/35 px-6 py-4 sm:px-8">
                  <h2 className="text-lg font-bold text-ev-900">Rules</h2>
                </div>
                <div className="px-6 py-6 sm:px-8 space-y-8">
                  {event.eligibilityCriteria && (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sgt-50/60 ring-1 ring-sgt-200/40">
                          <GraduationCap className="w-4.5 h-4.5 text-sgt-600" />
                        </div>
                        <h3 className="text-base font-bold text-ev-900">Eligibility Criteria</h3>
                      </div>
                      {(() => {
                        const displayFmt = event.eligibilityDisplayFormat || "paragraph";
                        const text = event.eligibilityCriteria || "";
                        const bothParts = text.split("\n\n---POINTS---\n\n");
                        const paragraph = bothParts[0]?.trim() || "";
                        const points =
                          displayFmt ===
   "both"
                            ? bothParts[1]
                              ? bothParts[1].split("\n").map((s) => s.trim()).filter(Boolean)
                              : []
                            : text.split(/\n/).map((s) => s.trim()).filter(Boolean);
                        if (displayFmt ===
   "points") {
                          return (
                            <ul className="space-y-2 pl-1">
                              {points.map((p, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                  <CheckCircle2 className="w-4 h-4 text-sgt-400 shrink-0 mt-0.5" />
                                  {p}
                                </li>
                              ))}
                            </ul>
                          );
                        }
                        if (displayFmt ===
   "both") {
                          return (
                            <div className="space-y-3">
                              {paragraph && <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{paragraph}</p>}
                              {points.length > 0 && (
                                <ul className="space-y-2 pl-1">
                                  {points.map((p, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                      <CheckCircle2 className="w-4 h-4 text-sgt-400 shrink-0 mt-0.5" />
                                      {p}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        }
                        return <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{text}</p>;
                      })()}
                    </div>
                  )}

                  {event.rulesAndGuidelines && (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sgt-50/60 ring-1 ring-sgt-200/40">
                          <FileText className="w-4.5 h-4.5 text-sgt-600" />
                        </div>
                        <h3 className="text-base font-bold text-ev-900">Rules & Regulations</h3>
                      </div>
                      {(() => {
                        const displayFmt = event.rulesDisplayFormat || "paragraph";
                        const text = event.rulesAndGuidelines || "";
                        const bothParts = text.split("\n\n---POINTS---\n\n");
                        const paragraph = bothParts[0]?.trim() || "";
                        const points =
                          displayFmt ===
   "both"
                            ? bothParts[1]
                              ? bothParts[1].split("\n").map((s) => s.trim()).filter(Boolean)
                              : []
                            : text.split(/\n/).map((s) => s.trim()).filter(Boolean);
                        if (displayFmt ===
   "points") {
                          return (
                            <ul className="space-y-2 pl-1">
                              {points.map((p, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                  <CheckCircle2 className="w-4 h-4 text-sgt-400 shrink-0 mt-0.5" />
                                  {p}
                                </li>
                              ))}
                            </ul>
                          );
                        }
                        if (displayFmt ===
   "both") {
                          return (
                            <div className="space-y-3">
                              {paragraph && <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{paragraph}</p>}
                              {points.length > 0 && (
                                <ul className="space-y-2 pl-1">
                                  {points.map((p, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                      <CheckCircle2 className="w-4 h-4 text-sgt-400 shrink-0 mt-0.5" />
                                      {p}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        }
                        return <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{text}</p>;
                      })()}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* =====
   PRIZES TAB =====
   */}
            {activeTab ===
   "prizes" && hasPrizesContent && (
              <EventPrizesSection event={event} />
            )}

            {/* =====
   FAQ TAB =====
   */}
            {activeTab ===
   "faq" && hasFaqContent && (
              <section className="rounded-2xl border border-[#b3cde0]/45 bg-white/95 shadow-[0_2px_12px_rgba(0,91,150,0.08)]">
                <div className="border-b border-[#b3cde0]/35 px-6 py-4 sm:px-8">
                  <h2 className="text-lg font-bold text-ev-900">Frequently Asked Questions</h2>
                </div>
                <div className="px-6 py-6 sm:px-8 space-y-3">
                  {event.faqs!.map((faq, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border-2 transition-all ${expandedFaq ===
   i ? "border-sgt-300 bg-sgt-50/50 shadow-sm" : "border-gray-200 bg-gray-50/50 hover:border-sgt-200 hover:bg-sgt-50/30"}`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedFaq(expandedFaq ===
   i ? null : i)}
                        className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <span className="text-sm font-semibold text-ev-900">{faq.question}</span>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm">
                          {expandedFaq ===
   i ? (
                            <ChevronUp className="w-5 h-5 text-sgt-600" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-sgt-600" />
                          )}
                        </span>
                      </button>
                      {expandedFaq ===
   i && (
                        <div className="border-t border-gray-200 px-5 pb-4 pt-3 text-sm leading-relaxed text-gray-600 bg-white/80 rounded-b-lg">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* =====
   CONTACT TAB =====
   */}
            {activeTab ===
   "contact" && hasContactContent && (
              <section className="rounded-2xl border border-[#b3cde0]/45 bg-white/95 shadow-[0_2px_12px_rgba(0,91,150,0.08)]">
                <div className="border-b border-[#b3cde0]/35 px-6 py-4 sm:px-8">
                  <h2 className="text-lg font-bold text-ev-900">Contact</h2>
                </div>
                <div className="px-6 py-6 sm:px-8">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {event.contactPersonName && (
                      <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/40 p-3.5">
                        <User className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-xs text-gray-400 font-medium">Contact Person</p>
                          <p className="text-sm font-semibold text-ev-900">{event.contactPersonName}</p>
                        </div>
                      </div>
                    )}
                    {event.contactEmail && (
                      <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/40 p-3.5">
                        <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-xs text-gray-400 font-medium">Email</p>
                          <a href={`mailto:${event.contactEmail}`} className="text-sm font-semibold text-sgt-600 hover:underline">{event.contactEmail}</a>
                        </div>
                      </div>
                    )}
                    {event.contactMobile && (
                      <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/40 p-3.5">
                        <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-xs text-gray-400 font-medium">Phone</p>
                          <a href={`tel:${event.contactMobile}`} className="text-sm font-semibold text-ev-900">{event.contactMobile}</a>
                        </div>
                      </div>
                    )}
                    {event.websiteUrl && (
                      <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/40 p-3.5">
                        <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-xs text-gray-400 font-medium">Website</p>
                          <a href={event.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-sgt-600 hover:underline truncate block max-w-[200px]">{event.websiteUrl.replace(/^https?:\/\//, "")}</a>
                        </div>
                      </div>
                    )}
                  </div>

                  {hasSocialLinks && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Social Media</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(event.socialMediaLinks!)
                          .filter(([, v]) => v)
                          .map(([platform, url]) => (
                            <a
                              key={platform}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold capitalize text-gray-600 transition hover:border-sgt-200 hover:bg-sgt-50/40 hover:text-sgt-600"
                            >
                              {platform}
                            </a>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* --- RIGHT: Sidebar --- */}
          <EventSidebar
            event={event}
            currentUser={currentUser}
            isCreator={isCreator}
            isRegistered={isRegistered}
            hasIncompleteRegistration={hasIncompleteRegistration}
            hasPendingPayment={hasPendingPayment}
            isTeamBased={isTeamBased}
            registrationOpen={registrationOpen}
            canRegister={canRegister}
            capacityPercent={capacityPercent}
            hasSocialLinks={!!hasSocialLinks}
            onRegister={handleRegister}
          />
        </div>
      </div>
    </div>
  );
}
