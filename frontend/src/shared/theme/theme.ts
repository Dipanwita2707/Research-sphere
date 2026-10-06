/**
 * Tenant theme: preset + optional custom colours → CSS variables.
 *
 * Tailwind's brand colours are `rgb(var(--brand-…) / <alpha-value>)` (tailwind.config.js),
 * so writing these variables on <html> re-colours every `bg-wine`, `text-wine`,
 * `border-amber`, `bg-blush`, … in the app. Values are "R G B" triplets; the chart
 * tokens (--viz-*) are plain hex because SVG/canvas code reads them directly.
 */
import { AA_TEXT, contrast, ensureContrast, isHexColor, mix, pickForeground, shade, tint, toTriplet } from './color';
import {
  CATEGORICAL_DARK,
  CATEGORICAL_LIGHT,
  DARK_SURFACES,
  DEFAULT_PRESET,
  LIGHT_SURFACES,
  PRESETS,
  type PresetColors,
  type ThemePresetKey,
  isPresetKey,
} from './presets';

/** Branding as returned by GET /branding/me and GET /public/branding/:slug. */
export interface Branding {
  universityId?: string;
  code?: string;
  slug: string;
  legalName?: string;
  displayName: string;
  shortName: string | null;
  shortNameIsCustom?: boolean;
  tagline: string | null;
  themePreset: string;
  primaryColor: string | null;
  accentColor: string | null;
  heroHeading: string | null;
  heroSubheading: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  /** Banner illustration on research profile / My Work pages (null = the built-in art). */
  heroImageUrl?: string | null;
  version: number;
}

export interface ThemeInput {
  themePreset?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}

export type ThemeVars = Record<string, string>;

export interface ContrastCheck {
  label: string;
  mode: 'light' | 'dark';
  fg: string;
  bg: string;
  ratio: number;
  pass: boolean;
}

export interface BuiltTheme {
  preset: ThemePresetKey;
  /** True when this is exactly the default ResearchSphere theme. */
  isDefault: boolean;
  light: ThemeVars;
  dark: ThemeVars;
  /** Resolved hex colours (for previews, charts and the contrast table). */
  colors: { light: Required<PresetColors> & { primaryFg: string; accentFg: string; primaryText: string; hi: string }; dark: { primaryText: string; hi: string; seqLo: string; seqHi: string } };
  checks: ContrastCheck[];
  /** Human-readable notes when custom colours were adjusted or still fail. */
  warnings: string[];
}

function fillDerived(base: PresetColors): Required<PresetColors> {
  const p = base.primary;
  const a = base.accent;
  return {
    ...base,
    primaryDark: base.primaryDark ?? shade(p, 0.17),
    primaryDarker: base.primaryDarker ?? shade(p, 0.44),
    primaryLight: base.primaryLight ?? tint(p, 0.12),
    primary50: base.primary50 ?? tint(p, 0.93),
    primary100: base.primary100 ?? tint(p, 0.87),
    primary200: base.primary200 ?? tint(p, 0.68),
    primary300: base.primary300 ?? tint(p, 0.35),
    accentDark: base.accentDark ?? shade(a, 0.11),
    accent300: base.accent300 ?? tint(a, 0.4),
    gold: base.gold ?? shade(a, 0.15),
    goldDark: base.goldDark ?? shade(a, 0.35),
    gold50: base.gold50 ?? tint(a, 0.85),
  } as Required<PresetColors>;
}

/** Custom primary: derive every shade from it; the preset keeps its neutrals. */
function withCustomPrimary(base: PresetColors, primary: string): PresetColors {
  return {
    ...base,
    primary,
    primaryDark: shade(primary, 0.17),
    primaryDarker: shade(primary, 0.44),
    primaryLight: tint(primary, 0.12),
    primary50: tint(primary, 0.93),
    primary100: tint(primary, 0.87),
    primary200: tint(primary, 0.68),
    primary300: tint(primary, 0.35),
    // Brand-tinted hairlines/soft fills follow the new hue
    canvas: mix(tint(primary, 0.96), '#FFFFFF', 0.2),
    canvasLight: tint(primary, 0.98),
    canvasDeep: tint(primary, 0.9),
    ivory: tint(primary, 0.97),
    peach: tint(primary, 0.85),
    peachDark: tint(primary, 0.78),
    line: tint(primary, 0.86),
    ink: shade(primary, 0.8),
    inkMuted: mix(shade(primary, 0.55), '#6B7280', 0.6),
    inkSubtle: mix(tint(primary, 0.2), '#9CA3AF', 0.7),
    charcoal: shade(primary, 0.82),
  };
}

