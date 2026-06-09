import Link from "next/link";
import { BookOpenIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCoursePrice } from "@/lib/format-course-price";
import type { Database } from "@/types/database.types";

export type PublicCourseCardModel = Pick<
  Database["public"]["Tables"]["courses"]["Row"],
  | "id"
  | "title"
  | "slug"
  | "description"
  | "image_url"
  | "price"
  | "marketing_audience"
  | "level"
  | "age_group"
  | "target_audience"
  | "delivery_format"
  | "language"
>;

type PublicCourseCardProps = {
  course: PublicCourseCardModel;
};

function formatMetaLine(course: PublicCourseCardModel): string | null {
  const parts: string[] = [];
  if (course.language?.trim()) parts.push(course.language.trim());
  if (course.delivery_format?.trim()) parts.push(course.delivery_format.trim());
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function PublicCourseCard({ course }: PublicCourseCardProps) {
  const href = `/courses/${encodeURIComponent(course.slug)}`;
  const description = course.description?.trim() || "Описание курса скоро появится.";
  const meta = formatMetaLine(course);
  const audienceLabel = course.marketing_audience?.trim();

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="relative mb-4 aspect-[3/2] w-full overflow-hidden rounded-lg bg-muted">
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

        {audienceLabel ? (
          <Badge className="absolute top-3 left-3 rounded-md border-0 bg-white/95 px-2.5 py-1 text-xs font-medium text-primary shadow-sm">
            {audienceLabel}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <h3 className="line-clamp-2 text-lg leading-snug font-semibold tracking-tight text-foreground">
          {course.title}
        </h3>

        {meta ? (
          <p className="text-muted-foreground text-xs font-medium">{meta}</p>
        ) : null}

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

      <Button className="mt-auto w-full rounded-xl" asChild>
        <Link href={href}>Подробнее</Link>
      </Button>
    </article>
  );
}
