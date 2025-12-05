/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        twitch: {
          purple: 'var(--accent-color)',
          'purple-dark': 'var(--accent-color-dark)',
          dark: '#0E0E10',
          gray: '#1F1F23',
          light: '#EFEFF1',
        },
        accent: {
          DEFAULT: 'var(--accent-color)',
          dark: 'var(--accent-color-dark)',
        }
      }
    },
  },
  plugins: [],
}
