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
        vs: {
          bg: '#070D1A',
          surface: '#0F1A2E',
          elevated: '#16243D',
          border: '#22324F',
          text: '#F5F7FB',
          muted: '#9AA8C1',
          gold: '#FFB331',
          'gold-hover': '#FFC65C',
          'on-gold': '#1A1205',
          blue: '#3B82F6',
          win: '#22C55E',
          loss: '#EF4444',
          live: '#FF4D6D',
          silver: '#C9D1DC',
          bronze: '#D08C4E',
        },
        luva: {
          navy: '#16243D',
          blue: '#3B82F6',
          light: '#60A5FA',
          amber: '#FFB331',
          silver: '#9AA8C1',
          bg: '#070D1A',
          border: '#22324F',
          success: '#22C55E',
          error: '#EF4444',
          muted: '#9AA8C1',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      transitionDuration: {
        'vs-press': 'var(--vs-motion-press)',
        'vs-tap': 'var(--vs-motion-tap)',
        'vs-burst': 'var(--vs-motion-burst)',
      },
      transitionTimingFunction: {
        'vs-out': 'var(--vs-motion-ease-out)',
        'vs-snap': 'var(--vs-motion-ease-snap)',
      },
    },
  },
  plugins: [],
}
export default config
