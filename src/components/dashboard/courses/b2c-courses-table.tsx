"use client";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import type { CourseB2C, CourseTableCurrentUser } from "@/app/actions/courses";
import {
  CourseRowActions,
  CreatorCell,
  TagsCell,
} from "@/components/dashboard/courses/course-table-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export type { CourseB2C };

function getB2CColumns(
  currentUser: CourseTableCurrentUser,
): ColumnDef<CourseB2C>[] {
  return [
    {
      accessorKey: "title",
      header: "Название",
    },
    {
      id: "creator",
      header: "Создатель",
      cell: ({ row }) => (
        <CreatorCell
          creatorName={row.original.creatorName}
          creatorEmail={row.original.creatorEmail}
          creatorAvatarUrl={row.original.creatorAvatarUrl}
          isCurator={row.original.isCurator}
        />
      ),
    },
    {
      accessorKey: "price",
      header: "Цена",
      cell: ({ row }) => {
        const price = row.original.price;
        return price === 0 ? "Бесплатно" : `$${price}`;
      },
    },
    {
      accessorKey: "tags",
      header: "Фильтры",
      cell: ({ row }) => <TagsCell tags={row.original.tags} />,
    },
    {
      accessorKey: "status",
      header: "Статус",
      cell: ({ row }) => {
        const status = row.original.status;
        const isPublished = status === "published";
        return (
          <Badge
            variant="outline"
            className={
              isPublished
                ? "border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-800 dark:text-emerald-200"
                : "border-amber-500/40 bg-amber-500/10 font-medium text-amber-800 dark:text-amber-200"
            }
          >
            {isPublished ? "Опубликован" : "Черновик"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <CourseRowActions course={row.original} currentUser={currentUser} />
      ),
    },
  ];
}

export function B2CCoursesTable({
  data,
  currentUser,
}: {
  data: CourseB2C[];
  currentUser: CourseTableCurrentUser;
}) {
  const columns = useMemo(() => getB2CColumns(currentUser), [currentUser]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;
  const rangeStart = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <>
      <div className="custom-scrollbar w-full overflow-x-auto">
        <Table className="min-w-max">
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
                            header.getContext(),
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
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
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
      <div className="flex items-center justify-between border-t px-6 py-4">
        <div className="text-sm text-muted-foreground">
          Строки {rangeStart}-{rangeEnd} из {totalRows}
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Строк на странице</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
