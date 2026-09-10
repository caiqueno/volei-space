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
        luva: {
          navy:   '#0F2C52',
          blue:   '#185FA5',
          light:  '#378ADD',
          amber:  '#EF9F27',
          silver: '#B4B2A9',
          bg:     '#F4F6FA',
          border: '#E2E8F0',
          success: '#1D9E75',
          error:   '#E24B4A',
          muted:   '#64748B',
        },
      },
    },
  },
  plugins: [],
}
export default config
