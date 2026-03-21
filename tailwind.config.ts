import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        crusader: {
          void:    '#04060D',
          dark:    '#070B14',
          navy:    '#0D1B2A',
          steel:   '#1C3A5E',
          gold:    '#C9A84C',
          'gold-light': '#E8D090',
          'gold-dim':   '#8A6E2F',
          crimson: '#8B1A1A',
          'crimson-bright': '#C0392B',
          ice:     '#A8D8EA',
          glow:    '#4AAFD4',
        },
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        inter:  ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'radial-gold':   'radial-gradient(ellipse at center, #C9A84C22 0%, transparent 70%)',
        'radial-glow':   'radial-gradient(ellipse at center, #4AAFD422 0%, transparent 70%)',
        'hero-gradient': 'linear-gradient(180deg, #04060D 0%, #0D1B2A 50%, #04060D 100%)',
      },
      boxShadow: {
        'glow-gold':    '0 0 20px #C9A84C66, 0 0 40px #C9A84C33',
        'glow-blue':    '0 0 20px #4AAFD466, 0 0 40px #4AAFD433',
        'glow-crimson': '0 0 20px #8B1A1A66, 0 0 40px #8B1A1A33',
        'card':         '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      animation: {
        'spin-slow':      'spin 20s linear infinite',
        'pulse-slow':     'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float':          'float 6s ease-in-out infinite',
        'glow-pulse':     'glowPulse 3s ease-in-out infinite',
        'slide-up':       'slideUp 0.5s ease-out',
        'fade-in':        'fadeIn 0.6s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
