"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AnalyticsTablePagination } from "@/components/dashboard/analytics/analytics-table-pagination";
import type { EmployeeAnalyticsRow } from "@/types/analytics";

function translateStatus(status: "completed" | "in_progress" | "not_started" | null) {
  if (status === "completed") return "Пройден";
  if (status === "in_progress") return "В процессе";
  if (status === "not_started") return "Не начинал";
  return "—";
}

export function AnalyticsTable({
  data,
  onRowClick,
}: {
  data: EmployeeAnalyticsRow[];
  onRowClick: (row: EmployeeAnalyticsRow) => void;
}) {
  const searchParams = useSearchParams();
  const course = searchParams.get("course");
  const hasCourse = course && course !== "all";

  const columns = useMemo<ColumnDef<EmployeeAnalyticsRow>[]>(() => {
    const baseCols: ColumnDef<EmployeeAnalyticsRow>[] = [
      {
        accessorKey: "fullName",
        header: "ФИО",
      },
      {
        accessorKey: "team",
        header: "Отдел",
      },
      {
        accessorKey: "jobTitle",
        header: "Должность",
      },
    ];

    if (hasCourse) {
      return [
        ...baseCols,
        {
          accessorKey: "courseStatus",
          header: "Статус",
          cell: ({ row }) => translateStatus(row.getValue("courseStatus")),
        },
        {
          id: "assessments",
          header: "Итоговые оценки",
          cell: ({ row }) => {
            const assessments = row.original.journalAssessments;
            if (!assessments || assessments.length === 0) return "—";
            return (
              <div className="flex flex-wrap gap-1">
                {assessments.map((a, i) => {
                  if (a.isPendingReview) {
                    return (
                      <Badge key={i} variant="secondary" className="mr-1">
                        {a.title}: На проверке
                      </Badge>
                    );
                  }
                  if (a.score !== null) {
                    return (
                      <Badge key={i} variant="outline" className="mr-1">
                        {a.title}: {a.score}
                      </Badge>
                    );
                  }
                  return null;
                })}
              </div>
            );
          },
        },
      ];
    }

    return [
      ...baseCols,
      {
        accessorKey: "total",
        header: "Всего",
      },
      {
        accessorKey: "completed",
        header: "Пройдено",
      },
      {
        accessorKey: "inProgress",
        header: "В процессе",
      },
      {
        accessorKey: "notStarted",
        header: "Не начинал",
      },
    ];
  }, [hasCourse]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card overflow-x-auto whitespace-nowrap">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => onRowClick(row.original)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Нет данных.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <AnalyticsTablePagination table={table} />
    </div>
  );
}
