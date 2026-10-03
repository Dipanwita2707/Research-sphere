'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, Lock, PowerOff, RefreshCw, SearchX } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import { useRipAccess } from '../../hooks/useRipAccess';
import { ripGateState } from '../../utils/graphUtils';
import type { RipPermissionKey } from '../../types';
import type { LegendItem } from '../../utils/graphUtils';

function StateCard({ icon, title, children, tone = 'wine' }: { icon: React.ReactNode; title: string; children?: React.ReactNode; tone?: 'wine' | 'amber' | 'stone' }) {
  const tint =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : tone === 'stone'
        ? 'bg-stone-100 text-stone-500 dark:bg-gray-700 dark:text-gray-300'
        : 'bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber';
  return (
    <div className={`mx-auto max-w-lg px-6 py-10 text-center ${ui.card}`} role="status">
      <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${tint} [&_svg]:h-6 [&_svg]:w-6`}>{icon}</div>
      <h2 className="mt-4 text-base font-semibold text-stone-900 dark:text-white">{title}</h2>
      {children}
    </div>
  );
}

export function RipNoAccess({ feature, capability }: { feature: string; capability: string }) {
  return (
    <StateCard icon={<Lock />} title={`You don't have access to ${feature}`}>
      <p className="mt-2 text-sm text-stone-600 dark:text-gray-400">
        Ask your Directorate of Research for the <strong className="font-semibold">{capability}</strong> permission in Research Intelligence.
      </p>
      <Link href="/dashboard" className={`mt-6 ${ui.btnSecondary}`}>
        Back to dashboard
      </Link>
    </StateCard>
  );
}

export function RipModuleDisabled() {
  return (
    <StateCard icon={<PowerOff />} title="Research Intelligence is not enabled" tone="stone">
      <p className="mt-2 text-sm text-stone-600 dark:text-gray-400">Your university does not have the Research Intelligence module switched on yet.</p>
    </StateCard>
  );
}

export function RipError({ message, onRetry, title = "Couldn't load this view" }: { message?: string; onRetry?: () => void; title?: string }) {
  return (
    <div className={`px-6 py-10 text-center ${ui.card}`} role="alert">
      <AlertCircle className="mx-auto h-9 w-9 text-amber-500" aria-hidden />
      <h2 className="mt-3 text-base font-semibold text-stone-900 dark:text-white">{title}</h2>
      {message && <p className="mt-1 text-sm text-stone-500 dark:text-gray-400">{message}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className={`mt-5 ${ui.btnPrimary}`}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

export function RipEmpty({ title, message, icon, action }: { title: string; message?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center" role="status">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-500 dark:bg-gray-700 dark:text-gray-300 [&_svg]:h-5 [&_svg]:w-5">
        {icon || <SearchX />}
      </div>
      <p className="mt-3 text-sm font-semibold text-stone-800 dark:text-gray-100">{title}</p>
      {message && <p className="mt-1 max-w-md text-sm text-stone-500 dark:text-gray-400">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function GraphSkeleton({ height = 520 }: { height?: number }) {
  return (
    <div className="relative animate-pulse overflow-hidden rounded-lg bg-stone-50 dark:bg-gray-900/40" style={{ height }} aria-busy="true" aria-label="Loading graph">
      {[...Array(14)].map((_, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-stone-200 dark:bg-gray-700"
          style={{ width: 14 + ((i * 7) % 26), height: 14 + ((i * 7) % 26), left: `${8 + ((i * 37) % 84)}%`, top: `${10 + ((i * 53) % 78)}%` }}
        />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-stone-100 p-4 dark:border-gray-700">
          <div className="h-3.5 w-1/3 rounded bg-stone-200 dark:bg-gray-700" />
          <div className="mt-2.5 h-3 rounded bg-stone-100 dark:bg-gray-700/60" style={{ width: `${85 - i * 9}%` }} />
        </div>
      ))}
    </div>
  );
}

/** Render children only when the user holds any of `anyOf`; otherwise a clear no-access state. */
export function RipGate({ anyOf, feature, capability, children }: { anyOf: RipPermissionKey[]; feature: string; capability: string; children: React.ReactNode }) {
  const access = useRipAccess();
  const state = ripGateState(access, anyOf);
  if (state === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-36 animate-pulse rounded-2xl bg-stone-200 dark:bg-gray-800" />
        <GraphSkeleton height={380} />
      </div>
    );
  }
  if (state === 'error') return <RipError title="Couldn't check your access" message="Research Intelligence did not respond." onRetry={() => access.refetch()} />;
  if (state === 'disabled') return <RipModuleDisabled />;
  if (state === 'denied') return <RipNoAccess feature={feature} capability={capability} />;
  return <>{children}</>;
}

export function GraphLegend({ items, title, onToggle, hidden }: { items: LegendItem[]; title: string; onToggle?: (key: string) => void; hidden?: Set<string> }) {
  if (!items.length) return null;
  return (
    <div>
      <p className={ui.label}>{title}</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map((it) => {
          const off = hidden?.has(it.key);
          const swatch = <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.color, opacity: off ? 0.3 : 1 }} aria-hidden />;
          const text = (
            <>
              {swatch}
              <span className={`truncate ${off ? 'line-through opacity-60' : ''}`}>{it.key}</span>
              <span className="tabular-nums text-stone-400 dark:text-gray-500">{it.count}</span>
            </>
          );
          return (
            <li key={it.key} className="min-w-0 max-w-full">
              {onToggle ? (
                <button
                  type="button"
                  onClick={() => onToggle(it.key)}
                  aria-pressed={!off}
                  className="inline-flex max-w-full items-center gap-1.5 rounded text-xs text-stone-700 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:text-gray-300 dark:hover:text-white"
                >
                  {text}
                </button>
              ) : (
                <span className="inline-flex max-w-full items-center gap-1.5 text-xs text-stone-700 dark:text-gray-300">{text}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Branded page header, rounded to sit inside the standard page container. */
export function RipPageHeader(props: { title: string; description: string; icon: React.ReactNode; chips?: { label: string; value: string }[]; actions?: React.ReactNode }) {
  const { title, description, icon, chips, actions } = props;
  return (
    <header className="relative overflow-hidden rounded-2xl bg-brand-banner text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber/40 blur-3xl" />
      </div>
      <div className="relative px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100 [&_svg]:h-3.5 [&_svg]:w-3.5">
              {icon}
              Research Intelligence
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/75">{description}</p>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {chips && chips.length > 0 && (
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {chips.map((c) => (
              <div key={c.label} className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <dt className="text-[11px] font-medium uppercase tracking-wider text-white/70">{c.label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{c.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );
}
