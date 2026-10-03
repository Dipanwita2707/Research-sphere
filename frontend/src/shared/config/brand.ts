/**
 * ResearchSphere brand identity — single source of truth.
 * Import from here instead of hardcoding the product name or palette.
 */

export const BRAND = {
  name: 'ResearchSphere',
  shortName: 'ResearchSphere',
  tagline: 'Research Management Platform',
  description: 'Research Management Platform',
  /**
   * Public support address, set per deployment via NEXT_PUBLIC_SUPPORT_EMAIL.
   * null when not configured: callers must then send people to the contact form
   * (SUPPORT_CONTACT_PATH) instead of rendering a mailto link.
   */
  supportEmail: (process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '').trim() || null,
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

/** In-app route that always works for reaching support, even without a configured email. */
export const SUPPORT_CONTACT_PATH = '/contact';

export type BrandPalette = typeof BRAND.palette;
