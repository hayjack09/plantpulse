/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bhh: {
          pink: '#E8A0A0',
          'pink-light': '#F5D5D5',
          'pink-hot': '#D4787A',
          'pink-dark': '#C46B6D',
          green: '#1D6F42',
          'green-light': '#2D8B57',
          'green-dark': '#145232',
          cream: '#FFF8F0',
          gold: '#C9A227',
          'gold-light': '#E0BC4D',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        midcentury: ['Josefin Sans', 'Century Gothic', 'Futura', 'Avenir', 'sans-serif'],
      },
      backgroundImage: {
        'palm-pattern': "url('/banana-leaf.png')",
      },
      boxShadow: {
        'luxury': '0 10px 40px -10px rgba(232, 160, 160, 0.4)',
        'luxury-lg': '0 20px 60px -15px rgba(232, 160, 160, 0.5)',
      },
    },
  },
  plugins: [],
}
