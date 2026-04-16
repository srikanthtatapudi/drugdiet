/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0F172A',
        card: 'rgba(30, 41, 59, 0.7)',
        primary: '#3B82F6',
        secondary: '#10B981',
        accent: '#8B5CF6',
        text: '#F8FAFC',
        muted: '#94A3B8'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
