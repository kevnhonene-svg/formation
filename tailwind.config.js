/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#141a2e',
        brand: { DEFAULT: '#6258e8', dark: '#5046d1', light: '#f0efff' },
        mint: '#dff6ed',
      },
      fontFamily: { sans: ['DM Sans', 'sans-serif'], display: ['Manrope', 'sans-serif'] },
      boxShadow: { card: '0 14px 40px rgba(26, 31, 59, .08)', lift: '0 22px 55px rgba(26, 31, 59, .13)' },
    },
  },
  plugins: [],
}
