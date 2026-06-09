import Link from "next/link";
import { BookOpenIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const isPublished = course.status === "published";
  const editHref = `/dashboard/courses/${encodeURIComponent(course.slug)}`;
  const description = course.description?.trim() || "Без описания";

  return (
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
        className="mt-4 w-full rounded-xl"
        asChild
      >
        <Link href={editHref}>Редактировать</Link>
      </Button>
    </article>
  );
}
