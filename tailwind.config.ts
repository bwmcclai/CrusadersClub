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
          void: '#0A0A0A',
          dark: '#141414',
          navy: '#121F33',
          steel: '#243A51',
          gold: '#C9A84C',
          'gold-light': '#E8D090',
          'gold-dim': '#8A6E2F',
          crimson: '#6B1212',
          'crimson-bright': '#991F1F',
          parchment: '#E8D5A3',
          'parchment-dark': '#B8A47A',
          wood: '#2b1d16',
          'wood-dark': '#1e140f',
          ice: '#A8D8EA',
          stone: '#2A2E33',
        },
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        inter: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'radial-gold': 'radial-gradient(ellipse at center, #C9A84C22 0%, transparent 70%)',
        'radial-crimson': 'radial-gradient(ellipse at center, #6B121244 0%, transparent 70%)',
      },
      boxShadow: {
        'glow-gold': '0 0 15px #C9A84C44, 0 0 30px #C9A84C22',
        'glow-crimson': '0 0 15px #6B121244, 0 0 30px #6B121222',
        'card': '0 8px 32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(232, 213, 163, 0.15)',
        'medieval-inset': 'inset 0 0 20px rgba(0,0,0,0.8)',
      },
      animation: {
        'spin-slow': 'spin 20s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'flicker': 'flicker 3s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.6s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        flicker: {
          '0%, 100%': { opacity: '0.8', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' },
          '25%, 75%': { opacity: '0.9' },
        },
        slideUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
