import type { Database } from "@/types/database.types";

export type LearnLessonNav = {
  id: string;
  title: string;
  type: Database["public"]["Enums"]["lesson_type"];
  order_index: number;
  is_published: boolean;
  test_id: string | null;
};

export type LearnModuleNav = {
  id: string;
  title: string;
  order_index: number;
  lessons: LearnLessonNav[] | null;
};

export function sortModules(modules: LearnModuleNav[]): LearnModuleNav[] {
  return [...modules].sort((a, b) => a.order_index - b.order_index);
}

export function publishedLessonsSorted(
  lessons: LearnLessonNav[] | null,
): LearnLessonNav[] {
  return [...(lessons ?? [])]
    .filter((l) => l.is_published)
    .sort((a, b) => a.order_index - b.order_index);
}

/** Первый опубликованный урок по порядку модулей и уроков. */
export function getFirstPublishedLessonId(
  modules: LearnModuleNav[] | null | undefined,
): string | null {
  if (!modules?.length) return null;
  for (const mod of sortModules(modules)) {
    const first = publishedLessonsSorted(mod.lessons)[0];
    if (first) return first.id;
  }
  return null;
}

export function isPublishedLessonInCourse(
  modules: LearnModuleNav[] | null | undefined,
  lessonId: string,
): boolean {
  if (!modules?.length) return false;
  for (const mod of sortModules(modules)) {
    for (const l of publishedLessonsSorted(mod.lessons)) {
      if (l.id === lessonId) return true;
    }
  }
  return false;
}

/** Все id опубликованных уроков курса (с учётом уже отфильтрованных modules). */
export function collectPublishedLessonIds(
  modules: LearnModuleNav[] | null | undefined,
): string[] {
  if (!modules?.length) return [];
  const ids: string[] = [];
  for (const mod of sortModules(modules)) {
    for (const lesson of publishedLessonsSorted(mod.lessons)) {
      ids.push(lesson.id);
    }
  }
  return ids;
}
