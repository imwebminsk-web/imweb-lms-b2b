"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { toggleLessonCompletion } from "@/app/actions/lesson-completion-actions";
import {
  isLessonCompletionBlocked,
  type LessonCompletionGate,
} from "@/lib/learn/lesson-final-test-gate";
import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LessonCompletionButtonProps = {
  lessonId: string;
  initialGate: LessonCompletionGate;
  pathname: string;
};

export function LessonCompletionButton({
  lessonId,
  initialGate,
  pathname,
}: LessonCompletionButtonProps) {
  const { t } = useLanguage();
  const [gate, setGate] = useState<LessonCompletionGate>(initialGate);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setGate(initialGate);
  }, [initialGate]);

  const isBlocked = isLessonCompletionBlocked(gate.state);
  const isCompleted = gate.state === "completed";

  function handleClick() {
    if (isBlocked) return;

    const previous = gate;
    const next: LessonCompletionGate = isCompleted
      ? { state: "ready" }
      : { state: "completed" };
    setGate(next);
    startTransition(async () => {
      const res = await toggleLessonCompletion(lessonId, pathname);
      if (!res.ok) {
        setGate(previous);
        toast.error(res.error);
        console.error("[LessonCompletionButton]", res.error);
      }
    });
  }

  const label = isPending
    ? t("lesson_view.saving")
    : gate.state === "completed"
      ? t("lesson_view.lessonCompleted")
      : gate.state === "blocked_not_passed"
        ? t("lesson_view.completeBlockedPassFinal")
        : gate.state === "blocked_pending_review"
          ? t("lesson_view.completeBlockedPendingReview")
          : gate.state === "blocked_assignment_not_submitted"
            ? t("lesson_view.completeBlockedAssignmentNotSubmitted")
            : gate.state === "blocked_assignment_rejected"
              ? t("lesson_view.completeBlockedAssignmentRejected")
              : t("lesson_view.markComplete");

  return (
    <Button
      type="button"
      variant={isCompleted ? "outline" : "default"}
      onClick={handleClick}
      disabled={isPending || isBlocked}
      className={cn("w-full sm:w-auto")}
    >
      {label}
    </Button>
  );
}
