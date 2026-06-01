import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BookOpen } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import { formatCoursePrice } from "@/lib/format-course-price";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export const dynamic = "force-dynamic";

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
  | "video_url"
  | "youtube_url"
  | "vimeo_url"
  | "category"
  | "delivery_format"
  | "marketing_audience"
  | "age_group"
  | "language"
  | "duration_value"
  | "duration_unit"
  | "has_certificate"
  | "start_date"
  | "start_date_type"
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

/** Возвращает URL для iframe Vimeo или null, если ссылка не распознана. */
function vimeoEmbedSrc(url: string | null): string | null {
  const raw = url?.trim();
  if (!raw) return null;

  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "vimeo.com" && host !== "player.vimeo.com") {
      return null;
    }

    if (host === "player.vimeo.com" && u.pathname.startsWith("/video/")) {
      return `${u.origin}${u.pathname}`;
    }

    const parts = u.pathname.split("/").filter(Boolean);
    const id = parts[0];
    if (!id || !/^\d+$/.test(id)) {
      return null;
    }

    return `https://player.vimeo.com/video/${id}`;
  } catch {
    return null;
  }
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

/** Русская форма слова по числу: 1 модуль, 2 модуля, 5 модулей. */
function pluralRu(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 > 10 && mod100 < 20) {
    return many;
  }
  if (mod10 > 1 && mod10 < 5) {
    return few;
  }
  if (mod10 === 1) {
    return one;
  }
  return many;
}

function formatModuleCount(count: number): string {
  return `${count} ${pluralRu(count, "модуль", "модуля", "модулей")}`;
}

function formatLessonCount(count: number): string {
  return `${count} ${pluralRu(count, "урок", "урока", "уроков")}`;
}

