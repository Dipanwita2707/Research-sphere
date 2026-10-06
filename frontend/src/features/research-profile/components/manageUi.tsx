import React from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Building blocks shared by the profile settings tabs (manage page), so every tab
 * reads as one surface on the brand canvas.
 */
const FIELD = 'rounded-lg border border-blush-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-wine focus:ring-2 focus:ring-wine/15 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

export const panel = {
  card: 'rounded-2xl border border-blush-line bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] dark:border-gray-700 dark:bg-gray-800',
  header: 'flex flex-wrap items-start justify-between gap-3 border-b border-blush-line/70 px-5 py-4 sm:px-6 dark:border-gray-700',
  body: 'px-5 py-5 sm:px-6',
  title: 'text-base font-semibold text-ink dark:text-white',
  subtitle: 'mt-0.5 text-sm text-ink-muted dark:text-gray-400',
  label: 'block text-sm font-medium text-ink dark:text-gray-200',
  input: `h-10 w-full ${FIELD}`,
  textarea: `w-full py-2 leading-relaxed ${FIELD}`,
  btnPrimary: 'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-wine px-4 text-sm font-medium text-wine-fg transition-colors hover:bg-wine-dark disabled:cursor-not-allowed disabled:opacity-50',
  btnSecondary: 'inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blush-line bg-white px-3.5 text-sm font-medium text-ink transition-colors hover:border-wine/40 hover:text-wine disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:text-gold',
} as const;

export function CardHeader({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={panel.header}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-50 text-gold-dark dark:bg-gray-700 dark:text-gold">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h3 className={panel.title}>{title}</h3>
          {subtitle && <p className={panel.subtitle}>{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? 'bg-wine' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}
