'use client';

import React from 'react';
import { ArrowLeft, Beaker, BookOpen, FlaskConical, Microscope, Sparkles } from 'lucide-react';

// Icons pinned to the far-left and far-right margins (where page blank space is)
const FLOATING_RESEARCH_ICONS = [
  // ── Left column ──────────────────────────────────────────────────
  { Icon: Beaker,       className: 'left-[1%]  top-[6%]  text-slate-400/20', size: 'h-12 w-12', delay: '0s',   duration: '6.0s', drift: 'down' },
  { Icon: FlaskConical, className: 'left-[3%]  top-[20%] text-slate-500/18', size: 'h-14 w-14', delay: '1.2s', duration: '7.0s', drift: 'up'   },
  { Icon: Microscope,   className: 'left-[1%]  top-[36%] text-slate-400/20', size: 'h-12 w-12', delay: '0.6s', duration: '6.5s', drift: 'down' },
  { Icon: Sparkles,     className: 'left-[4%]  top-[52%] text-slate-400/16', size: 'h-10 w-10', delay: '1.8s', duration: '6.8s', drift: 'up'   },
  { Icon: BookOpen,     className: 'left-[2%]  top-[68%] text-slate-500/18', size: 'h-12 w-12', delay: '0.4s', duration: '7.2s', drift: 'down' },
  { Icon: Beaker,       className: 'left-[5%]  top-[82%] text-slate-400/16', size: 'h-10 w-10', delay: '2.4s', duration: '6.3s', drift: 'up'   },
  { Icon: FlaskConical, className: 'left-[1%]  top-[92%] text-slate-400/14', size: 'h-9  w-9',  delay: '1.0s', duration: '7.5s', drift: 'down' },
  { Icon: Sparkles,     className: 'left-[6%]  top-[44%] text-slate-400/14', size: 'h-9  w-9',  delay: '3.1s', duration: '6.9s', drift: 'up'   },
  // ── Right column ─────────────────────────────────────────────────
  { Icon: Microscope,   className: 'right-[1%] top-[10%] text-slate-400/20', size: 'h-14 w-14', delay: '0.8s', duration: '6.5s', drift: 'up'   },
  { Icon: BookOpen,     className: 'right-[3%] top-[24%] text-slate-500/18', size: 'h-12 w-12', delay: '0.3s', duration: '7.0s', drift: 'down' },
  { Icon: Beaker,       className: 'right-[1%] top-[40%] text-slate-400/20', size: 'h-12 w-12', delay: '1.5s', duration: '6.2s', drift: 'up'   },
  { Icon: FlaskConical, className: 'right-[4%] top-[56%] text-slate-400/16', size: 'h-10 w-10', delay: '2.0s', duration: '7.3s', drift: 'down' },
  { Icon: Sparkles,     className: 'right-[2%] top-[70%] text-slate-500/18', size: 'h-12 w-12', delay: '0.9s', duration: '6.7s', drift: 'up'   },
  { Icon: Microscope,   className: 'right-[5%] top-[84%] text-slate-400/16', size: 'h-10 w-10', delay: '2.7s', duration: '7.1s', drift: 'down' },
  { Icon: BookOpen,     className: 'right-[1%] top-[94%] text-slate-400/14', size: 'h-9  w-9',  delay: '1.4s', duration: '6.4s', drift: 'up'   },
  { Icon: Beaker,       className: 'right-[6%] top-[48%] text-slate-400/14', size: 'h-9  w-9',  delay: '3.5s', duration: '7.8s', drift: 'down' },
];

