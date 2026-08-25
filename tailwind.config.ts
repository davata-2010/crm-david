import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#080808",
          925: "#0C0C0C",
          920: "#0E0E0E",
          915: "#0F0F0F",
          900: "#111111",
          880: "#141414",
          870: "#151515",
          860: "#171717",
          800: "#1A1A1A",
          700: "#262626",
          600: "#3A3A3A",
          500: "#4A4A4A",
          450: "#5A5A5A",
          400: "#6E6E6E",
          350: "#7A7A7A",
          300: "#8A8A8A",
          250: "#9A9A9A",
          200: "#B4B4B4",
          150: "#C8C8C8",
          100: "#E8E8E8",
          50: "#F5F5F5",
        },
        gold: { DEFAULT: "#FAC51C", hover: "#ffd75e" },
        hair: "rgba(245,245,245,0.07)",
      },
      fontFamily: { sans: ["Inter", "Helvetica", "sans-serif"] },
      borderRadius: { xl2: "14px" },
    },
  },
  plugins: [],
};
export default config;
