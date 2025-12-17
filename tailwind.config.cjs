/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./dreamstack/**/*.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        'brand-orange': '#FF7E33',
        'brand-blue': '#0069FF',
        'brand-blue-light': '#3498DB',
        'brand-gray': '#333333',
        'brand-gray-light': '#F5F5F5',
      },
      animation: {
        'infinite-scroll': 'infinite-scroll 25s linear infinite',
      },
      keyframes: {
        'infinite-scroll': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-100%)' },
        }
      }
    }
  },
  plugins: []
}
