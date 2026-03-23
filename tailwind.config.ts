import type { Config } from "tailwindcss";

/**
 * Tailwind v4: основные токены и `@theme` в `src/app/globals.css`.
 * Пазльные утилиты `.puzzle-tab-right` / `.puzzle-blank-left` заданы там же
 * в `@layer components` (псевдоэлементы `::before` / `::after`).
 */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
} satisfies Config;
