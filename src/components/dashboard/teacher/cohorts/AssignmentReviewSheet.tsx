"use client";

import { Loader2Icon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  getSubmissionForReview,
  getSubmissionForReviewByLessonBlock,
  reviewSubmission,
  type AssignmentSheetPayload,
} from "@/app/actions/assignment-actions";
import {
  AssignmentSheetLayout,
  type AssignmentSheetDisplayStatus,
} from "@/components/dashboard/assignment-sheet-layout";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { normalizeStoredAssignmentPoints } from "@/lib/learn/assignment-grade-display";
import { initialsFromDisplayName } from "@/lib/utils/user-utils";

export type AssignmentReviewSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  studentAvatarUrl?: string | null;
  isTeacher: boolean;
} & (
  | { fetchMode: "submissionId"; submissionId: string }
  | { fetchMode: "lessonBlock"; lessonBlockId: string; studentId: string }
);

function parseCohortJournalUrlFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/cohorts\/([0-9a-f-]{36})(?:\/|$)/i);
  if (!match) {
    return null;
  }
  return `/dashboard/cohorts/${match[1]}?tab=journal`;
}

function resolvePostReviewRedirectUrl(
  pathname: string,
  cohortId: string | null,
): string | null {
  const fromPathname = parseCohortJournalUrlFromPathname(pathname);
  if (fromPathname) {
    return fromPathname;
  }
  if (cohortId) {
    return `/dashboard/cohorts/${cohortId}?tab=journal`;
  }
  return null;
}

function parseOptionalGrade(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return Number.NaN;
  }
  return n;
}

function submissionStatusToDisplay(
  status: string | null | undefined,
): AssignmentSheetDisplayStatus {
  if (status === "pending" || status === "approved" || status === "rejected") {
    return status;
  }
  return "not_started";
}

