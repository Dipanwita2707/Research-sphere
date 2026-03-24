"use client";

import React from "react";
import { BadgeCheck, IndianRupee, Trophy } from "lucide-react";
import type { Event, EventPrize } from "@/features/event-management/types/event.types";

interface EventPrizesSectionProps {
  event: Event;
}

function normalizePerks(perks: string[] | unknown): string[] {
  if (!perks) return [];
  if (Array.isArray(perks)) return perks.filter((p): p is string => typeof p === "string");
  if (typeof perks === "string") return perks.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export default function EventPrizesSection({ event }: EventPrizesSectionProps) {
  if (
    !event.prizeDetails &&
    !event.certificateAvailable &&
    (!event.prizes || event.prizes.length === 0)
  ) {
    return null;
  }

  const prizeCount = event.prizes?.length || 0;
  const totalPrizePool =
    event.prizes?.reduce((sum, prize) => sum + (prize.prizeAmount || 0), 0) || 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-ev-900">Prizes & Rewards</h2>
          <div className="flex flex-wrap gap-2">
            {prizeCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600">
                <Trophy className="h-3.5 w-3.5 text-sgt-500" />
                {prizeCount} tiers
              </span>
            )}
            {totalPrizePool > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <IndianRupee className="h-3.5 w-3.5" />
                ₹{totalPrizePool.toLocaleString()} total
              </span>
            )}
            {event.certificateAvailable && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                Certificate
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Prize cards */}
      <div className="px-6 py-5 sm:px-8 space-y-4">
        {event.prizes &&
          event.prizes.length > 0 &&
          event.prizes
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((prize: EventPrize, idx: number) => {
              const hasCash = prize.prizeAmount && prize.prizeAmount > 0;
              const perks = normalizePerks(prize.additionalPerks);
              const rankLabel =
                prize.position === 1
                  ? "Winner"
                  : prize.position === 2
                    ? "1st Runner Up"
                    : prize.position === 3
                      ? "2nd Runner Up"
                      : prize.rank || prize.title || `Position ${idx + 1}`;

              const tierColors = [
                "border-l-amber-500 bg-amber-50/50",
                "border-l-gray-500 bg-gray-50/50",
                "border-l-orange-500 bg-orange-50/50",
              ];
              const colorClass = idx < 3 ? tierColors[idx] : "border-l-sgt-400 bg-sgt-50/40";

              return (
                <div
                  key={prize.id || idx}
                  className={`rounded-lg border-2 border-gray-200 border-l-4 ${colorClass} p-4 transition hover:shadow-md`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="rounded bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                          Tier {idx + 1}
                        </span>
                        {prize.position && prize.position <= 3 && (
                          <span className="rounded bg-sgt-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sgt-700">
                            Leaderboard
                          </span>
                        )}
                      </div>
                      <h4 className="text-lg font-bold text-ev-900">{rankLabel}</h4>
                      {prize.title && prize.title !== rankLabel && prize.title.trim() && (
                        <p className="mt-0.5 text-sm font-medium text-gray-600">{prize.title}</p>
                      )}
                      {prize.description && (
                        <p className="mt-2 text-sm leading-relaxed text-gray-600">{prize.description}</p>
                      )}
                      {perks.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {perks.map((p, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {hasCash ? (
                        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center ring-2 ring-emerald-200">
                          <p className="text-lg font-black text-emerald-700">₹{prize.prizeAmount!.toLocaleString()}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Cash</p>
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sgt-100 ring-2 ring-sgt-200">
                          <Trophy className="h-6 w-6 text-sgt-600" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

        {/* Participation Certificate */}
        {event.certificateAvailable && (
          <div className="rounded-lg border-2 border-gray-200 border-l-4 border-l-sky-500 bg-sky-50/50 p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <span className="rounded bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                  Universal Reward
                </span>
                <h4 className="mt-1.5 text-lg font-bold text-ev-900">Participation Certificate</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Awarded to eligible participants as part of the event completion experience.
                </p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 ring-2 ring-sky-200">
                <BadgeCheck className="h-6 w-6 text-sky-600" />
              </div>
            </div>
          </div>
        )}

        {/* General prize text */}
        {!event.prizes?.length && event.prizeDetails && (
          <div className="rounded-lg border-2 border-gray-200 border-l-4 border-l-amber-400 bg-amber-50/40 p-4">
            <h4 className="text-lg font-bold text-ev-900">Prize Details</h4>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
              {event.prizeDetails}
            </p>
          </div>
        )}

        <p className="pt-2 text-xs text-gray-500">
          * All prizes and certificates will be released within 30 days after the event ends.
        </p>
      </div>
    </div>
  );
}
