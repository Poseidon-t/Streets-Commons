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
          cream: '#f5f2eb',
          light: '#eff0e8',
          sage: '#eaf2ec',
          mist: '#e4ede8',
          border: '#d8d4c8',
          'text-light': '#7a9a7a',
          'text-mid': '#5a7a5a',
          'text-body': '#4a6a4a',
          'text-muted': '#6a8a6a',
          'text-dark': '#1a2a1a',
          green: '#3a7a3a',
          'green-light': '#5a9a4a',
          forest: '#1a3a1a',
        },
        terra: {
          DEFAULT: '#e07850',
        },
        platform: {
          navy: '#1E40AF',
          'navy-light': '#2563EB',
          'navy-dark': '#1E3A8A',
          green: '#10B981',
          'green-light': '#34D399',
          slate: '#0F172A',
          'slate-mid': '#1E293B',
          gray: '#F8FAFC',
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
