/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: '#FBFAF8', dark: '#1C1B1A' },
        ink: { DEFAULT: '#2B2A28', dark: '#EDEBE7' },
        surface: { DEFAULT: '#FFFFFF', dark: '#242321' },
        canvas: { DEFAULT: '#F1EFEA', dark: '#171615' },
        accent: { DEFAULT: '#3457D5', dark: '#7C93F0' },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        paper: '0 1px 2px rgba(43,42,40,0.04), 0 10px 30px -8px rgba(43,42,40,0.10)',
        'paper-dark': '0 1px 2px rgba(0,0,0,0.3), 0 10px 30px -8px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
