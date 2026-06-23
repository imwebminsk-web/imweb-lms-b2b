import Link from "next/link";

import type { CohortStudentRow } from "@/app/actions/cohort-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
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

export function CohortStudentsList({
  cohortId,
  students,
}: CohortStudentsListProps) {
  return (
    <div className="w-full overflow-x-auto">
      <Table className="min-w-[40rem]">
      <TableHeader>
        <TableRow>
          <TableHead>Имя</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Дата записи</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead className="w-[140px] text-right">Журнал</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-muted-foreground text-center">
              В этой группе пока нет учеников.
            </TableCell>
          </TableRow>
        ) : (
          students.map((row) => (
            <TableRow key={row.enrollmentId}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage
                      src={row.avatarUrl ?? undefined}
                      alt={row.name}
                    />
                    <AvatarFallback className="text-xs">
                      {initialsFromDisplayName(row.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{row.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{row.email}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(row.enrolledAt)}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                >
                  Активен
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="secondary">
                  <Link
                    href={`/dashboard/cohorts/${cohortId}/student/${row.userId}`}
                  >
                    Журнал
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
    </div>
  );
}
