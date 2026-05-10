/**
 * Приводит значение `grade` из БД к отображению по шкале 0–10
 * (новые записи 0–10, старые 0–100 → доля от 10).
 */
export function normalizeStoredGradeToGrade10(
  grade: number | null,
): number | null {
  if (grade == null) return null;
  const n = Number(grade);
  if (!Number.isFinite(n)) return null;
  if (Number.isInteger(n) && n >= 0 && n <= 10) return n;
  if (n > 10 && n <= 100) {
    return Math.min(10, Math.max(0, Math.round((n / 100) * 10)));
  }
  return Math.min(10, Math.max(0, Math.round(n)));
}
