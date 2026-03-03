"use client";

import React from "react";
import { Award, IndianRupee } from "lucide-react";
import type { Event } from "@/features/event-management/types/event.types";

interface EventPrizesSectionProps {
  event: Event;
}

/* ── SVG Icons (inlined to avoid extra network requests) ── */

const CashCoinSVG = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-11 h-11 mb-1">
    <circle cx="32" cy="32" r="22" fill="#ECFDF5" stroke="#10B981" strokeWidth="2.5" />
    <circle cx="32" cy="32" r="17" fill="none" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.4" />
    <text x="32" y="38" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#059669" fontFamily="Arial, sans-serif">₹</text>
    <ellipse cx="22" cy="22" rx="4" ry="2.5" fill="white" opacity="0.5" transform="rotate(-35 22 22)" />
  </svg>
);

const TrophySVG = ({ color = "#6366F1", bg = "#EEF2FF" }: { color?: string; bg?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mb-1">
    <path d="M20 10H44V30C44 40.493 38.627 49 32 49C25.373 49 20 40.493 20 30Z" fill={bg} stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M20 16H13C10.239 16 8 18.239 8 21C8 23.761 10.239 26 13 26H20" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M44 16H51C53.761 16 56 18.239 56 21C56 23.761 53.761 26 51 26H44" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M32 49V55" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <rect x="22" y="55" width="20" height="4" rx="2" fill={bg} stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M32 21L33.5 25.5H38L34.5 28L36 32.5L32 30L28 32.5L29.5 28L26 25.5H30.5Z" fill={color} opacity="0.5" />
  </svg>
);

const CertificateSVG = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0">
    <rect x="8" y="6" width="48" height="36" rx="3" fill="#FFF8E7" stroke="#F59E0B" strokeWidth="2" />
    <line x1="16" y1="16" x2="48" y2="16" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="23" x2="48" y2="23" stroke="#D4A855" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <line x1="16" y1="29" x2="40" y2="29" stroke="#D4A855" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    <path d="M20 42L16 57L22 53L26 57L26 42" fill="#EF4444" stroke="#DC2626" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M44 42L48 57L42 53L38 57L38 42" fill="#EF4444" stroke="#DC2626" strokeWidth="1.2" strokeLinejoin="round" />
    <circle cx="32" cy="46" r="9" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="2" />
    <path d="M32 40.5L33.2 44.2H37L34 46.4L35.2 50L32 47.8L28.8 50L30 46.4L27 44.2H30.8Z" fill="#F59E0B" />
  </svg>
);

const GiftBoxSVG = () => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
    <rect x="10" y="30" width="44" height="26" rx="2" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="2" />
    <rect x="8" y="22" width="48" height="10" rx="2" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" />
    <rect x="29" y="22" width="6" height="34" fill="#3B82F6" opacity="0.25" />
    <rect x="8" y="25" width="48" height="4" fill="#3B82F6" opacity="0.25" />
    <path d="M32 22 C28 14 16 14 18 20 C20 24 28 22 32 22Z" fill="#3B82F6" opacity="0.7" stroke="#2563EB" strokeWidth="1.2" />
    <path d="M32 22 C36 14 48 14 46 20 C44 24 36 22 32 22Z" fill="#3B82F6" opacity="0.7" stroke="#2563EB" strokeWidth="1.2" />
    <circle cx="32" cy="22" r="3" fill="#1D4ED8" />
  </svg>
);

/* ── Component ── */

export default function EventPrizesSection({ event }: EventPrizesSectionProps) {
  if (
    !event.prizeDetails &&
    !event.certificateAvailable &&
    (!event.prizes || event.prizes.length === 0)
  ) {
    return null;
  }

  return (
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
                        <CashCoinSVG />
                        <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 leading-tight tabular-nums">
                          ₹{prize.prizeAmount!.toLocaleString()}
                        </span>
                        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                          Cash
                        </span>
                      </>
                    ) : (
                      <>
                        <TrophySVG />
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

                    {/* Certificate badge */}
                    <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                      <CertificateSVG />
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
            <div className="shrink-0 w-36 flex flex-col items-center justify-center px-4 py-5 border-r border-gray-200 dark:border-gray-700 bg-blue-50/60 dark:bg-blue-900/10">
              <GiftBoxSVG />
            </div>
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
                <CertificateSVG />
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
              <TrophySVG color="#F59E0B" bg="#FEF3C7" />
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
        * All prizes and certificates will be released within 30 days after the
        event is over.
      </p>
    </div>
  );
}
