"use client";

import { Ban, CheckCircle2, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  updateEnrollmentStatus,
  type CohortStudentRow,
  type EnrollmentStatus,
} from "@/app/actions/cohort-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initialsFromDisplayName } from "@/lib/utils/user-utils";

type CohortStudentsListProps = {
  cohortId: string;
  students: CohortStudentRow[];
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  if (status === "pending") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/40 bg-amber-500/10 font-medium text-amber-800 dark:text-amber-200"
      >
        Ожидает
      </Badge>
    );
  }
  if (status === "suspended") {
    return (
      <Badge
        variant="outline"
        className="border-destructive/40 bg-destructive/10 font-medium text-destructive dark:text-red-300"
      >
        Доступ закрыт
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-800 dark:text-emerald-200"
    >
      Активен
    </Badge>
  );
}

function StudentRowActions({
  student,
  disabled,
  onStatusChange,
}: {
  student: CohortStudentRow;
  disabled: boolean;
  onStatusChange: (
    student: CohortStudentRow,
    status: EnrollmentStatus,
  ) => void;
}) {
  if (student.status === "pending") {
    return (
      <Button
        type="button"
        size="sm"
        variant="default"
        disabled={disabled}
        onClick={() => onStatusChange(student, "active")}
      >
        Принять
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={`Действия для ${student.name}`}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {student.status === "active" ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => onStatusChange(student, "suspended")}
          >
            <Ban className="size-4" aria-hidden />
            Закрыть доступ
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onStatusChange(student, "active")}>
            <CheckCircle2 className="size-4" aria-hidden />
            Вернуть доступ
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CohortStudentsList({
  cohortId,
  students,
}: CohortStudentsListProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleStatusChange(
    student: CohortStudentRow,
    status: EnrollmentStatus,
  ) {
    startTransition(async () => {
      const result = await updateEnrollmentStatus(
        student.userId,
        cohortId,
        status,
      );
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      if (status === "active" && student.status === "pending") {
        toast.success(`${student.name} принят в группу`);
      } else if (status === "suspended") {
        toast.success(`Доступ для ${student.name} закрыт`);
      } else {
        toast.success(`Доступ для ${student.name} восстановлен`);
      }
      router.refresh();
    });
  }

  return (
    <div className="custom-scrollbar w-full overflow-x-auto">
      <Table className="min-w-max">
        <TableHeader>
          <TableRow>
            <TableHead>Ученик</TableHead>
            <TableHead>Дата записи</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="w-[140px] text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground text-center"
              >
                В этой группе пока нет учеников.
              </TableCell>
            </TableRow>
          ) : (
            students.map((row) => (
              <TableRow key={row.enrollmentId}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage
                        src={row.avatarUrl ?? undefined}
                        alt={row.name}
                      />
                      <AvatarFallback className="text-xs">
                        {initialsFromDisplayName(row.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium text-foreground">
                        {row.name}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {row.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(row.enrolledAt)}
                </TableCell>
                <TableCell>
                  <EnrollmentStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-right">
                  <StudentRowActions
                    student={row}
                    disabled={pending}
                    onStatusChange={handleStatusChange}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
