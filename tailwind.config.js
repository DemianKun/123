/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#1a0b12',
          800: '#341525',
          700: '#521d36',
          600: '#752549',
          500: '#9d2f5d', // Pomegranate Red Principal
          400: '#c54273',
          300: '#db6f95',
          200: '#ebb2c6',
          100: '#f5dbe4',
          50: '#fcf3f6',
        }
      }
    },
  },
  plugins: [],
}
