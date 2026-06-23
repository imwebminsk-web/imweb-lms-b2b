"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PendingReviewItem } from "@/app/dashboard/fetch-dashboard-data";
import { AssignmentReviewSheet } from "@/components/dashboard/teacher/cohorts/AssignmentReviewSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export function PendingReviewsWidget({
  reviews,
}: {
  reviews: PendingReviewItem[];
}) {
  const router = useRouter();
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(
    null,
  );

  const selectedReview = reviews.find(
    (review) =>
      review.kind === "assignment" &&
      review.submissionId === selectedSubmissionId,
  );

  return (
    <section className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Требует внимания</CardTitle>
          <CardDescription>
            Недавние задания и тесты, ожидающие проверки
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="border-muted-foreground/25 text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm">
              Все работы проверены! 🎉
            </div>
          ) : (
            <div className="w-full overflow-x-auto rounded-lg border">
              <Table className="min-w-[52rem]">
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
          )}
        </CardContent>
      </Card>

      {selectedSubmissionId &&
      selectedReview &&
      selectedReview.kind === "assignment" ? (
        <AssignmentReviewSheet
          isOpen
          onOpenChange={(open) => {
            if (!open) {
              setSelectedSubmissionId(null);
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
