/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // LMS Color Palette
        lms: {
          primary: '#005b96',
          'primary-dark': '#011f4b',
          'primary-mid': '#03396c',
          light: '#6497b1',
          'very-light': '#b3cde0',
          background: '#f8fafc',
        },
        // SGT University Blue Theme Palette
        sgt: {
          50: '#ADE1FB',   // Lightest - backgrounds, hover states
          100: '#8ED4F8',  // Light accents
          200: '#6FC7F5',  // Light borders
          300: '#4BBAF2',  // Subtle highlights
          400: '#266CA9',  // Secondary actions
          500: '#1A5A8F',  // Primary mid-tone
          600: '#0F2573',  // Primary - buttons, links
          700: '#041D56',  // Dark primary - headers
          800: '#021340',  // Darker - emphasis
          900: '#01082D',  // Darkest - text, backgrounds
        },
        // Keep primary as alias for backward compatibility
        primary: {
          50: '#ADE1FB',
          100: '#8ED4F8',
          200: '#6FC7F5',
          300: '#4BBAF2',
          400: '#266CA9',
          500: '#1A5A8F',
          600: '#0F2573',
          700: '#041D56',
          800: '#021340',
          900: '#01082D',
        },
        // Stat card colors (from LMS design)
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
        'lms-sidebar': 'linear-gradient(180deg, #03396c 0%, #011f4b 100%)',
        'lms-header': 'linear-gradient(90deg, #03396c 0%, #011f4b 100%)',
        'sgt-gradient': 'linear-gradient(135deg, #0F2573 0%, #041D56 50%, #01082D 100%)',
        'sgt-gradient-light': 'linear-gradient(135deg, #ADE1FB 0%, #266CA9 100%)',
        'sgt-gradient-radial': 'radial-gradient(ellipse at top, #266CA9 0%, #041D56 100%)',
      },
      boxShadow: {
        'sgt': '0 4px 14px 0 rgba(4, 29, 86, 0.15)',
        'sgt-lg': '0 10px 40px -10px rgba(4, 29, 86, 0.25)',
        'sgt-xl': '0 25px 50px -12px rgba(1, 8, 45, 0.35)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
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
