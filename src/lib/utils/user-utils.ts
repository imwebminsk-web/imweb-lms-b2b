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

/** Инициалы для AvatarFallback (1–2 буквы из имени). */
export function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
