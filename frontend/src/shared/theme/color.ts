/**
 * Small colour toolkit for the tenant theme: hex parsing, mixing, WCAG 2.x contrast.
 * Pure functions, no DOM — shared by the runtime theme, the superadmin preview, SSR
 * public pages and the contrast tests.
 */

export type RGB = [number, number, number];

const HEX_RE = /^#?([0-9a-f]{6})$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

export function hexToRgb(hex: string): RGB {
  const m = HEX_RE.exec(hex.trim());
  if (!m) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** "R G B" triplet for `rgb(var(--x) / <alpha>)` CSS variables. */
export function toTriplet(hex: string): string {
  return hexToRgb(hex).join(' ');
}

/** Mix `a` toward `b`; amount 0 = a, 1 = b (sRGB, good enough for tints/shades). */
export function mix(a: string, b: string, amount: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * amount) as RGB);
}

export const tint = (hex: string, amount: number) => mix(hex, '#FFFFFF', amount);
export const shade = (hex: string, amount: number) => mix(hex, '#000000', amount);

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1–21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const AA_TEXT = 4.5;

/** White or near-black text, whichever reads better on `bg`. */
export function pickForeground(bg: string, light = '#FFFFFF', dark = '#111827'): string {
  return contrast(bg, light) >= contrast(bg, dark) ? light : dark;
}

/**
 * Move `fg` toward black (on light surfaces) or white (on dark ones) until it reaches
 * `ratio` against every surface. Returns the first passing step, or the extreme.
 */
export function ensureContrast(fg: string, surfaces: string[], ratio = AA_TEXT): string {
  const passes = (c: string) => surfaces.every((s) => contrast(c, s) >= ratio);
  if (passes(fg)) return fg;
  const darkSurfaces = surfaces.every((s) => luminance(s) < 0.2);
  const target = darkSurfaces ? '#FFFFFF' : '#000000';
  for (let step = 0.05; step <= 1.0001; step += 0.05) {
    const candidate = mix(fg, target, step);
    if (passes(candidate)) return candidate;
  }
  return target;
}
