/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary:   '#4A7C59',
        secondary: '#8B6914',
        bg:        '#F5F0E8',
        surface:   '#FFFFFF',
        ink:       '#2C2416',
        muted:     '#6B5E4E',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body:    ['Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
}