function withCustomAccent(base: PresetColors, accent: string): PresetColors {
  return {
    ...base,
    accent,
    accentDark: shade(accent, 0.11),
    accent300: tint(accent, 0.4),
    gold: shade(accent, 0.15),
    goldDark: shade(accent, 0.35),
    gold50: tint(accent, 0.85),
  };
}

const VAR_MAP: [cssVar: string, key: keyof Required<PresetColors>][] = [
  ['--brand-primary', 'primary'],
  ['--brand-primary-dark', 'primaryDark'],
  ['--brand-primary-darker', 'primaryDarker'],
  ['--brand-primary-light', 'primaryLight'],
  ['--brand-primary-50', 'primary50'],
  ['--brand-primary-100', 'primary100'],
  ['--brand-primary-200', 'primary200'],
  ['--brand-primary-300', 'primary300'],
  ['--brand-accent', 'accent'],
  ['--brand-accent-dark', 'accentDark'],
  ['--brand-accent-300', 'accent300'],
  ['--brand-gold', 'gold'],
  ['--brand-gold-dark', 'goldDark'],
  ['--brand-gold-50', 'gold50'],
  ['--brand-canvas', 'canvas'],
  ['--brand-canvas-light', 'canvasLight'],
  ['--brand-canvas-deep', 'canvasDeep'],
  ['--brand-ivory', 'ivory'],
  ['--brand-peach', 'peach'],
  ['--brand-peach-dark', 'peachDark'],
  ['--brand-line', 'line'],
  ['--brand-ink', 'ink'],
  ['--brand-ink-muted', 'inkMuted'],
  ['--brand-ink-subtle', 'inkSubtle'],
  ['--brand-charcoal', 'charcoal'],
];

export function normalizeThemeInput(input?: ThemeInput | null): { preset: ThemePresetKey; primary: string | null; accent: string | null } {
  return {
    preset: isPresetKey(input?.themePreset) ? input!.themePreset as ThemePresetKey : DEFAULT_PRESET,
    primary: isHexColor(input?.primaryColor) ? input!.primaryColor!.toUpperCase() : null,
    accent: isHexColor(input?.accentColor) ? input!.accentColor!.toUpperCase() : null,
  };
}

