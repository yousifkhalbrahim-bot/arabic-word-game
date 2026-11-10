/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // تتغير حسب الخلفية: أبيض على التدرج، بنفسجي غامق داخل البطاقات البيضاء
        parchment: 'rgb(var(--c-text) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        dim: 'rgb(var(--c-dim) / <alpha-value>)',
        grape: { DEFAULT: '#6d28d9', ink: '#2e1065', soft: '#ede9fe' },
      },
      fontFamily: {
        body: ['ThmanyahSerifText', 'sans-serif'],
        display: ['ThmanyahSerifDisplay', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