function countPublishedCourseStats(raw: CourseRow["modules"]): {
  totalModules: number;
  totalLessons: number;
} {
  const modules = raw ?? [];
  const totalModules = modules.length;
  const totalLessons = modules.reduce(
    (sum, mod) =>
      sum + (mod.lessons ?? []).filter((lesson) => lesson.is_published).length,
    0,
  );
  return { totalModules, totalLessons };
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
        video_url,
        youtube_url,
        vimeo_url,
        category,
        delivery_format,
        marketing_audience,
        age_group,
        language,
        duration_value,
        duration_unit,
        has_certificate,
        start_date,
        start_date_type,
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
  const { totalModules, totalLessons } = countPublishedCourseStats(
    course.modules,
  );
  const programStatsLabel = `${formatModuleCount(totalModules)} • ${formatLessonCount(totalLessons)}`;
  const hasYouTubeUrl = (course.youtube_url?.trim()?.length ?? 0) > 0;
  const hasVimeoUrl = (course.vimeo_url?.trim()?.length ?? 0) > 0;
  const hasSelfHostedVideo = (course.video_url?.trim()?.length ?? 0) > 0;
  const youtubeSrc = youtubeEmbedSrc(course.youtube_url);
  const vimeoSrc = vimeoEmbedSrc(course.vimeo_url);
  const selfHostedVideo = course.video_url?.trim() || "";
  const numericPrice = Number(course.price ?? 0);
  const priceLabel =
    Number.isFinite(numericPrice) && numericPrice > 0
      ? formatCoursePrice(course.price)
      : "Бесплатно";
  const durationLabel = formatDuration(
    course.duration_value,
    course.duration_unit,
  );
  const startLabel =
    course.start_date_type === "on_demand"
      ? "В любое время"
      : formatStartDate(course.start_date);
  const showStartDate = course.start_date_type === "on_demand" || startLabel != null;
  const showVideoSection =
    (hasYouTubeUrl && youtubeSrc != null) ||
    (hasVimeoUrl && vimeoSrc != null) ||
    hasSelfHostedVideo;
  const detailedHtml = course.detailed_description?.trim() ?? "";
  const galleryUrls = (course.promotional_images ?? []).filter(
    (u) => typeof u === "string" && u.trim().length > 0,
  );
  const audienceRaw = course.marketing_audience?.trim() ?? "";
  const audienceLower = audienceRaw.toLowerCase();
  const isAdultAudience = audienceLower.includes("взросл");
  const isKidsAudience =
    audienceLower.includes("дет") || audienceLower.includes("подрост");
  const formatRaw = course.delivery_format?.trim() ?? "";
  const formatLower = formatRaw.toLowerCase();

  const markerBase =
    "rounded-sm px-2 py-1 text-sm font-bold uppercase tracking-wider";

  const audienceMarkerClass = isAdultAudience
    ? "bg-[#7dd3fc] text-black"
    : isKidsAudience
      ? "bg-[#fde047] text-black"
      : "bg-white/20 text-white";

  const formatMarkerClass = formatLower.includes("онлайн")
    ? "bg-[#a3e635] text-black"
    : formatLower.includes("офлайн")
      ? "bg-[#fb923c] text-black"
      : formatLower.includes("гибрид")
        ? "bg-[#c084fc] text-black"
        : "bg-white/20 text-white";

  return (
    <WithSiteHeader>
      <div className="bg-background text-foreground">
        <section className="bg-slate-900 py-8 md:py-16">
          <div className="container mx-auto space-y-6 px-4 sm:px-6">
            <div className="mb-4 flex flex-wrap gap-2">
              {course.category?.trim() ? (
                <span className={`${markerBase} bg-white/20 text-white`}>
                  {course.category.trim()}
                </span>
              ) : null}
              {course.language?.trim() ? (
                <span className={`${markerBase} bg-[#fb7185] text-black`}>
                  {course.language.trim()}
                </span>
              ) : null}
              {audienceRaw ? (
                <span className={`${markerBase} ${audienceMarkerClass}`}>
                  {audienceRaw}
                </span>
              ) : null}
              {isAdultAudience && course.level != null ? (
                <span className={`${markerBase} bg-white/20 text-white`}>
                  Уровень: {course.level}
                </span>
              ) : null}
              {isKidsAudience && course.age_group?.trim() ? (
                <span className={`${markerBase} bg-white/20 text-white`}>
                  Возраст: {course.age_group.trim()}
                </span>
              ) : null}
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              {course.title}
            </h1>
            {course.description?.trim() ? (
              <p className="max-w-3xl text-xl leading-relaxed text-white/80">
                {course.description.trim()}
              </p>
            ) : null}
            {formatRaw ? (
              <div className="mt-6 flex flex-wrap gap-2">
                <span className={`${markerBase} ${formatMarkerClass}`}>
                  {formatRaw}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        <main className="container mx-auto grid grid-cols-1 gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div className="space-y-24 md:col-span-2">
          <section aria-label="Подробное описание" className="space-y-3">
            <h2 className="mb-8 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              О курсе
            </h2>
            {detailedHtml ? (
              <div
                className="prose prose-lg prose-slate text-foreground max-w-none dark:prose-invert prose-img:max-w-full prose-img:h-auto prose-img:rounded-md [&_img]:mx-auto [&_img]:my-8 [&_img]:max-h-[600px] [&_img]:w-auto [&_img]:object-contain [&_img]:rounded-xl [&_iframe]:my-8 [&_iframe]:aspect-video [&_iframe]:w-full [&_video]:my-8 [&_video]:w-full"
                dangerouslySetInnerHTML={{ __html: detailedHtml }}
              />
            ) : (
              <p className="text-muted-foreground">
                Подробное описание скоро появится.
              </p>
            )}
          </section>

          {showVideoSection ? (
          <section aria-label="Превью курса" className="space-y-3">
            <h2 className="mb-8 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Видео
            </h2>
            <div className="flex flex-col gap-6">
              {hasYouTubeUrl && youtubeSrc ? (
                <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  <iframe
                    title="Превью курса на YouTube"
                    src={youtubeSrc}
                    className="size-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : null}

              {hasVimeoUrl && vimeoSrc ? (
                <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  <iframe
                    title="Превью курса на Vimeo"
                    src={vimeoSrc}
                    className="size-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : null}

              {hasSelfHostedVideo ? (
                <video
                  controls
                  playsInline
                  className="aspect-video w-full rounded-xl border border-border bg-card object-cover shadow-sm"
                  src={selfHostedVideo}
                  preload="metadata"
                >
                  Ваш браузер не поддерживает воспроизведение видео.
                </video>
              ) : null}
            </div>
          </section>
          ) : null}

          {galleryUrls.length > 0 ? (
            <section aria-label="Галерея курса" className="space-y-3">
              <h2 className="mb-8 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Галерея
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {galleryUrls.map((src) => (
                  <div
                    key={src}
                    className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted/50 shadow-sm"
                  >
                    <Image
                      src={src}
                      alt={`Изображение галереи курса: ${course.title}`}
                      fill
                      unoptimized
                      className="object-contain"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-label="Программа курса" className="space-y-3">
            <h2 className="mb-8 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Программа
            </h2>
            <CourseCurriculumAccordion
              modules={curriculum}
              className="rounded-xl border border-border bg-card/40 px-4"
            />
          </section>
        </div>

        <aside className="md:col-span-1">
          <Card className="sticky top-24 overflow-hidden border-border bg-card/60 shadow-md backdrop-blur-md">
            {course.image_url?.trim() ? (
              <div className="p-4 pb-0">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-800/50 shadow-sm">
                  <Image
                    src={course.image_url.trim()}
                    alt={`Обложка курса: ${course.title}`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              </div>
            ) : null}
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Запись на курс</CardTitle>
              <p className="text-3xl font-semibold tabular-nums">{priceLabel}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <BookOpen
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
                <span className="text-base font-semibold text-foreground">
                  {programStatsLabel}
                </span>
              </div>
              <Separator />
              <div className="text-sm">
                <span className="text-sm font-medium text-muted-foreground">
                  Длительность:{" "}
                </span>
                <span className="text-base font-semibold text-foreground">
                  {durationLabel || "Не указана"}
                </span>
              </div>
              {showStartDate ? (
                <>
                  <Separator />
                  <div className="text-sm">
                    <span className="text-sm font-medium text-muted-foreground">
                      Старт:{" "}
                    </span>
                    <span className="text-base font-semibold text-foreground">
                      {startLabel}
                    </span>
                  </div>
                </>
              ) : null}
              {course.has_certificate ? (
                <>
                  <Separator />
                  <Badge variant="secondary">Сертификат по окончании</Badge>
                </>
              ) : null}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button className="w-full" size="lg" asChild>
                <Link
                  href={`/login?returnTo=${encodeURIComponent(`/courses/${course.slug}`)}`}
                >
                  Присоединиться
                </Link>
              </Button>
              <p className="text-muted-foreground text-center text-xs">
                После входа вы сможете начать обучение.
              </p>
            </CardFooter>
          </Card>
        </aside>
        </main>
      </div>
    </WithSiteHeader>
  );
}
