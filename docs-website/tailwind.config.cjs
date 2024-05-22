/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        purple: {
          // This is now 'dark green' but we keep it as purple, for easier reference with the original theme
          50: "#DDFCFE",
          100: "#BAFAFC",
          200: "#76F5F9",
          300: "#31F0F6",
          400: "#09CCD2",
          500: "#068A8F",
          600: "#056D71",
          700: "#045558",
          800: "#02393B",
          900: "#011C1D",
          950: "#010E0F"
        },
        blue: {
          // This is now 'green', but we keep it as blue, for easier reference with the original theme
          50: "#EBF9F3",
          100: "#D8F3E6",
          200: "#B0E8CE",
          300: "#89DCB5",
          400: "#65D29F",
          500: "#3DC685",
          600: "#2FA26C",
          700: "#23764F",
          800: "#174F35",
          900: "#0C271A",
          950: "#06140D"
        },
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "3rem",
        "6xl": "5rem",
      },
      fontFamily: {
        display: ["Cabinet Grotesk", ...defaultTheme.fontFamily.sans],
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
        mono: ["JetBrains Mono", ...defaultTheme.fontFamily.mono],
      },
    },
  },
  plugins: [
    require("tailwind-scrollbar-hide"),
    require("@tailwindcss/typography"),
    // ...
  ],
};
