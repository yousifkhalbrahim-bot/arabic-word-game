/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        parchment: '#f5ead8',
        muted: '#b49a7c',
        dim: '#7a644c',
        ink: '#120a05',
      },
      fontFamily: {
        body: ['ThmanyahSerifText', 'sans-serif'],
        display: ['ThmanyahSerifDisplay', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
