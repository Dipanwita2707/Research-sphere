"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ClipboardList,
  ExternalLink,
  Globe,
  Mail,
  Phone,
  Sparkles,
  User,
  UserPlus,
  Users,
  Users2,
} from "lucide-react";
import type { Event } from "@/features/event-management/types/event.types";

/* Card wrapper — duplicated from parent to allow independent use */
const CARD =
  "overflow-hidden rounded-[1.5rem] border border-sky-100/90 bg-white/95 shadow-[0_24px_60px_-36px_rgba(1,31,75,0.45)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
    {children}
  </h3>
);

const fmtShort = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const getRemainingSeats = (event: Event) =>
  event.maxCapacity
    ? Math.max(0, event.maxCapacity - (event.currentRegistrations || 0))
    : null;

interface EventSidebarProps {
  event: Event;
  currentUser: { name: string; email: string } | null;
  isCreator: boolean;
  isRegistered: boolean;
  hasIncompleteRegistration: boolean;
  isTeamBased: boolean;
  registrationOpen: boolean;
  canRegister: boolean;
  capacityPercent: number;
  hasSocialLinks: boolean;
  onRegister: () => void;
}

export default function EventSidebar({
  event,
  currentUser,
  isCreator,
  isRegistered,
  hasIncompleteRegistration,
  isTeamBased,
  registrationOpen,
  canRegister,
  capacityPercent,
  hasSocialLinks,
  onRegister,
}: EventSidebarProps) {
  const remainingSeats = getRemainingSeats(event);
  const publicRegistrationCount = event.currentRegistrations || 0;
  const shouldRevealRegistrationCount = publicRegistrationCount >= 100;
  const publicCapacityLabel = event.maxCapacity
    ? `Capacity ${event.maxCapacity}`
    : "Unlimited capacity";
  const compactSeatLabel = shouldRevealRegistrationCount ? "Seats" : "Capacity";
  const compactSeatValue = shouldRevealRegistrationCount
    ? remainingSeats !== null
      ? `${remainingSeats}`
      : "Open"
    : event.maxCapacity
      ? `${event.maxCapacity}`
      : "Unlimited";
  const sidebarAvailabilityText = shouldRevealRegistrationCount
    ? remainingSeats !== null
      ? `${remainingSeats} seats remaining`
      : "Unlimited capacity"
    : publicCapacityLabel;
  const registeredHeadline = shouldRevealRegistrationCount
    ? `${publicRegistrationCount}`
    : "Few seats left";
  const registeredSubline = shouldRevealRegistrationCount
    ? event.maxCapacity
      ? `of ${event.maxCapacity} spots`
      : "participants"
    : publicCapacityLabel;

  return (
    <div className="lg:col-span-4 space-y-6 xl:pl-2">
      {/* Registration Card */}
      {!isRegistered && !hasIncompleteRegistration && (
        <div className="relative overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-[0_26px_70px_-38px_rgba(1,31,75,0.5)] dark:border-slate-700 dark:bg-slate-900">
          <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(135deg,rgba(173,225,251,0.24),rgba(38,108,169,0.1)_42%,transparent)]" />
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full border border-sky-100/70" />

          <div className="relative space-y-6">
          {/* Header Row: Days Left & Eligibility Status */}
            <div className="flex items-start justify-between gap-4">
              {event.registrationEndDate &&
              new Date(event.registrationEndDate) >= new Date() ? (
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-sgt-500 dark:text-sky-300">
                    Registration window
                  </span>
                  <span className="mt-2 text-4xl font-black tracking-[-0.05em] text-slate-900 dark:text-white">
                    {Math.ceil(
                      (new Date(event.registrationEndDate).getTime() -
                        Date.now()) /
                        (1000 * 60 * 60 * 24),
                    )}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    Days left
                  </span>
                </div>
              ) : event.registrationEndDate &&
                new Date(event.registrationEndDate) < new Date() ? (
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-red-500">
                    Registration window
                  </span>
                  <span className="mt-2 text-2xl font-black tracking-[-0.04em] text-red-600 dark:text-red-400">
                    Closed
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Registration ended
                  </span>
                </div>
              ) : (
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-sgt-500 dark:text-sky-300">
                    Registration window
                  </span>
                  <span className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-900 dark:text-white">
                    Open now
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Limited availability
                  </span>
                </div>
              )}

              {currentUser && !isCreator && (
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  <span className="text-xs font-bold uppercase tracking-[0.18em]">
                    Eligible
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-3 dark:border-slate-700 dark:bg-slate-800/80">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                  Fee
                </p>
                <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                  {event.paymentType === "free" ? "Free" : `₹${event.registrationFee}`}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-3 dark:border-slate-700 dark:bg-slate-800/80">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                  Format
                </p>
                <p className="mt-2 text-sm font-bold capitalize text-slate-900 dark:text-white">
                  {isTeamBased ? "Team" : "Solo"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-3 dark:border-slate-700 dark:bg-slate-800/80">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                  {compactSeatLabel}
                </p>
                <p className="mt-2 text-sm font-bold leading-tight text-slate-900 dark:text-white">
                  {compactSeatValue}
                </p>
              </div>
            </div>

          {/* User Profile */}
          {currentUser && !isCreator && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/90 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {currentUser.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {currentUser.email}
                </p>
              </div>
            </div>
          )}

          {/* Action Section */}
          <div className="space-y-3">
            {!registrationOpen && !isCreator && !event?.userRegistration ? (
              <div className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100 py-3.5 text-sm font-bold text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <Clock className="w-4 h-4" />
                Registration Closed
              </div>
            ) : (
              <>
                {canRegister && (
                  <button
                    onClick={onRegister}
                    className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#ADE1FB_0%,#6FC7F5_18%,#266CA9_50%,#0F2573_100%)] pl-14 pr-6 text-base font-bold text-white shadow-[0_22px_35px_-18px_rgba(15,37,115,0.55)] transition-all duration-300 ease-out hover:translate-y-[-1px] active:scale-[0.98]"
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
                      className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#ADE1FB_0%,#6FC7F5_18%,#266CA9_50%,#0F2573_100%)] pl-14 pr-6 text-base font-bold text-white shadow-[0_22px_35px_-18px_rgba(15,37,115,0.55)] transition-all duration-300 ease-out hover:translate-y-[-1px] active:scale-[0.98]"
                    >
                      <div className="absolute left-0 top-0 m-1.5 h-11 w-11 rounded-lg bg-white/20 flex items-center justify-start pl-3 transition-all duration-300 ease-out group-hover:w-[calc(100%-0.75rem)] group-hover:bg-white/30">
                        <Users2 className="w-5 h-5 text-white shrink-0" />
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

            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <UserPlus className="w-3.5 h-3.5 text-slate-400" />
              <p>
                {sidebarAvailabilityText}
              </p>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Stats When Registered */}
      {isRegistered && (
        <div className={`${CARD} p-6`}>
          <SectionLabel>Registration</SectionLabel>
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="max-w-[12ch] text-3xl font-bold leading-tight text-gray-900 dark:text-white">
                  {registeredHeadline}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {registeredSubline}
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

            {event.maxCapacity && shouldRevealRegistrationCount && (
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

          </div>
        </div>
      )}

      {/* Incomplete Team Registration */}
      {hasIncompleteRegistration && event.userRegistration && (
        <div className="rounded-[1.5rem] border border-orange-300 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(194,65,12,0.45)] dark:border-orange-700 dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-300">
              Action Required
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Your registration is incomplete. Please setup your team to complete
            the registration process.
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
        <div className="rounded-[1.5rem] border border-emerald-300 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(5,150,105,0.42)] dark:border-emerald-700 dark:bg-slate-900">
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
          {/* Team event quick actions */}
          {isTeamBased && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
              <Link
                href={`/events/${event.id}/registration`}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-sgt-600 text-white text-sm font-medium rounded-md hover:bg-sgt-700 transition-colors"
              >
                <Users className="w-4 h-4" />
                View Team & QR
              </Link>
              <Link
                href={`/events/${event.id}/registration/team`}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 text-sm font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Users2 className="w-4 h-4" />
                Manage Team
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Contact Information */}
      {(event.contactPersonName ||
        event.contactEmail ||
        event.contactMobile ||
        event.websiteUrl) && (
        <div id="event-contact" className={`${CARD} p-6`}>
          <div className="mb-5 rounded-2xl bg-[linear-gradient(135deg,rgba(173,225,251,0.22),rgba(38,108,169,0.08))] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sgt-500 dark:text-sky-300">
              Contact desk
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Reach the organizer directly for logistics, clarifications, or external links.
            </p>
          </div>
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
          <div className="mb-5 rounded-2xl bg-[linear-gradient(135deg,rgba(173,225,251,0.22),rgba(38,108,169,0.08))] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sgt-500 dark:text-sky-300">
              Organizer
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Event ownership and communication details.
            </p>
          </div>
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
        <div className="mb-5 rounded-2xl bg-[linear-gradient(135deg,rgba(173,225,251,0.22),rgba(38,108,169,0.08))] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sgt-500 dark:text-sky-300">
            Reference
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Use this event ID for support, queries, or internal tracking.
          </p>
        </div>
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
              {event.publishedAt ? fmtShort(event.publishedAt) : "Not yet"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
