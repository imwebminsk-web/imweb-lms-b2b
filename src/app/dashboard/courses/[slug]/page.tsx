import type { Metadata } from "next";
import Link from "next/link";

import { getCourseForEditBySlug } from "@/app/actions/courses";
import type { TaxonomyWithGroup } from "@/app/actions/taxonomy-actions";
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
  const result = await getCourseForEditBySlug(decodedSlug);

  if (!result.ok && result.reason === "not_found") {
    return (
      <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6">
        <Button variant="link" size="sm" asChild>
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
            <code className="bg-muted rounded px-1">courses</code>, поле{" "}
            <code className="bg-muted rounded px-1">slug</code>).
          </p>
        </div>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6">
        <Button variant="link" size="sm" asChild>
          <Link href="/dashboard/courses">← Назад</Link>
        </Button>
        <div
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-4 py-6 text-sm"
          role="alert"
        >
          <p className="font-medium">Нет доступа к этому курсу.</p>
          <p className="mt-2 text-sm opacity-90">{result.error}</p>
        </div>
      </div>
    );
  }

  const courseRow = result.course;
  const supabase = await createClient();

  const taxonomyIds = [
    ...new Set(
      (courseRow.course_taxonomies ?? [])
        .map((row) => row.taxonomy_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

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
    promotional_images: courseRow.promotional_images ?? [],
    duration_value: courseRow.duration_value,
    duration_unit: courseRow.duration_unit,
    start_date: courseRow.start_date,
    taxonomy_ids: taxonomyIds,
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

  const [{ data: taxonomyRows }, { data: taxonomyGroupRows }] = await Promise.all([
    supabase
      .from("taxonomies")
      .select("*, taxonomy_groups!inner(slug, name)")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
    supabase
      .from("taxonomy_groups")
      .select("slug, name")
      .order("name", { ascending: true }),
  ]);

  const taxonomies: TaxonomyWithGroup[] = (taxonomyRows ?? []).map((row) => ({
    ...row,
    group_slug: row.taxonomy_groups?.slug ?? "",
    group_name: row.taxonomy_groups?.name ?? "",
  }));

  const { data: teamsData } = await supabase.from("teams").select("id, name").order("name");
  const { data: jobTitlesData } = await supabase.from("job_titles").select("id, name").order("name");
  const { data: tagsData } = await supabase.from("tags").select("id, name").order("name");

  const { data: teamCourses } = await supabase
    .from("team_courses")
    .select("team_id")
    .eq("course_id", course.id);

  const { data: jobTitleCourses } = await supabase
    .from("job_title_courses")
    .select("job_title_id")
    .eq("course_id", course.id);

  const { data: courseTags } = await supabase
    .from("course_tags")
    .select("tag_id")
    .eq("course_id", course.id);

  const b2bOptions = {
    teams: teamsData ?? [],
    jobTitles: jobTitlesData ?? [],
    tags: tagsData ?? [],
    selectedTeams: (teamCourses ?? []).map((tc) => tc.team_id),
    selectedJobTitles: (jobTitleCourses ?? []).map((jtc) => jtc.job_title_id),
    selectedTags: (courseTags ?? []).map((ct) => ct.tag_id),
    isGlobal: courseRow.is_global ?? false,
  };

  const isPublished = course.status === "published";

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-8">
      <Button variant="link" size="sm" asChild>
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

      <CourseEditorTabs
        course={course}
        modules={modules}
        taxonomies={taxonomies}
        taxonomyGroups={taxonomyGroupRows ?? []}
        b2bOptions={b2bOptions}
      />
    </div>
  );
}
