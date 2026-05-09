"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitAssignment } from "@/app/actions/assignment-actions";
import type { AssignmentSubmissionRow } from "@/app/actions/assignment-actions";
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

function SubmittedAnswerReadonly({ content }: { content: string }) {
  return (
    <div className="border-border bg-muted/30 rounded-lg border p-3">
      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
        Ваш ответ
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
    </div>
  );
}

type LessonAssignmentBlockProps = {
  block: PlayerBlockRow;
  initialSubmission: AssignmentSubmissionRow | null;
};

export function LessonAssignmentBlock({
  block,
  initialSubmission,
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

  return (
    <section className="space-y-4 rounded-xl border bg-card/40 p-4">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Задание
      </h3>

      {instructions ? (
        <div className="prose dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap text-base leading-relaxed">
            {instructions}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Задание без текста.</p>
      )}

      {submission?.status === "pending" ? (
        <>
          <SubmittedAnswerReadonly content={submission.content} />
          <Alert variant="warning">
            <AlertTitle>Ответ на проверке</AlertTitle>
            <AlertDescription>
              Преподаватель ещё не проверил вашу работу. Редактирование
              недоступно.
            </AlertDescription>
          </Alert>
        </>
      ) : null}

      {submission?.status === "approved" ? (
        <>
          <SubmittedAnswerReadonly content={submission.content} />
          <Alert variant="success">
            <AlertTitle>Задание принято</AlertTitle>
            <AlertDescription className="text-emerald-950 dark:text-emerald-50 space-y-2">
              {submission.grade != null ? (
                <p>
                  <span className="font-medium">Оценка:</span> {submission.grade}
                </p>
              ) : null}
              {submission.teacher_comment ? (
                <p className="whitespace-pre-wrap">{submission.teacher_comment}</p>
              ) : null}
              {submission.grade == null && !submission.teacher_comment ? (
                <p>Работа зачтена.</p>
              ) : null}
            </AlertDescription>
          </Alert>
        </>
      ) : null}

      {submission?.status === "rejected" ? (
        <>
          <Alert variant="destructive">
            <AlertTitle>Задание возвращено на доработку</AlertTitle>
            <AlertDescription className="text-destructive whitespace-pre-wrap">
              {submission.teacher_comment?.trim()
                ? submission.teacher_comment
                : "Комментарий преподавателя не указан."}
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
