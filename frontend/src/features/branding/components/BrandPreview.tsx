'use client';

import type { CSSProperties } from 'react';
import { BarChart3, Bell, Search } from 'lucide-react';
import { BrandMonogram } from '@/shared/components/brand/TenantLogo';
import type { BuiltTheme } from '@/shared/theme/theme';

export interface PreviewBrand {
  displayName: string;
  shortName: string | null;
  tagline: string | null;
  heroHeading: string | null;
  heroSubheading: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
}

const BARS = [38, 52, 46, 64, 58, 80];
const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

/**
 * Header + dashboard hero + button + chart drawn in a theme, without touching the page's
 * own theme: the CSS variables are set on this subtree only. Each mode uses explicit
 * classes (no `dark:` variants) so the light panel stays light on a dark page.
 */
function PreviewPanel({ theme, brand, mode }: { theme: BuiltTheme; brand: PreviewBrand; mode: 'light' | 'dark' }) {
  const dark = mode === 'dark';
  const vars = (dark ? { ...theme.light, ...theme.dark } : theme.light) as CSSProperties;
  const logo = dark ? brand.logoDarkUrl || brand.logoUrl : brand.logoUrl;
  const heading = brand.heroHeading?.trim() || 'Where Ideas Become Impact';
  const words = heading.split(' ');
  const sub =
    brand.heroSubheading?.trim() ||
    brand.tagline?.trim() ||
    `${brand.displayName} empowers researchers, faculty and scholars to collaborate and innovate.`;

  const surface = dark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900';
  const page = dark ? 'bg-gray-950' : 'bg-blush';
  const muted = dark ? 'text-gray-400' : 'text-ink-muted';
  const border = dark ? 'border-gray-800' : 'border-blush-line';
  const accentText = dark ? 'text-hi' : 'text-wine';

  return (
    <div style={vars} className={`overflow-hidden rounded-xl border ${border} ${page}`} data-testid={`brand-preview-${mode}`}>
      {/* Header */}
      <div className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${border} ${surface}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview / branding API image
            <img src={logo} alt="" className="h-7 w-auto max-w-[96px] object-contain" />
          ) : (
            <BrandMonogram branding={brand} className="h-7 w-7 rounded-lg !text-[9px]" />
          )}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[11px] font-bold">{brand.displayName}</p>
            <p className={`truncate text-[8px] font-medium uppercase tracking-wider ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Powered by ResearchSphere</p>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-1 2xl:flex">
          <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${dark ? 'bg-wine/20 text-hi' : 'bg-peach/60 text-wine'}`}>Dashboard</span>
          <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${muted}`}>Research</span>
          <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${muted}`}>Analytics</span>
        </div>
        <div className={`flex shrink-0 items-center gap-1.5 ${muted}`}>
          <Search className="h-3 w-3" />
          <span className="relative">
            <Bell className="h-3 w-3" />
            <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-wine" />
          </span>
        </div>
      </div>

      {/* Hero */}
      <div className={`grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-4 ${dark ? 'bg-gray-900' : 'bg-gradient-to-b from-white to-blush'}`}>
        <div className="min-w-0">
          <span className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${dark ? 'bg-wine/25 text-hi' : 'bg-gold-50 text-amber-dark'}`}>
            {(brand.shortName || brand.displayName)} · Research &amp; Development Portal
          </span>
          <p className={`mt-1.5 font-serif text-base font-bold leading-tight ${dark ? 'text-white' : 'text-ink'}`}>
            {words.slice(0, -1).join(' ')} <span className={accentText}>{words.slice(-1)[0]}</span>
          </p>
          <p className={`mt-0.5 text-[10px] font-bold ${accentText}`}>{brand.displayName}</p>
          <p className={`mt-1 line-clamp-2 text-[9px] leading-snug ${muted}`}>{sub}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" tabIndex={-1} className="rounded-full bg-wine-dark px-2.5 py-1 text-[9px] font-semibold text-wine-fg">
              Explore Research
            </button>
            <button type="button" tabIndex={-1} className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${dark ? 'border-gray-700 text-gray-200' : 'border-blush-line bg-white text-ink'}`}>
              Submit Proposal
            </button>
          </div>
        </div>
        <div className="relative h-16 w-20 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- static artwork */}
          <img src="/dashboard_image.png" alt="" className="h-full w-full object-contain" />
          {!theme.isDefault && <span className="pointer-events-none absolute inset-0" style={{ background: 'rgb(var(--brand-primary))', mixBlendMode: 'color', WebkitMask: 'url(/dashboard_image.png) center / contain no-repeat', mask: 'url(/dashboard_image.png) center / contain no-repeat' }} />}
        </div>
      </div>

      {/* KPI + chart */}
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        <div className={`rounded-lg border p-2 ${border} ${surface}`}>
          <p className={`text-[8px] font-medium uppercase tracking-wider ${muted}`}>Publications</p>
          <p className="text-sm font-bold tabular-nums">128</p>
          <a className={`text-[9px] font-semibold underline-offset-2 hover:underline ${dark ? 'text-wine' : 'text-wine'}`} href="#preview" onClick={(e) => e.preventDefault()}>
            View all
          </a>
        </div>
        <div className={`rounded-lg border p-2 ${border} ${surface}`}>
          <p className={`flex items-center gap-1 text-[8px] font-medium uppercase tracking-wider ${muted}`}>
            <BarChart3 className="h-2.5 w-2.5" /> Submissions
          </p>
          <svg viewBox="0 0 120 44" className="mt-1 h-11 w-full" role="img" aria-label="Sample chart in the theme colours">
            {BARS.map((v, i) => (
              <rect
                key={MONTHS[i]}
                x={4 + i * 19}
                y={40 - v * 0.45}
                width={13}
                height={v * 0.45}
                rx={2}
                style={{ fill: i === BARS.length - 1 ? 'rgb(var(--brand-accent))' : 'var(--viz-brand)' }}
              />
            ))}
            <line x1="0" y1="40.5" x2="120" y2="40.5" style={{ stroke: dark ? '#374151' : '#e7e5e4' }} />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function BrandPreview({ theme, brand }: { theme: BuiltTheme; brand: PreviewBrand }) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Light</p>
        <PreviewPanel theme={theme} brand={brand} mode="light" />
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Dark</p>
        <PreviewPanel theme={theme} brand={brand} mode="dark" />
      </div>
    </div>
  );
}
