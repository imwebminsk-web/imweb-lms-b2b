"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import {
  getPendingReviews,
  type PendingReviewItem,
  type PendingReviewsFilter,
  type StaffFilterOption,
} from "@/app/actions/teacher-dashboard-actions";
import { AssignmentReviewSheet } from "@/components/dashboard/teacher/cohorts/AssignmentReviewSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PENDING_REVIEWS_PAGE_SIZE = 10;

function formatSubmittedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function pendingReviewKey(review: PendingReviewItem): string {
  return review.kind === "test"
    ? `test-${review.attemptId}`
    : `assignment-${review.submissionId}`;
}

function mergeUnique(
  current: PendingReviewItem[],
  incoming: PendingReviewItem[],
): PendingReviewItem[] {
  const seen = new Set(current.map(pendingReviewKey));
  const next = [...current];
  for (const item of incoming) {
    const key = pendingReviewKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next;
}

export function PendingReviewsWidget({
  initialReviews,
  initialHasMore,
  staffOptions = [],
  showStaffFilter = false,
}: {
  initialReviews: PendingReviewItem[];
  initialHasMore: boolean;
  staffOptions?: StaffFilterOption[];
  showStaffFilter?: boolean;
}) {
  const router = useRouter();
  const [isFetching, setIsFetching] = useState(false);
  const [filter, setFilter] = useState<PendingReviewsFilter>("mine");
  const [reviews, setReviews] = useState(initialReviews);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(
    null,
  );

  const selectedReview = reviews.find(
    (review) =>
      review.kind === "assignment" &&
      review.submissionId === selectedSubmissionId,
  );

  async function loadPage(
    nextFilter: PendingReviewsFilter,
    offset: number,
    append: boolean,
  ) {
    setIsFetching(true);
    setError(null);
    try {
      const res = await getPendingReviews(
        nextFilter,
        offset,
        PENDING_REVIEWS_PAGE_SIZE,
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      setHasMore(res.hasMore);
      setReviews((prev) => (append ? mergeUnique(prev, res.items) : res.items));
    } finally {
      setIsFetching(false);
    }
  }

  function handleFilterChange(value: string) {
    const nextFilter = value as PendingReviewsFilter;
    setFilter(nextFilter);
    setReviews([]);
    setHasMore(false);
    void loadPage(nextFilter, 0, false);
  }

  return (
    <section className="px-4 lg:px-6">
      <Card className="overflow-hidden">
        <div className="flex flex-col justify-between border-b px-6 py-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <CardTitle>Требует внимания</CardTitle>
            <CardDescription>
              Недавние задания и тесты, ожидающие проверки
            </CardDescription>
          </div>
          {showStaffFilter ? (
            <Select value={filter} onValueChange={handleFilterChange} disabled={isFetching}>
              <SelectTrigger
                className="mt-3 w-full sm:mt-0 sm:w-64 [&_[data-slot=select-value]]:line-clamp-none"
                size="default"
                aria-label="Фильтр по сотруднику"
              >
                <SelectValue placeholder="Моё" />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                <SelectItem value="mine">Моё</SelectItem>
                <SelectItem value="others">Другие</SelectItem>
                {staffOptions.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        {error ? (
          <p className="text-destructive px-6 py-4 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {reviews.length === 0 && !isFetching ? (
          <div className="text-muted-foreground px-6 py-12 text-center text-sm">
            Все работы проверены! 🎉
          </div>
        ) : reviews.length === 0 && isFetching ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 px-6 py-12 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Загрузка…
          </div>
        ) : (
          <>
            <div className="custom-scrollbar w-full overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead>Ученик</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Курс</TableHead>
                    <TableHead>Урок</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead className="text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((review) => (
                    <TableRow key={pendingReviewKey(review)}>
                      <TableCell className="font-medium">
                        {review.studentName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            review.kind === "test"
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                              : undefined
                          }
                        >
                          {review.kind === "test" ? "Тест" : "Задание"}
                        </Badge>
                      </TableCell>
                      <TableCell>{review.courseTitle}</TableCell>
                      <TableCell>{review.lessonTitle}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatSubmittedAt(review.submittedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {review.kind === "test" ? (
                          <Button size="sm" variant="ghost" asChild>
                            <Link
                              href={`/dashboard/gradebook/attempts/${review.attemptId}/grade`}
                            >
                              Проверить
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setSelectedSubmissionId(review.submissionId)
                            }
                          >
                            Проверить
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {hasMore ? (
              <div className="flex justify-center border-t px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={isFetching}
                  onClick={() => void loadPage(filter, reviews.length, true)}
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Загрузка…
                    </>
                  ) : (
                    "Загрузить еще"
                  )}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>

      {selectedSubmissionId &&
      selectedReview &&
      selectedReview.kind === "assignment" ? (
        <AssignmentReviewSheet
          isOpen
          onOpenChange={(open) => {
            if (!open) {
              setSelectedSubmissionId(null);
              void loadPage(filter, 0, false);
              router.refresh();
            }
          }}
          fetchMode="submissionId"
          submissionId={selectedSubmissionId}
          studentName={selectedReview.studentName}
          isTeacher
        />
      ) : null}
    </section>
  );
}
