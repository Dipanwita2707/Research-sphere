'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ui } from './theme';


/** Full-page shell — calm neutral canvas so the data carries the colour. */
export function AnalyticsShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-h-screen bg-[#faf8f6] dark:bg-gray-900 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Page header. `chips` render as a headline-number strip under the title:
 * the four numbers a reader should take away before scrolling.
 */
export function AnalyticsHero({
  title, description, eyebrow, icon, onBack, backLabel = 'Back', actions, chips,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  chips?: Array<{ label: string; value: string }>;
}) {
  return (
    <header className="relative z-40 bg-brand-banner text-white">
      {/* Fine dot grid + soft amber glow for depth (clipped here so header menus can overflow) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
        />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber/40 blur-3xl" />
      </div>
      <div className="relative px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label={backLabel}
                title={backLabel}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                  {icon}
                  {eyebrow}
                </p>
              )}
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">{title}</h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-white/75">{description}</p>
            </div>
          </div>
          {actions && <div className="analytics-hero-actions flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {chips && chips.length > 0 && (
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {chips.map((chip) => (
              <div key={chip.label} className="rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 backdrop-blur-sm">
                <dt className="text-[11px] font-medium uppercase tracking-wider text-white/70">{chip.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-white">{chip.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );
}

/** Content card. */
export function AnalyticsPanel({
  title, subtitle, icon, actions, children, className = '',
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden ${ui.card} ${className}`}>
      <div className={ui.cardHeader}>
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber [&_svg]:h-4 [&_svg]:w-4">
              {icon}
            </div>
          )}
          <div>
            <h2 className={ui.title}>{title}</h2>
            {subtitle && <p className={ui.subtitle}>{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
