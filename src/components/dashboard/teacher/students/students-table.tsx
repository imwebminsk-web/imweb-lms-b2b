"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type GlobalTeacherStudent,
  unenrollStudentFromCohorts,
} from "@/app/actions/student-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function formatEnrolledAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
  }).format(date);
}

function StudentRowActions({
  student,
  onUnenrollRequest,
}: {
  student: GlobalTeacherStudent;
  onUnenrollRequest: (student: GlobalTeacherStudent) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Действия для ${student.studentName}`}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(event) => {
            event.preventDefault();
            onUnenrollRequest(student);
          }}
        >
          Отчислить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StudentsTable({
  students,
}: {
  students: GlobalTeacherStudent[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [unenrollTarget, setUnenrollTarget] =
    useState<GlobalTeacherStudent | null>(null);
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

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

  function requestUnenroll(student: GlobalTeacherStudent) {
    setUnenrollTarget(student);
    setSelectedCohortIds([]);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    if (pending) {
      return;
    }
    setDialogOpen(open);
    if (!open) {
      setUnenrollTarget(null);
      setSelectedCohortIds([]);
    }
  }

  function toggleCohort(cohortId: string, checked: boolean) {
    setSelectedCohortIds((current) => {
      if (checked) {
        return current.includes(cohortId) ? current : [...current, cohortId];
      }
      return current.filter((id) => id !== cohortId);
    });
  }

  function confirmUnenroll() {
    if (!unenrollTarget || selectedCohortIds.length === 0) {
      return;
    }

    startTransition(async () => {
      const result = await unenrollStudentFromCohorts(
        unenrollTarget.studentId,
        selectedCohortIds,
      );
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Ученик отчислён из выбранных групп");
      setDialogOpen(false);
      setUnenrollTarget(null);
      setSelectedCohortIds([]);
      router.refresh();
    });
  }

  if (students.length === 0) {
    return (
      <div className="border-muted-foreground/25 text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm">
        Пока нет учеников в ваших группах. Когда ученики введут PIN, они
        появятся здесь.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <Input
          type="search"
          placeholder="Поиск по имени или email…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full sm:max-w-sm"
          aria-label="Поиск по имени или email ученика"
        />

        {filteredStudents.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Нет учеников по запросу «{query.trim()}».
          </p>
        ) : (
          <div className="w-full overflow-x-auto rounded-lg border">
            <Table className="min-w-[44rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Имя ученика</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Состоит в группах</TableHead>
                  <TableHead>Дата присоединения</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.studentId}>
                    <TableCell className="font-medium">
                      {student.studentName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.studentEmail}
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
                    <TableCell className="text-right">
                      <StudentRowActions
                        student={student}
                        onUnenrollRequest={requestUnenroll}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Отчислить ученика</DialogTitle>
            <DialogDescription>
              {unenrollTarget ? (
                <>
                  Выберите группы, из которых нужно отчислить{" "}
                  <span className="text-foreground font-medium">
                    {unenrollTarget.studentName}
                  </span>
                  . Это действие нельзя отменить.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {unenrollTarget ? (
            <div className="space-y-3 py-1">
              {unenrollTarget.cohorts.map((cohort) => {
                const checked = selectedCohortIds.includes(cohort.id);
                const checkboxId = `cohort-${cohort.id}`;

                return (
                  <div
                    key={cohort.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleCohort(cohort.id, value === true)
                      }
                    />
                    <Label htmlFor={checkboxId} className="flex-1 cursor-pointer">
                      {cohort.name}
                    </Label>
                  </div>
                );
              })}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => handleDialogOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || selectedCohortIds.length === 0}
              onClick={confirmUnenroll}
            >
              {pending ? "Отчисляем…" : "Отчислить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
