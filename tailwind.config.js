/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        earth: {
          cream: '#f8f6f1',
          light: '#f2f0eb',
          sage: '#eef5f0',
          mist: '#e8f0eb',
          border: '#e0dbd0',
          'text-light': '#8a9a8a',
          'text-mid': '#6a7a6a',
          'text-body': '#5a6a5a',
          'text-dark': '#2a3a2a',
          green: '#4a8a4a',
          'green-light': '#6aaa5a',
          forest: '#2a3a2a',
        },
        terra: {
          DEFAULT: '#e07850',
        },
      },
      fontFamily: {
        sans: ["'DM Sans'", 'system-ui', 'sans-serif'],
        mono: ["'Space Mono'", 'monospace'],
      },
    },
  },
  plugins: [],
}
