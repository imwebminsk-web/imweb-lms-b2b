/**
 * Приводит `grade` из `assignment_submissions` к шкале 0–100.
 * Новые записи: 0–100; legacy 0–10 умножается на 10.
 */
export function normalizeStoredAssignmentPoints(
  grade: number | null,
): number | null {
  if (grade == null) return null;
  const n = Number(grade);
  if (!Number.isFinite(n)) return null;
  if (Number.isInteger(n) && n >= 0 && n <= 10) {
    return Math.min(100, Math.max(0, n * 10));
  }
  if (n >= 0 && n <= 100) {
    return Math.round(n);
  }
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** @deprecated Используйте `normalizeStoredAssignmentPoints`. */
export function normalizeStoredGradeToGrade10(
  grade: number | null,
): number | null {
  const points = normalizeStoredAssignmentPoints(grade);
  if (points == null) return null;
  return Math.round(points / 10);
}
