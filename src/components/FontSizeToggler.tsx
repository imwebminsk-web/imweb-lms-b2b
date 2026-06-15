"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "growvy-font-size";
const MIN_PX = 14;
const MAX_PX = 20;
const DEFAULT_PX = 16;
const STEP_PX = 1;

function clampFontSize(value: number): number {
  return Math.min(MAX_PX, Math.max(MIN_PX, Math.round(value)));
}

function readStoredFontSize(): number {
  if (typeof window === "undefined") return DEFAULT_PX;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PX;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_PX;
  return clampFontSize(parsed);
}

function applyRootFontSize(px: number) {
  document.documentElement.style.fontSize = `${px}px`;
}

type FontSizeTogglerProps = {
  className?: string;
  decreaseLabel?: string;
  increaseLabel?: string;
};

export function FontSizeToggler({
  className,
  decreaseLabel = "Уменьшить шрифт",
  increaseLabel = "Увеличить шрифт",
}: FontSizeTogglerProps) {
  const [fontSizePx, setFontSizePx] = useState(DEFAULT_PX);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = readStoredFontSize();
    setFontSizePx(initial);
    applyRootFontSize(initial);
    setMounted(true);
  }, []);

  function updateSize(next: number) {
    const clamped = clampFontSize(next);
    setFontSizePx(clamped);
    applyRootFontSize(clamped);
    localStorage.setItem(STORAGE_KEY, String(clamped));
  }

  if (!mounted) {
    return (
      <div
        className={cn("flex items-center gap-0.5", className)}
        aria-hidden
      >
        <Button type="button" variant="ghost" size="sm" className="h-9 px-2" disabled>
          A-
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-9 px-2" disabled>
          A+
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="group"
      aria-label="Размер шрифта"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 min-w-9 px-2 font-semibold"
        aria-label={decreaseLabel}
        disabled={fontSizePx <= MIN_PX}
        onClick={() => updateSize(fontSizePx - STEP_PX)}
      >
        A-
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 min-w-9 px-2 font-semibold"
        aria-label={increaseLabel}
        disabled={fontSizePx >= MAX_PX}
        onClick={() => updateSize(fontSizePx + STEP_PX)}
      >
        A+
      </Button>
    </div>
  );
}
