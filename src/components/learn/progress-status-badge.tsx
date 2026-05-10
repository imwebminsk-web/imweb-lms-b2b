import type { StudentProgressItem } from "@/app/actions/student-dashboard-actions";
import { Badge } from "@/components/ui/badge";

/**
 * Статусы тестов и заданий в таблице успеваемости: разные наборы значений и подписи.
 */
export function ProgressStatusBadge({ item }: { item: StudentProgressItem }) {
  if (item.type === "test") {
    switch (item.status) {
      case "completed":
        return <Badge variant="secondary">Завершён</Badge>;
      case "in_progress":
        return <Badge variant="outline">В процессе</Badge>;
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Не начат
          </Badge>
        );
    }
  }

  switch (item.status) {
    case "approved":
      return <Badge variant="default">Принято</Badge>;
    case "rejected":
      return <Badge variant="destructive">На доработке</Badge>;
    case "pending":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
        >
          На проверке
        </Badge>
      );
    default:
      return <Badge variant="secondary">Не начато</Badge>;
  }
}
