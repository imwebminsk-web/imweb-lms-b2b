import type { Config } from "tailwindcss";

/**
 * Tailwind v4: основные токены и `@theme` в `src/app/globals.css`.
 * Пазльные утилиты `.puzzle-tab-right` / `.puzzle-blank-left` заданы там же
 * в `@layer components` (псевдоэлементы `::before` / `::after`).
 */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        growvy: {
          primary: "#1D4ED8",
          body: "#F4F6F8",
          content: "#FFFFFF",
          text: "#1A1D21",
          "text-muted": "#6B7280",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
    },
  },
} satisfies Config;
