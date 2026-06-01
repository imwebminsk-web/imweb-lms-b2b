"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PendingReviewItem } from "@/app/dashboard/fetch-dashboard-data";
import { AssignmentReviewSheet } from "@/components/dashboard/teacher/cohorts/AssignmentReviewSheet";
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
    (review) => review.submissionId === selectedSubmissionId,
  );

  return (
    <section className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Требует внимания</CardTitle>
          <CardDescription>Недавние ответы, ожидающие проверки</CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="border-muted-foreground/25 text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm">
              Все работы проверены! 🎉
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ученик</TableHead>
                    <TableHead>Курс</TableHead>
                    <TableHead>Урок</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead className="text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((review) => (
                    <TableRow key={review.submissionId}>
                      <TableCell className="font-medium">
                        {review.studentName}
                      </TableCell>
                      <TableCell>{review.courseTitle}</TableCell>
                      <TableCell>{review.lessonTitle}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatSubmittedAt(review.submittedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setSelectedSubmissionId(review.submissionId)
                          }
                        >
                          Проверить
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSubmissionId && selectedReview ? (
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
