import { CheckCircle2, Clock, Inbox, XCircle, type LucideIcon } from "lucide-react";

/** Тест на проверке в БД — `pending_review`, в журнале — `pending`. */
export function isPendingStatus(status: string): boolean {
  return status === "pending" || status === "pending_review";
}

/** Задание отклонено: в журнале — `rejected`, в экспорте иногда — `needs_revision`. */
export function isRejectedStatus(status: string): boolean {
  return status === "rejected" || status === "needs_revision";
}

export const PROGRESS_STATUS_VISUAL: Record<
  "pending" | "in_progress" | "rejected" | "approved_pass",
  { Icon: LucideIcon; className: string; label: string }
> = {
  pending: {
    Icon: Inbox,
    className: "text-amber-600 dark:text-amber-500",
    label: "На проверке",
  },
  in_progress: {
    Icon: Clock,
    className: "text-blue-600 dark:text-blue-500",
    label: "В процессе",
  },
  rejected: {
    Icon: XCircle,
    className: "text-destructive",
    label: "На пересдаче",
  },
  approved_pass: {
    Icon: CheckCircle2,
    className: "text-emerald-600 dark:text-emerald-500",
    label: "Зачёт (без оценки)",
  },
};

/** Четыре диапазона оценки 0–100%. Цвета совпадают с `getGradeColor`. */
export const GRADE_COLOR_BANDS = [
  {
    label: "Отлично",
    range: "90–100%",
    className: "text-emerald-600 dark:text-emerald-500",
  },
  {
    label: "Хорошо",
    range: "75–89%",
    className: "text-lime-600 dark:text-lime-500",
  },
  {
    label: "Удовлетворительно",
    range: "50–74%",
    className: "text-orange-500 dark:text-orange-400",
  },
  {
    label: "Неуд",
    range: "< 50%",
    className: "text-red-600 dark:text-red-500",
  },
] as const;

/** Цвет процента в журнале: 90+ / 75+ / 50+ / ниже 50. */
export function getGradeColor(points: number): string {
  if (points >= 90) return GRADE_COLOR_BANDS[0].className;
  if (points >= 75) return GRADE_COLOR_BANDS[1].className;
  if (points >= 50) return GRADE_COLOR_BANDS[2].className;
  return GRADE_COLOR_BANDS[3].className;
}

export type GradebookCellVisual =
  | { kind: "empty" }
  | { kind: "status"; key: keyof typeof PROGRESS_STATUS_VISUAL }
  | { kind: "points"; points: number };

/**
 * Общая развилка ячейки журнала (матрица и колонка «Баллы»).
 * Порядок как в MatrixCell: статус без баллов важнее числа.
 */
export function resolveGradebookCellVisual(
  status: string | null | undefined,
  points: number | null,
): GradebookCellVisual {
  const s = status ?? "not_started";

  if (s === "not_started") {
    return { kind: "empty" };
  }

  if (isPendingStatus(s)) {
    return { kind: "status", key: "pending" };
  }

  if (s === "in_progress" && points == null) {
    return { kind: "status", key: "in_progress" };
  }

  if (isRejectedStatus(s) && points == null) {
    return { kind: "status", key: "rejected" };
  }

  if ((s === "approved" || s === "completed") && points == null) {
    return { kind: "status", key: "approved_pass" };
  }

  if (points != null) {
    return { kind: "points", points };
  }

  return { kind: "empty" };
}

/**
 * Шторку журнала открываем только если есть результат или сдача на проверке.
 * «Не приступал» и «В процессе» без баллов — нет: пустая шторка не нужна.
 */
export function isGradebookDrawerOpenable(
  status: string | null | undefined,
  points: number | null,
): boolean {
  if (status == null || status === "not_started") {
    return false;
  }
  if (status === "in_progress" && points == null) {
    return false;
  }
  return (
    status === "completed" ||
    status === "approved" ||
    isPendingStatus(status) ||
    isRejectedStatus(status)
  );
}