/** Build the full light/dark variable sets, contrast checks and warnings. */
export function buildTheme(input?: ThemeInput | null): BuiltTheme {
  const { preset, primary, accent } = normalizeThemeInput(input);
  const def = PRESETS[preset];
  let base: PresetColors = { ...def.light };
  if (primary) base = withCustomPrimary(base, primary);
  if (accent) base = withCustomAccent(base, accent);
  const c = fillDerived(base);
  const warnings: string[] = [];

  const lightSurfaces = [LIGHT_SURFACES.surface, c.canvas, c.canvasLight, c.ivory, c.canvasDeep];
  const darkSurfaces = [DARK_SURFACES.surface, DARK_SURFACES.surfaceAlt];

  // Text on the primary fill: white or near-black, whichever passes better
  const primaryFg = pickForeground(c.primary);
  const accentFg = pickForeground(c.accent);
  if (primary && primaryFg !== '#FFFFFF') {
    warnings.push('The custom primary colour is light, so button text switches to dark. Pick a deeper colour to keep white button text.');
  }

  // Links (`text-wine`) on light surfaces; adjusted when a custom colour is too light
  const primaryText = ensureContrast(c.primary, lightSurfaces);
  if (primaryText !== c.primary) {
    warnings.push(`The primary colour is too light for text on white (${contrast(c.primary, '#FFFFFF').toFixed(2)}:1). Links use a darker shade (${primaryText}).`);
  }

  // Dark mode: preset values, or a light tint of the custom primary/accent
  const darkPrimaryText = ensureContrast(primary ? tint(c.primary, 0.62) : def.dark.primaryText, darkSurfaces);
  const darkHi = ensureContrast(accent ? tint(c.accent, 0.35) : def.dark.hi, darkSurfaces);

  const light: ThemeVars = {};
  for (const [v, k] of VAR_MAP) light[v] = toTriplet(c[k]);
  light['--brand-primary-fg'] = toTriplet(primaryFg);
  light['--brand-accent-fg'] = toTriplet(accentFg);
  light['--brand-primary-text'] = toTriplet(primaryText);
  light['--brand-hi'] = toTriplet(primaryText);
  CATEGORICAL_LIGHT.forEach((hex, i) => { light[`--viz-${i + 1}`] = hex; });
  light['--viz-brand'] = c.primary;
  light['--viz-brand-soft'] = c.primary200;
  light['--viz-seq-lo'] = c.primary100;
  light['--viz-seq-hi'] = c.primary;
  light['--viz-surface'] = LIGHT_SURFACES.surface;

  const darkSeqLo = mix(c.primary, DARK_SURFACES.surface, 0.55);
  const darkSeqHi = c.primary300;
  const dark: ThemeVars = {
    '--brand-primary-text': toTriplet(darkPrimaryText),
    '--brand-hi': toTriplet(darkHi),
    '--viz-brand': darkPrimaryText,
    '--viz-brand-soft': mix(c.primary, DARK_SURFACES.surface, 0.35),
    '--viz-seq-lo': darkSeqLo,
    '--viz-seq-hi': darkSeqHi,
    '--viz-surface': DARK_SURFACES.surface,
  };
  CATEGORICAL_DARK.forEach((hex, i) => { dark[`--viz-${i + 1}`] = hex; });

  const checks: ContrastCheck[] = [];
  const check = (label: string, mode: 'light' | 'dark', fg: string, bg: string) => {
    const ratio = contrast(fg, bg);
    checks.push({ label, mode, fg, bg, ratio: Math.round(ratio * 100) / 100, pass: ratio >= AA_TEXT });
  };
  check('Button text on primary', 'light', primaryFg, c.primary);
  check('Button text on primary (hover)', 'light', primaryFg, c.primaryDark);
  check('Link on white', 'light', primaryText, '#FFFFFF');
  check('Link on page canvas', 'light', primaryText, c.canvas);
  check('Link on ivory', 'light', primaryText, c.ivory);
  check('Link on section canvas', 'light', primaryText, c.canvasDeep);
  check('Button text on primary', 'dark', primaryFg, c.primary);
  check('Link on dark card', 'dark', darkPrimaryText, DARK_SURFACES.surface);
  check('Link on dark page', 'dark', darkPrimaryText, DARK_SURFACES.surfaceAlt);
  check('Highlight on dark card', 'dark', darkHi, DARK_SURFACES.surface);
  for (const failed of checks.filter((x) => !x.pass)) {
    warnings.push(`${failed.label} (${failed.mode}) is ${failed.ratio}:1, below the 4.5:1 WCAG AA minimum.`);
  }

  return {
    preset,
    isDefault: preset === DEFAULT_PRESET && !primary && !accent,
    light,
    dark,
    colors: {
      light: { ...c, primaryFg, accentFg, primaryText, hi: primaryText },
      dark: { primaryText: darkPrimaryText, hi: darkHi, seqLo: darkSeqLo, seqHi: darkSeqHi },
    },
    checks,
    warnings,
  };
}

const declarations = (vars: ThemeVars) => Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');

/**
 * CSS text for a theme. `scope` is the selector the light variables go on; dark ones go
 * on `.dark` inside it (or `scope.dark` when scope is :root/html). Used both for the
 * runtime <style> and for SSR public pages.
 */
export function themeCss(theme: BuiltTheme, scope = ':root[data-brand]'): string {
  const isRoot = /^(:root|html)/.test(scope);
  const darkSel = isRoot ? `${scope}.dark` : `.dark ${scope}, ${scope}.dark`;
  return `${scope}{${declarations(theme.light)}}${darkSel}{${declarations(theme.dark)}}`;
}
