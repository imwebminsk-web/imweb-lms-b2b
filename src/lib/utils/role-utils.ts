/**
 * Человекочитаемые названия ролей в зависимости от режима платформы.
 * school — учебный центр, corporate — корпоративное обучение.
 */
export function getRoleTranslation(role?: string | null): string {
  const mode = process.env.NEXT_PUBLIC_APP_MODE || "school";
  const isCorp = mode === "corporate";

  if (!role?.trim()) {
    return "Неизвестно";
  }

  switch (role) {
    case "admin":
      return "Администратор";
    case "head_teacher":
      return isCorp ? "Менеджер по обучению" : "Старший преподаватель";
    case "teacher":
      return isCorp ? "Тренер" : "Преподаватель";
    case "student":
      return isCorp ? "Сотрудник" : "Ученик";
    default:
      return role;
  }
}
