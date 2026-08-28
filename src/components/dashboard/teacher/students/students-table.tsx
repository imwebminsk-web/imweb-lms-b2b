"use client";

import { useMemo, useState } from "react";

import type { GlobalTeacherStudent } from "@/app/actions/student-actions";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { initialsFromDisplayName } from "@/lib/utils/user-utils";

function formatEnrolledAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
  }).format(date);
}

export function StudentsTable({
  students,
}: {
  students: GlobalTeacherStudent[];
}) {
  const [query, setQuery] = useState("");

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return students;
    }
    return students.filter(
      (student) =>
        student.studentName.toLowerCase().includes(normalized) ||
        student.studentEmail.toLowerCase().includes(normalized),
    );
  }, [query, students]);

  if (students.length === 0) {
    return (
      <p className="text-muted-foreground px-6 py-12 text-center text-sm">
        Пока нет учеников в ваших группах. Когда ученики введут PIN, они
        появятся здесь.
      </p>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col justify-between gap-4 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
        <Input
          type="search"
          placeholder="Поиск по имени или email…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full sm:max-w-sm"
          aria-label="Поиск по имени или email ученика"
        />
      </div>

      {filteredStudents.length === 0 ? (
        <p className="text-muted-foreground px-6 py-4 text-sm">
          Нет учеников по запросу «{query.trim()}».
        </p>
      ) : (
        <div className="custom-scrollbar w-full overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead>Ученик</TableHead>
                <TableHead>Состоит в группах</TableHead>
                <TableHead>Дата присоединения</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.studentId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9 shrink-0">
                        <AvatarImage
                          src={student.avatarUrl ?? undefined}
                          alt={student.studentName}
                        />
                        <AvatarFallback className="text-xs">
                          {initialsFromDisplayName(student.studentName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium text-foreground">
                          {student.studentName}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">
                          {student.studentEmail}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-default underline decoration-dotted underline-offset-4">
                          {student.cohortCount}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        {student.cohorts.map((cohort) => cohort.name).join(", ")}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatEnrolledAt(student.firstEnrolledAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </TooltipProvider>
  );
}
