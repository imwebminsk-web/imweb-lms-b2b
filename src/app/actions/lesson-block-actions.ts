"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type {
  LessonBlockActionState,
  LessonBlockType,
} from "@/lib/lesson-blocks/lesson-block-types";
import type { Database, Json } from "@/types/database.types";

type DbClient = SupabaseClient<Database>;

const BUCKET_COVERS = "course-covers";

const addableBlockTypes: LessonBlockType[] = [
  "text",
  "image",
  "youtube",
  "vimeo",
  "assignment",
  "quiz",
];

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
      `[lesson-block-actions remove ${bucketId}]`,
      path,
      error.message,
    );
  }
}

async function getLessonOwnerSlug(
  supabase: DbClient,
  userId: string,
  lessonId: string,
): Promise<string | null> {
  const { data: lesson, error: le } = await supabase
    .from("lessons")
    .select("id, module_id")
    .eq("id", lessonId)
    .maybeSingle();
  if (le || !lesson) return null;

  const { data: mod, error: me } = await supabase
    .from("modules")
    .select("course_id")
    .eq("id", lesson.module_id)
    .maybeSingle();
  if (me || !mod) return null;

  const { data: course, error: ce } = await supabase
    .from("courses")
    .select("slug, teacher_id")
    .eq("id", mod.course_id)
    .maybeSingle();
  if (ce || !course || course.teacher_id !== userId) return null;
  return course.slug;
}

function defaultContentForType(type: LessonBlockType): Json {
  switch (type) {
    case "text":
      return { html: "<p></p>" };
    case "image":
      return {};
    case "youtube":
    case "vimeo":
      return { url: "" };
    case "assignment":
      return { instructions: "", save_to_journal: false, is_for_kids: false };
    case "quiz":
      return { test_id: "" };
    default: {
      const _e: never = type;
      return _e;
    }
  }
}

function nextBlockOrderIndex(max: number | null | undefined): number {
  return (max ?? -1) + 1;
}

