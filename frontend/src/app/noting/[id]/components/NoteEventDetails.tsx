"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Note } from "@/features/noting-management/types/noting.types";
import ClubDetailsCard from "@/features/dsw/components/ClubDetailsCard";
import { ROLE_LABELS } from "@/features/event-management/types/eventSettings.types";
import type { VisibleRole } from "@/features/event-management/types/eventSettings.types";
import { notingService } from "@/features/noting-management/services/noting.service";

interface NoteEventDetailsProps {
  note: Note;
}

type EventResourceItem = {
  type?: string;
  description?: string;
  pricePerPiece?: number | null;
  quantity?: number | null;
};

function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function SponsorLogoView({ logo, sponsorName, onZoom }: { logo?: { filePath: string; fileName: string } | null; sponsorName: string; onZoom?: (url: string, name: string) => void }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!logo?.filePath) {
      setLogoUrl(null);
      return;
    }

    notingService.viewAttachment(logo.filePath)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setLogoUrl(url);
      })
      .catch(() => {
        if (active) setLogoUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [logo?.filePath]);

  if (!logo) return null;

  return (
    <div className="inline-block rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 p-2 cursor-pointer hover:shadow-md transition-shadow" onClick={() => logoUrl && onZoom?.(logoUrl, sponsorName)}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${sponsorName || "Sponsor"} logo`}
          className="h-10 w-auto max-w-xs rounded border border-gray-200 dark:border-gray-700 bg-white object-contain"
        />
      ) : (
        <div className="h-10 w-16 rounded border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex items-center justify-center text-[9px] text-gray-400 text-center px-1">
          {logo.fileName}
        </div>
      )}
    </div>
  );
}

function ResourceList({ resources }: { resources: EventResourceItem[] }) {
  return (
    <div className="mt-2 space-y-2">
      {resources.map((resource, index) => {
        const hasPrice = resource.pricePerPiece != null;
        const hasQuantity = resource.quantity != null;
        const totalCost = hasPrice && hasQuantity
          ? Number(resource.pricePerPiece) * Number(resource.quantity)
          : null;

        return (
          <div
            key={index}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 p-3 space-y-2"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                  {resource.type || `Resource ${index + 1}`}
                </p>
                {resource.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                    {resource.description}
                  </p>
                )}
              </div>
              {totalCost != null && (
                <div className="text-left sm:text-right">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Total Cost
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(totalCost)}
                  </p>
                </div>
              )}
            </div>

            {(hasPrice || hasQuantity) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                {hasQuantity && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Quantity
                    </p>
                    <p className="text-gray-900 dark:text-white">
                      {resource.quantity}
                    </p>
                  </div>
                )}
                {hasPrice && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Cost Per Piece
                    </p>
                    <p className="text-gray-900 dark:text-white">
                      {formatCurrency(Number(resource.pricePerPiece))}
                    </p>
                  </div>
                )}
                {totalCost != null && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Calculation
                    </p>
                    <p className="text-gray-900 dark:text-white">
                      {formatCurrency(Number(resource.pricePerPiece))} x {resource.quantity} = {formatCurrency(totalCost)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Display sponsor list — handles both old format { name, amount, type, notes } and new advanced format */
function SponsorList({ sponsors, onZoom }: { sponsors: any[]; onZoom?: (url: string, name: string) => void }) {
  const SPONSOR_TYPE_LABELS: Record<string, string> = { corporate: 'Corporate', individual: 'Individual', organization: 'Organization', other: 'Other' };
  const PAYMENT_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    received: { label: 'Received', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
    pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
    partial: { label: 'Partial', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
    not_received: { label: 'Not Received', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  };
  const DELIVERY_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
    received: { label: 'Delivered', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
    not_received: { label: 'Not Received', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  };
  const PAYMENT_METHOD_LABELS: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', net_banking: 'Net Banking', other: 'Other' };
  const CONTRIBUTION_LABELS: Record<string, { label: string; cls: string }> = {
    cash: { label: 'Cash', cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' },
    in_kind: { label: 'In-Kind', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' },
    both: { label: 'Cash + In-Kind', cls: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700' },
  };

  const DetailBlock = ({ label, value, className = '' }: { label: string; value?: React.ReactNode; className?: string }) => {
    if (value == null || value === '') return null;
    return (
      <div className={className}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
        <div className="mt-1 text-sm text-gray-900 dark:text-white">{value}</div>
      </div>
    );
  };

  return (
    <div className="mt-3 space-y-4">
      {sponsors.map((s: any, si: number) => {
        const isNewFormat = !!s.contributionType;

        if (!isNewFormat) {
          return (
            <div key={si} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{s.name}</p>
              </div>
              <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailBlock label="Contribution Type" value={s.type === 'cash' ? 'Cash' : 'In-Kind'} />
                <DetailBlock label="Amount / Details" value={s.type === 'cash' ? formatCurrency(Number(s.amount || 0)) : (s.notes || 'Not provided')} />
              </div>
            </div>
          );
        }

        const showCash = s.contributionType === 'cash' || s.contributionType === 'both';
        const showInKind = s.contributionType === 'in_kind' || s.contributionType === 'both';
        const paymentInfo = PAYMENT_STATUS_LABELS[s.paymentStatus] || PAYMENT_STATUS_LABELS.pending;
        const contributionInfo = CONTRIBUTION_LABELS[s.contributionType] || CONTRIBUTION_LABELS.cash;
        const paymentMethodLabel = s.paymentMethod === 'other' && s.paymentMethodOtherLabel
          ? s.paymentMethodOtherLabel
          : PAYMENT_METHOD_LABELS[s.paymentMethod] || s.paymentMethod;

        const inKindTotal = Array.isArray(s.inKindItems)
          ? s.inKindItems.reduce((sum: number, item: any) => sum + (Number(item.quantity || 0) * Number(item.estimatedValue || 0)), 0)
          : 0;

        return (
          <div key={si} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">{s.name}</h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Sponsor details</p>
                </div>
                <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${contributionInfo.cls}`}>
                  {contributionInfo.label}
                </span>
              </div>
            </div>

            <div className="px-4 py-3 space-y-4">
              {s.sponsorLogo && (
                <SponsorLogoView logo={s.sponsorLogo} sponsorName={s.name} onZoom={onZoom} />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <DetailBlock label="Sponsor Type" value={SPONSOR_TYPE_LABELS[s.sponsorType] || 'Corporate'} />
                <DetailBlock label="Contact Person" value={s.contactPerson ? `${s.contactPerson}${s.designation ? ` (${s.designation})` : ''}` : 'Not provided'} />
                <DetailBlock label="Phone Number" value={s.phone || 'Not provided'} />
                <DetailBlock label="Email Address" value={s.email || 'Not provided'} />
              </div>

              {showCash && (
                <div className="rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400 mb-3">Cash Contribution</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <DetailBlock label="Cash Amount" value={<span className="text-xl font-bold">{formatCurrency(Number(s.cashAmount || 0))}</span>} />
                    <DetailBlock label="Payment Status" value={<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${paymentInfo.cls}`}>{paymentInfo.label}</span>} />
                    <DetailBlock label="Payment Method" value={paymentMethodLabel || 'Not provided'} />
                    <DetailBlock label="Transaction ID" value={s.transactionId || 'Not provided'} />
                    <DetailBlock label="Receipt" value={s.receipt?.fileName || 'Not uploaded'} />
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailBlock label="Responsible Person" value={s.cashAssignedTo ? `${s.cashAssignedTo.displayName} (${s.cashAssignedTo.uid})` : 'Not assigned'} />
                  </div>
                </div>
              )}

              {showInKind && Array.isArray(s.inKindItems) && s.inKindItems.length > 0 && (
                <div className="rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">In-Kind Contribution</p>
                    {inKindTotal > 0 && (
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        Total Estimated Value: {formatCurrency(inKindTotal)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {s.inKindItems.map((item: any, ii: number) => {
                      const qty = Number(item.quantity || 0);
                      const val = Number(item.estimatedValue || 0);
                      const total = qty * val;
                      const ds = DELIVERY_STATUS_LABELS[item.deliveryStatus] || DELIVERY_STATUS_LABELS.pending;
                      return (
                        <div key={ii} className="bg-white dark:bg-gray-800 rounded-lg px-3 py-3 border border-amber-100 dark:border-amber-800/20">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Item {ii + 1}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${ds.cls}`}>{ds.label}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <DetailBlock label="Item Name" value={item.itemName || 'Not provided'} />
                            <DetailBlock label="Category" value={item.category || 'Not provided'} />
                            <DetailBlock label="Quantity" value={qty || 'Not provided'} />
                            <DetailBlock label="Estimated Value Per Unit" value={val ? formatCurrency(val) : 'Not provided'} />
                            <DetailBlock label="Total Estimated Value" value={total ? formatCurrency(total) : 'Not provided'} />
                            <DetailBlock label="Responsible Person" value={item.assignedTo ? `${item.assignedTo.displayName} (${item.assignedTo.uid})` : 'Not assigned'} />
                          </div>
                          <DetailBlock label="Description" value={item.description || 'Not provided'} className="mt-4" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {s.notes && (
                <DetailBlock label="Additional Notes" value={<p className="text-gray-600 dark:text-gray-400 italic">{s.notes}</p>} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function NoteEventDetails({ note }: NoteEventDetailsProps) {
  const [zoomedLogo, setZoomedLogo] = useState<{ url: string; name: string } | null>(null);

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
                                    <SponsorList sponsors={v.eventSponsors} onZoom={(url, name) => setZoomedLogo({ url, name })} />
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
                                    <ResourceList resources={v.eventResources as EventResourceItem[]} />
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
                        <SponsorList sponsors={note.eventSponsors} onZoom={(url, name) => setZoomedLogo({ url, name })} />
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
                        <ResourceList resources={note.eventResources as EventResourceItem[]} />
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

          {/* ── EVENT VISIBILITY & SETTINGS ── */}
          {note.notingEventType && (
            <div className="mt-4 rounded-xl border border-[#b3cde0]/40 dark:border-gray-700 overflow-hidden">
              <div className="bg-[#f0f6fb] dark:bg-gray-800/50 px-4 py-2.5 border-b border-[#b3cde0]/30 dark:border-gray-700">
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Event Visibility & Settings
                </p>
              </div>
              
              {note.eventVisibilitySettings ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 dark:bg-gray-700">
                  {/* Audience Visibility */}
                  <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                      Audience Visibility
                    </label>
                    {Array.isArray(note.eventVisibilitySettings.visibleToRoles) &&
                    note.eventVisibilitySettings.visibleToRoles.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {note.eventVisibilitySettings.visibleToRoles.map((role: string) => (
                          <span
                            key={role}
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                          >
                            {ROLE_LABELS[role as VisibleRole] || role}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No roles configured</p>
                    )}
                  </div>

                  {/* Student Filter */}
                  {note.eventVisibilitySettings.studentFilterType === 'custom' && (
                    <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                        Student Visibility Filter
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Custom (restricted to specific schools / departments / programs)
                      </p>
                    </div>
                  )}

                  {/* Extra Passes */}
                  <div className="bg-white dark:bg-gray-800 p-3">
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                      Extra Passes
                    </label>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {note.eventVisibilitySettings.allowExtraPasses ? 'Yes' : 'No'}
                    </p>
                  </div>

                  {note.eventVisibilitySettings.allowExtraPasses && (
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                        Max Extra Passes Per User
                      </label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {note.eventVisibilitySettings.maxExtraPassesPerUser ?? '—'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-900 p-3">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <span className="font-medium">No visibility settings configured</span>
                    {" "}(Note created before this feature was added)
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Logo Zoom Modal */}
      {zoomedLogo && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setZoomedLogo(null)}>
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomedLogo(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-white dark:bg-gray-700 shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div className="p-6 flex flex-col items-center justify-center gap-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{zoomedLogo.name} Logo</p>
              <img
                src={zoomedLogo.url}
                alt={`${zoomedLogo.name} logo zoomed`}
                className="max-w-full max-h-[60vh] object-contain rounded-lg border border-gray-200 dark:border-gray-700"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
