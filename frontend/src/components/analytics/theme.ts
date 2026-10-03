/**
 * Analytics design tokens.
 *
 * Series colours are CSS variables (defined in app/globals.css) so light and dark
 * mode each get their own validated step. Use them through `style`, not SVG
 * presentation attributes — `fill="var(--x)"` is not resolved by every browser.
 */

export const VIZ = [
  'var(--viz-1)',
  'var(--viz-2)',
  'var(--viz-3)',
  'var(--viz-4)',
  'var(--viz-5)',
  'var(--viz-6)',
  'var(--viz-7)',
  'var(--viz-8)',
] as const;

/**
 * Entities that appear across many charts keep one colour everywhere, so a
 * reader who learns "Research is blue" on the overview can rely on it on every
 * drill-down page.
 */
const ENTITY_SLOT: Record<string, number> = {
  research: 0,
  book: 1,
  conference: 2,
  ipr: 3,
  patent: 3,
  grants: 4,
  grant: 4,
  total: 0,
  submissions: 0,
  approved: 2,
  reviewed: 2,
  pending: 3,
  rejected: 1,
};

/**
 * Resolve a colour for each series key. Known entities get their fixed slot;
 * everything else takes the next unused slot in fixed order. Passed-in hex
 * colours from older call sites are deliberately ignored so every chart uses
 * the validated palette.
 */
export function seriesColors(keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const used = new Set<number>();
  for (const key of keys) {
    const slot = ENTITY_SLOT[key.toLowerCase()];
    if (slot !== undefined && !used.has(slot)) {
      out[key] = VIZ[slot];
      used.add(slot);
    }
  }
  let next = 0;
  for (const key of keys) {
    if (out[key]) continue;
    while (used.has(next) && next < VIZ.length - 1) next++;
    out[key] = VIZ[next % VIZ.length];
    used.add(next);
  }
  return out;
}

/** Colour for a single known category key (research, book, conference, ipr, grants). */
export function categoryColor(key: string): string {
  const slot = ENTITY_SLOT[key.toLowerCase()];
  return VIZ[slot ?? 0];
}

export function niceMax(val: number): number {
  if (val <= 0) return 5;
  const mag = Math.pow(10, Math.floor(Math.log10(val)));
  for (const n of [1, 2, 2.5, 5, 10]) {
    if (n * mag >= val) return n * mag;
  }
  return Math.ceil(val / mag) * mag;
}

/**
 * Axis top for whole-number data drawn with `ticks` intervals. Small scales are rounded up to a
 * multiple of the tick count so every tick is a distinct integer (a max of 2 gives 0-1-2-3-4,
 * not 0-1-1-2-2); larger scales keep niceMax.
 */
export function countAxisMax(val: number, ticks = 4): number {
  const n = niceMax(val);
  if (n >= 5 * ticks) return n;
  return Math.max(ticks, Math.ceil(n / ticks) * ticks);
}

export function formatTick(val: number): string {
  if (val >= 1_00_000) return `${(val / 1_00_000).toFixed(val % 1_00_000 === 0 ? 0 : 1)}L`;
  if (val >= 1000) return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
  return String(val);
}

/** Shared class strings so every analytics surface reads as one system. */
export const ui = {
  card: 'rounded-xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] dark:border-gray-700 dark:bg-gray-800',
  cardHeader: 'flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4 dark:border-gray-700',
  title: 'text-sm font-semibold text-stone-900 dark:text-gray-100',
  subtitle: 'mt-0.5 text-xs text-stone-500 dark:text-gray-400',
  label: 'text-[11px] font-medium uppercase tracking-wider text-stone-500 dark:text-gray-400',
  value: 'font-semibold tabular-nums text-stone-900 dark:text-white',
  muted: 'text-stone-500 dark:text-gray-400',
  th: 'px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500 dark:text-gray-400',
  td: 'px-4 py-3 text-sm text-stone-700 dark:text-gray-200',
  btnPrimary: 'inline-flex h-9 items-center gap-2 rounded-lg bg-wine px-4 text-sm font-medium text-wine-fg transition-colors hover:bg-wine-dark disabled:opacity-60',
  btnSecondary: 'inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
  input: 'h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition focus:border-wine focus:ring-2 focus:ring-wine/15 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
} as const;
