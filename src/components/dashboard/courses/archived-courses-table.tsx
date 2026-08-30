"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  MoreHorizontal,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type {
  CourseArchived,
  CourseTableCurrentUser,
} from "@/app/actions/courses";
import { hardDeleteCourse } from "@/app/actions/curriculum-actions";
import { RestoreCourseModal } from "@/components/dashboard/courses/restore-course-modal";
import {
  CreatorCell,
  TagsCell,
} from "@/components/dashboard/courses/course-table-shared";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function getArchivedColumns(
  onRestore: (course: CourseArchived) => void,
  onHardDelete: (courseId: string) => void,
): ColumnDef<CourseArchived>[] {
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
      accessorKey: "tags",
      header: "Теги",
      cell: ({ row }) => <TagsCell tags={row.original.tags} />,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <span className="sr-only">Открыть меню</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Действия</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onRestore(row.original)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Восстановить
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onHardDelete(row.original.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить навсегда
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}

export function ArchivedCoursesTable({
  data,
  currentUser: _currentUser,
}: {
  data: CourseArchived[];
  currentUser: CourseTableCurrentUser;
}) {
  const router = useRouter();
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<CourseArchived | null>(
    null,
  );
  const [courseToHardDelete, setCourseToHardDelete] = useState<string | null>(
    null,
  );
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();

  const columns = useMemo(
    () =>
      getArchivedColumns(
        (course) => {
          setSelectedCourse(course);
          setIsRestoreOpen(true);
        },
        (courseId) => setCourseToHardDelete(courseId),
      ),
    [],
  );

  function handleHardDeleteConfirm() {
    if (!courseToHardDelete || isPending) {
      return;
    }

    startTransition(async () => {
      const result = await hardDeleteCourse(courseToHardDelete);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Курс удалён навсегда");
      setCourseToHardDelete(null);
      setDeleteConfirmText("");
      router.refresh();
    });
  }

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
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
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
                    В архиве нет курсов.
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
              <span className="text-sm text-muted-foreground">
                Строк на странице
              </span>
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

      <RestoreCourseModal
        courseId={selectedCourse?.id ?? ""}
        currentOwnerIsActive={selectedCourse?.creatorIsActive ?? true}
        isOpen={isRestoreOpen}
        onClose={() => {
          setIsRestoreOpen(false);
          setSelectedCourse(null);
        }}
      />

      <AlertDialog
        open={courseToHardDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setCourseToHardDelete(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить курс навсегда?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы собираетесь удалить курс навсегда. Это необратимо удалит все привязанные к нему группы, уроки,
              тесты и прогресс учеников. Введите слово{" "}
              <span className="font-bold text-foreground">Удалить</span> для
              подтверждения:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            autoComplete="off"
            aria-label="Подтверждение удаления курса"
          />
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Отмена
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive-outline"
              disabled={isPending || deleteConfirmText.trim() !== "Удалить"}
              onClick={handleHardDeleteConfirm}
            >
              {isPending ? "Удаление…" : "Удалить навсегда"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
