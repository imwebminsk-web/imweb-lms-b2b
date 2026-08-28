"use client";

import Link from "next/link";
import { BookOpenIcon, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteCourse } from "@/app/actions/curriculum-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCoursePrice } from "@/lib/format-course-price";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

export type TeacherCourseCardModel = Pick<
  Database["public"]["Tables"]["courses"]["Row"],
  "id" | "title" | "description" | "status" | "price" | "slug" | "image_url"
>;

type TeacherCourseCardProps = {
  course: TeacherCourseCardModel;
};

export function TeacherCourseCard({ course }: TeacherCourseCardProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletePending, startDeleteTransition] = useTransition();

  const isPublished = course.status === "published";
  const editHref = `/dashboard/courses/${encodeURIComponent(course.slug)}`;
  const description = course.description?.trim() || "Без описания";

  function handleDeleteConfirm() {
    startDeleteTransition(async () => {
      const result = await deleteCourse(course.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Курс удалён");
      setDeleteDialogOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <article className="flex h-full flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg bg-muted">
          {course.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.image_url}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="text-muted-foreground flex size-full items-center justify-center">
              <BookOpenIcon className="size-12 opacity-35" aria-hidden />
            </div>
          )}

          <Badge
            className={cn(
              "absolute top-3 left-3 rounded-md border-0 px-2.5 py-1 text-xs font-medium shadow-sm",
              isPublished
                ? "bg-white/95 text-emerald-700"
                : "bg-white/95 text-amber-800",
            )}
          >
            {isPublished ? "Опубликован" : "Черновик"}
          </Badge>

          <div className="absolute top-3 right-3 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label={`Действия для курса «${course.title}»`}
                  disabled={isDeletePending}
                >
                  <MoreVertical className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(event) => {
                    event.preventDefault();
                    setDeleteDialogOpen(true);
                  }}
                >
                  Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-4 flex flex-1 flex-col gap-2">
          <h3 className="line-clamp-2 text-lg leading-snug font-semibold tracking-tight text-foreground">
            {course.title}
          </h3>

          <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
            {description}
          </p>

          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Цена: </span>
            <span className="font-medium tabular-nums">
              {formatCoursePrice(course.price)}
            </span>
          </p>
        </div>

        <Button
          variant="outline"
          className="mt-4 w-full"
          asChild
        >
          <Link href={editHref}>Редактировать</Link>
        </Button>
      </article>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить курс?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены? Это действие удалит курс, все его модули, уроки и
              медиафайлы. Это нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletePending}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeletePending}
              className={buttonVariants({ variant: "destructive" })}
            >
              {isDeletePending ? "Удаление…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
