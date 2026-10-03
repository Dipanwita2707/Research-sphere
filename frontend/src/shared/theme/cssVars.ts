/**
 * Read the active theme's colours as concrete values, for code that cannot use CSS
 * variables directly (d3/SVG attributes, canvas, chart libraries that write attributes).
 * Call at draw time — the values change when the university theme or dark mode changes.
 */

/** `rgb(r, g, b)` of a "R G B" brand variable, e.g. brandRgb('primary'). */
export function brandRgb(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(`--brand-${name}`).trim();
    const parts = raw.split(/\s+/).map(Number);
    return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? `rgb(${parts.join(', ')})` : fallback;
  } catch {
    return fallback;
  }
}

/** Value of any CSS custom property on <html> (e.g. '--viz-brand'), or the fallback. */
export function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}
