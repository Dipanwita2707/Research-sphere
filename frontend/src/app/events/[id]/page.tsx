"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  UserPlus,
  Clock,
  Globe,
  Mail,
  Phone,
  User,
  Award,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  IndianRupee,
  Settings,
  Monitor,
  Building2,
  Wifi,
  Shield,
  HelpCircle,
  Trophy,
  GraduationCap,
  Sparkles,
  MousePointerClick,
  Medal,
  Briefcase,
  ShoppingBag,
  Ticket,
  Star,
  Gift,
  ClipboardList,
  UsersRound,
} from "lucide-react";
import { eventService } from "@/features/event-management/services/event.service";
import type { Event } from "@/features/event-management/types/event.types";
import { useToast } from "@/shared/ui-components/Toast";
import { getErrorMessage } from "@/shared/utils/errorHandler";
import { PageSkeleton } from "@/shared/components/PageSkeleton";

const EVENT_TYPE_LABELS: Record<string, string> = {
  seminar: "Seminar",
  workshop: "Workshop",
  fest: "Fest",
  conference: "Conference",
  competition: "Competition",
  cultural: "Cultural",
  technical: "Technical",
  sports: "Sports",
  other: "Other",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  draft: {
    label: "Draft",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    dot: "bg-gray-400",
  },
  published: {
    label: "Published",
    color: "bg-sgt-50 text-sgt-700 dark:bg-sgt-900/20 dark:text-sgt-300",
    dot: "bg-sgt-500",
  },
  ongoing: {
    label: "Live Now",
    color:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  completed: {
    label: "Completed",
    color:
      "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300",
    dot: "bg-purple-500",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
    dot: "bg-red-500",
  },
};

const MODE_ICONS: Record<string, React.ReactNode> = {
  online: <Monitor className="w-4 h-4" />,
  offline: <Building2 className="w-4 h-4" />,
  hybrid: <Wifi className="w-4 h-4" />,
};

/* Card wrapper — all-sides blue border + shadow */
const CARD =
  "bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt";

/* ─── Section label ("ABOUT", "DATES", etc.) ─── */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
    {children}
  </h3>
);

