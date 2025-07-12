/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#86efac',
          DEFAULT: '#4ade80',
          dark: '#22c55e',
        },
      },
    },
  },
  plugins: [],
} 