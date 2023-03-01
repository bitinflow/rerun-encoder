const colors = require('tailwindcss/colors')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#9146FF',
          '50': '#FEFEFF',
          '100': '#F2E9FF',
          '200': '#DAC0FF',
          '300': '#C298FF',
          '400': '#A96FFF',
          '500': '#9146FF',
          '600': '#700EFF',
          '700': '#5600D5',
          '800': '#40009D',
          '900': '#290065'
        },
        base: {
          DEFAULT: '#26262C',
          '50': '#A8A8B4',
          '100': '#9D9DAA',
          '200': '#878797',
          '300': '#727284',
          '400': '#5F5F6E',
          '500': '#4C4C58',
          '600': '#393942',
          '700': '#26262C',
          '800': '#0C0C0E',
          '900': '#000000'
        },
        purple: '#8d63f2',
        emerald: colors.emerald,
        rose: colors.rose,
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
}
