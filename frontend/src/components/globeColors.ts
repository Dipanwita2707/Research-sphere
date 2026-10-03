// Chosen to stay legible over both the blue oceans and the green/brown land of the
// satellite texture. Shared by the globe and its legend; kept in a tiny module so the
// legend doesn't pull three.js into the page bundle.
//
// The values are CSS variables (--globe-*, src/styles/globals.css) like every other theme
// colour. They are deliberately the same in every university theme: they encode
// home / domestic / international against the photo texture, not brand identity, and a
// brand hue (e.g. royal blue) would disappear over the oceans.
import { cssVar } from '@/shared/theme/cssVars';

export const GLOBE_COLORS = {
  home: '#ff7a1a',          // your university
  domestic: '#ffd23f',      // partner in the same country
  international: '#2ee6d6', // partner abroad
  atmosphere: '#7cc4ff',
};

/** CSS references for HTML legends (follow the variables). */
export const GLOBE_COLOR_VARS = {
  home: 'var(--globe-home)',
  domestic: 'var(--globe-domestic)',
  international: 'var(--globe-international)',
  atmosphere: 'var(--globe-atmosphere)',
};

/** Concrete colours for WebGL (three.js cannot read CSS variables). Call on the client. */
export function readGlobeColors(): typeof GLOBE_COLORS {
  return {
    home: cssVar('--globe-home', GLOBE_COLORS.home),
    domestic: cssVar('--globe-domestic', GLOBE_COLORS.domestic),
    international: cssVar('--globe-international', GLOBE_COLORS.international),
    atmosphere: cssVar('--globe-atmosphere', GLOBE_COLORS.atmosphere),
  };
}
