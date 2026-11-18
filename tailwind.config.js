/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      // charte apps360 (brand/README.md) — réservé au site, les apps gardent leurs couleurs
      colors: {
        brand: {
          orange: "#FF7A1A",
          "orange-dark": "#E5640A",
          teal: "#14C8B6",
          "teal-light": "#2DE0CC",
          navy: "#14306B",
          "navy-dark": "#0E2350",
          grey: "#6B6B73",
          mist: "#AAB4CC",
          cream: "#F5F4F0",
        },
      },
      fontFamily: {
        outfit: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
