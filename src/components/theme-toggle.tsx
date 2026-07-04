"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 text-[#001352] transition-all dark:-rotate-90 dark:scale-0 dark:text-white" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 text-white transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
