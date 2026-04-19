import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  CourseCurriculumAccordion,
  type CurriculumModulePreview,
} from "@/components/courses/course-curriculum-accordion";
import { WithSiteHeader } from "@/components/site/with-site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCoursePrice } from "@/lib/format-course-price";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type CourseRow = Pick<
  Database["public"]["Tables"]["courses"]["Row"],
  | "id"
  | "title"
  | "description"
  | "detailed_description"
  | "price"
  | "slug"
  | "image_url"
  | "youtube_url"
  | "category"
  | "marketing_audience"
  | "age_group"
  | "duration_value"
  | "duration_unit"
  | "has_certificate"
  | "start_date"
  | "level"
  | "promotional_images"
> & {
  modules:
    | {
        id: string;
        title: string;
        order_index: number;
        lessons:
          | {
              id: string;
              title: string;
              type: Database["public"]["Enums"]["lesson_type"];
              order_index: number;
              is_published: boolean;
            }[]
          | null;
      }[]
    | null;
};

/** Сегмент пути может прийти в percent-encoding; в БД хранится декодированный slug. */
function decodeSlugParam(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

const DURATION_UNIT_LABEL: Record<string, string> = {
  hours: "ч.",
  weeks: "нед.",
  months: "мес.",
};

function formatDuration(
  value: number | null,
  unit: string | null,
): string | null {
  if (value == null || value <= 0) return null;
  if (!unit?.trim()) {
    return `${value}`;
  }
  const u = unit.trim().toLowerCase();
  const suffix = DURATION_UNIT_LABEL[u] ?? unit;
  return `${value} ${suffix}`;
}

function formatStartDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Возвращает URL для iframe YouTube или null, если ссылка не распознана. */
function youtubeEmbedSrc(url: string | null): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/embed/")) {
        return `${u.origin}${u.pathname}${u.search}`;
      }
      const v = u.searchParams.get("v");
      if (v) {
        return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
      }
      const shorts = u.pathname.match(/^\/shorts\/([^/]+)/);
      if (shorts?.[1]) {
        return `https://www.youtube.com/embed/${encodeURIComponent(shorts[1])}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function buildCurriculumPreview(
  raw: CourseRow["modules"],
): CurriculumModulePreview[] {
  const list = raw ?? [];
  return list
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((m) => ({
      id: m.id,
      title: m.title,
      lessons: (m.lessons ?? [])
        .filter((l) => l.is_published)
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
        })),
    }));
}

const getPublishedCourseBySlug = cache(
  async (decodedSlug: string): Promise<CourseRow | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("courses")
      .select(
        `
        id,
        title,
        description,
        detailed_description,
        price,
        slug,
        image_url,
        youtube_url,
        category,
        marketing_audience,
        age_group,
        duration_value,
        duration_unit,
        has_certificate,
        start_date,
        level,
        promotional_images,
        modules (
          id,
          title,
          order_index,
          lessons (
            id,
            title,
            type,
            order_index,
            is_published
          )
        )
      `,
      )
      .eq("slug", decodedSlug)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("[getPublishedCourseBySlug]", error.message);
      return null;
    }

    return data as CourseRow | null;
  },
);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: slugParam } = await params;
  const decodedSlug = decodeSlugParam(slugParam);
  const course = await getPublishedCourseBySlug(decodedSlug);
  if (!course) {
    return {
      title: "Курс не найден",
      description: "Курс не найден или ещё не опубликован.",
    };
  }
  return {
    title: course.title,
    description:
      course.description?.trim() ||
      `Курс «${course.title}» на образовательной платформе.`,
  };
}

export default async function PublicCourseLandingPage({ params }: PageProps) {
  const { slug: slugParam } = await params;
  const decodedSlug = decodeSlugParam(slugParam);
  const course = await getPublishedCourseBySlug(decodedSlug);

  if (!course) {
    notFound();
  }

  const curriculum = buildCurriculumPreview(course.modules);
  const embedSrc = youtubeEmbedSrc(course.youtube_url);
  const priceLabel = formatCoursePrice(course.price);
  const durationLabel = formatDuration(
    course.duration_value,
    course.duration_unit,
  );
  const startLabel = formatStartDate(course.start_date);
  const detailedHtml = course.detailed_description?.trim() ?? "";
  const galleryUrls = (course.promotional_images ?? []).filter(
    (u) => typeof u === "string" && u.trim().length > 0,
  );

  return (
    <WithSiteHeader>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(280px,340px)] lg:items-start">
          <div className="min-w-0 space-y-10">
            <header className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {course.category?.trim() ? (
                  <Badge variant="secondary">{course.category.trim()}</Badge>
                ) : null}
                {course.marketing_audience?.trim() ? (
                  <Badge variant="secondary">
                    {course.marketing_audience.trim()}
                  </Badge>
                ) : null}
                {course.age_group?.trim() ? (
                  <Badge variant="outline">
                    Возраст: {course.age_group.trim()}
                  </Badge>
                ) : null}
                {course.level != null ? (
                  <Badge variant="outline">CEFR: {course.level}</Badge>
                ) : null}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {course.title}
              </h1>
              {course.description?.trim() ? (
                <p className="text-muted-foreground max-w-3xl text-lg leading-relaxed">
                  {course.description.trim()}
                </p>
              ) : null}
            </header>

            <section aria-label="Превью курса" className="space-y-3">
              {embedSrc ? (
                <div className="aspect-video w-full overflow-hidden rounded-xl border bg-muted shadow-sm">
                  <iframe
                    title="Превью курса на YouTube"
                    src={embedSrc}
                    className="size-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : course.image_url?.trim() ? (
                <div className="aspect-video w-full overflow-hidden rounded-xl border bg-muted shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element -- произвольный URL обложки (Storage / внешние CDN) */}
                  <img
                    src={course.image_url.trim()}
                    alt={`Обложка курса: ${course.title}`}
                    className="size-full object-cover"
                  />
                </div>
              ) : null}
            </section>

            {detailedHtml ? (
              <section aria-label="Подробное описание" className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  О курсе
                </h2>
                <div
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: detailedHtml }}
                />
              </section>
            ) : null}

            {galleryUrls.length > 0 ? (
              <section aria-label="Галерея курса" className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">
                  Галерея
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {galleryUrls.map((src) => (
                    <div
                      key={src}
                      className="border-border aspect-[4/3] overflow-hidden rounded-xl border bg-muted/20"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section aria-label="Программа курса" className="space-y-3">
              <h2 className="text-xl font-semibold tracking-tight">
                Программа
              </h2>
              <CourseCurriculumAccordion modules={curriculum} />
            </section>
          </div>

          <aside className="lg:sticky lg:top-24">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Запись на курс</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-3xl font-semibold tabular-nums">
                  {priceLabel}
                </p>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  {durationLabel ? (
                    <li>
                      <span className="text-foreground font-medium">
                        Длительность:{" "}
                      </span>
                      {durationLabel}
                    </li>
                  ) : null}
                  {startLabel ? (
                    <li>
                      <span className="text-foreground font-medium">
                        Старт:{" "}
                      </span>
                      {startLabel}
                    </li>
                  ) : null}
                  {course.has_certificate ? (
                    <li>
                      <Badge variant="secondary" className="mt-1">
                        Сертификат по окончании
                      </Badge>
                    </li>
                  ) : null}
                </ul>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button className="w-full" size="lg" asChild>
                  <Link href={`/learn/${encodeURIComponent(course.slug)}`}>
                    Начать обучение
                  </Link>
                </Button>
                <p className="text-muted-foreground text-center text-xs">
                  Войдите в аккаунт, чтобы открыть уроки в плеере.
                </p>
              </CardFooter>
            </Card>
          </aside>
        </div>
      </main>
    </WithSiteHeader>
  );
}
