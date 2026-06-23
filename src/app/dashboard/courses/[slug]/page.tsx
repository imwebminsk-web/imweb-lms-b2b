import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CourseEditorTabs } from "@/components/dashboard/teacher/course-editor-tabs";
import type { CurriculumModuleRow } from "@/components/dashboard/teacher/curriculum-tab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/** Сегмент пути может прийти в percent-encoding; в БД хранится декодированный slug. */
function decodeSlugParam(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: slugParam } = await params;
  const decodedSlug = decodeSlugParam(slugParam);
  return {
    title: `Редактирование: ${decodedSlug}`,
    description: "Настройки и программа курса",
  };
}

export default async function DashboardCourseEditPage({ params }: PageProps) {
  const { slug: slugParam } = await params;
  const decodedSlug = decodeSlugParam(slugParam);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/login");
  }

  if (profile.role !== "teacher" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: courseRow, error } = await supabase
    .from("courses")
    .select(
      `
      id,
      title,
      description,
      detailed_description,
      price,
      status,
      slug,
      image_url,
      video_url,
      youtube_url,
      vimeo_url,
      category,
      has_certificate,
      marketing_audience,
      age_group,
      delivery_format,
      language,
      promotional_images,
      duration_value,
      duration_unit,
      start_date,
      level,
      modules (
        id,
        title,
        order_index,
        lessons (
          id,
          title,
          type,
          is_published,
          order_index
        )
      )
    `,
    )
    .eq("slug", decodedSlug)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!courseRow) {
    return (
      <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6">
        <Button variant="ghost" className="w-fit px-0" asChild>
          <Link href="/dashboard/courses">← Назад</Link>
        </Button>
        <div
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-4 py-6 text-sm"
          role="alert"
        >
          <p className="font-medium">Курс не найден.</p>
          <p className="mt-2 font-mono text-xs opacity-90">
            Ожидаемый slug (после decode): {decodedSlug}. Сырой сегмент URL:{" "}
            <span className="break-all">{slugParam}</span>. Проверьте базу данных
            (таблица{" "}
            <code className="bg-muted rounded px-1">courses</code>, поля{" "}
            <code className="bg-muted rounded px-1">slug</code> и{" "}
            <code className="bg-muted rounded px-1">teacher_id</code>).
          </p>
        </div>
      </div>
    );
  }

  const course = {
    id: courseRow.id,
    title: courseRow.title,
    description: courseRow.description,
    detailed_description: courseRow.detailed_description,
    price: courseRow.price,
    status: courseRow.status,
    slug: courseRow.slug,
    image_url: courseRow.image_url,
    video_url: courseRow.video_url,
    youtube_url: courseRow.youtube_url,
    vimeo_url: courseRow.vimeo_url,
    category: courseRow.category,
    has_certificate: courseRow.has_certificate,
    marketing_audience: courseRow.marketing_audience,
    age_group: courseRow.age_group,
    promotional_images: courseRow.promotional_images ?? [],
    duration_value: courseRow.duration_value,
    duration_unit: courseRow.duration_unit,
    start_date: courseRow.start_date,
    level: courseRow.level,
    delivery_format: courseRow.delivery_format,
    language: courseRow.language,
  };

  const rawModules = courseRow.modules ?? [];
  const modules: CurriculumModuleRow[] = rawModules
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((m) => ({
      id: m.id,
      title: m.title,
      order_index: m.order_index,
      lessons: (m.lessons ?? [])
        .slice()
        .sort((a, b) => a.order_index - b.order_index),
    }));

  const isPublished = course.status === "published";

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-8">
      <Button variant="ghost" className="w-fit px-0" asChild>
        <Link href="/dashboard/courses">← Назад</Link>
      </Button>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {course.title}
          </h1>
          <p className="text-muted-foreground font-mono text-xs">
            /{course.slug}
          </p>
        </div>
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
      </header>

      <CourseEditorTabs course={course} modules={modules} />
    </div>
  );
}
