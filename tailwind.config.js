/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['ThmanyahSerifText', 'sans-serif'],
        display: ['ThmanyahSerifDisplay', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