export function AssignmentReviewSheet(props: AssignmentReviewSheetProps) {
  const {
    isOpen,
    onOpenChange,
    studentName,
    studentAvatarUrl = null,
    isTeacher,
  } = props;

  const submissionIdArg =
    props.fetchMode === "submissionId" ? props.submissionId : null;
  const lessonBlockIdArg =
    props.fetchMode === "lessonBlock" ? props.lessonBlockId : null;
  const studentIdArg =
    props.fetchMode === "lessonBlock" ? props.studentId : null;

  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadPending, setLoadPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payload, setPayload] = useState<AssignmentSheetPayload | null>(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(
    null,
  );
  const [gradeInput, setGradeInput] = useState("");
  const [commentInput, setCommentInput] = useState("");

  const resetAndFetch = useCallback(() => {
    if (!isOpen) {
      setPayload(null);
      setLoadError(null);
      setGradeInput("");
      setCommentInput("");
      setActiveSubmissionId(null);
      return;
    }

    if (props.fetchMode === "submissionId" && !submissionIdArg) {
      return;
    }
    if (
      props.fetchMode === "lessonBlock" &&
      (!lessonBlockIdArg || !studentIdArg)
    ) {
      return;
    }

    setLoadPending(true);
    setLoadError(null);
    setPayload(null);
    setActiveSubmissionId(null);

    void (async () => {
      const res =
        props.fetchMode === "submissionId"
          ? await getSubmissionForReview(submissionIdArg!)
          : await getSubmissionForReviewByLessonBlock(
              lessonBlockIdArg!,
              studentIdArg!,
            );

      setLoadPending(false);
      if (!res.success) {
        setLoadError(res.error);
        return;
      }
      setPayload(res.data);
      const sub = res.data.submission;
      setActiveSubmissionId(sub?.id ?? null);
      if (sub) {
        const normalized = normalizeStoredAssignmentPoints(sub.grade);
        setGradeInput(
          normalized != null
            ? String(normalized)
            : sub.grade != null
              ? String(sub.grade)
              : "",
        );
        setCommentInput(sub.teacher_comment ?? "");
      } else {
        setGradeInput("");
        setCommentInput("");
      }
    })();
  }, [
    isOpen,
    props.fetchMode,
    submissionIdArg,
    lessonBlockIdArg,
    studentIdArg,
  ]);

  useEffect(() => {
    resetAndFetch();
  }, [resetAndFetch]);

  function runReview(status: "approved" | "rejected") {
    if (!activeSubmissionId) {
      toast.error("Нет сдачи для изменения статуса");
      return;
    }

    const gradeParsed = parseOptionalGrade(gradeInput);
    if (status === "approved" && gradeParsed !== null && Number.isNaN(gradeParsed)) {
      toast.error("Введите целый балл от 0 до 100 или оставьте поле пустым");
      return;
    }
    if (
      status === "approved" &&
      gradeParsed != null &&
      !Number.isNaN(gradeParsed) &&
      (gradeParsed < 0 || gradeParsed > 100)
    ) {
      toast.error("Балл должен быть от 0 до 100");
      return;
    }

    const gradeForApi =
      status === "approved" && gradeParsed != null && !Number.isNaN(gradeParsed)
        ? gradeParsed
        : null;

    startTransition(() => {
      void (async () => {
        const res = await reviewSubmission(
          activeSubmissionId,
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
        const redirectUrl = resolvePostReviewRedirectUrl(pathname, res.cohortId);
        if (redirectUrl) {
          router.push(redirectUrl);
          return;
        }
        router.refresh();
      })();
    });
  }

  const submission = payload?.submission ?? null;
  const displayStatus = submissionStatusToDisplay(submission?.status);
  const studentAnswer =
    submission?.content?.trim() ? submission.content : "—";
  const allowReview = submission != null && isTeacher;

  const sheetTitle = payload?.lessonTitle?.trim() || "Задание";

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full flex-col gap-0 p-0 !w-[95vw] !max-w-full sm:!w-[80vw] sm:!max-w-[800px]"
      >
        <SheetHeader className="shrink-0 border-b p-6 text-left">
          <SheetTitle className="pr-8">{sheetTitle}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage
                  src={studentAvatarUrl ?? undefined}
                  alt={studentName}
                />
                <AvatarFallback>
                  {initialsFromDisplayName(studentName)}
                </AvatarFallback>
              </Avatar>
              <span>Ученик: {studentName}</span>
              {payload ? (
                <AssignmentHeaderStatusBadge status={displayStatus} />
              ) : null}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loadPending ? (
            <div className="text-muted-foreground flex items-center gap-2 py-6">
              <Loader2Icon className="size-5 animate-spin" aria-hidden />
              <span>Загрузка…</span>
            </div>
          ) : null}

          {loadError ? (
            <p className="text-destructive text-sm">{loadError}</p>
          ) : null}

          {payload && !loadPending && !loadError ? (
            isTeacher ? (
              <AssignmentSheetLayout
                isTeacher
                hideTitle
                hideActions
                lessonTitle={payload.lessonTitle}
                assignmentText={payload.assignmentText}
                studentAnswer={studentAnswer}
                status={displayStatus}
                allowReview={allowReview}
                gradeInput={gradeInput}
                onGradeInputChange={setGradeInput}
                commentInput={commentInput}
                onCommentInputChange={setCommentInput}
                onApprove={() => runReview("approved")}
                onReject={() => runReview("rejected")}
                isPending={isPending}
              />
            ) : (
              <AssignmentSheetLayout
                isTeacher={false}
                hideTitle
                lessonTitle={payload.lessonTitle}
                assignmentText={payload.assignmentText}
                studentAnswer={studentAnswer}
                status={displayStatus}
                storedGrade={submission?.grade ?? null}
                teacherComment={submission?.teacher_comment ?? null}
              />
            )
          ) : null}
        </div>

        {allowReview && payload && !loadPending && !loadError ? (
          <SheetFooter className="mt-auto flex shrink-0 flex-col gap-4 border-t bg-background p-6 sm:flex-col sm:space-x-0">
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => runReview("rejected")}
              >
                Вернуть на доработку
              </Button>
              <Button
                type="button"
                variant="default"
                disabled={isPending}
                onClick={() => runReview("approved")}
              >
                {isPending ? "Сохранение…" : "Принять"}
              </Button>
            </div>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function AssignmentHeaderStatusBadge({
  status,
}: {
  status: AssignmentSheetDisplayStatus;
}) {
  if (status === "pending") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200"
      >
        На проверке
      </Badge>
    );
  }
  if (status === "approved") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
      >
        Принято
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
      >
        На доработке
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Не начато
    </Badge>
  );
}
