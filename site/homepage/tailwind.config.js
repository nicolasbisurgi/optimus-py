/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./mocks-page.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary':   '#0a0a1a',
        'bg-secondary': '#12122a',
        'bg-tertiary':  '#1a1a3a',
        'accent-cyan':    '#22d3ee',
        'accent-violet':  '#a78bfa',
        'accent-rose':    '#fb7185',
        'accent-amber':   '#fbbf24',
        'accent-emerald': '#34d399',
        'text-primary':   '#ffffff',
        'text-secondary': '#cbd5e1',
        'text-muted':     '#71717a',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      animation: {
        'fade-in':       'fadeIn 0.6s ease-out forwards',
        'slide-up':      'slideUp 0.6s ease-out forwards',
        'float':         'float 20s ease-in-out infinite',
        'float-delayed': 'float 25s ease-in-out infinite',
        'dot-drop':      'dotDrop 0.4s ease-out forwards',
        'pulse-glow':    'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(20px)' },
                     '100%': { opacity: '1', transform: 'translateY(0)' } },
        float:     { '0%, 100%': { transform: 'translate(0, 0)' },
                     '50%':       { transform: 'translate(30px, -30px)' } },
        dotDrop:   { '0%': { opacity: '0', transform: 'translateY(-40px)' },
                     '70%': { opacity: '1', transform: 'translateY(4px)' },
                     '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseGlow: { '0%, 100%': { filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.6))' },
                     '50%':       { filter: 'drop-shadow(0 0 20px rgba(34, 211, 238, 1))' } },
      },
    },
  },
  plugins: [],
}
