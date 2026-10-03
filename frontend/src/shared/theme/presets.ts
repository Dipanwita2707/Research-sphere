/**
 * University theme presets.
 *
 * A preset gives the brand colours for light and dark mode. `buildTheme` (theme.ts)
 * turns a preset (+ optional custom primary/accent) into CSS variables that Tailwind's
 * brand colours (`wine`, `amber`, `brand-*`, `blush`, `peach`, …) resolve to, so every
 * existing class follows the tenant theme.
 *
 * Keys must match backend/src/modules/branding/constants/themePresets.js.
 * Every preset is checked for WCAG AA (4.5:1) in __tests__/presets.test.ts:
 * button text on the primary fill, and primary links on every surface in both modes.
 */

export type ThemePresetKey = 'classic-wine' | 'royal-blue' | 'crimson' | 'emerald' | 'teal-slate' | 'saffron-navy';

export const THEME_PRESET_KEYS: readonly ThemePresetKey[] = [
  'classic-wine',
  'royal-blue',
  'crimson',
  'emerald',
  'teal-slate',
  'saffron-navy',
] as const;

export const DEFAULT_PRESET: ThemePresetKey = 'classic-wine';

/**
 * Categorical chart palette (CVD-validated against #ffffff and #1f2937). It is the same in
 * every preset on purpose: series colours identify entities ("Research is blue" on every
 * page) and must stay distinguishable for colour-blind readers, which a brand-derived set
 * cannot guarantee. Brand colour reaches charts through the single-series and sequential
 * tokens instead (vizBrand, seqLow → seqHigh), which each preset sets.
 */
export const CATEGORICAL_LIGHT = ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#4A3AA7', '#E34948'] as const;
export const CATEGORICAL_DARK = ['#3987E5', '#D95926', '#199E70', '#C98500', '#D55181', '#008300', '#9085E9', '#E66767'] as const;

/** Surfaces the app draws text on, used for contrast checks (and the chart surface var). */
export const LIGHT_SURFACES = { surface: '#FFFFFF' } as const;
export const DARK_SURFACES = { surface: '#1F2937', surfaceAlt: '#111827' } as const;

export interface PresetColors {
  /** Primary fill (buttons, active states). White text must pass AA on it. */
  primary: string;
  primaryDark?: string;
  primaryDarker?: string;
  primaryLight?: string;
  /** Pale tints for soft backgrounds/badges; derived from primary when omitted. */
  primary50?: string;
  primary100?: string;
  primary200?: string;
  primary300?: string;
  accent: string;
  accentDark?: string;
  accent300?: string;
  /** Muted decorative accent (icons, small labels). */
  gold?: string;
  goldDark?: string;
  gold50?: string;
  /** Tinted page/card surfaces and hairlines (light UI). */
  canvas: string;
  canvasLight: string;
  canvasDeep: string;
  ivory: string;
  peach: string;
  peachDark: string;
  line: string;
  /** Text inks tinted toward the brand. */
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  charcoal: string;
}

export interface DarkOverrides {
  /** Text colour of `text-wine` links/labels on dark surfaces. */
  primaryText: string;
  /** Highlight for active nav items, counters and links on dark surfaces. */
  hi: string;
}

export interface ThemePreset {
  key: ThemePresetKey;
  label: string;
  description: string;
  light: PresetColors;
  dark: DarkOverrides;
}

