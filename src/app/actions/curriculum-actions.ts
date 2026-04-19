"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createLessonSchema } from "@/lib/validations/curriculum-schema";
import type { Database, Json } from "@/types/database.types";

export type CurriculumActionState = {
  success?: boolean;
  error?: string;
};

type LessonType = Database["public"]["Enums"]["lesson_type"];

type DbClient = SupabaseClient<Database>;

const BUCKET_COVERS = "course-covers";
const BUCKET_VIDEOS = "course-videos";

function nextOrderIndex(max: number | null | undefined): number {
  return (max ?? -1) + 1;
}

/** Путь объекта в Storage по публичному URL Supabase (`/object/public/{bucket}/…`). */
function storageObjectPathFromPublicUrl(
  publicUrl: string,
  bucketId: string,
): string | null {
  try {
    const u = new URL(publicUrl.trim());
    const marker = `/object/public/${bucketId}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

function readVideoUrlFromLessonContent(content: unknown): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const c = content as Record<string, unknown>;
  return typeof c.videoUrl === "string" ? c.videoUrl.trim() : "";
}

async function removeStorageObjectIfInBucket(
  supabase: DbClient,
  bucketId: string,
  publicUrl: string | null | undefined,
): Promise<void> {
  const trimmed = publicUrl?.trim();
  if (!trimmed) return;
  const path = storageObjectPathFromPublicUrl(trimmed, bucketId);
  if (!path) return;
  const { error } = await supabase.storage.from(bucketId).remove([path]);
  if (error) {
    console.error(
      `[removeStorageObjectIfInBucket] ${bucketId}`,
      path,
      error.message,
    );
  }
}

async function removeSelfHostedLessonVideoFromStorage(
  supabase: DbClient,
  lessonType: LessonType,
  content: Json,
): Promise<void> {
  if (lessonType !== "video") return;
  const url = readVideoUrlFromLessonContent(content);
  if (!url) return;
  await removeStorageObjectIfInBucket(supabase, BUCKET_VIDEOS, url);
}

async function removeImageBlocksForLessons(
  supabase: DbClient,
  lessonIds: string[],
): Promise<void> {
  if (!lessonIds.length) return;
  const { data: blocks, error } = await supabase
    .from("lesson_blocks")
    .select("type, content")
    .in("lesson_id", lessonIds);
  if (error) {
    console.error("[removeImageBlocksForLessons]", error.message);
    return;
  }
  for (const b of blocks ?? []) {
    const row = b as { type: string; content: Json };
    if (row.type !== "image") continue;
    const c = row.content as Record<string, unknown>;
    const url = typeof c.imageUrl === "string" ? c.imageUrl : "";
    await removeStorageObjectIfInBucket(supabase, BUCKET_COVERS, url);
  }
}

const defaultFirstLessonBlock: { type: "text"; content: Json } = {
  type: "text",
  content: { html: "<p></p>" },
};

export async function createModule(
  _prev: CurriculumActionState,
  formData: FormData,
): Promise<CurriculumActionState> {
  const courseId = String(formData.get("course_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  if (!courseId) {
    return { error: "Не указан курс." };
  }
  if (!title) {
    return { error: "Введите название модуля." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, teacher_id, slug")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError || !course || course.teacher_id !== user.id) {
    return { error: "Курс не найден или нет прав." };
  }

  const { data: lastRow } = await supabase
    .from("modules")
    .select("order_index")
    .eq("course_id", courseId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const orderIndex = nextOrderIndex(lastRow?.order_index);

  const { error: insertError } = await supabase.from("modules").insert({
    course_id: courseId,
    title,
    order_index: orderIndex,
  });

  if (insertError) {
    console.error("[createModule]", insertError.message);
    return { error: insertError.message || "Не удалось создать модуль." };
  }

  revalidatePath(`/dashboard/courses/${course.slug}`);
  revalidatePath("/dashboard/courses");
  return { success: true };
}

export async function createLesson(
  _prev: CurriculumActionState,
  formData: FormData,
): Promise<CurriculumActionState> {
  const parsed = createLessonSchema.safeParse({
    module_id: String(formData.get("module_id") ?? "").trim(),
    course_id: String(formData.get("course_id") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
  });

  if (!parsed.success) {
    const first =
      parsed.error.flatten().fieldErrors.module_id?.[0] ??
      parsed.error.flatten().fieldErrors.course_id?.[0] ??
      parsed.error.flatten().fieldErrors.title?.[0] ??
      "Некорректные данные.";
    return { error: first };
  }

  const { module_id: moduleId, course_id: courseIdFromForm, title } =
    parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: module, error: moduleError } = await supabase
    .from("modules")
    .select("id, course_id")
    .eq("id", moduleId)
    .maybeSingle();

  if (moduleError || !module) {
    return { error: "Модуль не найден." };
  }

  if (module.course_id !== courseIdFromForm) {
    return { error: "Модуль не принадлежит этому курсу." };
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, teacher_id, slug")
    .eq("id", module.course_id)
    .maybeSingle();

  if (
    courseError ||
    !course ||
    course.id !== courseIdFromForm ||
    course.teacher_id !== user.id
  ) {
    return { error: "Нет прав на добавление урока в этот модуль." };
  }

  const { data: lastLesson } = await supabase
    .from("lessons")
    .select("order_index")
    .eq("module_id", moduleId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const orderIndex = nextOrderIndex(lastLesson?.order_index);

  const { data: insertedLesson, error: insertError } = await supabase
    .from("lessons")
    .insert({
      module_id: moduleId,
      title,
      type: "text",
      order_index: orderIndex,
      content: {},
    })
    .select("id")
    .single();

  if (insertError || !insertedLesson) {
    console.error("[createLesson]", insertError?.message);
    return { error: insertError?.message || "Не удалось создать урок." };
  }

  const { error: blockErr } = await supabase.from("lesson_blocks").insert({
    lesson_id: insertedLesson.id,
    type: defaultFirstLessonBlock.type,
    content: defaultFirstLessonBlock.content,
    order_index: 0,
  });

  if (blockErr) {
    console.error("[createLesson] lesson_blocks", blockErr.message);
    await supabase.from("lessons").delete().eq("id", insertedLesson.id);
    return {
      error: blockErr.message || "Не удалось создать первый блок урока.",
    };
  }

  revalidatePath(`/dashboard/courses/${course.slug}`);
  revalidatePath("/dashboard/courses");
  return { success: true };
}

const lessonTypesForEditor: LessonType[] = ["text", "video", "quiz", "test"];

export async function updateLesson(
  _prev: CurriculumActionState,
  formData: FormData,
): Promise<CurriculumActionState> {
  const lessonId = String(formData.get("lesson_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "").trim() as LessonType;
  const isPublishedRaw = String(formData.get("is_published") ?? "").trim();

  if (!lessonId) {
    return { error: "Не указан урок." };
  }
  if (!title) {
    return { error: "Введите название урока." };
  }
  if (!lessonTypesForEditor.includes(typeRaw)) {
    return { error: "Некорректный тип урока." };
  }

  const is_published = isPublishedRaw === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: lessonRow, error: lessonErr } = await supabase
    .from("lessons")
    .select("id, module_id")
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonErr || !lessonRow) {
    return { error: "Урок не найден." };
  }

  const { data: module, error: moduleErr } = await supabase
    .from("modules")
    .select("id, course_id")
    .eq("id", lessonRow.module_id)
    .maybeSingle();

  if (moduleErr || !module) {
    return { error: "Модуль не найден." };
  }

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, teacher_id, slug")
    .eq("id", module.course_id)
    .maybeSingle();

  if (courseErr || !course || course.teacher_id !== user.id) {
    return { error: "Нет прав на изменение этого урока." };
  }

  let content: Json = {};
  let test_id: string | null = null;

  if (typeRaw === "video") {
    const videoUrl = String(formData.get("video_url") ?? "").trim();
    content = { videoUrl };
  } else if (typeRaw === "text") {
    const body = String(formData.get("body") ?? "");
    content = { body };
  } else if (typeRaw === "quiz" || typeRaw === "test") {
    test_id = String(formData.get("test_id") ?? "").trim() || null;
    if (!test_id) {
      return {
        error: "Выберите тест для урока с типом «тест / квиз».",
      };
    }
    content = {};
  }

  const { error: updateError } = await supabase
    .from("lessons")
    .update({
      title,
      type: typeRaw,
      content,
      is_published,
      test_id: typeRaw === "text" || typeRaw === "video" ? null : test_id,
    })
    .eq("id", lessonId);

  if (updateError) {
    console.error("[updateLesson]", updateError.message);
    return { error: updateError.message || "Не удалось сохранить урок." };
  }

  const slug = course.slug;
  revalidatePath(`/dashboard/courses/${slug}/lessons/${lessonId}`);
  revalidatePath(`/dashboard/courses/${slug}`);
  revalidatePath("/dashboard/courses");
  return { success: true };
}

export type DeleteCurriculumState = {
  success?: boolean;
  error?: string;
};

export async function reorderModule(
  courseId: string,
  moduleId: string,
  direction: "up" | "down",
): Promise<DeleteCurriculumState> {
  const cid = courseId.trim();
  const mid = moduleId.trim();
  if (!cid || !mid) {
    return { error: "Некорректные параметры." };
  }
  if (direction !== "up" && direction !== "down") {
    return { error: "Некорректное направление." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, teacher_id, slug")
    .eq("id", cid)
    .maybeSingle();

  if (courseErr || !course || course.teacher_id !== user.id) {
    return { error: "Курс не найден или нет прав." };
  }

  const { data: rows, error: listErr } = await supabase
    .from("modules")
    .select("id, order_index")
    .eq("course_id", cid)
    .order("order_index", { ascending: true });

  if (listErr || !rows?.length) {
    return { error: "Модули не найдены." };
  }

  const sorted = [...rows].sort((a, b) => a.order_index - b.order_index);
  const i = sorted.findIndex((r) => r.id === mid);
  if (i === -1) {
    return { error: "Модуль не найден в этом курсе." };
  }
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= sorted.length) {
    return { success: true };
  }

  const a = sorted[i]!;
  const b = sorted[j]!;
  const oa = a.order_index;
  const ob = b.order_index;

  const { error: e1 } = await supabase
    .from("modules")
    .update({ order_index: ob })
    .eq("id", a.id);
  if (e1) {
    console.error("[reorderModule] update a", e1.message);
    return { error: e1.message || "Не удалось изменить порядок." };
  }

  const { error: e2 } = await supabase
    .from("modules")
    .update({ order_index: oa })
    .eq("id", b.id);
  if (e2) {
    console.error("[reorderModule] update b", e2.message);
    return { error: e2.message || "Не удалось изменить порядок." };
  }

  revalidatePath(`/dashboard/courses/${course.slug}`);
  revalidatePath("/dashboard/courses");
  return { success: true };
}

export async function reorderLesson(
  moduleId: string,
  lessonId: string,
  direction: "up" | "down",
): Promise<DeleteCurriculumState> {
  const modId = moduleId.trim();
  const lid = lessonId.trim();
  if (!modId || !lid) {
    return { error: "Некорректные параметры." };
  }
  if (direction !== "up" && direction !== "down") {
    return { error: "Некорректное направление." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: module, error: moduleErr } = await supabase
    .from("modules")
    .select("id, course_id")
    .eq("id", modId)
    .maybeSingle();

  if (moduleErr || !module) {
    return { error: "Модуль не найден." };
  }

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, teacher_id, slug")
    .eq("id", module.course_id)
    .maybeSingle();

  if (courseErr || !course || course.teacher_id !== user.id) {
    return { error: "Нет прав на изменение этого модуля." };
  }

  const { data: rows, error: listErr } = await supabase
    .from("lessons")
    .select("id, order_index")
    .eq("module_id", modId)
    .order("order_index", { ascending: true });

  if (listErr || !rows?.length) {
    return { error: "Уроки не найдены." };
  }

  const sorted = [...rows].sort((a, b) => a.order_index - b.order_index);
  const i = sorted.findIndex((r) => r.id === lid);
  if (i === -1) {
    return { error: "Урок не найден в этом модуле." };
  }
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= sorted.length) {
    return { success: true };
  }

  const a = sorted[i]!;
  const b = sorted[j]!;
  const oa = a.order_index;
  const ob = b.order_index;

  const { error: e1 } = await supabase
    .from("lessons")
    .update({ order_index: ob })
    .eq("id", a.id);
  if (e1) {
    console.error("[reorderLesson] update a", e1.message);
    return { error: e1.message || "Не удалось изменить порядок." };
  }

  const { error: e2 } = await supabase
    .from("lessons")
    .update({ order_index: oa })
    .eq("id", b.id);
  if (e2) {
    console.error("[reorderLesson] update b", e2.message);
    return { error: e2.message || "Не удалось изменить порядок." };
  }

  revalidatePath(`/dashboard/courses/${course.slug}`);
  revalidatePath("/dashboard/courses");
  return { success: true };
}

export async function deleteModule(
  moduleId: string,
): Promise<DeleteCurriculumState> {
  const id = moduleId.trim();
  if (!id) {
    return { error: "Не указан модуль." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: module, error: moduleErr } = await supabase
    .from("modules")
    .select("id, course_id")
    .eq("id", id)
    .maybeSingle();

  if (moduleErr || !module) {
    return { error: "Модуль не найден." };
  }

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, teacher_id, slug")
    .eq("id", module.course_id)
    .maybeSingle();

  if (courseErr || !course || course.teacher_id !== user.id) {
    return { error: "Нет прав на удаление этого модуля." };
  }

  const { data: moduleLessons, error: lessonsListErr } = await supabase
    .from("lessons")
    .select("id, type, content")
    .eq("module_id", id);

  if (lessonsListErr) {
    console.error("[deleteModule] list lessons", lessonsListErr.message);
    return {
      error: lessonsListErr.message || "Не удалось подготовить удаление.",
    };
  }

  const lessonIdsForModule = (moduleLessons ?? []).map((l) => l.id);
  await removeImageBlocksForLessons(supabase, lessonIdsForModule);

  for (const row of moduleLessons ?? []) {
    await removeSelfHostedLessonVideoFromStorage(
      supabase,
      row.type as LessonType,
      row.content as Json,
    );
  }

  const { error: delErr } = await supabase.from("modules").delete().eq("id", id);

  if (delErr) {
    console.error("[deleteModule]", delErr.message);
    return { error: delErr.message || "Не удалось удалить модуль." };
  }

  revalidatePath(`/dashboard/courses/${course.slug}`);
  revalidatePath("/dashboard/courses");
  return { success: true };
}

export async function deleteLesson(
  lessonId: string,
): Promise<DeleteCurriculumState> {
  const id = lessonId.trim();
  if (!id) {
    return { error: "Не указан урок." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: lesson, error: lessonErr } = await supabase
    .from("lessons")
    .select("id, module_id, type, content")
    .eq("id", id)
    .maybeSingle();

  if (lessonErr || !lesson) {
    return { error: "Урок не найден." };
  }

  const { data: module, error: moduleErr } = await supabase
    .from("modules")
    .select("id, course_id")
    .eq("id", lesson.module_id)
    .maybeSingle();

  if (moduleErr || !module) {
    return { error: "Модуль не найден." };
  }

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, teacher_id, slug")
    .eq("id", module.course_id)
    .maybeSingle();

  if (courseErr || !course || course.teacher_id !== user.id) {
    return { error: "Нет прав на удаление этого урока." };
  }

  await removeImageBlocksForLessons(supabase, [id]);

  await removeSelfHostedLessonVideoFromStorage(
    supabase,
    lesson.type as LessonType,
    lesson.content as Json,
  );

  const { error: delErr } = await supabase.from("lessons").delete().eq("id", id);

  if (delErr) {
    console.error("[deleteLesson]", delErr.message);
    return { error: delErr.message || "Не удалось удалить урок." };
  }

  revalidatePath(`/dashboard/courses/${course.slug}`);
  revalidatePath(`/dashboard/courses/${course.slug}/lessons/${id}`);
  revalidatePath("/dashboard/courses");
  return { success: true };
}

export async function deleteCourse(
  courseId: string,
): Promise<DeleteCurriculumState> {
  const cid = courseId.trim();
  if (!cid) {
    return { error: "Не указан курс." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, teacher_id, slug, image_url, video_url")
    .eq("id", cid)
    .maybeSingle();

  if (courseErr || !course || course.teacher_id !== user.id) {
    return { error: "Курс не найден или нет прав." };
  }

  const { data: moduleRows, error: modErr } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", cid);

  if (modErr) {
    console.error("[deleteCourse] list modules", modErr.message);
    return { error: modErr.message || "Не удалось подготовить удаление." };
  }

  const moduleIds = (moduleRows ?? []).map((m) => m.id);
  if (moduleIds.length > 0) {
    const { data: lessonIdRows, error: lidErr } = await supabase
      .from("lessons")
      .select("id")
      .in("module_id", moduleIds);

    if (lidErr) {
      console.error("[deleteCourse] list lesson ids", lidErr.message);
      return { error: lidErr.message || "Не удалось подготовить удаление." };
    }

    const allLessonIds = (lessonIdRows ?? []).map((l) => l.id);
    await removeImageBlocksForLessons(supabase, allLessonIds);

    const { data: lesRows, error: lesErr } = await supabase
      .from("lessons")
      .select("type, content")
      .in("module_id", moduleIds);

    if (lesErr) {
      console.error("[deleteCourse] list lessons", lesErr.message);
      return { error: lesErr.message || "Не удалось подготовить удаление." };
    }

    for (const row of lesRows ?? []) {
      await removeSelfHostedLessonVideoFromStorage(
        supabase,
        row.type as LessonType,
        row.content as Json,
      );
    }
  }

  await removeStorageObjectIfInBucket(supabase, BUCKET_COVERS, course.image_url);
  await removeStorageObjectIfInBucket(supabase, BUCKET_VIDEOS, course.video_url);

  const { error: delErr } = await supabase.from("courses").delete().eq("id", cid);

  if (delErr) {
    console.error("[deleteCourse]", delErr.message);
    return { error: delErr.message || "Не удалось удалить курс." };
  }

  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${course.slug}`);
  return { success: true };
}
