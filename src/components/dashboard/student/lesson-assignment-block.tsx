"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitAssignment } from "@/app/actions/assignment-actions";
import type { AssignmentSubmissionRow } from "@/app/actions/assignment-actions";
import { AssignmentSheetLayout } from "@/components/dashboard/assignment-sheet-layout";
import type { PlayerBlockRow } from "@/components/learn/lesson-block-renderer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Json } from "@/types/database.types";

function readInstructions(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const c = content as Record<string, unknown>;
  return typeof c.instructions === "string" ? c.instructions.trim() : "";
}

type LessonAssignmentBlockProps = {
  block: PlayerBlockRow;
  initialSubmission: AssignmentSubmissionRow | null;
  lessonTitle: string;
};

export function LessonAssignmentBlock({
  block,
  initialSubmission,
  lessonTitle,
}: LessonAssignmentBlockProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [submission, setSubmission] = useState<AssignmentSubmissionRow | null>(
    initialSubmission,
  );

  useEffect(() => {
    setSubmission(initialSubmission);
  }, [initialSubmission]);

  const instructions = readInstructions(block.content);

  const handleSubmit = useCallback(() => {
    const text = draft.trim();
    if (!text) {
      toast.error("Введите ответ перед отправкой");
      return;
    }

    startTransition(async () => {
      try {
        await submitAssignment(block.id, text, pathname);
        toast.success(
          submission?.status === "rejected"
            ? "Ответ отправлен повторно"
            : "Ответ отправлен на проверку",
        );
        setDraft("");
        router.refresh();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Не удалось отправить задание";
        toast.error(message);
      }
    });
  }, [block.id, draft, pathname, router, submission?.status]);

  const hasReviewableSubmission =
    submission &&
    (submission.status === "pending" ||
      submission.status === "approved" ||
      submission.status === "rejected");

  return (
    <section className="space-y-6 rounded-xl border border-border bg-card/40 p-4">
      {hasReviewableSubmission ? (
        <AssignmentSheetLayout
          isTeacher={false}
          lessonTitle={lessonTitle}
          assignmentText={instructions}
          studentAnswer={submission.content}
          status={submission.status}
          storedGrade={submission.grade}
          teacherComment={submission.teacher_comment}
        />
      ) : (
        <>
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Задание
          </h3>
          {instructions ? (
            <div className="text-muted-foreground rounded-md bg-muted p-4 text-sm leading-relaxed">
              <p className="whitespace-pre-wrap">{instructions}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Задание без текста.</p>
          )}
        </>
      )}

      {submission?.status === "pending" ? (
        <Alert variant="warning">
          <AlertTitle>Ответ на проверке</AlertTitle>
          <AlertDescription>
            Преподаватель ещё не проверил вашу работу. Редактирование недоступно.
          </AlertDescription>
        </Alert>
      ) : null}

      {submission?.status === "rejected" ? (
        <>
          <Alert variant="destructive">
            <AlertTitle>Нужна доработка</AlertTitle>
            <AlertDescription>
              Комментарий преподавателя указан в сводке выше. Исправьте ответ и
              отправьте снова.
            </AlertDescription>
          </Alert>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ваш ответ или ссылки на работу…"
            rows={6}
            disabled={isPending}
            aria-label="Ответ на задание"
          />
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !draft.trim()}
          >
            {isPending ? "Отправка…" : "Отправить на проверку"}
          </Button>
        </>
      ) : null}

      {!submission ? (
        <>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ваш ответ или ссылки на работу…"
            rows={6}
            disabled={isPending}
            aria-label="Ответ на задание"
          />
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !draft.trim()}
          >
            {isPending ? "Отправка…" : "Отправить на проверку"}
          </Button>
        </>
      ) : null}
    </section>
  );
}
