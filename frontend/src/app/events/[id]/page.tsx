"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
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
  CreditCard,
  Settings,
  Monitor,
  Building2,
  Wifi,
  Shield,
  Trophy,
  GraduationCap,
  Clock,
} from "lucide-react";
import { useEvent } from "@/features/event-management/hooks/useEvents";
import {
  EVENT_TYPE_LABELS,
  STATUS_CONFIG,
} from "@/features/event-management/constants";
import type { Event } from "@/features/event-management/types/event.types";
import { useAuthStore } from "@/shared/auth/authStore";
import { PageSkeleton } from "@/shared/components/PageSkeleton";

/* -- Lazy-loaded heavy sections (code-split) -- */
const EventPrizesSection = dynamic(() => import("./components/EventPrizesSection"), { ssr: false });
const EventSidebar = dynamic(() => import("./components/EventSidebar"), { ssr: false });

const MODE_ICONS: Record<string, React.ReactNode> = {
  online: <Monitor className="w-4 h-4" />,
  offline: <Building2 className="w-4 h-4" />,
  hybrid: <Wifi className="w-4 h-4" />,
};

/* Card wrapper  - all-sides blue border + shadow */
const CARD =
  "bg-white dark:bg-gray-800 rounded-xl border border-[#b3cde0] dark:border-ev-700 shadow-ev";

/* --- Section label ("ABOUT", "DATES", etc.) --- */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-semibold text-ev-400 dark:text-gray-500 uppercase tracking-widest mb-3">
    {children}
  </h3>
);

