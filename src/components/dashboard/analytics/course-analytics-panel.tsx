"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";

import { getB2BCourseAnalytics } from "@/app/actions/analytics-actions";
import type { MatrixGradebookData } from "@/app/actions/gradebook-actions";
import { MatrixGradebook } from "@/components/dashboard/teacher/cohorts/matrix-gradebook";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { CourseAnalyticsEmployeeRow } from "@/types/analytics";

export function CourseAnalyticsPanel({
  courses,
  onEmployeeClick,
}: {
  courses: { id: string; title: string }[];
  onEmployeeClick: (row: CourseAnalyticsEmployeeRow) => void;
}) {
  const [courseId, setCourseId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [matrix, setMatrix] = useState<MatrixGradebookData | null>(null);
  const [employees, setEmployees] = useState<CourseAnalyticsEmployeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setMatrix(null);
      setEmployees([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    getB2BCourseAnalytics(courseId)
      .then((res) => {
        if (isCancelled) return;
        if (res.success) {
          setMatrix(res.data.matrix);
          setEmployees(res.data.employees);
        } else {
          setMatrix(null);
          setEmployees([]);
          setError(res.error);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (isCancelled) return;
        setMatrix(null);
        setEmployees([]);
        setError("Не удалось загрузить журнал курса.");
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [courseId]);

  const filteredMatrix = useMemo(() => {
    if (!matrix) return null;
    const q = search.trim().toLowerCase();
    if (!q) return matrix;
    return {
      ...matrix,
      students: matrix.students.filter((student) =>
        student.name.toLowerCase().includes(q),
      ),
    };
  }, [matrix, search]);

  const employeeById = useMemo(() => {
    return new Map(employees.map((row) => [row.id, row]));
  }, [employees]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <Select value={courseId || undefined} onValueChange={setCourseId}>
          <SelectTrigger className="w-full md:w-[280px]">
            <SelectValue placeholder="Выберите курс" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full md:max-w-sm">
          <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            placeholder="Поиск по ФИО..."
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={!courseId}
          />
        </div>
      </div>

      {!courseId && (
        <p className="text-muted-foreground text-sm">
          Выберите курс, чтобы открыть журнал оценок сотрудников.
        </p>
      )}

      {courseId && isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {courseId && !isLoading && error && (
        <p className="text-destructive text-sm">{error}</p>
      )}

      {courseId && !isLoading && !error && filteredMatrix && (
        <MatrixGradebook
          data={filteredMatrix}
          nameColumnLabel="Сотрудник"
          emptyColumnsText="Нет опубликованных тестов или заданий в журнале этого курса."
          emptyStudentsText="Нет сотрудников на этом курсе."
          onStudentClick={(student) => {
            const extras = employeeById.get(student.id);
            onEmployeeClick({
              id: student.id,
              fullName: extras?.fullName ?? student.name,
              team: extras?.team ?? "-",
              jobTitle: extras?.jobTitle ?? "-",
              courseStatus: extras?.courseStatus ?? "not_started",
              progress: extras?.progress ?? 0,
            });
          }}
        />
      )}
    </div>
  );
}