export async function addBlock(
  lessonId: string,
  type: LessonBlockType,
): Promise<LessonBlockActionState> {
  const lid = lessonId.trim();
  if (!lid) {
    return { error: "Не указан урок." };
  }
  if (!addableBlockTypes.includes(type)) {
    return { error: "Некорректный тип блока." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const slug = await getLessonOwnerSlug(supabase, user.id, lid);
  if (!slug) {
    return { error: "Урок не найден или нет прав." };
  }

  const { data: last } = await supabase
    .from("lesson_blocks")
    .select("order_index")
    .eq("lesson_id", lid)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const orderIndex = nextBlockOrderIndex(last?.order_index);

  const { data: row, error: insertError } = await supabase
    .from("lesson_blocks")
    .insert({
      lesson_id: lid,
      type,
      content: defaultContentForType(type),
      order_index: orderIndex,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    console.error("[addBlock]", insertError?.message);
    return {
      error: insertError?.message || "Не удалось добавить блок.",
    };
  }

  revalidatePath(`/dashboard/courses/${slug}/lessons/${lid}`);
  revalidatePath(`/dashboard/courses/${slug}`);
  revalidatePath(`/learn/${encodeURIComponent(slug)}`, "layout");
  return { success: true, blockId: row.id };
}

export async function updateBlock(
  blockId: string,
  content: Json,
): Promise<LessonBlockActionState> {
  const bid = blockId.trim();
  if (!bid) {
    return { error: "Не указан блок." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: block, error: be } = await supabase
    .from("lesson_blocks")
    .select("id, lesson_id")
    .eq("id", bid)
    .maybeSingle();
  if (be || !block) {
    return { error: "Блок не найден." };
  }

  const slug = await getLessonOwnerSlug(supabase, user.id, block.lesson_id);
  if (!slug) {
    return { error: "Нет прав на изменение блока." };
  }

  const { error: up } = await supabase
    .from("lesson_blocks")
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bid);

  if (up) {
    console.error("[updateBlock]", up.message);
    return { error: up.message || "Не удалось сохранить блок." };
  }

  revalidatePath(`/dashboard/courses/${slug}/lessons/${block.lesson_id}`);
  revalidatePath(`/dashboard/courses/${slug}`);
  revalidatePath(`/learn/${encodeURIComponent(slug)}`, "layout");
  return { success: true };
}

export async function deleteBlock(
  blockId: string,
): Promise<LessonBlockActionState> {
  const bid = blockId.trim();
  if (!bid) {
    return { error: "Не указан блок." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: block, error: be } = await supabase
    .from("lesson_blocks")
    .select("id, lesson_id, type, content")
    .eq("id", bid)
    .maybeSingle();
  if (be || !block) {
    return { error: "Блок не найден." };
  }

  const slug = await getLessonOwnerSlug(supabase, user.id, block.lesson_id);
  if (!slug) {
    return { error: "Нет прав на удаление блока." };
  }

  if (block.type === "image") {
    const c = block.content as Record<string, unknown>;
    const url = typeof c.imageUrl === "string" ? c.imageUrl : "";
    await removeStorageObjectIfInBucket(supabase, BUCKET_COVERS, url);
  }

  const { error: de } = await supabase.from("lesson_blocks").delete().eq("id", bid);
  if (de) {
    console.error("[deleteBlock]", de.message);
    return { error: de.message || "Не удалось удалить блок." };
  }

  revalidatePath(`/dashboard/courses/${slug}/lessons/${block.lesson_id}`);
  revalidatePath(`/dashboard/courses/${slug}`);
  revalidatePath(`/learn/${encodeURIComponent(slug)}`, "layout");
  return { success: true };
}

export async function reorderBlock(
  lessonId: string,
  blockId: string,
  direction: "up" | "down",
): Promise<LessonBlockActionState> {
  const lid = lessonId.trim();
  const bid = blockId.trim();
  if (!lid || !bid) {
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

  const slug = await getLessonOwnerSlug(supabase, user.id, lid);
  if (!slug) {
    return { error: "Нет прав." };
  }

  const { data: rows, error: listErr } = await supabase
    .from("lesson_blocks")
    .select("id, order_index")
    .eq("lesson_id", lid)
    .order("order_index", { ascending: true });

  if (listErr || !rows?.length) {
    return { error: "Блоки не найдены." };
  }

  const sorted = [...rows].sort((a, b) => a.order_index - b.order_index);
  const i = sorted.findIndex((r) => r.id === bid);
  if (i === -1) {
    return { error: "Блок не найден в уроке." };
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
    .from("lesson_blocks")
    .update({ order_index: ob, updated_at: new Date().toISOString() })
    .eq("id", a.id);
  if (e1) {
    return { error: e1.message || "Не удалось изменить порядок." };
  }

  const { error: e2 } = await supabase
    .from("lesson_blocks")
    .update({ order_index: oa, updated_at: new Date().toISOString() })
    .eq("id", b.id);
  if (e2) {
    return { error: e2.message || "Не удалось изменить порядок." };
  }

  revalidatePath(`/dashboard/courses/${slug}/lessons/${lid}`);
  revalidatePath(`/dashboard/courses/${slug}`);
  revalidatePath(`/learn/${encodeURIComponent(slug)}`, "layout");
  return { success: true };
}

export async function updateLessonMeta(
  _prev: LessonBlockActionState,
  formData: FormData,
): Promise<LessonBlockActionState> {
  const lessonId = String(formData.get("lesson_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const isPublishedRaw = String(formData.get("is_published") ?? "").trim();

  if (!lessonId) {
    return { error: "Не указан урок." };
  }
  if (!title) {
    return { error: "Введите название урока." };
  }

  const is_published = isPublishedRaw === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const slug = await getLessonOwnerSlug(supabase, user.id, lessonId);
  if (!slug) {
    return { error: "Урок не найден или нет прав." };
  }

  const { error: up } = await supabase
    .from("lessons")
    .update({ title, is_published })
    .eq("id", lessonId);

  if (up) {
    console.error("[updateLessonMeta]", up.message);
    return { error: up.message || "Не удалось сохранить." };
  }

  revalidatePath(`/dashboard/courses/${slug}/lessons/${lessonId}`);
  revalidatePath(`/dashboard/courses/${slug}`);
  revalidatePath(`/learn/${encodeURIComponent(slug)}`, "layout");
  return { success: true };
}
