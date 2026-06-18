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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { normalizeStoredAssignmentPoints } from "@/lib/learn/assignment-grade-display";

export type AssignmentReviewSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  isTeacher: boolean;
} & (
  | { fetchMode: "submissionId"; submissionId: string }
  | { fetchMode: "lessonBlock"; lessonBlockId: string; studentId: string }
);

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
  const { isOpen, onOpenChange, studentName, isTeacher } = props;

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
        router.refresh();
      })();
    });
  }

  const submission = payload?.submission ?? null;
  const displayStatus = submissionStatusToDisplay(submission?.status);
  const studentAnswer =
    submission?.content?.trim() ? submission.content : "—";
  const allowReview = submission != null && isTeacher;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader className="border-border shrink-0 border-b pb-4 text-left">
          <SheetTitle className="pr-8">Задание</SheetTitle>
          <SheetDescription>
            Ученик: <span className="text-foreground font-medium">{studentName}</span>
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

          {payload && !loadPending && !loadError ? (
            isTeacher ? (
              <AssignmentSheetLayout
                isTeacher
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
      </SheetContent>
    </Sheet>
  );
}
