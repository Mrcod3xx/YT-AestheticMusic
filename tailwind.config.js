/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./popup/**/*.{html,ts,tsx}",
    "./options/**/*.{html,ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        amberClock: '#C28356',
        glassDark: 'rgba(18, 18, 22, 0.72)',
        glassBorder: 'rgba(255, 255, 255, 0.14)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        clock: ['"Bebas Neue"', '"Antonio"', '"Oswald"', 'Impact', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
