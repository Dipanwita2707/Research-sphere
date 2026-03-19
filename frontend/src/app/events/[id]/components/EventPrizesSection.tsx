"use client";

import React from "react";
import { BadgeCheck, Gift, IndianRupee, Trophy } from "lucide-react";
import type { Event } from "@/features/event-management/types/event.types";

interface EventPrizesSectionProps {
  event: Event;
}

const CertificateChip = () => (
  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/85 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
    <BadgeCheck className="h-4 w-4" />
    Certificate
  </div>
);

const RewardIconBlock = ({
  kind,
  amount,
}: {
  kind: "cash" | "reward" | "participation" | "note";
  amount?: number;
}) => {
  const styles = {
    cash: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
    reward: "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300",
    participation: "border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300",
    note: "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
  } as const;

  return (
    <div className="flex h-full min-h-[104px] flex-col items-center justify-center gap-2 px-4 py-5 text-center">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${styles[kind]}`}>
        {kind === "cash" ? <IndianRupee className="h-6 w-6" /> : null}
        {kind === "reward" ? <Trophy className="h-6 w-6" /> : null}
        {kind === "participation" ? <Gift className="h-6 w-6" /> : null}
        {kind === "note" ? <Trophy className="h-6 w-6" /> : null}
      </div>
      {kind === "cash" && amount ? (
        <div className="space-y-0.5">
          <p className="text-lg font-black leading-none tracking-[-0.04em] text-emerald-700 dark:text-emerald-300">
            ₹{amount.toLocaleString()}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
            Cash
          </p>
        </div>
      ) : (
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-gray-500">
          {kind === "participation"
            ? "Included"
            : kind === "note"
              ? "Details"
              : "Reward"}
        </p>
      )}
    </div>
  );
};

/* ── Component ── */

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
    <div id="prizes-section" className="border-t border-gray-100 p-8 dark:border-gray-700 sm:p-10">
      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,rgba(245,248,252,0.96))] shadow-[0_22px_55px_-40px_rgba(15,37,115,0.35)] dark:border-gray-700 dark:bg-gray-800/70">
        <div className="border-b border-slate-200/80 px-6 py-5 dark:border-gray-700 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300">
                Reward Layer
              </div>
              <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-900 dark:text-white">
                Rewards and Prizes
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-gray-300">
                Compact reward cards with clearer tiers, cleaner icons, and less visual weight.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {prizeCount > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
                  <Trophy className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                  {prizeCount} tiers
                </div>
              )}
              {totalPrizePool > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/85 px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <IndianRupee className="h-4 w-4" />
                  ₹{totalPrizePool.toLocaleString()}
                </div>
              )}
              {event.certificateAvailable && <CertificateChip />}
            </div>
          </div>
        </div>

        <div className="space-y-3 px-6 py-5 sm:px-8 sm:py-6">
          {/* Dynamic prizes */}
          {event.prizes &&
            event.prizes.length > 0 &&
            event.prizes
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((prize, idx) => {
                const hasCash = prize.prizeAmount && prize.prizeAmount > 0;
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
                    className="overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-white/90 shadow-[0_16px_35px_-32px_rgba(15,37,115,0.42)] transition hover:border-slate-300 dark:border-gray-700 dark:bg-gray-900/35 dark:hover:border-gray-600"
                  >
                    <div className="grid gap-0 md:grid-cols-[118px_minmax(0,1fr)_auto] md:items-center">
                      <div className={`border-b border-slate-200/80 md:border-b-0 md:border-r dark:border-gray-700 ${
                        hasCash
                          ? "bg-emerald-50/70 dark:bg-emerald-900/12"
                          : "bg-indigo-50/70 dark:bg-indigo-900/12"
                      }`}>
                        <RewardIconBlock
                          kind={hasCash ? "cash" : "reward"}
                          amount={hasCash ? prize.prizeAmount || 0 : undefined}
                        />
                      </div>

                      <div className="min-w-0 px-5 py-4 sm:px-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                            Tier {idx + 1}
                          </span>
                          {prize.position && prize.position <= 3 && (
                            <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700 ring-1 ring-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-800">
                              Leaderboard
                            </span>
                          )}
                        </div>

                        <h4 className="mt-3 text-[1.85rem] font-black tracking-[-0.045em] text-slate-900 dark:text-white sm:text-[2rem] md:text-[1.95rem]">
                          {posLabel}
                        </h4>

                        {prize.title && prize.title !== posLabel && (
                          <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-gray-400">
                            {prize.title}
                          </p>
                        )}

                        {prize.description && (
                          <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-500 dark:text-gray-300">
                            {prize.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center px-5 pb-4 md:px-6 md:pb-0">
                        <CertificateChip />
                      </div>
                    </div>
                  </div>
                );
              })}

          {/* Participation Certificate card */}
          {event.certificateAvailable && (
            <div className="overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-white/90 shadow-[0_16px_35px_-32px_rgba(15,37,115,0.42)] transition hover:border-slate-300 dark:border-gray-700 dark:bg-gray-900/35 dark:hover:border-gray-600">
              <div className="grid gap-0 md:grid-cols-[118px_minmax(0,1fr)_auto] md:items-center">
                <div className="border-b border-slate-200/80 bg-sky-50/70 md:border-b-0 md:border-r dark:border-gray-700 dark:bg-sky-900/12">
                  <RewardIconBlock kind="participation" />
                </div>
                <div className="min-w-0 px-5 py-4 sm:px-6">
                  <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                    Universal Reward
                  </span>
                  <h4 className="mt-3 text-[1.85rem] font-black tracking-[-0.045em] text-slate-900 dark:text-white sm:text-[2rem] md:text-[1.95rem]">
                    Participation Certificate
                  </h4>
                  <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-500 dark:text-gray-300">
                    Awarded to eligible participants as part of the event completion experience.
                  </p>
                </div>
                <div className="flex items-center px-5 pb-4 md:px-6 md:pb-0">
                  <CertificateChip />
                </div>
              </div>
            </div>
          )}

          {/* General prize text fallback */}
          {!event.prizes?.length && event.prizeDetails && (
            <div className="overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-white/90 shadow-[0_16px_35px_-32px_rgba(15,37,115,0.42)] dark:border-gray-700 dark:bg-gray-900/35">
              <div className="grid gap-0 md:grid-cols-[118px_minmax(0,1fr)] md:items-center">
                <div className="border-b border-slate-200/80 bg-amber-50/70 md:border-b-0 md:border-r dark:border-gray-700 dark:bg-amber-900/12">
                  <RewardIconBlock kind="note" />
                </div>
                <div className="px-5 py-4 sm:px-6">
                  <h4 className="text-[1.85rem] font-black tracking-[-0.045em] text-slate-900 dark:text-white sm:text-[2rem] md:text-[1.95rem]">
                    Prize Details
                  </h4>
                  <p className="mt-2.5 whitespace-pre-wrap text-sm leading-6 text-slate-500 dark:text-gray-300">
                    {event.prizeDetails}
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="pt-1 text-xs leading-relaxed text-slate-400 dark:text-gray-500">
            * All prizes and certificates will be released within 30 days after the event is over.
          </p>
        </div>
      </div>
    </div>
  );
}
