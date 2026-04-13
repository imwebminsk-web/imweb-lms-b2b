"use server";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

type LessonRow = Tables<"lessons">;
type ModuleRow = Tables<"modules">;
type CourseRow = Tables<"courses">;

/** Курс с вложенными модулями и уроками (порядок по `order_index`). */
export type CourseWithStructure = CourseRow & {
  modules: Array<
    ModuleRow & {
      lessons: LessonRow[];
    }
  >;
};

function sortByOrderIndex<T extends { order_index: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order_index - b.order_index);
}

/**
 * Список курсов, доступных текущему клиенту по RLS, с модулями и уроками.
 * Анонимы видят только опубликованные курсы; автор курса — ещё и свои черновики.
 */
export async function getCoursesWithStructure(): Promise<
  | { success: true; data: CourseWithStructure[] }
  | { success: false; error: string }
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .select(
      `
      id,
      slug,
      title,
      description,
      languages,
      level,
      target_audience,
      images_gallery,
      start_date_type,
      start_date,
      price,
      teacher_id,
      thumbnail_url,
      status,
      modules (
        id,
        course_id,
        title,
        order_index,
        lessons (
          id,
          module_id,
          title,
          content,
          type,
          test_id,
          order_index
        )
      )
    `,
    )
    .order("title", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  type RawModule = ModuleRow & { lessons: LessonRow[] | null };
  type RawCourse = CourseRow & { modules: RawModule[] | null };

  const rows = (data ?? []) as RawCourse[];

  const enriched: CourseWithStructure[] = rows.map((course) => {
    const modulesSorted = sortByOrderIndex(course.modules ?? []).map(
      (mod): ModuleRow & { lessons: LessonRow[] } => ({
        ...mod,
        lessons: sortByOrderIndex(mod.lessons ?? []),
      }),
    );
    return { ...course, modules: modulesSorted };
  });

  return { success: true, data: enriched };
}
