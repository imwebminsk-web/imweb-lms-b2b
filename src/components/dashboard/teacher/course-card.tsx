import Link from "next/link";
import { BookOpenIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCoursePrice } from "@/lib/format-course-price";
import type { Database } from "@/types/database.types";

export type CourseCardModel = Pick<
  Database["public"]["Tables"]["courses"]["Row"],
  "id" | "title" | "description" | "status" | "price" | "slug" | "image_url"
>;

export function CourseCard({ course }: { course: CourseCardModel }) {
  const isPublished = course.status === "published";

  const editHref = `/dashboard/courses/${encodeURIComponent(course.slug)}`;

  return (
    <Card className="h-full overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <div className="bg-muted relative aspect-[16/9] w-full border-b">
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
      </div>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 min-w-0 pr-1 text-base leading-snug">
            {course.title}
          </CardTitle>
          {isPublished ? (
            <Badge
              variant="outline"
              className="shrink-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
            >
              Опубликован
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="shrink-0 border-amber-500/35 bg-amber-500/12 text-amber-950 dark:text-amber-100"
            >
              Черновик
            </Badge>
          )}
        </div>
        <CardDescription className="line-clamp-2 text-sm">
          {course.description?.trim() || "Без описания"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-muted-foreground text-sm">
          Цена:{" "}
          <span className="text-foreground font-medium tabular-nums">
            {formatCoursePrice(course.price)}
          </span>
        </p>
      </CardContent>
      <CardFooter className="mt-auto">
        <Button variant="outline" className="w-full" asChild>
          <Link href={editHref}>Редактировать</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
