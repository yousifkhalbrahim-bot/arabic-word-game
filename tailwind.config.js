/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-tajawal)', 'sans-serif'],
        display: ['var(--font-reem-kufi)', 'var(--font-tajawal)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
