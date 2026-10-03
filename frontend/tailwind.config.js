/** Tailwind colour backed by a "R G B" CSS variable, so opacity modifiers keep working. */
const v = (name) => `rgb(var(--brand-${name}) / <alpha-value>)`;
/** Plain CSS colour from a brand variable (for gradients and shadows). */
const c = (name, alpha) => (alpha === undefined ? `rgb(var(--brand-${name}))` : `rgb(var(--brand-${name}) / ${alpha})`);

const brandScale = {
  50: v('ivory'), // page background
  100: v('peach'), // soft fills, hovers
  200: v('peach-dark'),
  300: v('accent-300'),
  400: v('accent'), // accent
  500: v('accent-dark'),
  600: v('primary'), // primary
  700: v('primary-dark'),
  800: v('primary-darker'),
  900: v('charcoal'), // text, dark surfaces
};

const wine = {
  DEFAULT: v('primary'),
  dark: v('primary-dark'),
  darker: v('primary-darker'),
  light: v('primary-light'),
  fg: v('primary-fg'), // text on a primary fill (white, or dark for light custom colours)
  50: v('primary-50'),
  100: v('primary-100'),
  200: v('primary-200'),
  300: v('primary-300'),
  400: v('primary-light'),
  500: v('primary'),
  600: v('primary'),
  700: v('primary-dark'),
  800: v('primary-darker'),
  900: v('primary-darker'),
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Brand colours resolve to CSS variables set per university (src/shared/theme):
      // defaults (Classic Wine) live in src/styles/globals.css; a tenant theme overrides
      // them on <html data-brand>. Every bg-wine / text-wine / border-amber / bg-blush …
      // therefore follows the active university theme.
      colors: {
        brand: brandScale,
        charcoal: v('charcoal'),
        wine: wine,
        amber: {
          // Brand accent. The numeric amber-50…950 scale stays Tailwind's (warning states).
          DEFAULT: v('accent'),
          dark: v('accent-dark'),
          fg: v('accent-fg'),
        },
        peach: {
          DEFAULT: v('peach'),
          dark: v('peach-dark'),
        },
        ivory: v('ivory'),
        blush: {
          DEFAULT: v('canvas'),
          light: v('canvas-light'),
          deep: v('canvas-deep'),
          line: v('line'),
        },
        gold: {
          DEFAULT: v('gold'),
          dark: v('gold-dark'),
          50: v('gold-50'),
        },
        ink: {
          DEFAULT: v('ink'),
          muted: v('ink-muted'),
          subtle: v('ink-subtle'),
        },
        // Highlight on dark surfaces (active nav, counters): amber in Classic Wine
        hi: v('hi'),
        // Backward-compat aliases (map old names to the brand scale)
        sgt: brandScale,
        primary: brandScale,
        lms: {
          primary: v('primary'),
          'primary-dark': v('primary-darker'),
          'primary-mid': v('primary-dark'),
          light: v('accent'),
          'very-light': v('peach'),
          background: v('ivory'),
        },
        ev: {
          900: v('charcoal'),
          800: v('primary-darker'),
          700: v('primary'),
          400: v('accent-dark'),
          200: v('peach'),
          50: v('ivory'),
          bg: v('ivory'),
        },
        // Stat card colors
        card: {
          green: '#dcfce7',
          'green-dark': '#166534',
          cream: '#fef9c3',
          'cream-dark': '#854d0e',
          blue: '#dbeafe',
          'blue-dark': '#1e40af',
          coral: '#ffe4e6',
          'coral-dark': '#be123c',
          purple: '#f3e8ff',
          'purple-dark': '#7e22ce',
          orange: '#ffedd5',
          'orange-dark': '#c2410c',
        },
      },
      // `text-wine` uses the link colour: the primary in light mode, a readable light
      // tint of it in dark mode (fills keep the primary itself).
      textColor: {
        wine: { ...wine, DEFAULT: v('primary-text') },
      },
      backgroundImage: {
        'brand-sidebar': `linear-gradient(180deg, ${c('charcoal')} 0%, ${c('primary-darker')} 100%)`,
        'brand-header': `linear-gradient(90deg, ${c('charcoal')} 0%, ${c('primary-darker')} 100%)`,
        'brand-gradient': `linear-gradient(135deg, ${c('primary')} 0%, ${c('primary-darker')} 50%, ${c('charcoal')} 100%)`,
        'brand-gradient-light': `linear-gradient(135deg, ${c('ivory')} 0%, ${c('accent')} 100%)`,
        'brand-gradient-radial': `radial-gradient(ellipse at top, ${c('accent')} 0%, ${c('primary-darker')} 100%)`,
        // Banner used by analytics/profile headers (was a fixed wine→copper gradient)
        'brand-banner': `linear-gradient(120deg, ${c('primary-darker')} 0%, ${c('primary')} 45%, ${c('primary-light')} 70%, ${c('accent-dark')} 100%)`,
        // Backward-compat aliases
        'lms-sidebar': `linear-gradient(180deg, ${c('charcoal')} 0%, ${c('primary-darker')} 100%)`,
        'lms-header': `linear-gradient(90deg, ${c('charcoal')} 0%, ${c('primary-darker')} 100%)`,
        'sgt-gradient': `linear-gradient(135deg, ${c('primary')} 0%, ${c('primary-darker')} 50%, ${c('charcoal')} 100%)`,
        'sgt-gradient-light': `linear-gradient(135deg, ${c('ivory')} 0%, ${c('accent')} 100%)`,
        'sgt-gradient-radial': `radial-gradient(ellipse at top, ${c('accent')} 0%, ${c('primary-darker')} 100%)`,
      },
      boxShadow: {
        'brand': `0 4px 14px 0 ${c('primary', 0.15)}`,
        'brand-lg': `0 10px 40px -10px ${c('primary', 0.25)}`,
        'brand-xl': `0 25px 50px -12px ${c('charcoal', 0.35)}`,
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'ev': `0 1px 3px 0 ${c('primary', 0.08)}, 0 1px 2px -1px ${c('primary', 0.06)}`,
        'ev-md': `0 4px 12px -2px ${c('primary', 0.1)}, 0 2px 4px -2px ${c('primary', 0.06)}`,
        'ev-lg': `0 10px 24px -4px ${c('primary', 0.12)}, 0 4px 8px -4px ${c('primary', 0.06)}`,
        // Backward-compat aliases
        'sgt': `0 4px 14px 0 ${c('primary', 0.15)}`,
        'sgt-lg': `0 10px 40px -10px ${c('primary', 0.25)}`,
        'sgt-xl': `0 25px 50px -12px ${c('charcoal', 0.35)}`,
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'xxs': ['10px', { lineHeight: '14px' }],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.5s ease-out forwards',
        'slide-in-right': 'slideInRight 0.5s ease-out forwards',
        'spin-slow': 'spin 8s linear infinite',
        'spin-slow-reverse': 'spinReverse 6s linear infinite',
        'bounce-slow': 'bounce 3s infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        spinReverse: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(-360deg)' },
        },
      },
    },
  },
  plugins: [],
}
