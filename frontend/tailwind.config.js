/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ResearchSphere Brand Palette
        brand: {
          50: '#FEF7F4',   // Soft Ivory — page background
          100: '#FDD7BF',  // Peach Beige — soft fills, hovers
          200: '#F5C9A6',  // peach tint
          300: '#EFAE73',  // amber tint
          400: '#E28B22',  // Amber Orange — accent
          500: '#C9771B',  // amber hover
          600: '#841C43',  // Deep Raspberry Wine — primary
          700: '#6E1738',  // wine hover
          800: '#4A0F26',  // wine active
          900: '#232323',  // Charcoal — text, dark surfaces
        },
        // Semantic aliases
        charcoal: '#232323',
        wine: {
          DEFAULT: '#841C43',
          dark: '#6E1738',
          darker: '#4A0F26',
        },
        amber: {
          DEFAULT: '#E28B22',
          dark: '#C9771B',
        },
        peach: {
          DEFAULT: '#FDD7BF',
          dark: '#F5C9A6',
        },
        ivory: '#FEF7F4',
        blush: {
          DEFAULT: '#FDF5EC',
          light: '#FFF8F4',
          deep: '#F5E8DC',
        },
        // Backward-compat aliases (map old names to new brand colors)
        sgt: {
          50: '#FEF7F4',
          100: '#FDD7BF',
          200: '#F5C9A6',
          300: '#EFAE73',
          400: '#E28B22',
          500: '#C9771B',
          600: '#841C43',
          700: '#6E1738',
          800: '#4A0F26',
          900: '#232323',
        },
        primary: {
          50: '#FEF7F4',
          100: '#FDD7BF',
          200: '#F5C9A6',
          300: '#EFAE73',
          400: '#E28B22',
          500: '#C9771B',
          600: '#841C43',
          700: '#6E1738',
          800: '#4A0F26',
          900: '#232323',
        },
        lms: {
          primary: '#841C43',
          'primary-dark': '#4A0F26',
          'primary-mid': '#6E1738',
          light: '#E28B22',
          'very-light': '#FDD7BF',
          background: '#FEF7F4',
        },
        ev: {
          900: '#232323',
          800: '#4A0F26',
          700: '#841C43',
          400: '#C9771B',
          200: '#FDD7BF',
          50:  '#FEF7F4',
          bg:  '#FEF7F4',
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
      backgroundImage: {
        'brand-sidebar': 'linear-gradient(180deg, #232323 0%, #4A0F26 100%)',
        'brand-header': 'linear-gradient(90deg, #232323 0%, #4A0F26 100%)',
        'brand-gradient': 'linear-gradient(135deg, #841C43 0%, #4A0F26 50%, #232323 100%)',
        'brand-gradient-light': 'linear-gradient(135deg, #FEF7F4 0%, #E28B22 100%)',
        'brand-gradient-radial': 'radial-gradient(ellipse at top, #E28B22 0%, #4A0F26 100%)',
        // Backward-compat aliases
        'lms-sidebar': 'linear-gradient(180deg, #232323 0%, #4A0F26 100%)',
        'lms-header': 'linear-gradient(90deg, #232323 0%, #4A0F26 100%)',
        'sgt-gradient': 'linear-gradient(135deg, #841C43 0%, #4A0F26 50%, #232323 100%)',
        'sgt-gradient-light': 'linear-gradient(135deg, #FEF7F4 0%, #E28B22 100%)',
        'sgt-gradient-radial': 'radial-gradient(ellipse at top, #E28B22 0%, #4A0F26 100%)',
      },
      boxShadow: {
        'brand': '0 4px 14px 0 rgba(132, 28, 67, 0.15)',
        'brand-lg': '0 10px 40px -10px rgba(132, 28, 67, 0.25)',
        'brand-xl': '0 25px 50px -12px rgba(35, 35, 35, 0.35)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'ev': '0 1px 3px 0 rgba(132, 28, 67, 0.08), 0 1px 2px -1px rgba(132, 28, 67, 0.06)',
        'ev-md': '0 4px 12px -2px rgba(132, 28, 67, 0.10), 0 2px 4px -2px rgba(132, 28, 67, 0.06)',
        'ev-lg': '0 10px 24px -4px rgba(132, 28, 67, 0.12), 0 4px 8px -4px rgba(132, 28, 67, 0.06)',
        // Backward-compat aliases
        'sgt': '0 4px 14px 0 rgba(132, 28, 67, 0.15)',
        'sgt-lg': '0 10px 40px -10px rgba(132, 28, 67, 0.25)',
        'sgt-xl': '0 25px 50px -12px rgba(35, 35, 35, 0.35)',
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
