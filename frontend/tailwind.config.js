/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f4ff",
          100: "#dbe4ff",
          200: "#bac8ff",
          300: "#91a7ff",
          400: "#748ffc",
          500: "#5c7cfa",
          600: "#4c6ef5",
          700: "#4263eb",
          800: "#3b5bdb",
          900: "#364fc7",
        },
        chat: {
          bg: "#0b141a",
          sidebar: "#111b21",
          panel: "#202c33",
          header: "#202c33",
          incoming: "#202c33",
          outgoing: "#005c4b",
          hover: "#2a3942",
          border: "#2a3942",
          muted: "#8696a0",
          accent: "#00a884",
          input: "#2a3942",
        },
      },
    },
  },
  plugins: [],
};