/* ─── Inline info row (icon + label + value) ─── */
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
  const { toast } = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
  } | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    try {
      const authStr = localStorage.getItem("auth-storage");
      if (authStr) {
        const auth = JSON.parse(authStr);
        const user = auth?.state?.user;
        setCurrentUserId(user?.id ?? null);

        // Get user name from various possible fields
        let userName = "User";
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
          email: user?.email || "",
        });
      }
    } catch {}
  }, []);

  const fetchEvent = async () => {
    setLoading(true);
    try {
      const data = await eventService.getEventById(id);
      setEvent(data);
    } catch (error: any) {
      toast({ type: "error", message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isCreator = event?.createdBy?.id === currentUserId;
  const isRegistered =
    !!event?.userRegistration &&
    event?.userRegistration?.status === "confirmed";
  const hasIncompleteRegistration =
    !!event?.userRegistration &&
    event?.userRegistration?.status === "incomplete_team";
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
    // ALL registrations go through the dynamic form — no legacy one-click
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
      {/* ══════ HERO BANNER ══════ */}
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

          {/* Prize Teaser — right side overlay on banner */}
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
                    ? `${event.prizes.length} prize${event.prizes.length > 1 ? "s" : ""} • Click to view`
                    : event.certificateAvailable
                      ? "Certificate • Click to view"
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

      {/* ══════ MAIN CONTENT ══════ */}
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16"
        style={{ marginTop: event.bannerImageUrl ? "-4rem" : "0" }}
      >
        {/* Header Card — Title + Quick Info + Register CTA */}
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
                      ₹{event.registrationFee}
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

                {/* Registered Badge — shown first (above prizes) for visibility */}
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

                {/* Prize Teaser — right side of header card, click → scroll to prizes */}
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
                                    ? "🥇"
                                    : prize.position === 2
                                      ? "🥈"
                                      : prize.position === 3
                                        ? "🥉"
                                        : "🏆";
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
                                        ₹{prize.prizeAmount!.toLocaleString()}
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

                        {/* Total prize pool — only when actual cash exists */}
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
                                ₹{totalCash.toLocaleString()}
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

        {/* ══════ GRID LAYOUT ══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* ─── LEFT COLUMN (8/12) ─── */}
          <div className="lg:col-span-8 space-y-8">
            {/* ─── UNIFIED MAIN CONTENT CARD ─── */}
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
                                    — ₹ {Number(s.amount || 0).toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-gray-600 dark:text-gray-300">
                                    {" "}
                                    — In-kind: {s.notes || "—"}
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

              {/* PRIZES & REWARDS SECTION */}
              {(event.prizeDetails ||
                event.certificateAvailable ||
                (event.prizes && event.prizes.length > 0)) && (
                <div
                  id="prizes-section"
                  className="p-8 sm:p-10 border-t border-gray-100 dark:border-gray-700"
                >
                  {/* Section Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-6 bg-blue-600 rounded-full" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                      Rewards and Prizes
                    </h3>
                  </div>

                  {/* Prize Cards */}
                  <div className="space-y-3">
                    {/* Dynamic prizes */}
                    {event.prizes &&
                      event.prizes.length > 0 &&
                      event.prizes
                        .slice()
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((prize, idx) => {
                          const hasCash =
                            prize.prizeAmount && prize.prizeAmount > 0;
                          const posLabel =
                            prize.position === 1
                              ? "Winner"
                              : prize.position === 2
                                ? "1st Runner Up"
                                : prize.position === 3
                                  ? "2nd Runner Up"
                                  : prize.rank || prize.title || "Prize";

                          return (
                            <div
                              key={prize.id || idx}
                              className="flex items-stretch rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow duration-200"
                            >
                              {/* LEFT — cash panel or trophy panel */}
                              <div
                                className={`shrink-0 w-36 flex flex-col items-center justify-center px-4 py-5 border-r border-gray-200 dark:border-gray-700 ${
                                  hasCash
                                    ? "bg-emerald-50 dark:bg-emerald-900/20"
                                    : "bg-indigo-50/60 dark:bg-indigo-900/10"
                                }`}
                              >
                                {hasCash ? (
                                  <>
                                    {/* Cash coin SVG */}
                                    <svg
                                      viewBox="0 0 64 64"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="w-11 h-11 mb-1"
                                    >
                                      <circle
                                        cx="32"
                                        cy="32"
                                        r="22"
                                        fill="#ECFDF5"
                                        stroke="#10B981"
                                        strokeWidth="2.5"
                                      />
                                      <circle
                                        cx="32"
                                        cy="32"
                                        r="17"
                                        fill="none"
                                        stroke="#10B981"
                                        strokeWidth="1.5"
                                        strokeDasharray="3 2"
                                        opacity="0.4"
                                      />
                                      <text
                                        x="32"
                                        y="38"
                                        textAnchor="middle"
                                        fontSize="20"
                                        fontWeight="bold"
                                        fill="#059669"
                                        fontFamily="Arial, sans-serif"
                                      >
                                        ₹
                                      </text>
                                      <ellipse
                                        cx="22"
                                        cy="22"
                                        rx="4"
                                        ry="2.5"
                                        fill="white"
                                        opacity="0.5"
                                        transform="rotate(-35 22 22)"
                                      />
                                    </svg>
                                    <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 leading-tight tabular-nums">
                                      ₹{prize.prizeAmount!.toLocaleString()}
                                    </span>
                                    <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                      Cash
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    {/* Trophy SVG */}
                                    <svg
                                      viewBox="0 0 64 64"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="w-12 h-12 mb-1"
                                    >
                                      <path
                                        d="M20 10H44V30C44 40.493 38.627 49 32 49C25.373 49 20 40.493 20 30Z"
                                        fill="#EEF2FF"
                                        stroke="#6366F1"
                                        strokeWidth="2.5"
                                        strokeLinejoin="round"
                                      />
                                      <path
                                        d="M20 16H13C10.239 16 8 18.239 8 21C8 23.761 10.239 26 13 26H20"
                                        stroke="#6366F1"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      <path
                                        d="M44 16H51C53.761 16 56 18.239 56 21C56 23.761 53.761 26 51 26H44"
                                        stroke="#6366F1"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      <path
                                        d="M32 49V55"
                                        stroke="#6366F1"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                      />
                                      <rect
                                        x="22"
                                        y="55"
                                        width="20"
                                        height="4"
                                        rx="2"
                                        fill="#EEF2FF"
                                        stroke="#6366F1"
                                        strokeWidth="2.5"
                                        strokeLinejoin="round"
                                      />
                                      <path
                                        d="M32 21L33.5 25.5H38L34.5 28L36 32.5L32 30L28 32.5L29.5 28L26 25.5H30.5Z"
                                        fill="#6366F1"
                                        opacity="0.5"
                                      />
                                    </svg>
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
                                      Reward
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* RIGHT — title + description + certificate tag */}
                              <div className="flex flex-1 items-center justify-between gap-4 px-5 py-4">
                                <div className="min-w-0">
                                  <h4 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
                                    {posLabel}
                                  </h4>
                                  {prize.title && prize.title !== posLabel && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                                      {prize.title}
                                    </p>
                                  )}
                                  {prize.description && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">
                                      {prize.description}
                                    </p>
                                  )}
                                </div>

                                {/* Certificate badge with SVG icon */}
                                <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                                  <svg
                                    viewBox="0 0 64 64"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-5 h-5 shrink-0"
                                  >
                                    <rect
                                      x="8"
                                      y="6"
                                      width="48"
                                      height="36"
                                      rx="3"
                                      fill="#FFF8E7"
                                      stroke="#F59E0B"
                                      strokeWidth="2"
                                    />
                                    <line
                                      x1="16"
                                      y1="16"
                                      x2="48"
                                      y2="16"
                                      stroke="#F59E0B"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                    />
                                    <line
                                      x1="16"
                                      y1="23"
                                      x2="48"
                                      y2="23"
                                      stroke="#D4A855"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      opacity="0.6"
                                    />
                                    <line
                                      x1="16"
                                      y1="29"
                                      x2="40"
                                      y2="29"
                                      stroke="#D4A855"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      opacity="0.5"
                                    />
                                    <path
                                      d="M20 42L16 57L22 53L26 57L26 42"
                                      fill="#EF4444"
                                      stroke="#DC2626"
                                      strokeWidth="1.2"
                                      strokeLinejoin="round"
                                    />
                                    <path
                                      d="M44 42L48 57L42 53L38 57L38 42"
                                      fill="#EF4444"
                                      stroke="#DC2626"
                                      strokeWidth="1.2"
                                      strokeLinejoin="round"
                                    />
                                    <circle
                                      cx="32"
                                      cy="46"
                                      r="9"
                                      fill="#FFFBEB"
                                      stroke="#F59E0B"
                                      strokeWidth="2"
                                    />
                                    <path
                                      d="M32 40.5L33.2 44.2H37L34 46.4L35.2 50L32 47.8L28.8 50L30 46.4L27 44.2H30.8Z"
                                      fill="#F59E0B"
                                    />
                                  </svg>
                                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                    Certificate
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                    {/* Participation Certificate card */}
                    {event.certificateAvailable && (
                      <div className="flex items-stretch rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow duration-200">
                        {/* LEFT — participation trophy/gift icon */}
                        <div className="shrink-0 w-36 flex flex-col items-center justify-center px-4 py-5 border-r border-gray-200 dark:border-gray-700 bg-blue-50/60 dark:bg-blue-900/10">
                          <svg
                            viewBox="0 0 64 64"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-14 h-14"
                          >
                            {/* Gift box base */}
                            <rect
                              x="10"
                              y="30"
                              width="44"
                              height="26"
                              rx="2"
                              fill="#EFF6FF"
                              stroke="#3B82F6"
                              strokeWidth="2"
                            />
                            {/* Gift box lid */}
                            <rect
                              x="8"
                              y="22"
                              width="48"
                              height="10"
                              rx="2"
                              fill="#DBEAFE"
                              stroke="#3B82F6"
                              strokeWidth="2"
                            />
                            {/* Ribbon vertical */}
                            <rect
                              x="29"
                              y="22"
                              width="6"
                              height="34"
                              fill="#3B82F6"
                              opacity="0.25"
                            />
                            {/* Ribbon horizontal */}
                            <rect
                              x="8"
                              y="25"
                              width="48"
                              height="4"
                              fill="#3B82F6"
                              opacity="0.25"
                            />
                            {/* Bow left loop */}
                            <path
                              d="M32 22 C28 14 16 14 18 20 C20 24 28 22 32 22Z"
                              fill="#3B82F6"
                              opacity="0.7"
                              stroke="#2563EB"
                              strokeWidth="1.2"
                            />
                            {/* Bow right loop */}
                            <path
                              d="M32 22 C36 14 48 14 46 20 C44 24 36 22 32 22Z"
                              fill="#3B82F6"
                              opacity="0.7"
                              stroke="#2563EB"
                              strokeWidth="1.2"
                            />
                            {/* Bow center */}
                            <circle cx="32" cy="22" r="3" fill="#1D4ED8" />
                          </svg>
                        </div>

                        {/* RIGHT */}
                        <div className="flex flex-1 items-center justify-between gap-4 px-5 py-4">
                          <div>
                            <h4 className="text-base font-bold text-gray-900 dark:text-white">
                              Participation Certificate
                            </h4>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              Awarded to all eligible participants
                            </p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                            <svg
                              viewBox="0 0 64 64"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-5 h-5 shrink-0"
                            >
                              <rect
                                x="8"
                                y="6"
                                width="48"
                                height="36"
                                rx="3"
                                fill="#FFF8E7"
                                stroke="#F59E0B"
                                strokeWidth="2"
                              />
                              <line
                                x1="16"
                                y1="16"
                                x2="48"
                                y2="16"
                                stroke="#F59E0B"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                              <line
                                x1="16"
                                y1="23"
                                x2="48"
                                y2="23"
                                stroke="#D4A855"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                opacity="0.6"
                              />
                              <line
                                x1="16"
                                y1="29"
                                x2="40"
                                y2="29"
                                stroke="#D4A855"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                opacity="0.5"
                              />
                              <path
                                d="M20 42L16 57L22 53L26 57L26 42"
                                fill="#EF4444"
                                stroke="#DC2626"
                                strokeWidth="1.2"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M44 42L48 57L42 53L38 57L38 42"
                                fill="#EF4444"
                                stroke="#DC2626"
                                strokeWidth="1.2"
                                strokeLinejoin="round"
                              />
                              <circle
                                cx="32"
                                cy="46"
                                r="9"
                                fill="#FFFBEB"
                                stroke="#F59E0B"
                                strokeWidth="2"
                              />
                              <path
                                d="M32 40.5L33.2 44.2H37L34 46.4L35.2 50L32 47.8L28.8 50L30 46.4L27 44.2H30.8Z"
                                fill="#F59E0B"
                              />
                            </svg>
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                              Certificate
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* General prize text fallback */}
                    {!event.prizes?.length && event.prizeDetails && (
                      <div className="flex items-stretch rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                        <div className="shrink-0 w-36 flex flex-col items-center justify-center px-4 py-5 border-r border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/10">
                          <svg
                            viewBox="0 0 64 64"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-12 h-12 mb-1"
                          >
                            <path
                              d="M20 10H44V30C44 40.493 38.627 49 32 49C25.373 49 20 40.493 20 30Z"
                              fill="#FEF3C7"
                              stroke="#F59E0B"
                              strokeWidth="2.5"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M20 16H13C10.239 16 8 18.239 8 21C8 23.761 10.239 26 13 26H20"
                              stroke="#F59E0B"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M44 16H51C53.761 16 56 18.239 56 21C56 23.761 53.761 26 51 26H44"
                              stroke="#F59E0B"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M32 49V55"
                              stroke="#F59E0B"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                            <rect
                              x="22"
                              y="55"
                              width="20"
                              height="4"
                              rx="2"
                              fill="#FEF3C7"
                              stroke="#F59E0B"
                              strokeWidth="2.5"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M32 21L33.5 25.5H38L34.5 28L36 32.5L32 30L28 32.5L29.5 28L26 25.5H30.5Z"
                              fill="#F59E0B"
                              opacity="0.6"
                            />
                          </svg>
                          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                            Prize
                          </span>
                        </div>
                        <div className="flex-1 px-5 py-4">
                          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                            Prize Details
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {event.prizeDetails}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Disclaimer note */}
                  <p className="mt-5 text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                    * All prizes and certificates will be released within 30
                    days after the event is over.
                  </p>
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
                  {event.registrationEndDate &&
                  new Date(event.registrationEndDate) >= new Date() ? (
                    <div className="flex flex-col">
                      <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {Math.ceil(
                          (new Date(event.registrationEndDate).getTime() -
                            Date.now()) /
                            (1000 * 60 * 60 * 24),
                        )}
                      </span>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Days Left
                      </span>
                    </div>
                  ) : event.registrationEndDate &&
                    new Date(event.registrationEndDate) < new Date() ? (
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-red-600 dark:text-red-400">
                        Closed
                      </span>
                      <span className="text-xs text-gray-500">
                        Registration Ended
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        Register Now
                      </span>
                      <span className="text-xs text-gray-500">
                        Limited Time
                      </span>
                    </div>
                  )}

                  {currentUser && !isCreator && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-100 dark:border-emerald-800">
                      <Sparkles className="w-3.5 h-3.5 fill-current" />
                      <span className="text-xs font-bold">
                        You are eligible
                      </span>
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
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {currentUser.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {currentUser.email}
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Section */}
                <div className="space-y-3">
                  {!registrationOpen &&
                  !isCreator &&
                  !event?.userRegistration ? (
                    <div className="w-full py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm font-bold rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4" />
                      Registration Closed
                    </div>
                  ) : (
                    <>
                      {canRegister && (
                        <button
                          onClick={handleRegister}
                          className="group relative w-full h-14 text-base font-bold rounded-xl overflow-hidden transition-all duration-300 ease-out hover:shadow-sgt-lg hover:rotate-[1.5deg] active:scale-[0.98] flex items-center justify-center text-white bg-sgt-600 hover:bg-sgt-700 shadow-sgt pl-14 pr-6"
                        >
                          <div className="absolute left-0 top-0 m-1.5 h-11 w-11 rounded-lg bg-white/20 flex items-center justify-start pl-3 transition-all duration-300 ease-out group-hover:w-[calc(100%-0.75rem)] group-hover:bg-white/30">
                            <ClipboardList className="w-5 h-5 text-white shrink-0" />
                          </div>
                          <span className="relative z-10 flex items-center gap-2">
                            Register Now
                            <ArrowLeft className="w-4 h-4 rotate-180 transition-transform group-hover:translate-x-1" />
                          </span>
                          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-sgt-400 animate-ping opacity-60" />
                          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-sgt-500 scale-90" />
                        </button>
                      )}
                      {isTeamBased &&
                        event?.status === "published" &&
                        !isCreator &&
                        !event?.userRegistration &&
                        registrationOpen && (
                          <Link
                            href={`/events/${event.id}/registration`}
                            className="group relative flex w-full h-14 text-base font-bold rounded-xl overflow-hidden transition-all duration-300 ease-out hover:shadow-sgt-lg hover:rotate-[1.5deg] active:scale-[0.98] items-center justify-center text-white bg-sgt-600 hover:bg-sgt-700 shadow-sgt pl-14 pr-6"
                          >
                            <div className="absolute left-0 top-0 m-1.5 h-11 w-11 rounded-lg bg-white/20 flex items-center justify-start pl-3 transition-all duration-300 ease-out group-hover:w-[calc(100%-0.75rem)] group-hover:bg-white/30">
                              <UsersRound className="w-5 h-5 text-white shrink-0" />
                            </div>
                            <span className="relative z-10 flex items-center gap-2">
                              Register Team
                              <ArrowLeft className="w-4 h-4 rotate-180 transition-transform group-hover:translate-x-1" />
                            </span>
                            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-sgt-400 animate-ping opacity-60" />
                            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-sgt-500 scale-90" />
                          </Link>
                        )}
                    </>
                  )}

                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
                    <UserPlus className="w-3.5 h-3.5 text-gray-400" />
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
                      <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {event.currentRegistrations}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {event.maxCapacity
                          ? `of ${event.maxCapacity} spots`
                          : "participants"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${
                          event.paymentType === "free"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                        }`}
                      >
                        {event.paymentType === "free"
                          ? "FREE"
                          : `₹${event.registrationFee}`}
                      </span>
                    </div>
                  </div>

                  {event.maxCapacity && (
                    <div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${capacityPercent >= 90 ? "bg-red-500" : capacityPercent >= 70 ? "bg-amber-500" : "bg-sgt-500"}`}
                          style={{ width: `${capacityPercent}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {Math.max(
                          0,
                          event.maxCapacity - (event.currentRegistrations || 0),
                        )}{" "}
                        spots remaining
                      </p>
                    </div>
                  )}

                  {/* Registration deadline */}
                  {event.registrationEndDate && (
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                        Registration closes
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {fmtShort(event.registrationEndDate)}
                      </p>
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
                  <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                    Action Required
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Your registration is incomplete. Please setup your team to
                  complete the registration process.
                </p>
                <div className="space-y-2.5 mb-4">
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                      Registration ID
                    </p>
                    <p className="text-sm font-mono text-gray-900 dark:text-white">
                      {event.userRegistration.registrationId}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                      Status
                    </p>
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
                  <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Your Registration
                  </h3>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                      Registration ID
                    </p>
                    <p className="text-sm font-mono text-gray-900 dark:text-white">
                      {event.userRegistration.registrationId}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                      Status
                    </p>
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded mt-0.5">
                      {event.userRegistration.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                      Registered On
                    </p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {fmtShort(event.userRegistration.registeredAt)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Contact Information */}
            {(event.contactPersonName ||
              event.contactEmail ||
              event.contactMobile ||
              event.websiteUrl) && (
              <div className={`${CARD} p-6`}>
                <SectionLabel>Contact</SectionLabel>
                <div className="space-y-3">
                  {event.contactPersonName && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <User className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-900 dark:text-white font-medium">
                        {event.contactPersonName}
                      </span>
                    </div>
                  )}
                  {event.contactEmail && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                      <a
                        href={`mailto:${event.contactEmail}`}
                        className="text-sgt-600 dark:text-sgt-400 hover:underline truncate"
                      >
                        {event.contactEmail}
                      </a>
                    </div>
                  )}
                  {event.contactMobile && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                      <a
                        href={`tel:${event.contactMobile}`}
                        className="text-gray-900 dark:text-white"
                      >
                        {event.contactMobile}
                      </a>
                    </div>
                  )}
                  {event.alternateContact && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-400">
                        {event.alternateContact}{" "}
                        <span className="text-xs text-gray-400">(Alt)</span>
                      </span>
                    </div>
                  )}
                  {event.websiteUrl && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                      <a
                        href={event.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sgt-600 dark:text-sgt-400 hover:underline truncate flex items-center gap-1"
                      >
                        {event.websiteUrl.replace(/^https?:\/\//, "")}{" "}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Social Media */}
                {hasSocialLinks && (
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">
                      Social Media
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(event.socialMediaLinks!)
                        .filter(([, v]) => v)
                        .map(([platform, url]) => (
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
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {event.createdBy.name}
                    </p>
                    {event.createdBy.email && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {event.createdBy.email}
                      </p>
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
                  <span className="text-[10px] font-medium text-gray-400 uppercase">
                    Event ID
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-sgt-50 dark:bg-sgt-900/20 border border-sgt-100 dark:border-sgt-800 font-mono text-xs font-semibold text-sgt-700 dark:text-sgt-300">
                    {event.eventId}
                  </span>
                </div>
                {event.notingId && event.note && isCreator && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-gray-400 uppercase">
                      Noting
                    </span>
                    <Link
                      href={`/noting/${event.notingId}`}
                      className="text-xs text-sgt-600 dark:text-sgt-400 hover:underline flex items-center gap-1"
                    >
                      View Noting <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-gray-400 uppercase">
                    Published
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {event.publishedAt
                      ? fmtShort(event.publishedAt)
                      : "Not yet"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
