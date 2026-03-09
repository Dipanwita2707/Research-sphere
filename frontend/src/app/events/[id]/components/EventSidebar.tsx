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
  "bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt";

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
  return (
    <div className="lg:col-span-4 space-y-8">
      {/* Registration Card */}
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

          {/* User Profile */}
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
            {!registrationOpen && !isCreator && !event?.userRegistration ? (
              <div className="w-full py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm font-bold rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                Registration Closed
              </div>
            ) : (
              <>
                {canRegister && (
                  <button
                    onClick={onRegister}
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

            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
              <UserPlus className="w-3.5 h-3.5 text-gray-400" />
              <p>{event.currentRegistrations || 0} registered recently</p>
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
              {event.publishedAt ? fmtShort(event.publishedAt) : "Not yet"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
