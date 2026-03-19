/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // NSGB HUB 2.0 Brand Colors
        blue: {
          DEFAULT: '#1e3799',
          dark: '#152a70',
          light: '#2d4fc4',
        },
        pink: {
          DEFAULT: '#e84393',
          light: '#f06ab5',
        },
        // Semantic
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
        // Grayscale (Slate)
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,.08)',
        DEFAULT: '0 4px 16px rgba(0,0,0,.10)',
        lg: '0 8px 32px rgba(0,0,0,.14)',
        xl: '0 16px 48px rgba(0,0,0,.18)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #1e3799 0%, #e84393 100%)',
        'brand-gradient-r': 'linear-gradient(135deg, #e84393 0%, #1e3799 100%)',
      },
      maxWidth: {
        container: '1200px',
      },
      height: {
        nav: '68px',
      },
    },
  },
  plugins: [],
};
