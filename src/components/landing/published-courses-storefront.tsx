import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpenIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCoursePrice } from "@/lib/format-course-price";
import type { Database } from "@/types/database.types";

export type PublishedCourseCard = Pick<
  Database["public"]["Tables"]["courses"]["Row"],
  | "id"
  | "title"
  | "slug"
  | "image_url"
  | "price"
  | "marketing_audience"
  | "level"
  | "age_group"
  | "target_audience"
  | "delivery_format"
  | "language"
>;

type PublishedCoursesStorefrontProps = {
  courses: PublishedCourseCard[];
  /** Активные фильтры в URL и ноль курсов в выборке. */
  filtersYieldEmpty?: boolean;
};

function audienceBadges(course: PublishedCourseCard): ReactNode[] {
  const nodes: ReactNode[] = [];
  const ma = course.marketing_audience?.trim();
  if (ma) {
    nodes.push(
      <Badge key="ma" variant="secondary" className="max-w-full truncate">
        {ma}
      </Badge>,
    );
  }
  if (course.target_audience === "adults" && course.level) {
    nodes.push(
      <Badge key="level" variant="outline">
        {course.level}
      </Badge>,
    );
  }
  if (course.target_audience === "kids" && course.age_group?.trim()) {
    nodes.push(
      <Badge key="age" variant="outline">
        {course.age_group.trim()}
      </Badge>,
    );
  }
  return nodes;
}

function formatMetaLine(course: PublishedCourseCard): string | null {
  const parts: string[] = [];
  if (course.language?.trim()) parts.push(course.language.trim());
  if (course.delivery_format?.trim()) parts.push(course.delivery_format.trim());
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function PublishedCoursesStorefront({
  courses,
  filtersYieldEmpty = false,
}: PublishedCoursesStorefrontProps) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-none lg:text-left">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Каталог курсов
        </h2>
        <p className="text-muted-foreground mt-3 text-lg">
          Выберите программу и перейдите на страницу курса, чтобы узнать
          подробности и программу занятий.
        </p>
      </div>

      {courses.length === 0 ? (
        <p className="text-muted-foreground mx-auto mt-16 max-w-md text-center text-base lg:mx-0 lg:text-left">
          {filtersYieldEmpty
            ? "По выбранным фильтрам курсов нет. Попробуйте изменить условия или сбросить фильтры."
            : "Курсы пока не добавлены. Загляните позже!"}
        </p>
      ) : (
        <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const badges = audienceBadges(course);
            const meta = formatMetaLine(course);
            const href = `/courses/${encodeURIComponent(course.slug)}`;
            return (
              <li key={course.id}>
                <Link href={href} className="block h-full focus:outline-none">
                  <Card className="border-border/80 h-full overflow-hidden pt-0 transition-shadow hover:shadow-md">
                    <div className="bg-muted relative aspect-video w-full border-b">
                      {course.image_url ? (
                        <Image
                          src={course.image_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="text-muted-foreground flex size-full items-center justify-center">
                          <BookOpenIcon
                            className="size-14 opacity-40"
                            aria-hidden
                          />
                        </div>
                      )}
                    </div>
                    <CardHeader className="gap-2">
                      {badges.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">{badges}</div>
                      ) : null}
                      <CardTitle className="text-lg leading-snug">
                        {course.title}
                      </CardTitle>
                      {meta ? (
                        <p className="text-muted-foreground text-xs font-medium">
                          {meta}
                        </p>
                      ) : null}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-foreground text-lg font-semibold tabular-nums">
                        {formatCoursePrice(course.price)}
                      </p>
                    </CardContent>
                    <CardFooter className="text-muted-foreground text-sm">
                      Подробнее на странице курса →
                    </CardFooter>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
