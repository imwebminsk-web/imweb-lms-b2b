"use client";

import { cn } from "@/lib/utils";

import { PUZZLE_VIEW_H, PUZZLE_VIEW_W } from "./puzzle-svg-constants";

export {
  PUZZLE_ASSEMBLY_OVERLAP,
  PUZZLE_BODY_LEFT,
  PUZZLE_BODY_RIGHT,
  PUZZLE_TAB_DEPTH,
  PUZZLE_VIEW_H,
  PUZZLE_VIEW_W,
} from "./puzzle-svg-constants";

/** Шип: тело до 280, дуга r=20 выступает вправо до x≈320. */
const PUZZLE_LEFT_PATH_D =
  "M 0 0 L 280 0 L 280 35 C 285 35 290 30 300 30 A 20 20 0 0 1 300 70 C 290 70 285 65 280 65 L 280 100 L 0 100 Z";

/** Впадина: зеркально к шипу, sweep-flag=0, вырез к x≈80. */
const PUZZLE_RIGHT_PATH_D =
  "M 40 0 L 320 0 L 320 100 L 40 100 L 40 65 C 45 65 50 70 60 70 A 20 20 0 0 0 60 30 C 50 30 45 35 40 35 Z";

export type PuzzleVisualVariant = "card" | "assembly";

function PuzzleSvgShell({
  d,
  className,
  variant = "card",
  highlight = false,
  "aria-hidden": ariaHidden = true,
}: {
  d: string;
  className?: string;
  variant?: PuzzleVisualVariant;
  highlight?: boolean;
  "aria-hidden"?: boolean;
}) {
  const isAssembly = variant === "assembly";

  return (
    <svg
      className={cn(
        "block h-full w-full text-slate-400 dark:text-slate-500",
        className,
      )}
      viewBox={`0 0 ${PUZZLE_VIEW_W} ${PUZZLE_VIEW_H}`}
      preserveAspectRatio="none"
      aria-hidden={ariaHidden}
    >
      <path
        d={d}
        fill={highlight ? undefined : "var(--card)"}
        stroke="currentColor"
        strokeOpacity={isAssembly ? 0.08 : 0.25}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        className={cn(
          highlight && "fill-[#fef9c3] dark:fill-yellow-900/35",
        )}
      />
    </svg>
  );
}

export function PuzzleLeftBackground({
  className,
  variant = "card",
  highlight = false,
  "aria-hidden": ariaHidden = true,
}: {
  className?: string;
  variant?: PuzzleVisualVariant;
  highlight?: boolean;
  "aria-hidden"?: boolean;
}) {
  return (
    <PuzzleSvgShell
      d={PUZZLE_LEFT_PATH_D}
      className={className}
      variant={variant}
      highlight={highlight}
      aria-hidden={ariaHidden}
    />
  );
}

export function PuzzleRightBackground({
  className,
  variant = "card",
  highlight = false,
  "aria-hidden": ariaHidden = true,
}: {
  className?: string;
  variant?: PuzzleVisualVariant;
  highlight?: boolean;
  "aria-hidden"?: boolean;
}) {
  return (
    <PuzzleSvgShell
      d={PUZZLE_RIGHT_PATH_D}
      className={className}
      variant={variant}
      highlight={highlight}
      aria-hidden={ariaHidden}
    />
  );
}