export const PRESETS: Record<ThemePresetKey, ThemePreset> = {
  'classic-wine': {
    key: 'classic-wine',
    label: 'Classic Wine',
    description: 'Deep raspberry wine with amber — the original ResearchSphere look.',
    light: {
      primary: '#841C43',
      primaryDark: '#6E1738',
      primaryDarker: '#4A0F26',
      primaryLight: '#9B2040',
      primary50: '#F6EDF0',
      primary100: '#FBE2E8',
      primary200: '#F3B6C8',
      primary300: '#C0587D',
      accent: '#E28B22',
      accentDark: '#C9771B',
      accent300: '#EFAE73',
      gold: '#C8973F',
      goldDark: '#966820',
      gold50: '#FBE8D6',
      canvas: '#FDF5EC',
      canvasLight: '#FFF8F4',
      canvasDeep: '#F5E8DC',
      ivory: '#FEF7F4',
      peach: '#FDD7BF',
      peachDark: '#F5C9A6',
      line: '#F0E2D2',
      ink: '#2B1D22',
      inkMuted: '#7A7178',
      inkSubtle: '#9A9198',
      charcoal: '#232323',
    },
    dark: { primaryText: '#F3B6C8', hi: '#FBBF24' },
  },
  'royal-blue': {
    key: 'royal-blue',
    label: 'Royal Blue & White',
    description: 'Royal blue on crisp white with a sky-blue accent.',
    light: {
      primary: '#1D4ED8',
      primaryDark: '#1E40AF',
      primaryDarker: '#172554',
      primaryLight: '#2563EB',
      primary50: '#EFF4FF',
      primary100: '#DBE7FE',
      primary200: '#BFD3FE',
      primary300: '#6B93F0',
      accent: '#0EA5E9',
      accentDark: '#0284C7',
      accent300: '#7DD3FC',
      gold: '#2563EB',
      goldDark: '#1E40AF',
      gold50: '#E0EFFE',
      canvas: '#F5F8FE',
      canvasLight: '#F9FBFF',
      canvasDeep: '#E6EEFB',
      ivory: '#F7F9FE',
      peach: '#DBE7FB',
      peachDark: '#C7D7F5',
      line: '#DCE5F3',
      ink: '#0F1B33',
      inkMuted: '#5B6478',
      inkSubtle: '#8790A3',
      charcoal: '#111827',
    },
    dark: { primaryText: '#93C5FD', hi: '#7DD3FC' },
  },
  crimson: {
    key: 'crimson',
    label: 'Crimson & White',
    description: 'Bold crimson on white with a warm gold accent.',
    light: {
      primary: '#B91C1C',
      primaryDark: '#991B1B',
      primaryDarker: '#7F1D1D',
      primaryLight: '#DC2626',
      primary50: '#FEF2F2',
      primary100: '#FEE2E2',
      primary200: '#FECACA',
      primary300: '#EF7A7A',
      accent: '#D97706',
      accentDark: '#B45309',
      accent300: '#FCD34D',
      gold: '#B45309',
      goldDark: '#92400E',
      gold50: '#FEF3C7',
      canvas: '#FEF7F7',
      canvasLight: '#FFFBFB',
      canvasDeep: '#FBE9E9',
      ivory: '#FFF8F8',
      peach: '#FDE2E2',
      peachDark: '#FBCFCF',
      line: '#F3DEDE',
      ink: '#2A1515',
      inkMuted: '#786B6B',
      inkSubtle: '#9D9191',
      charcoal: '#1F1A1A',
    },
    dark: { primaryText: '#FCA5A5', hi: '#FCD34D' },
  },
  emerald: {
    key: 'emerald',
    label: 'Emerald & White',
    description: 'Fresh emerald green on white with a lime-green accent.',
    light: {
      primary: '#047857',
      primaryDark: '#065F46',
      primaryDarker: '#064E3B',
      primaryLight: '#059669',
      primary50: '#ECFDF5',
      primary100: '#D1FAE5',
      primary200: '#A7F3D0',
      primary300: '#34D399',
      accent: '#65A30D',
      accentDark: '#4D7C0F',
      accent300: '#BEF264',
      gold: '#4D7C0F',
      goldDark: '#3F6212',
      gold50: '#ECFCCB',
      canvas: '#F3FBF7',
      canvasLight: '#F8FDFA',
      canvasDeep: '#E1F4EA',
      ivory: '#F5FCF8',
      peach: '#D1F2E1',
      peachDark: '#B9E9D0',
      line: '#D8EDE2',
      ink: '#0E241B',
      inkMuted: '#5E7268',
      inkSubtle: '#88998F',
      charcoal: '#14201B',
    },
    dark: { primaryText: '#6EE7B7', hi: '#BEF264' },
  },
  'teal-slate': {
    key: 'teal-slate',
    label: 'Teal & Slate',
    description: 'Calm teal with cool slate greys.',
    light: {
      primary: '#0F766E',
      primaryDark: '#115E59',
      primaryDarker: '#134E4A',
      primaryLight: '#0D9488',
      primary50: '#F0FDFA',
      primary100: '#CCFBF1',
      primary200: '#99F6E4',
      primary300: '#2DD4BF',
      accent: '#475569',
      accentDark: '#334155',
      accent300: '#94A3B8',
      gold: '#475569',
      goldDark: '#334155',
      gold50: '#E2E8F0',
      canvas: '#F4F7F8',
      canvasLight: '#F8FAFB',
      canvasDeep: '#E7EEF0',
      ivory: '#F6F9F9',
      peach: '#D5E9E7',
      peachDark: '#C0DEDB',
      line: '#DCE4E7',
      ink: '#0F1E24',
      inkMuted: '#5F6E75',
      inkSubtle: '#8A979C',
      charcoal: '#1E293B',
    },
    dark: { primaryText: '#5EEAD4', hi: '#99F6E4' },
  },
  'saffron-navy': {
    key: 'saffron-navy',
    label: 'Saffron & Navy',
    description: 'Deep navy with a saffron accent.',
    light: {
      primary: '#1E3A8A',
      primaryDark: '#1A2F6E',
      primaryDarker: '#0F1E4A',
      primaryLight: '#2848A8',
      primary50: '#EEF2FB',
      primary100: '#DCE4F7',
      primary200: '#B9C8EE',
      primary300: '#6E86CC',
      accent: '#F28C28',
      accentDark: '#D97316',
      accent300: '#F9C38C',
      gold: '#C2650E',
      goldDark: '#9A4F0B',
      gold50: '#FDEBD7',
      canvas: '#FFF8F0',
      canvasLight: '#FFFBF6',
      canvasDeep: '#FCEBD7',
      ivory: '#FFF9F2',
      peach: '#FDE3C4',
      peachDark: '#F9D2A3',
      line: '#F0E0CC',
      ink: '#111A33',
      inkMuted: '#6B6F7D',
      inkSubtle: '#9195A2',
      charcoal: '#0F172A',
    },
    dark: { primaryText: '#A5B8F0', hi: '#F9C38C' },
  },
};

export function isPresetKey(value: unknown): value is ThemePresetKey {
  return typeof value === 'string' && (THEME_PRESET_KEYS as readonly string[]).includes(value);
}