/** Full-page shell — soft gradient background */
export function AnalyticsShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-[#f5f7fb] to-slate-100 ${className}`}>
      <style>{`
        @keyframes drd-drift-down {
          0%, 100% { transform: translateY(-18px); opacity: 0.12; }
          50% { transform: translateY(18px); opacity: 0.28; }
        }
        @keyframes drd-drift-up {
          0%, 100% { transform: translateY(18px); opacity: 0.12; }
          50% { transform: translateY(-18px); opacity: 0.28; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {FLOATING_RESEARCH_ICONS.map(({ Icon, className: iconClassName, size, delay, duration, drift }, index) => (
          <div
            key={index}
            className={`absolute ${iconClassName} ${size} rounded-full`}
            style={{
              animation: `${drift ===
   'up' ? 'drd-drift-up' : 'drd-drift-down'} ${duration} ease-in-out infinite`,
              animationDelay: delay,
            }}
          >
            <Icon aria-hidden="true" className="h-full w-full stroke-[1]" />
          </div>
        ))}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.15),transparent_0.55rem),radial-gradient(circle_at_80%_25%,rgba(99,102,241,0.15),transparent_0.55rem),radial-gradient(circle_at_35%_70%,rgba(168,85,247,0.14),transparent_0.6rem),radial-gradient(circle_at_78%_78%,rgba(16,185,129,0.14),transparent_0.6rem)] [background-size:18rem_18rem] opacity-95 animate-[drd-drift-down_8s_ease-in-out_infinite]" />
      </div>

      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

/** Full-bleed dark masthead — premium dark hero */
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
    <header className="relative overflow-hidden bg-slate-900">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: "url('https://i.pinimg.com/736x/c6/57/9f/c6579fd780c535bad01e6fe301f52e2c.jpg')",
          backgroundPosition: 'right center',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          WebkitMaskImage: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 16%, rgba(0,0,0,0.04) 28%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.52) 56%, rgba(0,0,0,0.86) 72%, rgba(0,0,0,1) 86%, rgba(0,0,0,1) 100%)',
          maskImage: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 16%, rgba(0,0,0,0.04) 28%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.52) 56%, rgba(0,0,0,0.86) 72%, rgba(0,0,0,1) 86%, rgba(0,0,0,1) 100%)',
        }}
      />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[72%] bg-[linear-gradient(90deg,rgba(3,7,18,1)_0%,rgba(3,7,18,0.99)_60%,rgba(3,7,18,0.94)_72%,rgba(3,7,18,0.76)_84%,rgba(3,7,18,0.42)_94%,rgba(3,7,18,0)_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-[52%] w-[30%] bg-[linear-gradient(90deg,rgba(3,7,18,0.9)_0%,rgba(3,7,18,0.68)_20%,rgba(3,7,18,0.38)_48%,rgba(3,7,18,0.14)_74%,rgba(3,7,18,0)_100%)] blur-[22px]" />

      {/* Ambient mesh gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-indigo-500/10 blur-[100px]" />
        <div className="absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="absolute left-1/3 top-1/2 h-40 w-40 rounded-full bg-violet-500/8 blur-[80px]" />
      </div>
      {/* Grid pattern overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0z\' fill=\'none\' stroke=\'%23fff\' stroke-width=\'.5\'/%3E%3C/svg%3E")' }} />
      {/* Animated gradient separator */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-indigo-500/0 via-indigo-500/30 to-indigo-500/0 blur-sm" />

      <div className="relative z-10 px-6 py-8 sm:px-8 lg:px-12 xl:px-16 lg:py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            {(onBack || eyebrow) && (
              <div className="flex flex-wrap items-center gap-3">
                {onBack && (
                  <button onClick={onBack} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20" aria-label={backLabel}>
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                {eyebrow && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300 backdrop-blur-sm">
                    {icon}
                    {eyebrow}
                  </span>
                )}
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[2.25rem] drop-shadow-sm">{title}</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-start gap-2">{actions}</div>}
        </div>

        {chips && chips.length > 0 && (
          <div className="mt-7 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            {chips.map((chip) => (
              <div key={chip.label} className="flex min-w-[120px] flex-col rounded-2xl border border-white/8 bg-white/[0.04] px-5 py-3.5 backdrop-blur-sm transition-colors hover:bg-white/[0.07]">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{chip.label}</span>
                <span className="mt-1.5 text-2xl font-bold leading-tight text-white">{chip.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

/** Content card — glassmorphism-inspired panel */
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
    <section className={`overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100/80 px-6 py-4">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-sm">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
