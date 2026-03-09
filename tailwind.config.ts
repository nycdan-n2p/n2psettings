import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      keyframes: {
        "loader-pulse": {
          "0%, 100%": { opacity: "0.2", transform: "scale(0.95)" },
          "50%": { opacity: "0.4", transform: "scale(1.05)" },
        },
      },
      animation: {
        "loader-pulse": "loader-pulse 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
