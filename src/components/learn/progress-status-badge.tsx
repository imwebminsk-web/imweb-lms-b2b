"use client";

import type { StudentProgressItem } from "@/app/actions/student-dashboard-actions";
import {
  isPendingStatus,
  isRejectedStatus,
  PROGRESS_STATUS_VISUAL,
} from "@/components/dashboard/gradebook/progress-status-visuals";
import { useLanguage } from "@/components/providers/language-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Статусы тестов и заданий в таблице успеваемости: те же иконки и цвета, что в MatrixCell.
 */
export function ProgressStatusBadge({ item }: { item: StudentProgressItem }) {
  const { t } = useLanguage();

  if (isPendingStatus(item.status)) {
    const { Icon, className } = PROGRESS_STATUS_VISUAL.pending;
    return (
      <Badge
        variant="outline"
        className={cn("border-amber-500/40 bg-amber-500/10", className)}
      >
        <Icon aria-hidden />
        {t("lesson_view.statusPending")}
      </Badge>
    );
  }

  if (item.status === "in_progress") {
    const { Icon, className } = PROGRESS_STATUS_VISUAL.in_progress;
    return (
      <Badge
        variant="outline"
        className={cn("border-blue-500/40 bg-blue-500/10", className)}
      >
        <Icon aria-hidden />
        {t("lesson_view.statusTestInProgress")}
      </Badge>
    );
  }

  if (isRejectedStatus(item.status)) {
    const { Icon, className } = PROGRESS_STATUS_VISUAL.rejected;
    return (
      <Badge
        variant="outline"
        className={cn("border-destructive/40 bg-destructive/10", className)}
      >
        <Icon aria-hidden />
        {t("lesson_view.statusAssignmentRejected")}
      </Badge>
    );
  }

  if (item.type === "test") {
    switch (item.status) {
      case "completed":
        return (
          <Badge variant="secondary">{t("lesson_view.statusTestCompleted")}</Badge>
        );
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
    default:
      return (
        <Badge variant="secondary">
          {t("lesson_view.statusAssignmentNotStarted")}
        </Badge>
      );
  }
}
