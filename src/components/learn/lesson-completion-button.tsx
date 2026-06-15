"use client";

import { useEffect, useState, useTransition } from "react";

import { toggleLessonCompletion } from "@/app/actions/lesson-completion-actions";
import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LessonCompletionButtonProps = {
  lessonId: string;
  initialIsCompleted: boolean;
  pathname: string;
};

export function LessonCompletionButton({
  lessonId,
  initialIsCompleted,
  pathname,
}: LessonCompletionButtonProps) {
  const { t } = useLanguage();
  const [isCompleted, setIsCompleted] = useState(initialIsCompleted);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setIsCompleted(initialIsCompleted);
  }, [initialIsCompleted]);

  function handleClick() {
    const previous = isCompleted;
    const next = !previous;
    setIsCompleted(next);
    startTransition(async () => {
      const res = await toggleLessonCompletion(lessonId, pathname);
      if (!res.ok) {
        setIsCompleted(previous);
        console.error("[LessonCompletionButton]", res.error);
      }
    });
  }

  return (
    <Button
      type="button"
      variant={isCompleted ? "outline" : "default"}
      onClick={handleClick}
      disabled={isPending}
      className={cn("w-full sm:w-auto")}
    >
      {isPending
        ? t("lesson_view.saving")
        : isCompleted
          ? t("lesson_view.lessonCompleted")
          : t("lesson_view.markComplete")}
    </Button>
  );
}
