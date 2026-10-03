/**
 * Theme preset keys a university can choose. The colour values live in the frontend
 * (frontend/src/shared/theme/presets.ts), which turns a key + optional custom colours
 * into CSS variables; the backend only validates the key. Keep both lists in sync
 * (frontend/src/shared/theme/__tests__/presets.test.ts checks it).
 */
const THEME_PRESET_KEYS = Object.freeze([
  'classic-wine',
  'royal-blue',
  'crimson',
  'emerald',
  'teal-slate',
  'saffron-navy',
]);

const DEFAULT_THEME_PRESET = 'classic-wine';

module.exports = { THEME_PRESET_KEYS, DEFAULT_THEME_PRESET };
