"use client";

import { Loader2Icon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  getSubmissionForReview,
  reviewSubmission,
  type SubmissionForReviewPayload,
} from "@/app/actions/assignment-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type AssignmentReviewSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  studentName: string;
  assignmentTitle: string;
};

function parseOptionalGrade(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return Number.NaN;
  }
  return n;
}

export function AssignmentReviewSheet({
  isOpen,
  onOpenChange,
  submissionId,
  studentName,
  assignmentTitle,
}: AssignmentReviewSheetProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadPending, setLoadPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payload, setPayload] = useState<SubmissionForReviewPayload | null>(
    null,
  );
  const [gradeInput, setGradeInput] = useState("");
  const [commentInput, setCommentInput] = useState("");

  const resetAndFetch = useCallback(() => {
    if (!isOpen || !submissionId) {
      setPayload(null);
      setLoadError(null);
      setGradeInput("");
      setCommentInput("");
      return;
    }

    setLoadPending(true);
    setLoadError(null);
    setPayload(null);

    void (async () => {
      const res = await getSubmissionForReview(submissionId);
      setLoadPending(false);
      if (!res.success) {
        setLoadError(res.error);
        return;
      }
      setPayload(res.data);
      const g = res.data.submission.grade;
      setGradeInput(g == null ? "" : String(g));
      setCommentInput(res.data.submission.teacher_comment ?? "");
    })();
  }, [isOpen, submissionId]);

  useEffect(() => {
    resetAndFetch();
  }, [resetAndFetch]);

  function runReview(status: "approved" | "rejected") {
    if (!submissionId) return;

    const gradeParsed = parseOptionalGrade(gradeInput);
    if (status === "approved" && gradeParsed !== null && Number.isNaN(gradeParsed)) {
      toast.error("Введите целую оценку от 0 до 100 или оставьте поле пустым");
      return;
    }
    if (
      status === "approved" &&
      gradeParsed != null &&
      !Number.isNaN(gradeParsed) &&
      (gradeParsed < 0 || gradeParsed > 100)
    ) {
      toast.error("Оценка должна быть от 0 до 100");
      return;
    }

    const gradeForApi =
      status === "approved" && gradeParsed != null && !Number.isNaN(gradeParsed)
        ? gradeParsed
        : null;

    startTransition(() => {
      void (async () => {
        const res = await reviewSubmission(
          submissionId,
          status,
          gradeForApi,
          commentInput.trim() || null,
          pathname,
        );
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        toast.success(
          status === "approved" ? "Задание принято" : "Возвращено на доработку",
        );
        onOpenChange(false);
        router.refresh();
      })();
    });
  }

  const submission = payload?.submission;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader className="border-border shrink-0 border-b pb-4 text-left">
          <SheetTitle className="pr-8">Проверка задания</SheetTitle>
          <SheetDescription>
            Ученик: <span className="text-foreground font-medium">{studentName}</span>
            <br />
            <span className="text-foreground/90">{assignmentTitle}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 p-4">
          {loadPending ? (
            <div className="text-muted-foreground flex items-center gap-2 py-6">
              <Loader2Icon className="size-5 animate-spin" aria-hidden />
              <span>Загрузка…</span>
            </div>
          ) : null}

          {loadError ? (
            <p className="text-destructive text-sm">{loadError}</p>
          ) : null}

          {payload && submission ? (
            <>
              <section className="space-y-2" aria-labelledby="instr-heading">
                <h3
                  id="instr-heading"
                  className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
                >
                  Инструкция к заданию
                </h3>
                <div className="border-border bg-muted/30 rounded-lg border p-3 text-sm leading-relaxed">
                  {payload.instructions ? (
                    <p className="whitespace-pre-wrap">{payload.instructions}</p>
                  ) : (
                    <p className="text-muted-foreground">Текст инструкции не задан.</p>
                  )}
                </div>
              </section>

              <Separator />

              <section className="space-y-2" aria-labelledby="answer-heading">
                <h3
                  id="answer-heading"
                  className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
                >
                  Ответ ученика
                </h3>
                <div className="border-border bg-card rounded-lg border p-3">
                  <pre className="font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">
                    {submission.content}
                  </pre>
                </div>
              </section>

              <Separator />

              <section className="space-y-4" aria-labelledby="review-heading">
                <h3
                  id="review-heading"
                  className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
                >
                  Ваша оценка и комментарий
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="teacher-grade">Оценка (0–100, необязательно)</Label>
                  <Input
                    id="teacher-grade"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    inputMode="numeric"
                    value={gradeInput}
                    onChange={(e) => setGradeInput(e.target.value)}
                    disabled={isPending}
                    className="max-w-[120px]"
                    aria-describedby="teacher-grade-hint"
                  />
                  <p id="teacher-grade-hint" className="text-muted-foreground text-xs">
                    Учитывается при принятии задания. При возврате на доработку оценка
                    сбрасывается.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teacher-comment">Комментарий преподавателя</Label>
                  <Textarea
                    id="teacher-comment"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    disabled={isPending}
                    rows={4}
                    placeholder="Замечания, похвала или причина возврата…"
                    className="resize-y"
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    disabled={isPending}
                    onClick={() => runReview("approved")}
                    className="border-emerald-600/30 bg-emerald-600 text-white hover:bg-emerald-600/90 dark:border-emerald-500/40 dark:bg-emerald-600 dark:hover:bg-emerald-600/90"
                  >
                    {isPending ? "Сохранение…" : "Принять задание"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => runReview("rejected")}
                  >
                    Вернуть на доработку
                  </Button>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
