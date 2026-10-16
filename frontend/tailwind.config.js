/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["selector", '[data-admin-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "var(--brand-50, #fff7ed)",
          100: "var(--brand-100, #ffedd5)",
          200: "var(--brand-200, #fed7aa)",
          300: "var(--brand-300, #fdba74)",
          400: "var(--brand-400, #fb923c)",
          500: "var(--brand-500, #f97316)",
          600: "var(--brand-600, #ea580c)",
          700: "var(--brand-700, #c2410c)",
          800: "var(--brand-800, #9a3412)",
          900: "var(--brand-900, #7c2d12)",
        },
        ink: "#1c1917",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-dm-sans)", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 12px 40px -18px rgba(154, 52, 18, 0.35)",
        float: "0 20px 50px -20px rgba(28, 25, 23, 0.35)",
      },
    },
  },
  plugins: [],
};
