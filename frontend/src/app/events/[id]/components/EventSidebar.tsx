"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Sparkles,
  User,
  UserPlus,
  Users,
  Users2,
  Timer,
} from "lucide-react";
import type { Event } from "@/features/event-management/types/event.types";

const fmtShort = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getRemainingSeats = (event: Event) =>
  event.maxCapacity
    ? Math.max(0, event.maxCapacity - (event.currentRegistrations || 0))
    : null;

const getDaysLeft = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

interface EventSidebarProps {
  event: Event;
  currentUser: { name: string; email: string } | null;
  isCreator: boolean;
  isRegistered: boolean;
  hasIncompleteRegistration: boolean;
  hasPendingPayment: boolean;
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
  hasPendingPayment,
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

  const daysLeft = event.registrationEndDate ? getDaysLeft(event.registrationEndDate) : null;
  const regExpired = event.registrationEndDate ? new Date(event.registrationEndDate) < new Date() : false;

  return (
    <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
      {/* =====
   REGISTRATION INFO CARD =====
   */}
      <div className="overflow-hidden rounded-2xl border border-[#b3cde0]/45 bg-white/95 shadow-[0_2px_12px_rgba(0,91,150,0.08)]">
        <div className="border-b border-[#b3cde0]/35 bg-gradient-to-r from-[#011f4b] to-[#03396c] px-5 py-4">
          <h3 className="text-base font-bold text-white">Registration Info</h3>
        </div>

        <div className="divide-y divide-[#b3cde0]/25">
          {/* Deadline */}
          {event.registrationEndDate && (
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-[#6497b1]">Deadline</span>
              <span className="text-sm font-semibold text-[#011f4b]">{fmtDateTime(event.registrationEndDate)}</span>
            </div>
          )}

          {/* Mode */}
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-[#6497b1]">Mode</span>
            <span className="text-sm font-semibold capitalize text-[#011f4b]">{event.opportunityMode || "Offline"}</span>
          </div>

          {/* Participation */}
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-[#6497b1]">Participation</span>
            <span className="text-sm font-semibold capitalize text-[#011f4b]">
              {event.participationType || "Individual"}
              {isTeamBased && ` (${event.minTeamSize}-${event.maxTeamSize})`}
            </span>
          </div>

          {/* Type */}
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-[#6497b1]">Type</span>
            <span className="text-sm font-semibold capitalize text-[#011f4b]">{event.eventType}</span>
          </div>

          {/* Fee */}
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-[#6497b1]">Entry Fee</span>
            <span className="text-sm font-semibold text-[#011f4b]">
              {event.paymentType ===
   "free" ? "Free" : `₹${event.registrationFee}`}
            </span>
          </div>

          {/* Capacity */}
          {event.maxCapacity && (
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-[#6497b1]">Capacity</span>
              <span className="text-sm font-semibold text-[#011f4b]">{event.maxCapacity}</span>
            </div>
          )}

          {/* Registration Ends Timer */}
          {event.registrationEndDate && !regExpired && (
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-[#6497b1]">Registration Ends</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600 ring-1 ring-red-100">
                <Timer className="w-3.5 h-3.5" />
                {daysLeft} days left
              </span>
            </div>
          )}
          {regExpired && (
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-[#6497b1]">Registration</span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500">Closed</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="px-5 py-4 space-y-3">
          {/* Not registered & not creator */}
          {!isRegistered && !hasIncompleteRegistration && (
            <>
              {canRegister && (
                <button
                  onClick={onRegister}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sgt-400 via-sgt-500 to-sgt-600 px-4 py-3 text-sm font-bold text-white shadow-md transition-all duration-200 hover:shadow-lg hover:brightness-105 active:scale-[0.98]"
                >
                  Register Now
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </button>
              )}
              {isTeamBased && event.status ===
   "published" && !isCreator && !event.userRegistration && registrationOpen && (
                <Link
                  href={`/events/${event.id}/registration`}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sgt-400 via-sgt-500 to-sgt-600 px-4 py-3 text-sm font-bold text-white shadow-md transition-all duration-200 hover:shadow-lg hover:brightness-105 active:scale-[0.98]"
                >
                  <Users2 className="w-4 h-4" />
                  Register Team
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </Link>
              )}
              {!registrationOpen && !isCreator && !event.userRegistration && (
                <div className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-3 text-sm font-semibold text-gray-400">
                  <Clock className="w-4 h-4" />
                  Registration Closed
                </div>
              )}
              {isCreator && (
                <Link
                  href={`/events/${event.id}/manage`}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-sgt-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sgt-700"
                >
                  Manage Event
                </Link>
              )}
            </>
          )}

          {/* Registered */}
          {isRegistered && event.userRegistration && (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
                <CheckCircle2 className="w-4 h-4" />
                You are registered
              </div>
              <Link
                href="/events/registrations"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-sgt-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sgt-700"
              >
                {event.allowExtraPasses ? "Open Guest Passes" : "View My Pass"}
              </Link>
              {isTeamBased && (
                <div className="flex gap-2">
                  <Link
                    href={`/events/${event.id}/registration`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    <Users className="w-3.5 h-3.5" />
                    View Team
                  </Link>
                  <Link
                    href={`/events/${event.id}/registration/team`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    <Users2 className="w-3.5 h-3.5" />
                    Manage Team
                  </Link>
                </div>
              )}

              <div className="pt-2 space-y-2 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Registration ID</span>
                  <span className="font-mono font-semibold text-gray-700">{event.userRegistration.registrationId}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Status</span>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">{event.userRegistration.status}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Registered On</span>
                  <span className="text-gray-700 font-medium">{fmtShort(event.userRegistration.registeredAt)}</span>
                </div>
              </div>

              {event.maxCapacity && shouldRevealRegistrationCount && (
                <div className="pt-2">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${capacityPercent >= 90 ? "bg-red-500" : capacityPercent >= 70 ? "bg-amber-500" : "bg-sgt-500"}`}
                      style={{ width: `${capacityPercent}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {Math.max(0, event.maxCapacity - (event.currentRegistrations || 0))} spots remaining
                  </p>
                </div>
              )}
            </>
          )}

          {/* Incomplete team */}
          {hasIncompleteRegistration && event.userRegistration && (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 ring-1 ring-orange-100">
                <Users className="w-4 h-4" />
                Incomplete Team - Action Required
              </div>
              <Link
                href={`/events/${event.id}/registration/team`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-700"
              >
                Setup Team Now
              </Link>
              <div className="pt-2 space-y-2 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Registration ID</span>
                  <span className="font-mono font-semibold text-gray-700">{event.userRegistration.registrationId}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Status</span>
                  <span className="rounded bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-700">INCOMPLETE</span>
                </div>
              </div>
            </>
          )}

          {/* Pending payment */}
          {hasPendingPayment && event.userRegistration && (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 ring-1 ring-amber-100">
                <Clock className="w-4 h-4" />
                Payment Pending
              </div>
              <Link
                href={isTeamBased ? `/events/${event.id}/registration/team` : `/events/${event.id}/registration/payment`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-600"
              >
                Complete Payment
              </Link>
            </>
          )}

          {/* Registered user info */}
          {currentUser && !isCreator && !isRegistered && !hasIncompleteRegistration && (
            <div className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sgt-50 text-xs font-bold text-sgt-600">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ev-900">{currentUser.name}</p>
                <p className="truncate text-xs text-gray-500">{currentUser.email}</p>
              </div>
              {!regExpired && (
                <div className="ml-auto shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700">
                    <Sparkles className="w-3 h-3" />
                    Eligible
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Seat info */}
          {!isRegistered && !hasIncompleteRegistration && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <UserPlus className="w-3.5 h-3.5" />
              {shouldRevealRegistrationCount
                ? remainingSeats !== null
                  ? `${remainingSeats} seats remaining`
                  : "Unlimited capacity"
                : event.maxCapacity
                  ? `Capacity ${event.maxCapacity}`
                  : "Unlimited capacity"}
            </div>
          )}
        </div>
      </div>

      {/* =====
   ORGANIZER CARD =====
   */}
      {event.createdBy && (
        <div className="rounded-2xl border border-[#b3cde0]/45 bg-white/95 p-5 shadow-[0_2px_12px_rgba(0,91,150,0.08)]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6497b1]">Organized By</p>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sgt-50 text-sm font-bold text-sgt-600">
              {event.createdBy.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-ev-900">{event.createdBy.name}</p>
              {event.createdBy.email && (
                <p className="text-xs text-gray-500">{event.createdBy.email}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====
   EVENT REFERENCE CARD =====
   */}
      <div className="rounded-2xl border border-[#b3cde0]/45 bg-white/95 p-5 shadow-[0_2px_12px_rgba(0,91,150,0.08)]">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6497b1]">Event Reference</p>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Event ID</span>
            <span className="rounded-md bg-gray-100 px-2.5 py-1 font-mono text-xs font-semibold text-ev-900">
              {event.eventId}
            </span>
          </div>
          {event.notingId && event.note && isCreator && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Noting</span>
              <Link
                href={`/noting/${event.notingId}`}
                className="text-xs font-semibold text-sgt-600 hover:underline flex items-center gap-1"
              >
                View Noting <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Published</span>
            <span className="text-xs font-medium text-gray-700">
              {event.publishedAt ? fmtShort(event.publishedAt) : "Not yet"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
