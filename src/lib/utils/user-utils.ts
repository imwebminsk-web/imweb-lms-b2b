/** Имя для UI: profiles.full_name → часть email до @ → UUID. */
export function resolveStudentDisplayName(
  fullName: string | null | undefined,
  email: string | null | undefined,
  userId: string,
): string {
  if (fullName?.trim()) return fullName.trim();
  if (email) return email.split("@")[0] ?? userId;
  return userId;
}
