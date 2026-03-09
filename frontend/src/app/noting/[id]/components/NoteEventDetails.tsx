"use client";

import { Note } from "@/features/noting-management/types/noting.types";
import ClubDetailsCard from "@/features/dsw/components/ClubDetailsCard";

interface NoteEventDetailsProps {
  note: Note;
}

export default function NoteEventDetails({ note }: NoteEventDetailsProps) {
  return (
    <>
      {/* DSW Club Creation Details */}
      {note.subcategory === "dsw_club_creation" && note.clubName && (
        <section>
          <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
            Club Creation Details
          </h3>
          <ClubDetailsCard
            mode="view"
            data={note}
            resolvedDetails={note.clubDetails}
          />
        </section>
      )}

      {/* Event Details */}
      {note.subcategory === "events" && (
        <section>
          <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
            Event Details
          </h3>

          {/* ── FESTIVAL ── */}
          {note.notingEventType === "festival" ? (
            <div className="space-y-4">
              {/* Festival Meta Card */}
              {note.festivalMeta && (
                <div className="rounded-xl border border-purple-200 dark:border-purple-800 overflow-hidden">
                  <div className="bg-purple-50 dark:bg-purple-900/20 px-3 py-2 border-b border-purple-100 dark:border-purple-800">
                    <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      🎪 Festival Information
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 dark:bg-gray-700">
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Festival Name
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {note.festivalMeta.name || "—"}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Coordinator
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {note.festivalMeta.coordinator || "—"}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Start Date & Time
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {note.festivalMeta.startDate
                          ? new Date(
                              note.festivalMeta.startDate,
                            ).toLocaleString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : "—"}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        End Date & Time
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {note.festivalMeta.endDate
                          ? new Date(
                              note.festivalMeta.endDate,
                            ).toLocaleString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : "—"}
                      </p>
                    </div>
                    {note.festivalMeta.description && (
                      <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                          Description
                        </label>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {note.festivalMeta.description}
                        </p>
                      </div>
                    )}
                  </div>
                  {note.status === "pending" && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900">
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        <span className="font-medium">
                          Auto-Creation:
                        </span>{" "}
                        When approved, all sub-events will be created in{" "}
                        <span className="font-semibold">DRAFT</span>{" "}
                        status.
                      </p>
                    </div>
                  )}
                  {note.status === "approved" && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border-t border-emerald-100 dark:border-emerald-900">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        <span className="font-medium">
                          Events Created.
                        </span>{" "}
                        Visit{" "}
                        <a
                          href="/events/my-events"
                          className="underline font-semibold"
                        >
                          My Created Events
                        </a>{" "}
                        to add details and publish.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Events */}
              {Array.isArray(note.subEvents) &&
                note.subEvents.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                      Sub-Events ({note.subEvents.length})
                    </p>
                    <div className="space-y-3">
                      {note.subEvents.map((se, idx) => {
                        const v = se.venueFormData;
                        return (
                          <div
                            key={idx}
                            className="rounded-xl border border-[#b3cde0]/30 dark:border-gray-700 overflow-hidden"
                          >
                            {/* Sub-event header */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-[#f8fafc] dark:bg-gray-700/50 border-b border-[#b3cde0]/30 dark:border-gray-700">
                              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                #{idx + 1}
                              </span>
                              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1">
                                {v.eventName || "(Unnamed)"}
                              </span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${se.eventType === "stall" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"}`}
                              >
                                {se.eventType === "stall"
                                  ? "🪄 Stall-Based"
                                  : "🏛️ Venue"}
                              </span>
                            </div>
                            {/* Sub-event body */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[#b3cde0]/20 dark:bg-gray-700">
                              {v.eventType && (
                                <div className="bg-white dark:bg-gray-800 p-3">
                                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                    Event Type
                                  </label>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                    {v.eventType.replace(/_/g, " ")}
                                  </p>
                                </div>
                              )}
                              <div className="bg-white dark:bg-gray-800 p-3">
                                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                  Dates
                                </label>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {v.eventStartDate
                                    ? new Date(
                                        v.eventStartDate,
                                      ).toLocaleString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                      })
                                    : "—"}
                                  {v.eventEndDate &&
                                  v.eventEndDate !== v.eventStartDate
                                    ? ` – ${new Date(v.eventEndDate).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}`
                                    : ""}
                                </p>
                              </div>
                              {v.eventPaymentType && (
                                <div className="bg-white dark:bg-gray-800 p-3">
                                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                    Payment
                                  </label>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${v.eventPaymentType === "free" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}
                                  >
                                    {v.eventPaymentType.toUpperCase()}
                                    {v.eventPaymentType === "paid" &&
                                      (v.eventRegistrationFeeIndividual !=
                                        null ||
                                        v.eventRegistrationFeeTeam !=
                                          null) && (
                                        <span className="ml-1 font-normal">
                                          — ₹
                                          {Number(
                                            v.eventParticipationType ===
                                              "team"
                                              ? v.eventRegistrationFeeTeam ||
                                                  0
                                              : v.eventRegistrationFeeIndividual ||
                                                  0,
                                          ).toLocaleString()}{" "}
                                          {v.eventParticipationType ===
                                          "team"
                                            ? "/team"
                                            : "/person"}
                                        </span>
                                      )}
                                  </span>
                                </div>
                              )}
                              {v.eventParticipationType && (
                                <div className="bg-white dark:bg-gray-800 p-3">
                                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                    Participation
                                  </label>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                    {v.eventParticipationType}
                                  </p>
                                </div>
                              )}
                              {v.eventApproxCapacity != null && (
                                <div className="bg-white dark:bg-gray-800 p-3">
                                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                    Approx. Capacity
                                  </label>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {v.eventApproxCapacity}
                                  </p>
                                </div>
                              )}
                              {v.eventDutyLeaveAvailable != null && (
                                <div className="bg-white dark:bg-gray-800 p-3">
                                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                    Duty Leave
                                  </label>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {v.eventDutyLeaveAvailable
                                      ? "Yes"
                                      : "No"}
                                  </p>
                                  {v.eventDutyLeaveAvailable && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {Array.isArray(
                                        v.eventDutyLeaveEligibility,
                                      ) &&
                                      v.eventDutyLeaveEligibility.length >
                                        0
                                        ? `${v.eventDutyLeaveEligibility.map((e: string) => e.toUpperCase()).join(", ")}`
                                        : "All students"}
                                      {v.eventDutyLeaveRoleType
                                        ? ` • For: ${v.eventDutyLeaveRoleType}`
                                        : ""}
                                    </p>
                                  )}
                                </div>
                              )}
                              {v.eventCertification != null && (
                                <div className="bg-white dark:bg-gray-800 p-3">
                                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                    Certificate
                                  </label>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {v.eventCertification
                                      ? "📜 Yes"
                                      : "No"}
                                  </p>
                                </div>
                              )}
                              {v.eventHasSponsorship != null && (
                                <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                    Sponsorship
                                  </label>
                                  {v.eventHasSponsorship &&
                                  Array.isArray(v.eventSponsors) &&
                                  v.eventSponsors.length > 0 ? (
                                    <div className="mt-1 space-y-0.5">
                                      {v.eventSponsors.map(
                                        (s: any, si: number) => (
                                          <p
                                            key={si}
                                            className="text-sm text-gray-900 dark:text-white"
                                          >
                                            <span className="font-medium">
                                              {s.name}
                                            </span>
                                            {s.type === "cash"
                                              ? ` — ₹${Number(s.amount || 0).toLocaleString()}`
                                              : ` — In-kind: ${s.notes || "—"}`}
                                          </p>
                                        ),
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {v.eventHasSponsorship
                                        ? "Yes"
                                        : "No"}
                                    </p>
                                  )}
                                </div>
                              )}
                              {v.eventHasResources != null && (
                                <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                    Resources
                                  </label>
                                  {v.eventHasResources &&
                                  Array.isArray(v.eventResources) &&
                                  v.eventResources.length > 0 ? (
                                    <div className="mt-1 space-y-0.5">
                                      {v.eventResources.map(
                                        (r: any, ri: number) => (
                                          <p
                                            key={ri}
                                            className="text-sm text-gray-900 dark:text-white"
                                          >
                                            <span className="font-medium capitalize">
                                              {r.type}
                                            </span>
                                            {r.description
                                              ? ` — ${r.description}`
                                              : ""}
                                            {r.pricePerPiece != null &&
                                            r.quantity != null
                                              ? ` (₹${r.pricePerPiece} × ${r.quantity} = ₹${Number(r.pricePerPiece) * Number(r.quantity)})`
                                              : ""}
                                          </p>
                                        ),
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {v.eventHasResources ? "Yes" : "No"}
                                    </p>
                                  )}
                                </div>
                              )}
                              {Array.isArray(v.eventPrizesAwards) &&
                                v.eventPrizesAwards.length > 0 && (
                                  <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                                      🏆 Prizes / Awards
                                    </label>
                                    <div className="space-y-1">
                                      {v.eventPrizesAwards.map(
                                        (p: any, pi: number) => (
                                          <div
                                            key={pi}
                                            className="flex items-start gap-2 text-sm text-gray-900 dark:text-white"
                                          >
                                            <span className="font-semibold text-gray-500 min-w-[70px]">
                                              {p.rank}
                                            </span>
                                            <span>
                                              {p.prizeType === "cash" &&
                                              p.prizeAmount
                                                ? `₹${Number(p.prizeAmount).toLocaleString()}`
                                                : p.title || p.prizeType}
                                            </span>
                                            {Array.isArray(
                                              p.additionalPerks,
                                            ) &&
                                              p.additionalPerks.length >
                                                0 && (
                                                <span className="text-xs text-gray-400">
                                                  +
                                                  {p.additionalPerks.join(
                                                    ", ",
                                                  )}
                                                </span>
                                              )}
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                            {/* Stall config for stall-type sub-events */}
                            {se.eventType === "stall" &&
                              se.stallConfig && (
                                <div className="border-t border-[#b3cde0]/30 dark:border-gray-700 bg-amber-50/30 dark:bg-amber-900/10 p-3">
                                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
                                    Stall Configuration
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                                    <div>
                                      <span className="font-medium">
                                        Student-Applied Stalls:
                                      </span>{" "}
                                      {se.stallConfig.enableStudentApplied
                                        ? `Yes (max ${se.stallConfig.maxStudentStalls ?? "—"})`
                                        : "No"}
                                    </div>
                                    {se.stallConfig
                                      .enableStudentApplied &&
                                      se.stallConfig.stallFee != null && (
                                        <div>
                                          <span className="font-medium">
                                            Stall Fee:
                                          </span>{" "}
                                          ₹{se.stallConfig.stallFee}
                                        </div>
                                      )}
                                    {se.stallConfig
                                      .enableStudentApplied &&
                                      se.stallConfig
                                        .applicationDeadline && (
                                        <div>
                                          <span className="font-medium">
                                            Application Deadline:
                                          </span>{" "}
                                          {
                                            se.stallConfig
                                              .applicationDeadline
                                          }
                                        </div>
                                      )}
                                  </div>
                                </div>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            /* ── VENUE / STALL ── */
            <div className="rounded-xl border border-[#b3cde0]/30 dark:border-gray-700 overflow-hidden">
              {!note.eventName &&
              !note.eventType &&
              !note.eventStartDate ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic p-4">
                  Event details not provided.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[#b3cde0]/20 dark:bg-gray-700">
                  {note.eventName && (
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Event Name
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {note.eventName}
                      </p>
                    </div>
                  )}
                  {note.eventType && (
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Event Type
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {note.eventType.replace(/_/g, " ")}
                      </p>
                    </div>
                  )}
                  {note.eventStartDate && (
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Start
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(note.eventStartDate).toLocaleString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          },
                        )}
                      </p>
                    </div>
                  )}
                  {note.eventEndDate && (
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        End
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(note.eventEndDate).toLocaleString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          },
                        )}
                      </p>
                    </div>
                  )}
                  {note.eventPaymentType && (
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Payment Type
                      </label>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${note.eventPaymentType === "free" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}
                      >
                        {note.eventPaymentType.toUpperCase()}
                      </span>
                    </div>
                  )}
                  {note.eventParticipationType && (
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Participation
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {note.eventParticipationType.replace("_", " ")}
                      </p>
                    </div>
                  )}
                  {note.eventPaymentType === "paid" &&
                    (note.eventRegistrationFeeIndividual != null ||
                      note.eventRegistrationFeeTeam != null) && (
                      <div className="bg-white dark:bg-gray-800 p-3">
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                          Fee
                        </label>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {note.eventParticipationType === "team"
                            ? `₹ ${Number(note.eventRegistrationFeeTeam || 0).toLocaleString()} per team`
                            : `₹ ${Number(note.eventRegistrationFeeIndividual || 0).toLocaleString()} per person`}
                        </p>
                      </div>
                    )}
                  {note.eventApproxCapacity != null && (
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Approx. Capacity
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {note.eventApproxCapacity}
                      </p>
                    </div>
                  )}
                  {note.eventDutyLeaveAvailable != null && (
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Duty Leave
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {note.eventDutyLeaveAvailable ? "Yes" : "No"}
                      </p>
                      {note.eventDutyLeaveAvailable && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {Array.isArray(
                            note.eventDutyLeaveEligibility,
                          ) && note.eventDutyLeaveEligibility.length > 0
                            ? `Eligible: ${(note.eventDutyLeaveEligibility as string[]).map((e) => (e === "ug" ? "UG" : e === "pg" ? "PG" : e === "phd" ? "PhD" : e)).join(", ")}`
                            : "Students (UG, PG, PhD)"}
                          {note.eventDutyLeaveRoleType
                            ? ` • For: ${note.eventDutyLeaveRoleType}`
                            : ""}
                        </p>
                      )}
                    </div>
                  )}
                  {note.eventCertification != null && (
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Certificate
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {note.eventCertification ? "📜 Yes" : "No"}
                      </p>
                    </div>
                  )}
                  {note.eventHasSponsorship != null && (
                    <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Sponsorship
                      </label>
                      {note.eventHasSponsorship &&
                      Array.isArray(note.eventSponsors) &&
                      note.eventSponsors.length > 0 ? (
                        <div className="mt-1 space-y-1">
                          {note.eventSponsors.map((s, i) => (
                            <div
                              key={i}
                              className="text-sm text-gray-900 dark:text-white"
                            >
                              <span className="font-medium">
                                {s.name}
                              </span>
                              {s.type === "cash" ? (
                                <span className="text-gray-600 dark:text-gray-300">
                                  {" "}
                                  — ₹{" "}
                                  {Number(s.amount || 0).toLocaleString()}
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
                      ) : (
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {note.eventHasSponsorship
                            ? "Yes (details not provided)"
                            : "No"}
                        </p>
                      )}
                    </div>
                  )}
                  {note.eventHasResources != null && (
                    <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Resources
                      </label>
                      {note.eventHasResources &&
                      Array.isArray(note.eventResources) &&
                      note.eventResources.length > 0 ? (
                        <div className="mt-1 space-y-1">
                          {note.eventResources.map((r, i) => (
                            <div
                              key={i}
                              className="text-sm text-gray-900 dark:text-white"
                            >
                              <span className="font-medium capitalize">
                                {r.type}
                              </span>
                              {r.description ? ` — ${r.description}` : ""}
                              {r.pricePerPiece != null &&
                              r.quantity != null
                                ? ` (₹${r.pricePerPiece} × ${r.quantity} = ₹${Number(r.pricePerPiece) * Number(r.quantity)})`
                                : ""}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {note.eventHasResources
                            ? "Yes (details not provided)"
                            : "No"}
                        </p>
                      )}
                    </div>
                  )}
                  {Array.isArray(note.eventPrizesAwards) &&
                    note.eventPrizesAwards.length > 0 && (
                      <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                          🏆 Prizes / Awards
                        </label>
                        <div className="space-y-1">
                          {note.eventPrizesAwards.map((p, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-sm text-gray-900 dark:text-white"
                            >
                              <span className="font-semibold text-gray-500 min-w-[90px]">
                                {p.rank}
                              </span>
                              <span>
                                {p.prizeType === "cash" && p.prizeAmount
                                  ? `₹${Number(p.prizeAmount).toLocaleString()}`
                                  : p.title || p.prizeType}
                              </span>
                              {Array.isArray(p.additionalPerks) &&
                                p.additionalPerks.length > 0 && (
                                  <span className="text-xs text-gray-400">
                                    +{p.additionalPerks.join(", ")}
                                  </span>
                                )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* Stall Config (for stall events) */}
              {note.notingEventType === "stall" && note.stallConfig && (
                <div className="border-t border-[#b3cde0]/30 dark:border-gray-700 bg-amber-50/30 dark:bg-amber-900/10 p-3">
                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
                    🪄 Stall Configuration
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <div>
                      <span className="font-medium">
                        Student-Applied Stalls:
                      </span>{" "}
                      {note.stallConfig.enableStudentApplied
                        ? `Yes (max ${note.stallConfig.maxStudentStalls ?? "—"})`
                        : "No"}
                    </div>
                    {note.stallConfig.enableStudentApplied &&
                      note.stallConfig.stallFee != null && (
                        <div>
                          <span className="font-medium">Stall Fee:</span>{" "}
                          ₹{note.stallConfig.stallFee}
                        </div>
                      )}
                    {note.stallConfig.enableStudentApplied &&
                      note.stallConfig.applicationDeadline && (
                        <div>
                          <span className="font-medium">
                            Application Deadline:
                          </span>{" "}
                          {note.stallConfig.applicationDeadline}
                        </div>
                      )}
                  </div>
                </div>
              )}

              {note.eventName && note.status === "pending" && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900">
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    <span className="font-medium">Auto-Creation:</span>{" "}
                    When approved, an event will be created in{" "}
                    <span className="font-semibold">DRAFT</span> status.
                  </p>
                </div>
              )}
              {note.eventName && note.status === "approved" && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border-t border-emerald-100 dark:border-emerald-900">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    <span className="font-medium">Event Created.</span>{" "}
                    Visit{" "}
                    <a
                      href="/events/my-events"
                      className="underline font-semibold"
                    >
                      My Created Events
                    </a>{" "}
                    to add details and publish.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
