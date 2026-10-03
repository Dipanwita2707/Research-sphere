/**
 * Every theme preset must meet WCAG AA (4.5:1) for button text on the primary fill and
 * for primary links on every surface, in light and dark mode. Custom colours are adjusted
 * (or warned about) so they cannot silently ship unreadable text.
 */
import fs from 'fs';
import path from 'path';
import { contrast } from '../color';
import { PRESETS, THEME_PRESET_KEYS } from '../presets';
import { buildTheme, themeCss } from '../theme';

describe('theme presets', () => {
  test('keys match the backend allowlist', () => {
    const backend = fs.readFileSync(
      path.join(__dirname, '../../../../../backend/src/modules/branding/constants/themePresets.js'),
      'utf8',
    );
    const keys = [...backend.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).filter((k) => k in PRESETS);
    expect(new Set(keys)).toEqual(new Set(THEME_PRESET_KEYS));
  });

  const rows: string[] = [];
  afterAll(() => {
    if (process.env.PRINT_CONTRAST) console.log(rows.join('\n'));
  });

  test.each(THEME_PRESET_KEYS.map((k) => [k]))('%s passes AA in light and dark', (key) => {
    const theme = buildTheme({ themePreset: key });
    for (const c of theme.checks) {
      rows.push(`| ${PRESETS[key].label} | ${c.mode} | ${c.label} | ${c.fg} on ${c.bg} | ${c.ratio.toFixed(2)} | ${c.pass ? 'pass' : 'FAIL'} |`);
    }
    const failed = theme.checks.filter((c) => !c.pass);
    expect(failed).toEqual([]);
    expect(theme.warnings).toEqual([]);
    // the link colour used on light surfaces is the preset primary itself (no adjustment)
    expect(theme.colors.light.primaryText).toBe(PRESETS[key].light.primary);
    // links also pass on the tinted "deep" canvas used for section backgrounds
    expect(contrast(theme.colors.light.primary, theme.colors.light.canvasDeep)).toBeGreaterThanOrEqual(4.5);
  });

  test('classic wine reproduces the original palette', () => {
    const t = buildTheme(null);
    expect(t.isDefault).toBe(true);
    expect(t.light['--brand-primary']).toBe('132 28 67'); // #841C43
    expect(t.light['--brand-accent']).toBe('226 139 34'); // #E28B22
    expect(t.light['--brand-canvas']).toBe('253 245 236'); // #FDF5EC
  });

  test('unknown preset and malformed colours fall back to the default', () => {
    const t = buildTheme({ themePreset: 'neon', primaryColor: 'red', accentColor: '#12' });
    expect(t.preset).toBe('classic-wine');
    expect(t.isDefault).toBe(true);
  });
});

describe('custom colours', () => {
  test('a light custom primary gets dark button text, darker links and a warning', () => {
    const t = buildTheme({ themePreset: 'royal-blue', primaryColor: '#FACC15' });
    expect(t.colors.light.primaryFg).not.toBe('#FFFFFF');
    expect(contrast(t.colors.light.primaryFg, '#FACC15')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.colors.light.primaryText, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(t.colors.light.primaryText).not.toBe('#FACC15');
    expect(t.warnings.length).toBeGreaterThan(0);
    expect(t.checks.every((c) => c.pass)).toBe(true);
  });

  test('a deep custom primary keeps white text and derives shades', () => {
    const t = buildTheme({ themePreset: 'classic-wine', primaryColor: '#5B21B6', accentColor: '#F59E0B' });
    expect(t.isDefault).toBe(false);
    expect(t.colors.light.primaryFg).toBe('#FFFFFF');
    expect(t.light['--brand-primary']).toBe('91 33 182');
    expect(t.light['--brand-primary-dark']).not.toBe(t.light['--brand-primary']);
    expect(t.light['--brand-accent']).toBe('245 158 11');
    expect(t.warnings).toEqual([]);
  });

  test('themeCss scopes light vars to the selector and dark vars under .dark', () => {
    const css = themeCss(buildTheme({ themePreset: 'royal-blue' }));
    expect(css).toMatch(/^:root\[data-brand\]\{--brand-primary:29 78 216;/);
    expect(css).toContain(':root[data-brand].dark{--brand-primary-text:147 197 253');
  });
});
