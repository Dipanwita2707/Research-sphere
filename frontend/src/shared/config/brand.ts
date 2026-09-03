/**
 * ResearchSphere brand identity — single source of truth.
 * Import from here instead of hardcoding the product name or palette.
 */

export const BRAND = {
  name: 'ResearchSphere',
  shortName: 'ResearchSphere',
  tagline: 'Research Management Platform',
  description: 'Research Management Platform',
  supportEmail: 'mrinal11092002@gmail.com',
  websiteUrl: '#',
  social: {
    facebook: '#',
    twitter: '#',
    linkedin: '#',
    github: '#',
    instagram: '#',
  },
  palette: {
    charcoal: '#232323',
    wine: '#841C43',
    amber: '#E28B22',
    peach: '#FDD7BF',
    ivory: '#FEF7F4',
    /** Warm rose-cream canvas — page backgrounds & soft fills */
    blush: '#FDF5EC',
    blushLight: '#FFF8F4',
    blushDeep: '#F5E8DC',
  },
} as const;

export type BrandPalette = typeof BRAND.palette;
