"use client";

import type { StudentProgressItem } from "@/app/actions/student-dashboard-actions";
import { useLanguage } from "@/components/providers/language-provider";
import { Badge } from "@/components/ui/badge";

/**
 * Статусы тестов и заданий в таблице успеваемости: разные наборы значений и подписи.
 */
export function ProgressStatusBadge({ item }: { item: StudentProgressItem }) {
  const { t } = useLanguage();

  if (item.type === "test") {
    switch (item.status) {
      case "completed":
        return <Badge variant="secondary">{t("lesson_view.statusTestCompleted")}</Badge>;
      case "in_progress":
        return <Badge variant="outline">{t("lesson_view.statusTestInProgress")}</Badge>;
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            {t("lesson_view.statusTestNotStarted")}
          </Badge>
        );
    }
  }

  switch (item.status) {
    case "approved":
      return <Badge variant="default">{t("lesson_view.statusApproved")}</Badge>;
    case "rejected":
      return (
        <Badge variant="destructive">
          {t("lesson_view.statusAssignmentRejected")}
        </Badge>
      );
    case "pending":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
        >
          {t("lesson_view.statusPending")}
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">{t("lesson_view.statusAssignmentNotStarted")}</Badge>
      );
  }
}
