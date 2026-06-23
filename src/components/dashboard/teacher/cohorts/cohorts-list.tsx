"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pendingReviewBadgeClassName } from "@/lib/dashboard/pending-review-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CohortListRow = {
  id: string;
  name: string;
  pin_code: string;
  is_active: boolean;
  created_at: string;
  courses: { title: string } | { title: string }[] | null;
};

function courseTitle(rel: CohortListRow["courses"]): string {
  if (rel == null) return "—";
  const row = Array.isArray(rel) ? rel[0] : rel;
  return row?.title?.trim() || "—";
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function CohortsList({
  cohorts,
  unreadMap = {},
  pendingMap = {},
}: {
  cohorts: CohortListRow[];
  unreadMap?: Record<string, number>;
  pendingMap?: Record<string, number>;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyPin(pin: string, id: string) {
    try {
      await navigator.clipboard.writeText(pin);
      setCopiedId(id);
      toast.success("PIN скопирован");
      setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 2000);
    } catch {
      toast.error("Не удалось скопировать PIN");
    }
  }

  if (cohorts.length === 0) {
    return (
      <div className="border-muted-foreground/25 text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm">
        Пока нет групп. Создайте первую кнопкой «Создать группу».
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border">
      <Table className="min-w-[48rem]">
        <TableHeader>
          <TableRow>
            <TableHead>Группа</TableHead>
            <TableHead>Курс</TableHead>
            <TableHead>PIN</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="text-right">Создана</TableHead>
            <TableHead className="text-right">Детали</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cohorts.map((row) => {
            const unreadCount = unreadMap[row.id] ?? 0;
            const pendingCount = pendingMap[row.id] ?? 0;
            return (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{row.name}</span>
                  {pendingCount > 0 ? (
                    <Badge className={pendingReviewBadgeClassName}>
                      {pendingCount}
                    </Badge>
                  ) : null}
                  {unreadCount > 0 ? (
                    <Badge variant="destructive" className="min-w-5 justify-center px-1.5 tabular-nums">
                      {unreadCount}
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {courseTitle(row.courses)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="font-mono text-sm tracking-widest"
                  >
                    {row.pin_code}
                  </Badge>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-8"
                    aria-label="Скопировать PIN"
                    onClick={() => void copyPin(row.pin_code, row.id)}
                  >
                    {copiedId === row.id ? (
                      <CheckIcon className="size-4" aria-hidden />
                    ) : (
                      <CopyIcon className="size-4" aria-hidden />
                    )}
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                {row.is_active ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  >
                    Активна
                  </Badge>
                ) : (
                  <Badge variant="secondary">Неактивна</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-right text-sm">
                {formatCreatedAt(row.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/cohorts/${row.id}`}>Открыть</Link>
                </Button>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
