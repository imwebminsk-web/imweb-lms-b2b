/**
 * Геометрия пазла: viewBox 320×100, фиксированная ширина в CSS w-[320px].
 */
export const PUZZLE_VIEW_W = 320;
export const PUZZLE_VIEW_H = 100;

export const PUZZLE_BODY_RIGHT = 280;
export const PUZZLE_BODY_LEFT = 40;
export const PUZZLE_TAB_DEPTH = 40;

/** Сдвиг правой половины: VIEW_W − BODY_RIGHT + BODY_LEFT = 80. */
export const PUZZLE_ASSEMBLY_OVERLAP =
  PUZZLE_VIEW_W - PUZZLE_BODY_RIGHT + PUZZLE_BODY_LEFT;
