/**
 * Студенческое название теста: title_student → title_teacher → title (legacy).
 * В форме `tests.title` часто совпадает с названием для учителя.
 */
export function resolveStudentFacingTestTitle(
  row: {
    title: string;
    title_student?: string | null;
    title_teacher?: string | null;
  },
  fallback = "Тест",
): string {
  const studentTitle = row.title_student?.trim();
  if (studentTitle) {
    return studentTitle;
  }

  const teacherTitle = row.title_teacher?.trim() || row.title?.trim();
  return teacherTitle || fallback;
}
