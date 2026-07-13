import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        "surface-inset": "var(--surface-inset)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
  safelist: [
    "bg-emerald-500",
    "bg-emerald-50",
    "text-emerald-700",
    "stroke-emerald-500",
    "bg-amber-500",
    "bg-amber-50",
    "text-amber-700",
    "stroke-amber-500",
    "bg-violet-500",
    "bg-violet-50",
    "text-violet-700",
    "stroke-violet-500",
  ],
};
export default config;

