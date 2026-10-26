import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f7f8", 100: "#eeeef0", 200: "#d9d9de", 300: "#b8b8c1",
          400: "#9191a0", 500: "#747485", 600: "#5e5e6d", 700: "#4d4d59",
          800: "#42424b", 900: "#3a3a41", 950: "#18181b",
        },
        lumen: {
          50: "#f0f7ff", 100: "#e0effe", 200: "#b9dffd", 300: "#7cc5fc",
          400: "#36a7f8", 500: "#0c8ce9", 600: "#006fc7", 700: "#0158a1",
          800: "#064b85", 900: "#0b3f6e", 950: "#072849",
        },
        accent: { DEFAULT: "#f59e0b", soft: "#fef3c7" },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grid-fade": "radial-gradient(circle at 50% 0%, rgba(12,140,233,0.12), transparent 50%)",
        "hero-glow": "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(12,140,233,0.25), transparent)",
      },
      boxShadow: {
        soft: "0 4px 24px -4px rgba(15, 23, 42, 0.08)",
        lift: "0 12px 40px -12px rgba(15, 23, 42, 0.18)",
      },
    },
  },
  plugins: [],
};
export default config;
