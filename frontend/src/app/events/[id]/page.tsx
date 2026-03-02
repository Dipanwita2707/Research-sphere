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
  "bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt";

/* --- Section label ("ABOUT", "DATES", etc.) --- */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
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
    <span className="mt-0.5 text-gray-400 dark:text-gray-500 shrink-0">
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      <div className="text-sm text-gray-900 dark:text-white mt-0.5">
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
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <PageSkeleton message="Loading event..." />
      </div>
    );
  }

  // -- Not Found --
  if (!event) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            Event Not Found
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            The event you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sgt-600 text-white text-sm font-medium rounded-md hover:bg-sgt-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.draft;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* ====== HERO BANNER ====== */}
      {event.bannerImageUrl ? (
        <div className="relative w-full h-56 sm:h-64 md:h-72 bg-gray-200 dark:bg-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.bannerImageUrl}
            alt={event.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute top-4 left-4">
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm text-sm text-gray-700 dark:text-gray-200 rounded-md hover:bg-white transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Events
            </Link>
          </div>

          {/* Prize Teaser  - right side overlay on banner */}
          {(event.prizeDetails ||
            event.certificateAvailable ||
            (event.prizes && event.prizes.length > 0)) && (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("prizes-section");
                if (el)
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="absolute top-4 right-4 group flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 hover:border-amber-400/60 transition-all duration-300 shadow-lg hover:shadow-amber-500/20 hover:shadow-xl cursor-pointer"
            >
              {/* Trophy icon with glow */}
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-amber-400/20 group-hover:bg-amber-400/40 transition-colors duration-300">
                <Trophy className="w-4 h-4 text-amber-300 group-hover:text-amber-200 drop-shadow" />
                <span className="absolute inset-0 rounded-full bg-amber-400/30 animate-ping opacity-60 group-hover:opacity-80" />
              </div>

              {/* Text info */}
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 group-hover:text-amber-200">
                  Prizes & Rewards
                </span>
                <span className="text-xs font-semibold text-white/80 group-hover:text-white mt-0.5">
                  {event.prizes && event.prizes.length > 0
                    ? `${event.prizes.length} prize${event.prizes.length > 1 ? "s" : ""} \u2022 Click to view`
                    : event.certificateAvailable
                      ? "Certificate \u2022 Click to view"
                      : "Click to view"}
                </span>
              </div>

              {/* Down arrow */}
              <ChevronDown className="w-4 h-4 text-white/60 group-hover:text-amber-300 group-hover:translate-y-0.5 transition-all duration-300" />
            </button>
          )}
        </div>
      ) : (
        <div className="pt-6 px-4">
          <div className="max-w-[950px] mx-auto">
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-sgt-600 transition-colors mb-5"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Events
            </Link>
          </div>
        </div>
      )}

      {/* ====== MAIN CONTENT ====== */}
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16"
        style={{ marginTop: event.bannerImageUrl ? "-4rem" : "0" }}
      >
        {/* Header Card  - Title + Quick Info + Register CTA */}
        <div className={`relative ${CARD} overflow-hidden mb-6 sm:mb-8`}>
          <div className="px-4 sm:px-6 md:px-10 py-6 sm:py-8">
            <div className="flex flex-col md:flex-row md:items-start gap-8">
              {/* Logo */}
              {event.logoImageUrl && (
                <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 overflow-hidden shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={event.logoImageUrl}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Title area */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${statusCfg.color}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                  </span>
                  <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {EVENT_TYPE_LABELS[event.eventType]}
                  </span>
                  {event.paymentType === "free" ? (
                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                      FREE
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                      {'\u20B9'}{event.registrationFee}
                    </span>
                  )}
                  {event.opportunityMode && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {MODE_ICONS[event.opportunityMode]}{" "}
                      {event.opportunityMode}
                    </span>
                  )}
                  {event.festivalNotingId && event.festivalMeta?.name && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
                      Part of Festival: {event.festivalMeta.name}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight mb-3">
                  {event.name}
                </h1>
                {event.description && (
                  <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 line-clamp-2 max-w-4xl leading-relaxed">
                    {event.description}
                  </p>
                )}

                {/* Quick meta row */}
                <div className="flex flex-wrap items-center gap-6 mt-6 text-sm font-medium text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900 dark:text-white">
                      {fmtShort(event.startDate)}
                    </span>
                    {event.startDate !== event.endDate && (
                      <span className="text-gray-900 dark:text-white">
                        &ndash; {fmtShort(event.endDate)}
                      </span>
                    )}
                  </span>
                  {event.venue && (
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-900 dark:text-white">
                        {event.venue}
                      </span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900 dark:text-white">
                      {event.currentRegistrations}
                      {event.maxCapacity ? ` / ${event.maxCapacity}` : ""}{" "}
                      registered
                    </span>
                  </span>
                </div>

                {/* Creator badge */}
                {isCreator && (
                  <div className="mt-5 inline-flex items-center gap-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg text-sm transition-colors">
                    <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                      You are the organizer
                    </span>
                    <span className="text-indigo-300/50">|</span>
                    <Link
                      href={`/events/${event.id}/manage`}
                      className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 group"
                    >
                      <Settings className="w-4 h-4 transition-transform group-hover:rotate-90" />{" "}
                      Manage Event
                    </Link>
                  </div>
                )}
              </div>

              {/* Register / Registered CTA */}
              <div className="shrink-0 md:text-right space-y-3 pt-2">

                {/* Registered Badge  - shown first (above prizes) for visibility */}
                {isRegistered && event.userRegistration && (
                  <div className="flex justify-end mb-1">
                    <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-full shadow-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                      <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                        Registered
                      </span>
                    </div>
                  </div>
                )}

                {hasIncompleteRegistration && event.userRegistration && (
                  <div className="flex flex-col gap-3 items-start md:items-end mb-1">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-full">
                      <Users className="w-5 h-5 text-orange-700 dark:text-orange-400" />
                      <span className="text-sm font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wide">
                        Incomplete Team
                      </span>
                    </div>
                    <Link
                      href={`/events/${event.id}/registration/team`}
                      className="inline-flex items-center justify-center px-6 py-3 bg-orange-600 dark:bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-700 dark:hover:bg-orange-600 transition-all shadow-sm w-full md:w-auto"
                    >
                      Setup Team
                    </Link>
                  </div>
                )}

                {hasPendingPayment && event.userRegistration && (
                  <div className="flex flex-col gap-3 items-start md:items-end mb-1">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-full">
                      <CreditCard className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                      <span className="text-sm font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                        Payment Pending
                      </span>
                    </div>
                    <Link
                      href={isTeamBased ? `/events/${event.id}/registration/team` : `/events/${event.id}/registration/payment`}
                      className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white text-sm font-bold rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-sm w-full md:w-auto"
                    >
                      <IndianRupee className="w-4 h-4 mr-1" />
                      Pay Now
                    </Link>
                  </div>
                )}

                {/* Prize Teaser - right side of header card, click to scroll to prizes */}
                {(event.prizeDetails ||
                  event.certificateAvailable ||
                  (event.prizes && event.prizes.length > 0)) && (
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("prizes-section");
                      if (el)
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                    className="group inline-flex flex-col items-end gap-2 cursor-pointer text-left"
                  >
                    {/* Card */}
                    <div className="w-64 rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/30 dark:via-yellow-900/15 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/70 shadow-sm group-hover:shadow-lg group-hover:border-amber-400 dark:group-hover:border-amber-500 transition-all duration-250 overflow-hidden">
                      {/* Header strip */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-400/20 dark:bg-amber-700/30 border-b border-amber-200 dark:border-amber-700/50">
                        <div className="flex items-center gap-2">
                          <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-700/60">
                            <Trophy className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
                            <span className="absolute inset-0 rounded-full bg-amber-400/40 animate-ping opacity-60" />
                          </div>
                          <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                            Prizes & Rewards
                          </span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 group-hover:translate-y-0.5 transition-transform duration-200" />
                      </div>

                      {/* Prize rows */}
                      <div className="px-4 py-3 space-y-2">
                        {event.prizes && event.prizes.length > 0 ? (
                          <>
                            {event.prizes
                              .slice()
                              .sort((a, b) => a.sortOrder - b.sortOrder)
                              .slice(0, 3)
                              .map((prize, idx) => {
                                const positionLabel =
                                  prize.position === 1
                                    ? "Winner"
                                    : prize.position === 2
                                      ? "1st Runner Up"
                                      : prize.position === 3
                                        ? "2nd Runner Up"
                                        : prize.rank || prize.title || "Prize";
                                const positionEmoji =
                                  prize.position === 1
                                    ? "\uD83E\uDD47"
                                    : prize.position === 2
                                      ? "\uD83E\uDD48"
                                      : prize.position === 3
                                        ? "\uD83E\uDD49"
                                        : "\uD83C\uDFC6";
                                const hasCash =
                                  prize.prizeAmount && prize.prizeAmount > 0;
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between gap-3"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-base leading-none shrink-0">
                                        {positionEmoji}
                                      </span>
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
                                          {positionLabel}
                                        </span>
                                        {prize.title &&
                                          prize.title !== positionLabel && (
                                            <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                              {prize.title}
                                            </span>
                                          )}
                                      </div>
                                    </div>
                                    {hasCash ? (
                                      <span className="shrink-0 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700">
                                        {'\u20B9'}{prize.prizeAmount!.toLocaleString()}
                                      </span>
                                    ) : (
                                      <span className="shrink-0 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-700 uppercase tracking-wide">
                                        Trophy
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            {event.prizes.length > 3 && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold text-right">
                                +{event.prizes.length - 3} more prizes
                              </p>
                            )}
                          </>
                        ) : event.prizeDetails ? (
                          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">
                            {event.prizeDetails}
                          </p>
                        ) : null}

                        {/* Certificate badge */}
                        {event.certificateAvailable && (
                          <div className="flex items-center gap-2 pt-1.5 border-t border-amber-200/60 dark:border-amber-700/40 mt-1">
                            <Award className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                              Participation certificate for all
                            </span>
                          </div>
                        )}

                        {/* Total prize pool  - only when actual cash exists */}
                        {(() => {
                          const totalCash =
                            event.prizes?.reduce(
                              (sum, p) => sum + (p.prizeAmount || 0),
                              0,
                            ) ?? 0;
                          if (totalCash <= 0) return null;
                          return (
                            <div className="mt-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 px-4 py-2.5 flex items-center justify-between shadow-sm">
                              <div className="flex items-center gap-1.5">
                                <IndianRupee className="w-3.5 h-3.5 text-emerald-100" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-100">
                                  Total Prize Pool
                                </span>
                              </div>
                              <span className="text-base font-extrabold text-white tracking-tight">
                                {'\u20B9'}{totalCash.toLocaleString()}
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Footer CTA */}
                      <div className="px-4 py-2 bg-amber-100/60 dark:bg-amber-800/20 border-t border-amber-200 dark:border-amber-700/50 flex items-center justify-end gap-1">
                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 group-hover:underline">
                          View full details
                        </span>
                        <ChevronDown className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                  </button>
                )}

              </div>
            </div>
          </div>
        </div>

        {/* ====== GRID LAYOUT ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* --- LEFT COLUMN (8/12) --- */}
          <div className="lg:col-span-8 space-y-8">
            {/* --- UNIFIED MAIN CONTENT CARD --- */}
            <div
              className={`${CARD} divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden`}
            >
              {/* 1. ABOUT SECTION */}
              <div className="p-8 sm:p-10">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  About This Event
                </h3>
                {event.longDescription ? (
                  <div
                    className="noting-description-content text-base text-gray-700 dark:text-gray-300"
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
              <div className="p-5 sm:p-6 bg-gray-50/60 dark:bg-gray-800/60">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider text-sm opacity-70">
                  Structure & Schedule
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {/* Date */}
                  <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0">
                      <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                        Timeline
                      </p>
                      <p className="text-base font-bold text-gray-900 dark:text-white">
                        {fmt(event.startDate)}
                      </p>
                      {event.startDate !== event.endDate && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                          to {fmt(event.endDate)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Venue */}
                  {event.venue && (
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0">
                        <MapPin className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                          Venue
                        </p>
                        <p className="text-base font-bold text-gray-900 dark:text-white">
                          {event.venue}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Mode */}
                  {event.opportunityMode && (
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0 text-purple-600 dark:text-purple-400">
                        {MODE_ICONS[event.opportunityMode]}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                          Mode
                        </p>
                        <p className="text-base font-bold text-gray-900 dark:text-white capitalize">
                          {event.opportunityMode}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Participation Type */}
                  {event.participationType && (
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400">
                        {event.participationType === "individual" ? (
                          <User className="w-5 h-5" />
                        ) : (
                          <Users className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                          Participation
                        </p>
                        <p className="text-base font-bold text-gray-900 dark:text-white capitalize">
                          {event.participationType}{" "}
                          {event.participationType === "team" &&
                            `(${event.minTeamSize}-${event.maxTeamSize} members)`}
                        </p>
                        {event.participationType === "team" && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {event.interCollegeAllowed && (
                              <span className="inline-flex items-center text-[10px] uppercase font-bold bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded border border-gray-200 dark:border-gray-600">
                                Inter-College
                              </span>
                            )}
                            {event.interSpecializationAllowed && (
                              <span className="inline-flex items-center text-[10px] uppercase font-bold bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded border border-gray-200 dark:border-gray-600">
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
                        <div className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400">
                          <IndianRupee className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                            Sponsorship
                          </p>
                          <div className="space-y-1.5">
                            {event.sponsors.map((s, i) => (
                              <div
                                key={i}
                                className="text-sm text-gray-900 dark:text-white"
                              >
                                <span className="font-medium">{s.name}</span>
                                {s.type === "cash" ? (
                                  <span className="text-gray-600 dark:text-gray-300">
                                     {" "}
                                     {"\u2014"} {'\u20B9'}{" "}{Number(s.amount || 0).toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-gray-600 dark:text-gray-300">
                                    {" "}
                                     {"\u2014"} In-kind: {s.notes || "\u2014"}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Resources - hidden from public (internal/organizer only) */}

                  {/* Reg Dates */}
                  {(event.registrationStartDate ||
                    event.registrationEndDate) && (
                    <div className="flex gap-3 sm:col-span-2 border-t border-gray-200 dark:border-gray-700/50 pt-4 mt-1">
                      <div className="mt-0.5 shrink-0">
                        <Clock className="w-5 h-5 text-orange-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                          Registration Timeline
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          {event.registrationStartDate && (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-500">
                                Opens
                              </span>
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
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
                              <span className="text-xs font-medium text-gray-500">
                                Closes
                              </span>
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
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
                <div className="p-8 sm:p-10">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-wider text-sm opacity-70">
                    Guidelines
                  </h3>
                  <div className="flex flex-col gap-8">
                    {event.eligibilityCriteria && (
                      <div className="flex gap-5">
                        <div className="shrink-0 w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center ring-4 ring-blue-50/50 dark:ring-blue-900/10">
                          <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">
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
                        <div className="shrink-0 w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center ring-4 ring-red-50/50 dark:ring-red-900/10">
                          <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">
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
                <div className="p-8 sm:p-10 bg-gray-50/30 dark:bg-gray-800/30">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 uppercase tracking-wider text-sm opacity-70">
                    Frequently Asked Questions
                  </h3>
                  <div className="space-y-4">
                    {event.faqs.map((faq, i) => (
                      <div
                        key={i}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm hover:border-gray-300 transition-colors"
                      >
                        <button
                          onClick={() =>
                            setExpandedFaq(expandedFaq === i ? null : i)
                          }
                          className="w-full flex items-center justify-between px-6 py-4 text-left"
                        >
                          <span className="text-base font-semibold text-gray-900 dark:text-white">
                            {faq.question}
                          </span>
                          {expandedFaq === i ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-4 text-gray-400" />
                          )}
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
  );
}

