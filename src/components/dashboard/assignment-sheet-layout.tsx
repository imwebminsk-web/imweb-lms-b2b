"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/components/providers/language-provider";
import { normalizeStoredAssignmentPoints } from "@/lib/learn/assignment-grade-display";

export type AssignmentSheetDisplayStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "not_started";

function statusBadge(
  status: AssignmentSheetDisplayStatus,
  t: ReturnType<typeof useLanguage>["t"],
) {
  switch (status) {
    case "pending":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100"
        >
          {t("lesson_view.statusPending")}
        </Badge>
      );
    case "approved":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
        >
          {t("lesson_view.statusApproved")}
        </Badge>
      );
    case "rejected":
      return <Badge variant="destructive">{t("lesson_view.statusRejected")}</Badge>;
    case "not_started":
      return <Badge variant="secondary">{t("lesson_view.statusNotStarted")}</Badge>;
    default:
      return null;
  }
}

type AssignmentSheetLayoutBase = {
  lessonTitle: string;
  assignmentText: string;
  studentAnswer: string;
  status: AssignmentSheetDisplayStatus;
};

type AssignmentSheetLayoutTeacher = AssignmentSheetLayoutBase & {
  isTeacher: true;
  /** Есть сдача — можно принять / вернуть. */
  allowReview: boolean;
  gradeInput: string;
  onGradeInputChange: (value: string) => void;
  commentInput: string;
  onCommentInputChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
};

type AssignmentSheetLayoutStudent = AssignmentSheetLayoutBase & {
  isTeacher: false;
  /** Сырое значение из БД; для отображения нормализуется в 0–100. */
  storedGrade: number | null;
  teacherComment: string | null;
};

export type AssignmentSheetLayoutProps =
  | AssignmentSheetLayoutTeacher
  | AssignmentSheetLayoutStudent;

/**
 * Единая вёрстка блока задания (урок, формулировка, ответ, статус, оценка, комментарий).
 */
export function AssignmentSheetLayout(props: AssignmentSheetLayoutProps) {
  const { t } = useLanguage();
  const { lessonTitle, assignmentText, studentAnswer, status, isTeacher } =
    props;

  const pointsDisplay = isTeacher
    ? null
    : normalizeStoredAssignmentPoints(props.storedGrade);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{lessonTitle}</h3>
      </div>

      <section className="space-y-2">
        <p className="text-sm font-semibold">
          {isTeacher ? "Текст задания" : t("lesson_view.assignmentText")}
        </p>
        <div className="text-muted-foreground rounded-md bg-muted p-4 text-sm leading-relaxed">
          {assignmentText.trim() ? (
            <p className="whitespace-pre-wrap">{assignmentText}</p>
          ) : (
            <span className="italic">
              {isTeacher
                ? "Текст задания не указан."
                : t("lesson_view.assignmentTextMissing")}
            </span>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">
          {isTeacher ? "Ответ ученика" : t("lesson_view.studentAnswer")}
        </p>
        <div className="rounded-md border border-border bg-card p-4 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap break-words">{studentAnswer}</p>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">
          {isTeacher ? "Статус" : t("lesson_view.status")}
        </p>
        <div>{statusBadge(status, t)}</div>
      </section>

      {isTeacher ? (
        props.allowReview ? (
          <section className="border-border space-y-4 rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-semibold">Проверка</p>
            <div className="space-y-2">
              <Label htmlFor="sheet-grade-100" className="font-medium">
                Баллы (0–100, необязательно)
              </Label>
              <Input
                id="sheet-grade-100"
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                className="max-w-[120px]"
                value={props.gradeInput}
                onChange={(e) => props.onGradeInputChange(e.target.value)}
                disabled={props.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sheet-teacher-comment" className="font-medium">
                Комментарий преподавателя
              </Label>
              <Textarea
                id="sheet-teacher-comment"
                placeholder="Напишите комментарий…"
                rows={4}
                className="resize-y"
                value={props.commentInput}
                onChange={(e) => props.onCommentInputChange(e.target.value)}
                disabled={props.isPending}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                disabled={props.isPending}
                onClick={props.onApprove}
                className="border-emerald-600/30 bg-emerald-600 text-white hover:bg-emerald-600/90 dark:border-emerald-500/40 dark:bg-emerald-600 dark:hover:bg-emerald-600/90"
              >
                {props.isPending ? "Сохранение…" : "Принять"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={props.isPending}
                onClick={props.onReject}
              >
                Вернуть на доработку
              </Button>
            </div>
          </section>
        ) : (
          <p className="text-muted-foreground rounded-md border border-dashed bg-muted/20 p-4 text-sm">
            У ученика ещё нет отправленной сдачи по этому заданию. Проверка будет
            доступна после отправки ответа.
          </p>
        )
      ) : (
        <section className="space-y-3 rounded-md border bg-muted/15 p-4 text-sm">
          <p>
            <span className="font-semibold">{t("course_view.colPoints")}: </span>
            {pointsDisplay != null ? `${pointsDisplay}` : "—"}
          </p>
          <p>
            <span className="font-semibold">
              {t("lesson_view.teacherComment")}:{" "}
            </span>
            {props.teacherComment?.trim() ? (
              <span className="whitespace-pre-wrap">{props.teacherComment}</span>
            ) : (
              <span className="text-muted-foreground">{t("lesson_view.noComment")}</span>
            )}
          </p>
        </section>
      )}
    </div>
  );
}