/* --- Inline info row (icon + label + value) --- */
const InfoRow = ({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 text-ev-400 dark:text-gray-500 shrink-0">
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-ev-400 uppercase tracking-wide">
        {label}
      </p>
      <div className="text-sm text-ev-900 dark:text-white mt-0.5">
        {children}
      </div>
    </div>
  </div>
);

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data: event, isLoading: loading } = useEvent(id);
  const { user } = useAuthStore();

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Derive current user info from auth store
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

  const isCreator = event?.createdBy?.id === currentUserId;
  const isRegistered =
    !!event?.userRegistration &&
    event?.userRegistration?.status === "confirmed";
  const hasIncompleteRegistration =
    !!event?.userRegistration &&
    event?.userRegistration?.status === "incomplete_team";
  const hasPendingPayment =
    !!event?.userRegistration &&
    event?.userRegistration?.status === "pending" &&
    event?.paymentType === "paid";
  const isTeamBased = event?.participationType === "team";
  const registrationOpen = event?.registrationEndDate
    ? new Date(event.registrationEndDate) >= new Date()
    : true;
  const canRegister =
    event?.status === "published" &&
    !isCreator &&
    !event?.userRegistration &&
    !isTeamBased &&
    registrationOpen;

  const handleRegister = () => {
    if (!event) return;
    // ALL registrations go through the dynamic form  - no legacy one-click
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
  const fmtShort = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
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

  // -- Loading --
  if (loading) {
    return (
      <div className="ev-page flex items-center justify-center">
        <PageSkeleton message="Loading event..." />
      </div>
    );
  }

  // -- Not Found --
  if (!event) {
    return (
      <div className="ev-page flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-bold text-ev-900 mb-1">
            Event Not Found
          </h2>
          <p className="text-sm text-ev-400 mb-5">
            The event you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/events"
            className="ev-btn"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.draft;
  const publicRegistrationCount = event.currentRegistrations || 0;
  const shouldRevealRegistrationCount = publicRegistrationCount >= 100;
  const remainingSeats = event.maxCapacity
    ? Math.max(0, event.maxCapacity - (event.currentRegistrations || 0))
    : null;
  const publicCapacityLabel = event.maxCapacity
    ? `Capacity ${event.maxCapacity}`
    : "Unlimited capacity";
  const capacityHeadline = shouldRevealRegistrationCount
    ? event.maxCapacity
      ? `${publicRegistrationCount}/${event.maxCapacity} joined`
      : `${publicRegistrationCount}+ joined`
    : "Few seats left";
  const capacitySubline = shouldRevealRegistrationCount
    ? remainingSeats !== null
      ? `${remainingSeats} spots left`
      : "Unlimited capacity"
    : publicCapacityLabel;
  const totalPrizePool =
    event.prizes?.reduce((sum, prize) => sum + (prize.prizeAmount || 0), 0) || 0;
  const prizeTierCount = event.prizes?.length || 0;
  const prizeSummaryText = event.prizeDetails?.trim()
    ? event.prizeDetails.trim().replace(/\s+/g, " ").slice(0, 96) + (event.prizeDetails.trim().length > 96 ? "..." : "")
    : prizeTierCount > 0
      ? `${prizeTierCount} winning tier${prizeTierCount > 1 ? "s" : ""} with curated rewards for top performers.`
      : event.certificateAvailable
        ? "Top participants get recognition and post-event certificate benefits."
        : "Reward details will be shared soon.";
  const prizeHeadline = totalPrizePool > 0
    ? `₹${totalPrizePool.toLocaleString()} prize pool`
    : prizeTierCount > 0
      ? `${prizeTierCount} reward tier${prizeTierCount > 1 ? "s" : ""}`
      : event.certificateAvailable
        ? "Certificate rewards"
        : "Rewards soon";
  const cockpitPrimaryLabel = shouldRevealRegistrationCount ? "Joined" : "Status";
  const cockpitPrimaryValue = shouldRevealRegistrationCount ? `${publicRegistrationCount}` : "Few left";
  const cockpitSecondaryLabel = shouldRevealRegistrationCount ? "Seats left" : "Capacity";
  const cockpitSecondaryValue = shouldRevealRegistrationCount
    ? remainingSeats !== null
      ? `${remainingSeats}`
      : "Open"
    : event.maxCapacity
      ? `${event.maxCapacity}`
      : "Unlimited";
  const eventPhase = isOngoing
    ? "Live now"
    : isUpcoming
      ? "Upcoming"
      : "Completed";
  const eventPhaseClass = isOngoing
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
    : isUpcoming
      ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
      : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  const registrationLabel = !registrationOpen
    ? "Registration closed"
    : event.registrationEndDate
      ? `Closes ${fmtShort(event.registrationEndDate)}`
      : "Registration open";
  const timelineLabel = event.startDate !== event.endDate
    ? `${fmtShort(event.startDate)} - ${fmtShort(event.endDate)}`
    : fmtShort(event.startDate);
  const timelineTimeLabel = fmtTime(event.startDate);
  const locationLabel = event.venue || "Venue update soon";
  const sectionLinks = [
    { href: "#event-overview", label: "Overview" },
    { href: "#event-structure", label: "Schedule" },
    ...(event.eligibilityCriteria || event.rulesAndGuidelines
      ? [{ href: "#event-guidelines", label: "Guidelines" }]
      : []),
    ...(event.faqs && event.faqs.length > 0
      ? [{ href: "#event-faq", label: "FAQ" }]
      : []),
    ...(event.prizeDetails || event.certificateAvailable || (event.prizes && event.prizes.length > 0)
      ? [{ href: "#prizes-section", label: "Rewards" }]
      : []),
    ...(event.contactPersonName || event.contactEmail || event.contactMobile || event.websiteUrl
      ? [{ href: "#event-contact", label: "Contact" }]
      : []),
  ];

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="ev-page relative overflow-hidden pb-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] overflow-hidden">
        <div className="absolute -left-24 top-12 h-64 w-64 rounded-full bg-sky-200/50 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute left-1/3 top-24 h-56 w-56 rounded-full bg-cyan-100/50 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1450px] px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-[0_32px_80px_-40px_rgba(1,31,75,0.55)] backdrop-blur-xl">
          <div className="relative overflow-hidden border-b border-sky-100/80 bg-sgt-gradient">
            {event.bannerImageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.bannerImageUrl}
                  alt={event.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(1,31,75,0.9),rgba(4,29,86,0.75)_38%,rgba(15,37,115,0.42)_68%,rgba(255,255,255,0.08))]" />
              </>
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(173,225,251,0.65),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(38,108,169,0.45),transparent_34%),linear-gradient(135deg,#0F2573_0%,#041D56_52%,#01082D_100%)]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_25%,rgba(1,8,45,0.24))]" />

            <div className="relative z-10 px-5 py-5 sm:px-8 sm:py-7 lg:px-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition hover:bg-white/16"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to events
                </Link>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.24em] ${statusCfg.color}`}>
                    <span className={`h-2 w-2 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.24em] ${eventPhaseClass}`}>
                    {eventPhase}
                  </span>
                </div>
              </div>

              <div className="mt-12 max-w-4xl pb-2">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.34em] text-sky-100/90">
                  Campus event experience
                </p>
                <h1 className="max-w-3xl text-3xl font-black leading-[1.05] tracking-[-0.04em] text-white sm:text-4xl lg:text-6xl">
                  {event.name}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                  {event.description ||
                    "Built to make registration, discovery, and event participation feel sharper for students from the first glance."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 xl:grid-cols-[minmax(0,1.55fr)_380px] 2xl:grid-cols-[minmax(0,1.7fr)_400px]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-sky-800 ring-1 ring-sky-100 dark:bg-sky-900/20 dark:text-sky-300 dark:ring-sky-800/50">
                  {EVENT_TYPE_LABELS[event.eventType]}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                  {event.opportunityMode ? MODE_ICONS[event.opportunityMode] : <Building2 className="w-4 h-4" />}
                  {event.opportunityMode || "offline"}
                </span>
                {event.paymentType === "free" ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800">
                    Free entry
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-amber-700 ring-1 ring-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800">
                    <IndianRupee className="w-3.5 h-3.5" />
                    {event.registrationFee}
                  </span>
                )}
                {event.festivalNotingId && event.festivalMeta?.name && (
                  <span className="inline-flex items-center rounded-full bg-fuchsia-50 px-3 py-1.5 text-xs font-bold text-fuchsia-700 ring-1 ring-fuchsia-100 dark:bg-fuchsia-900/20 dark:text-fuchsia-300 dark:ring-fuchsia-800">
                    Part of {event.festivalMeta.name}
                  </span>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-12">
                <div className="rounded-[1.5rem] border border-sky-100 bg-[linear-gradient(180deg,#ffffff,rgba(237,244,248,0.98))] p-5 shadow-[0_18px_40px_-34px_rgba(1,31,75,0.55)] md:col-span-2 2xl:col-span-7">
                  <div className="mb-4 flex items-center justify-between text-sky-700">
                    <Calendar className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-500">Timeline</span>
                  </div>
                  {event.startDate !== event.endDate ? (
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Starts</p>
                        <p className="mt-2 text-xl font-bold tracking-[-0.03em] text-slate-900 sm:text-[1.7rem]">{fmtShort(event.startDate)}</p>
                      </div>
                      <div className="hidden h-px w-12 bg-gradient-to-r from-sky-200 via-sky-400 to-sky-200 sm:block" />
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Ends</p>
                        <p className="mt-2 text-xl font-bold tracking-[-0.03em] text-slate-900 sm:text-[1.7rem]">{fmtShort(event.endDate)}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xl font-bold tracking-[-0.03em] text-slate-900 sm:text-[1.7rem]">{timelineLabel}</p>
                  )}
                  <div className="mt-4 inline-flex items-center rounded-full border border-sky-100 bg-sky-50/80 px-3 py-1.5 text-sm font-medium text-slate-600">
                    {timelineTimeLabel}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-sky-100 bg-[linear-gradient(180deg,#ffffff,rgba(237,244,248,0.98))] p-5 shadow-[0_18px_40px_-34px_rgba(1,31,75,0.55)] 2xl:col-span-5">
                  <div className="mb-4 flex items-center justify-between text-sky-700">
                    <MapPin className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-500">Place</span>
                  </div>
                  <p className="text-xl font-bold tracking-[-0.03em] text-slate-900 sm:text-[1.55rem]">{locationLabel}</p>
                  <p className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-sm capitalize text-slate-500">{event.opportunityMode || "offline"} mode</p>
                </div>

                <button
                  type="button"
                  onClick={() => scrollToSection("prizes-section")}
                  className="rounded-[1.5rem] border border-sky-100 bg-[linear-gradient(180deg,#ffffff,rgba(237,244,248,0.98))] p-5 text-left shadow-[0_18px_40px_-34px_rgba(1,31,75,0.55)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_22px_45px_-32px_rgba(1,31,75,0.58)] focus:outline-none focus:ring-2 focus:ring-sky-300/70 2xl:col-span-6"
                >
                  <div className="mb-4 flex items-center justify-between text-sky-700">
                    <Trophy className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-500">Prizes</span>
                  </div>
                  <p className="max-w-[18ch] text-xl font-bold leading-tight tracking-[-0.03em] text-slate-900 sm:text-[1.55rem]">
                    {prizeHeadline}
                  </p>
                  <p className="mt-2 max-w-[34ch] text-sm leading-6 text-slate-500">
                    {prizeSummaryText}
                  </p>
                  {(totalPrizePool > 0 || prizeTierCount > 0 || event.certificateAvailable) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {prizeTierCount > 0 && (
                        <span className="inline-flex items-center rounded-full border border-sky-100 bg-white/85 px-3 py-1 text-xs font-semibold text-sky-700">
                          {prizeTierCount} tier{prizeTierCount > 1 ? "s" : ""}
                        </span>
                      )}
                      {event.certificateAvailable && (
                        <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50/90 px-3 py-1 text-xs font-semibold text-amber-700">
                          Certificate included
                        </span>
                      )}
                    </div>
                  )}
                </button>

                <div className="rounded-[1.5rem] border border-sky-100 bg-[linear-gradient(180deg,#ffffff,rgba(237,244,248,0.98))] p-5 shadow-[0_18px_40px_-34px_rgba(1,31,75,0.55)] 2xl:col-span-6">
                  <div className="mb-4 flex items-center justify-between text-sky-700">
                    {event.paymentType === "free" ? <Award className="w-5 h-5" /> : <IndianRupee className="w-5 h-5" />}
                    <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-500">Entry</span>
                  </div>
                  <p className="text-xl font-bold tracking-[-0.03em] text-slate-900 capitalize sm:text-[1.55rem]">
                    {event.paymentType === "free" ? "No fee" : `₹${event.registrationFee}`}
                  </p>
                  <p className="mt-2 text-sm capitalize text-slate-500">
                    {event.participationType}
                    {isTeamBased ? ` • ${event.minTeamSize}-${event.maxTeamSize} members` : " registration"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {sectionLinks.map((section) => (
                  <a
                    key={section.href}
                    href={section.href}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                  >
                    {section.label}
                  </a>
                ))}
              </div>

              {isCreator && (
                <div className="inline-flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 shadow-[0_18px_30px_-24px_rgba(79,70,229,0.55)] dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300">
                  <Shield className="w-4 h-4" />
                  <span className="font-semibold">You are managing this event</span>
                  <Link
                    href={`/events/${event.id}/manage`}
                    className="inline-flex items-center gap-1 font-semibold text-indigo-700 transition hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-200"
                  >
                    <Settings className="w-4 h-4" />
                    Open control panel
                  </Link>
                </div>
              )}
            </div>

            <aside className="relative overflow-hidden rounded-[1.75rem] border border-sgt-300/20 bg-[linear-gradient(150deg,#01082D_0%,#041D56_38%,#0F2573_100%)] p-5 text-white shadow-[0_30px_70px_-34px_rgba(1,8,45,0.85)] sm:p-6">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/10" />
              <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-white/5 blur-2xl" />

              <div className="relative z-10 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-sky-200/80">Registration cockpit</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em]">
                      {isRegistered
                        ? "You are in"
                        : hasIncompleteRegistration
                          ? "Finish your setup"
                          : hasPendingPayment
                            ? "Complete payment"
                            : isCreator
                              ? "Organizer controls"
                              : registrationOpen
                                ? "Reserve your slot"
                                : "Window closed"}
                    </h2>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-white/72">{registrationLabel}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right backdrop-blur-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">Mode</p>
                    <p className="mt-1 text-sm font-semibold capitalize text-white">{event.opportunityMode || "offline"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">{cockpitPrimaryLabel}</p>
                    <p className="mt-2 text-base font-bold leading-tight text-white sm:text-lg">{cockpitPrimaryValue}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">{cockpitSecondaryLabel}</p>
                    <p className="mt-2 text-base font-bold leading-tight text-white sm:text-lg">{cockpitSecondaryValue}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">Fee</p>
                    <p className="mt-2 text-lg font-bold text-white">{event.paymentType === "free" ? "Free" : `₹${event.registrationFee}`}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {isRegistered && event.userRegistration && (
                    <>
                      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-emerald-100">
                        <CheckCircle2 className="w-4 h-4" />
                        Registered
                      </div>
                      <Link
                        href="/events/registrations"
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-bold text-sgt-700 transition hover:bg-sky-50"
                      >
                        <Users className="w-4 h-4" />
                        {event.allowExtraPasses ? "Open guest passes" : "Open my pass"}
                      </Link>
                    </>
                  )}

                  {hasIncompleteRegistration && event.userRegistration && (
                    <>
                      <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/30 bg-orange-400/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-orange-100">
                        <Users className="w-4 h-4" />
                        Incomplete team
                      </div>
                      <Link
                        href={`/events/${event.id}/registration/team`}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-orange-400"
                      >
                        Setup team now
                      </Link>
                    </>
                  )}

                  {hasPendingPayment && event.userRegistration && (
                    <>
                      <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-amber-100">
                        <CreditCard className="w-4 h-4" />
                        Payment pending
                      </div>
                      <Link
                        href={isTeamBased ? `/events/${event.id}/registration/team` : `/events/${event.id}/registration/payment`}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-amber-300"
                      >
                        <IndianRupee className="w-4 h-4" />
                        Pay now
                      </Link>
                    </>
                  )}

                  {isCreator && (
                    <Link
                      href={`/events/${event.id}/manage`}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-bold text-sgt-700 transition hover:bg-sky-50"
                    >
                      <Settings className="w-4 h-4" />
                      Manage event
                    </Link>
                  )}

                  {canRegister && (
                    <button
                      type="button"
                      onClick={handleRegister}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#ADE1FB_0%,#6FC7F5_20%,#266CA9_55%,#0F2573_100%)] px-4 py-3.5 text-sm font-bold text-white transition hover:scale-[1.01]"
                    >
                      <Users className="w-4 h-4" />
                      Register now
                    </button>
                  )}

                  {isTeamBased && event.status === "published" && !isCreator && !event.userRegistration && registrationOpen && (
                    <Link
                      href={`/events/${event.id}/registration`}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#ADE1FB_0%,#6FC7F5_20%,#266CA9_55%,#0F2573_100%)] px-4 py-3.5 text-sm font-bold text-white transition hover:scale-[1.01]"
                    >
                      <Users className="w-4 h-4" />
                      Register team
                    </Link>
                  )}

                  {!registrationOpen && !isCreator && !event.userRegistration && (
                    <div className="rounded-2xl border border-dashed border-white/20 bg-white/8 px-4 py-3.5 text-center text-sm font-semibold text-white/78">
                      Registration closed for now
                    </div>
                  )}
                </div>

                {(event.prizeDetails || event.certificateAvailable || (event.prizes && event.prizes.length > 0)) && (
                  <button
                    type="button"
                    onClick={() => scrollToSection("prizes-section")}
                    className="group flex w-full items-center justify-between rounded-[1.35rem] border border-amber-300/30 bg-amber-300/12 px-4 py-3 text-left transition hover:bg-amber-300/18"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-300/20">
                        <Trophy className="w-5 h-5 text-amber-200" />
                        <span className="absolute inset-0 rounded-2xl bg-amber-300/20 animate-ping" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-100/80">Rewards</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {event.prizes && event.prizes.length > 0
                            ? `${event.prizes.length} prize tiers`
                            : event.certificateAvailable
                              ? "Certificates available"
                              : "View rewards"}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className="w-5 h-5 text-amber-100 transition group-hover:translate-y-0.5" />
                  </button>
                )}
              </div>
            </aside>
          </div>
        </section>

        <div className="mt-8">
          {/* ====== GRID LAYOUT ====== */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          {/* --- LEFT COLUMN (8/12) --- */}
          <div className="lg:col-span-8 space-y-8">
            {/* --- UNIFIED MAIN CONTENT CARD --- */}
            <div
              className={`${CARD} divide-y divide-[#b3cde0]/30 dark:divide-gray-700 overflow-hidden`}
            >
              {/* 1. ABOUT SECTION */}
              <div id="event-overview" className="p-8 sm:p-10">
                <h3 className="text-xl font-bold text-ev-900 dark:text-white mb-6 flex items-center gap-2">
                  About This Event
                </h3>
                {event.longDescription ? (
                  <div
                    className="noting-description-content text-base text-gray-700 dark:text-gray-300 overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: event.longDescription }}
                  />
                ) : (
                  <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {event.description ||
                      "No description provided for this event."}
                  </p>
                )}
              </div>

              {/* 3. KEY HIGHLIGHTS GRID (Structure & Schedule) */}
              <div id="event-structure" className="p-5 sm:p-6 bg-ev-50 dark:bg-gray-800/60">
                <h3 className="text-lg font-bold text-ev-900 dark:text-white mb-4 uppercase tracking-wider text-sm opacity-70">
                  Structure & Schedule
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {/* Date */}
                  <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0">
                      <Calendar className="w-5 h-5 text-ev-700 dark:text-ev-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ev-400 uppercase tracking-widest mb-1">
                        Timeline
                      </p>
                      <p className="text-base font-bold text-ev-900 dark:text-white">
                        {fmt(event.startDate)}
                      </p>
                      {event.startDate !== event.endDate && (
                        <p className="text-sm text-ev-400 dark:text-gray-400 mt-0.5">
                          to {fmt(event.endDate)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Venue */}
                  {event.venue && (
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0">
                        <MapPin className="w-5 h-5 text-ev-700 dark:text-ev-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ev-400 uppercase tracking-widest mb-1">
                          Venue
                        </p>
                        <p className="text-base font-bold text-ev-900 dark:text-white">
                          {event.venue}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Mode */}
                  {event.opportunityMode && (
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0 text-ev-700 dark:text-ev-400">
                        {MODE_ICONS[event.opportunityMode]}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ev-400 uppercase tracking-widest mb-1">
                          Mode
                        </p>
                        <p className="text-base font-bold text-ev-900 dark:text-white capitalize">
                          {event.opportunityMode}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Participation Type */}
                  {event.participationType && (
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0 text-ev-700 dark:text-ev-400">
                        {event.participationType === "individual" ? (
                          <User className="w-5 h-5" />
                        ) : (
                          <Users className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ev-400 uppercase tracking-widest mb-1">
                          Participation
                        </p>
                        <p className="text-base font-bold text-ev-900 dark:text-white capitalize">
                          {event.participationType}{" "}
                          {event.participationType === "team" &&
                            `(${event.minTeamSize}-${event.maxTeamSize} members)`}
                        </p>
                        {event.participationType === "team" && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {event.interCollegeAllowed && (
                              <span className="inline-flex items-center text-[10px] uppercase font-bold bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded border border-[#b3cde0] dark:border-gray-600">
                                Inter-College
                              </span>
                            )}
                            {event.interSpecializationAllowed && (
                              <span className="inline-flex items-center text-[10px] uppercase font-bold bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded border border-[#b3cde0] dark:border-gray-600">
                                Inter-Spec
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sponsorship - only if creator chose to show publicly */}
                  {event.showSponsorshipPublicly &&
                    event.hasSponsorship &&
                    Array.isArray(event.sponsors) &&
                    event.sponsors.length > 0 && (
                      <div className="flex gap-3 md:col-span-2">
                        <div className="mt-0.5 shrink-0 text-ev-700 dark:text-ev-400">
                          <IndianRupee className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-ev-400 uppercase tracking-widest mb-3">
                            Sponsorship
                          </p>
                          <div className="space-y-3">
                            {event.sponsors.map((s: any, i: number) => {
                              const isNewFormat = !!s.contributionType;
                              if (!isNewFormat) {
                                return (
                                  <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                    <p className="text-sm font-semibold text-ev-900 dark:text-white mb-1">{s.name}</p>
                                    {s.type === 'cash' ? (
                                      <p className="text-sm text-ev-700 dark:text-ev-400 font-medium">₹ {Number(s.amount || 0).toLocaleString()}</p>
                                    ) : (
                                      <p className="text-sm text-ev-700 dark:text-ev-400 font-medium">In-Kind: {s.notes || '—'}</p>
                                    )}
                                  </div>
                                );
                              }
                              const showCash = s.contributionType === 'cash' || s.contributionType === 'both';
                              const showInKind = s.contributionType === 'in_kind' || s.contributionType === 'both';
                              const SPONSOR_TYPE_LABELS: Record<string, string> = { corporate: 'Corporate', individual: 'Individual', organization: 'Organization', other: 'Other' };
                              return (
                                <div key={i} className="rounded-lg border border-ev-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                  <div className="px-4 py-3 border-b border-ev-100 dark:border-gray-700 flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <p className="text-sm font-bold text-ev-900 dark:text-white">{s.name}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{SPONSOR_TYPE_LABELS[s.sponsorType] || 'Corporate'}</p>
                                    </div>
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border shrink-0 whitespace-nowrap ${s.contributionType === 'both' ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700' : s.contributionType === 'in_kind' ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'}`}>
                                      {s.contributionType === 'both' ? '💰 + 📦' : s.contributionType === 'in_kind' ? '📦 In-Kind' : '💰 Cash'}
                                    </span>
                                  </div>
                                  <div className="px-4 py-3 space-y-2">
                                    {showCash && s.cashAmount != null && (
                                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md px-3 py-2 border border-blue-100 dark:border-blue-800">
                                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-0.5">Cash Contribution</p>
                                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">₹ {Number(s.cashAmount || 0).toLocaleString()}</p>
                                      </div>
                                    )}
                                    {showInKind && Array.isArray(s.inKindItems) && s.inKindItems.length > 0 && (
                                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2 border border-amber-100 dark:border-amber-800">
                                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1.5">In-Kind Items</p>
                                        <div className="space-y-1">
                                          {s.inKindItems.map((item: any, ii: number) => (
                                            <p key={ii} className="text-sm text-amber-900 dark:text-amber-100">
                                              <span className="font-semibold">{item.itemName}</span>
                                              {item.quantity ? <span className="text-amber-700 dark:text-amber-300 ml-1">×{item.quantity}</span> : ''}
                                            </p>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Resources - hidden from public (internal/organizer only) */}

                  {/* Reg Dates */}
                  {(event.registrationStartDate ||
                    event.registrationEndDate) && (
                    <div className="flex gap-3 sm:col-span-2 border-t border-[#b3cde0] dark:border-gray-700/50 pt-4 mt-1">
                      <div className="mt-0.5 shrink-0">
                        <Clock className="w-5 h-5 text-ev-700" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-ev-400 uppercase tracking-widest mb-1">
                          Registration Timeline
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          {event.registrationStartDate && (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-ev-400">
                                Opens
                              </span>
                              <span className="text-sm font-bold text-ev-900 dark:text-white">
                                {fmtTime(event.registrationStartDate)}
                              </span>
                            </div>
                          )}
                          {event.registrationStartDate &&
                            event.registrationEndDate && (
                              <div className="hidden sm:block w-8 h-[1px] bg-gray-300 dark:bg-gray-600" />
                            )}
                          {event.registrationEndDate && (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-ev-400">
                                Closes
                              </span>
                              <span className="text-sm font-bold text-ev-900 dark:text-white">
                                {fmtTime(event.registrationEndDate)}
                              </span>
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
                <div id="event-guidelines" className="p-8 sm:p-10">
                  <h3 className="text-lg font-bold text-ev-900 dark:text-white mb-6 uppercase tracking-wider text-sm opacity-70">
                    Guidelines
                  </h3>
                  <div className="flex flex-col gap-8">
                    {event.eligibilityCriteria && (
                      <div className="flex gap-5">
                        <div className="shrink-0 w-10 h-10 rounded-full bg-ev-50 dark:bg-ev-900/20 flex items-center justify-center ring-4 ring-ev-50/50 dark:ring-ev-900/10">
                          <GraduationCap className="w-5 h-5 text-ev-700 dark:text-ev-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-bold text-ev-900 dark:text-white mb-2">
                            Eligibility Criteria
                          </h4>
                          {(() => {
                            const fmt =
                              event.eligibilityDisplayFormat || "paragraph";
                            const text = event.eligibilityCriteria || "";
                            const bothParts = text.split(
                              "\n\n---POINTS---\n\n",
                            );
                            const paragraph = bothParts[0]?.trim() || "";
                            const points =
                              fmt === "both"
                                ? bothParts[1]
                                  ? bothParts[1]
                                      .split("\n")
                                      .map((s) => s.trim())
                                      .filter(Boolean)
                                  : []
                                : text
                                    .split(/\n/)
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                            if (fmt === "points") {
                              return (
                                <ul className="list-disc list-inside text-base text-gray-600 dark:text-gray-300 leading-relaxed space-y-1">
                                  {points.map((p, i) => (
                                    <li key={i}>{p}</li>
                                  ))}
                                </ul>
                              );
                            }
                            if (fmt === "both") {
                              return (
                                <div className="space-y-3">
                                  {paragraph && (
                                    <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                      {paragraph}
                                    </p>
                                  )}
                                  {points.length > 0 && (
                                    <ul className="list-disc list-inside text-base text-gray-600 dark:text-gray-300 leading-relaxed space-y-1">
                                      {points.map((p, i) => (
                                        <li key={i}>{p}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {text}
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                    {event.rulesAndGuidelines && (
                      <div className="flex gap-5">
                        <div className="shrink-0 w-10 h-10 rounded-full bg-ev-50 dark:bg-ev-900/20 flex items-center justify-center ring-4 ring-ev-50/50 dark:ring-ev-900/10">
                          <FileText className="w-5 h-5 text-ev-700 dark:text-ev-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-bold text-ev-900 dark:text-white mb-2">
                            Rules & Regulations
                          </h4>
                          {(() => {
                            const fmt = event.rulesDisplayFormat || "paragraph";
                            const text = event.rulesAndGuidelines || "";
                            const bothParts = text.split(
                              "\n\n---POINTS---\n\n",
                            );
                            const paragraph = bothParts[0]?.trim() || "";
                            const points =
                              fmt === "both"
                                ? bothParts[1]
                                  ? bothParts[1]
                                      .split("\n")
                                      .map((s) => s.trim())
                                      .filter(Boolean)
                                  : []
                                : text
                                    .split(/\n/)
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                            if (fmt === "points") {
                              return (
                                <ul className="list-disc list-inside text-base text-gray-600 dark:text-gray-300 leading-relaxed space-y-1">
                                  {points.map((p, i) => (
                                    <li key={i}>{p}</li>
                                  ))}
                                </ul>
                              );
                            }
                            if (fmt === "both") {
                              return (
                                <div className="space-y-3">
                                  {paragraph && (
                                    <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                      {paragraph}
                                    </p>
                                  )}
                                  {points.length > 0 && (
                                    <ul className="list-disc list-inside text-base text-gray-600 dark:text-gray-300 leading-relaxed space-y-1">
                                      {points.map((p, i) => (
                                        <li key={i}>{p}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {text}
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. FAQs */}
              {event.faqs && event.faqs.length > 0 && (
                <div id="event-faq" className="p-8 sm:p-10 bg-ev-50 dark:bg-gray-800/30">
                  <h3 className="text-lg font-bold text-ev-900 dark:text-white mb-6 uppercase tracking-wider text-sm opacity-70">
                    Frequently Asked Questions
                  </h3>
                  <div className="space-y-4">
                    {event.faqs.map((faq, i) => (
                      <div
                        key={i}
                        className="bg-white dark:bg-gray-800 border border-[#b3cde0] dark:border-gray-700 rounded-xl overflow-hidden shadow-ev hover:border-[#6497b1] transition-colors"
                      >
                        <button
                          onClick={() =>
                            setExpandedFaq(expandedFaq === i ? null : i)
                          }
                          className="w-full flex items-center justify-between px-6 py-4 text-left"
                        >
                          <span className="text-base font-semibold text-ev-900 dark:text-white">
                            {faq.question}
                          </span>
                          {expandedFaq === i ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-4 text-gray-400" />
                          )}
                        </button>
                        {expandedFaq === i && (
                          <div className="px-6 pb-6 text-base text-gray-600 dark:text-gray-300 leading-relaxed border-t border-[#b3cde0]/30 dark:border-gray-700 pt-4">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PRIZES & REWARDS SECTION - extracted to component */}
              <EventPrizesSection event={event} />
            </div>
          </div>

          {/* --- RIGHT COLUMN (4/12) - Sidebar --- */}
          <EventSidebar
            event={event}
            currentUser={currentUser}
            isCreator={isCreator}
            isRegistered={isRegistered}
            hasIncompleteRegistration={hasIncompleteRegistration}
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
  </div>
  );
}

