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
  course: PublicCourseCardModel & {
    resolvedTaxonomies?: {
      audience?: string;
      format?: string;
      language?: string;
      ageGroup?: string;
      level?: string;
    };
  };
};

function formatMetaLine(course: PublicCourseCardProps["course"]): string | null {
  const parts: string[] = [];
  const lang = course.resolvedTaxonomies?.language;
  const fmt = course.resolvedTaxonomies?.format;
  if (lang?.trim()) parts.push(lang.trim());
  if (fmt?.trim()) parts.push(fmt.trim());
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function PublicCourseCard({ course }: PublicCourseCardProps) {
  const href = `/courses/${encodeURIComponent(course.slug)}`;
  const description = course.description?.trim() || "Описание курса скоро появится.";
  const meta = formatMetaLine(course);
  const audienceLabel = course.resolvedTaxonomies?.audience;
  const extraLabel = course.resolvedTaxonomies?.ageGroup || course.resolvedTaxonomies?.level;

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="relative mb-4 aspect-[3/2] w-full overflow-hidden rounded-lg bg-muted dark:bg-slate-800">
        {course.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.image_url}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="text-[#001352] dark:text-slate-300 flex size-full items-center justify-center">
            <BookOpenIcon className="size-12 opacity-35" aria-hidden />
          </div>
        )}

        {audienceLabel || extraLabel ? (
          <Badge className="absolute top-3 left-3 rounded-md border-0 bg-white/95 px-2.5 py-1 text-xs font-medium text-[#001352] shadow-sm dark:bg-slate-800 dark:text-slate-300">
            {[audienceLabel, extraLabel].filter(Boolean).join(" • ")}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <h3 className="line-clamp-2 text-lg leading-snug font-semibold tracking-tight text-[#001352] dark:text-white">
          {course.title}
        </h3>

        {meta ? (
          <p className="text-[#001352] dark:text-slate-300 text-xs font-medium">{meta}</p>
        ) : null}

        <p className="text-[#001352] dark:text-slate-300 line-clamp-3 text-sm leading-relaxed">
          {description}
        </p>

        <p className="text-sm text-[#001352] dark:text-slate-300">
          <span className="text-[#001352] dark:text-slate-300">Цена: </span>
          <span className="text-[#001352] dark:text-slate-300 font-medium tabular-nums">
            {formatCoursePrice(course.price)}
          </span>
        </p>
      </div>

      <Button
        variant="landing"
        className="mt-auto w-full rounded-xl"
        asChild
      >
        <Link href={href}>Подробнее</Link>
      </Button>
    </article>
  );
}
