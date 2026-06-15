"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitAssignment } from "@/app/actions/assignment-actions";
import type { AssignmentSubmissionRow } from "@/app/actions/assignment-actions";
import { AssignmentSheetLayout } from "@/components/dashboard/assignment-sheet-layout";
import type { PlayerBlockRow } from "@/components/learn/lesson-block-renderer";
import { useLanguage } from "@/components/providers/language-provider";
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
  const { t } = useLanguage();
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
      toast.error(t("lesson_view.enterAnswerBeforeSubmit"));
      return;
    }

    startTransition(async () => {
      try {
        await submitAssignment(block.id, text, pathname);
        toast.success(
          submission?.status === "rejected"
            ? t("lesson_view.answerResubmitted")
            : t("lesson_view.answerSubmitted"),
        );
        setDraft("");
        router.refresh();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : t("lesson_view.submitFailed");
        toast.error(message);
      }
    });
  }, [block.id, draft, pathname, router, submission?.status, t]);

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
            {t("lesson_view.lessonAssignments")}
          </h3>
          {instructions ? (
            <div className="text-muted-foreground rounded-md bg-muted p-4 text-sm leading-relaxed">
              <p className="whitespace-pre-wrap">{instructions}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("lesson_view.assignmentNoText")}
            </p>
          )}
        </>
      )}

      {submission?.status === "pending" ? (
        <Alert variant="warning">
          <AlertTitle>{t("lesson_view.pendingReview")}</AlertTitle>
          <AlertDescription>
            {t("lesson_view.pendingReviewDescription")}
          </AlertDescription>
        </Alert>
      ) : null}

      {submission?.status === "rejected" ? (
        <>
          <Alert variant="destructive">
            <AlertTitle>{t("lesson_view.needsRevision")}</AlertTitle>
            <AlertDescription>
              {t("lesson_view.needsRevisionDescription")}
            </AlertDescription>
          </Alert>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("lesson_view.answerPlaceholder")}
            rows={6}
            disabled={isPending}
            aria-label={t("lesson_view.answerAriaLabel")}
          />
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !draft.trim()}
          >
            {isPending ? t("lesson_view.submitting") : t("lesson_view.submitForReview")}
          </Button>
        </>
      ) : null}

      {!submission ? (
        <>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("lesson_view.answerPlaceholder")}
            rows={6}
            disabled={isPending}
            aria-label={t("lesson_view.answerAriaLabel")}
          />
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !draft.trim()}
          >
            {isPending ? t("lesson_view.submitting") : t("lesson_view.submitForReview")}
          </Button>
        </>
      ) : null}
    </section>
  );
}
