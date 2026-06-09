type SiteHeaderProps = {
  /** Имя из `profiles.full_name` (или запасной вариант на странице). */
  fullName: string
}

/**
 * Заголовок страницы дашборда заменён на `DashboardTopnav` в layout.
 * Компонент оставлен для совместимости с существующими страницами.
 */
export function SiteHeader(_props: SiteHeaderProps) {
  return null;
}
