"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { verifyAccess, type Role } from "@/lib/auth/rbac";
import {
  assertCourseMutationAccess,
  loadLessonForMutation,
  type CourseMutationContext,
} from "@/lib/auth/course-access";
import type { LessonBlockType } from "@/lib/lesson-blocks/lesson-block-types";
import { createClient } from "@/lib/supabase/server";
import {
  addBlockSchema,
  deleteBlockSchema,
  reorderBlockSchema,
  updateBlockSchema,
  updateLessonMetaSchema,
  uploadBlockImageSchema,
} from "@/lib/validations/lesson-block-schema";
import type { Database, Json } from "@/types/database.types";

export type LessonBlockMutationResult =
  | { ok: true }
  | { ok: false; error: string };

export type AddBlockResult =
  | { ok: true; blockId: string }
  | { ok: false; error: string };

export type UploadBlockImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

type DbClient = SupabaseClient<Database>;

const BUCKET_COVERS = "course-covers";
const MAX_BLOCK_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_BLOCK_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Проверьте введённые данные.";
}

function callerRole(profile: unknown): Role {
  return (profile as unknown as { role: Role }).role;
}

function genericError(scope: string, message: string | undefined, fallback: string) {
  if (message) {
    console.error(`[${scope}]`, message);
  }
  return { ok: false as const, error: fallback };
}

function revalidateLessonPaths(slug: string, lessonId: string) {
  revalidatePath(`/dashboard/courses/${slug}/lessons/${lessonId}`);
  revalidatePath(`/dashboard/courses/${slug}`);
  revalidatePath(`/learn/${encodeURIComponent(slug)}`, "layout");
}

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

function readImageUrlFromContent(content: Json): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const url = (content as Record<string, unknown>).imageUrl;
  return typeof url === "string" ? url.trim() : "";
}

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
      return { instructions: "", save_to_journal: false };
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

export async function prepareLessonWrite(
  userId: string,
  role: Role,
  lessonId: string,
): Promise<
  | {
      ok: true;
      lessonId: string;
      course: CourseMutationContext;
      writer: Awaited<ReturnType<typeof createClient>>;
    }
  | { ok: false; error: string }
> {
  const loaded = await loadLessonForMutation(lessonId);
  if (!loaded.ok) {
    return loaded;
  }

  const userClient = await createClient();
  const accessError = await assertCourseMutationAccess(userClient, {
    userId,
    role,
    courseId: loaded.course.id,
    teacherId: loaded.course.teacher_id,
    courseOwnerRole: loaded.course.courseOwnerRole,
  });
  if (accessError) {
    return { ok: false, error: accessError };
  }

  return {
    ok: true,
    lessonId: loaded.lessonId,
    course: loaded.course,
    writer: userClient,
  };
}

export async function addBlock(
  lessonId: string,
  type: LessonBlockType,
): Promise<AddBlockResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = addBlockSchema.safeParse({ lessonId, type });
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const prepared = await prepareLessonWrite(
    user.id,
    callerRole(profile),
    parsed.data.lessonId,
  );
  if (!prepared.ok) {
    return prepared;
  }

  try {
    const { data: last, error: lastErr } = await prepared.writer
      .from("lesson_blocks")
      .select("order_index")
      .eq("lesson_id", prepared.lessonId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) {
      return genericError("addBlock", lastErr.message, "Не удалось добавить блок.");
    }

    const { data: row, error: insertError } = await prepared.writer
      .from("lesson_blocks")
      .insert({
        lesson_id: prepared.lessonId,
        type: parsed.data.type,
        content: defaultContentForType(parsed.data.type),
        order_index: nextBlockOrderIndex(last?.order_index),
      })
      .select("id")
      .single();

    if (insertError || !row) {
      return genericError(
        "addBlock",
        insertError?.message,
        "Не удалось добавить блок.",
      );
    }

    revalidateLessonPaths(prepared.course.slug, prepared.lessonId);
    return { ok: true, blockId: row.id };
  } catch (err) {
    console.error("[addBlock]", err);
    return { ok: false, error: "Не удалось добавить блок." };
  }
}

export async function updateBlock(
  blockId: string,
  content: Json,
): Promise<LessonBlockMutationResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = updateBlockSchema.safeParse({ blockId, content });
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();

  try {
    const { data: block, error: blockErr } = await supabase
      .from("lesson_blocks")
      .select("id, lesson_id, type, content")
      .eq("id", parsed.data.blockId)
      .maybeSingle();

    if (blockErr || !block) {
      return genericError("updateBlock", blockErr?.message, "Блок не найден.");
    }

    const prepared = await prepareLessonWrite(
      user.id,
      callerRole(profile),
      block.lesson_id,
    );
    if (!prepared.ok) {
      return prepared;
    }

    if (block.type === "image") {
      const previousUrl = readImageUrlFromContent(block.content);
      const nextUrl = readImageUrlFromContent(parsed.data.content);
      if (previousUrl && previousUrl !== nextUrl) {
        await removeStorageObjectIfInBucket(
          prepared.writer,
          BUCKET_COVERS,
          previousUrl,
        );
      }
    }

    const { error: updateError } = await prepared.writer
      .from("lesson_blocks")
      .update({
        content: parsed.data.content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.blockId);

    if (updateError) {
      return genericError("updateBlock", updateError.message, "Не удалось сохранить блок.");
    }

    revalidateLessonPaths(prepared.course.slug, prepared.lessonId);
    return { ok: true };
  } catch (err) {
    console.error("[updateBlock]", err);
    return { ok: false, error: "Не удалось сохранить блок." };
  }
}

export async function deleteBlock(
  blockId: string,
): Promise<LessonBlockMutationResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = deleteBlockSchema.safeParse({ blockId });
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();

  try {
    const { data: block, error: blockErr } = await supabase
      .from("lesson_blocks")
      .select("id, lesson_id, type, content")
      .eq("id", parsed.data.blockId)
      .maybeSingle();

    if (blockErr || !block) {
      return genericError("deleteBlock", blockErr?.message, "Блок не найден.");
    }

    const prepared = await prepareLessonWrite(
      user.id,
      callerRole(profile),
      block.lesson_id,
    );
    if (!prepared.ok) {
      return prepared;
    }

    if (block.type === "image") {
      const c = block.content as Record<string, unknown>;
      const url = typeof c.imageUrl === "string" ? c.imageUrl : "";
      await removeStorageObjectIfInBucket(prepared.writer, BUCKET_COVERS, url);
    }

    const { error: deleteError } = await prepared.writer
      .from("lesson_blocks")
      .delete()
      .eq("id", parsed.data.blockId);

    if (deleteError) {
      return genericError("deleteBlock", deleteError.message, "Не удалось удалить блок.");
    }

    revalidateLessonPaths(prepared.course.slug, prepared.lessonId);
    return { ok: true };
  } catch (err) {
    console.error("[deleteBlock]", err);
    return { ok: false, error: "Не удалось удалить блок." };
  }
}

export async function reorderBlock(
  lessonId: string,
  blockId: string,
  direction: "up" | "down",
): Promise<LessonBlockMutationResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = reorderBlockSchema.safeParse({ lessonId, blockId, direction });
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const prepared = await prepareLessonWrite(
    user.id,
    callerRole(profile),
    parsed.data.lessonId,
  );
  if (!prepared.ok) {
    return prepared;
  }

  try {
    const { data: rows, error: listErr } = await prepared.writer
      .from("lesson_blocks")
      .select("id, order_index")
      .eq("lesson_id", prepared.lessonId)
      .order("order_index", { ascending: true });

    if (listErr || !rows?.length) {
      return genericError("reorderBlock", listErr?.message, "Блоки не найдены.");
    }

    const sorted = [...rows].sort((a, b) => a.order_index - b.order_index);
    const i = sorted.findIndex((r) => r.id === parsed.data.blockId);
    if (i === -1) {
      return { ok: false, error: "Блок не найден в уроке." };
    }

    const j = parsed.data.direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= sorted.length) {
      return { ok: true };
    }

    const a = sorted[i]!;
    const b = sorted[j]!;
    const now = new Date().toISOString();

    const { error: firstUpdateError } = await prepared.writer
      .from("lesson_blocks")
      .update({ order_index: b.order_index, updated_at: now })
      .eq("id", a.id);

    if (firstUpdateError) {
      return genericError(
        "reorderBlock",
        firstUpdateError.message,
        "Не удалось изменить порядок.",
      );
    }

    const { error: secondUpdateError } = await prepared.writer
      .from("lesson_blocks")
      .update({ order_index: a.order_index, updated_at: now })
      .eq("id", b.id);

    if (secondUpdateError) {
      return genericError(
        "reorderBlock",
        secondUpdateError.message,
        "Не удалось изменить порядок.",
      );
    }

    revalidateLessonPaths(prepared.course.slug, prepared.lessonId);
    return { ok: true };
  } catch (err) {
    console.error("[reorderBlock]", err);
    return { ok: false, error: "Не удалось изменить порядок." };
  }
}

export async function updateLessonMeta(
  lessonId: string,
  data: { title: string; is_published: boolean },
): Promise<LessonBlockMutationResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = updateLessonMetaSchema.safeParse({
    lessonId,
    title: data.title,
    is_published: data.is_published,
  });
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const prepared = await prepareLessonWrite(
    user.id,
    callerRole(profile),
    parsed.data.lessonId,
  );
  if (!prepared.ok) {
    return prepared;
  }

  try {
    const { error: updateError } = await prepared.writer
      .from("lessons")
      .update({
        title: parsed.data.title,
        is_published: parsed.data.is_published,
      })
      .eq("id", prepared.lessonId);

    if (updateError) {
      return genericError(
        "updateLessonMeta",
        updateError.message,
        "Не удалось сохранить урок.",
      );
    }

    revalidateLessonPaths(prepared.course.slug, prepared.lessonId);
    return { ok: true };
  } catch (err) {
    console.error("[updateLessonMeta]", err);
    return { ok: false, error: "Не удалось сохранить урок." };
  }
}

export async function uploadBlockImage(
  lessonId: string,
  formData: FormData,
): Promise<UploadBlockImageResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const blockId = String(formData.get("blockId") ?? "").trim();
  const parsed = uploadBlockImageSchema.safeParse({ lessonId, blockId });
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Выберите файл изображения." };
  }

  if (!ALLOWED_BLOCK_IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: "Допустимы только JPEG, PNG, WebP или GIF." };
  }

  if (file.size > MAX_BLOCK_IMAGE_BYTES) {
    return { ok: false, error: "Файл больше 5 МБ." };
  }

  const prepared = await prepareLessonWrite(
    user.id,
    callerRole(profile),
    parsed.data.lessonId,
  );
  if (!prepared.ok) {
    return prepared;
  }

  try {
    const { data: block, error: blockErr } = await prepared.writer
      .from("lesson_blocks")
      .select("id, lesson_id, type, content")
      .eq("id", parsed.data.blockId)
      .maybeSingle();

    if (blockErr || !block) {
      return genericError("uploadBlockImage", blockErr?.message, "Блок не найден.");
    }

    if (block.lesson_id !== prepared.lessonId) {
      return { ok: false, error: "Блок не найден в уроке." };
    }

    if (block.type !== "image") {
      return { ok: false, error: "Этот блок не предназначен для изображений." };
    }

    const previousUrl = readImageUrlFromContent(block.content);
    if (previousUrl) {
      await removeStorageObjectIfInBucket(
        prepared.writer,
        BUCKET_COVERS,
        previousUrl,
      );
    }

    const ext = extFromMime(file.type);
    const objectPath = `${user.id}/lesson-blocks/${parsed.data.blockId}/${crypto.randomUUID()}.${ext}`;
    const body = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await prepared.writer.storage
      .from(BUCKET_COVERS)
      .upload(objectPath, body, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      return genericError(
        "uploadBlockImage",
        uploadError.message,
        "Не удалось загрузить изображение.",
      );
    }

    const {
      data: { publicUrl },
    } = prepared.writer.storage.from(BUCKET_COVERS).getPublicUrl(objectPath);

    const { error: updateError } = await prepared.writer
      .from("lesson_blocks")
      .update({
        content: { imageUrl: publicUrl },
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.blockId);

    if (updateError) {
      await prepared.writer.storage.from(BUCKET_COVERS).remove([objectPath]);
      return genericError(
        "uploadBlockImage",
        updateError.message,
        "Не удалось сохранить изображение.",
      );
    }

    revalidateLessonPaths(prepared.course.slug, prepared.lessonId);
    return { ok: true, url: publicUrl };
  } catch (err) {
    console.error("[uploadBlockImage]", err);
    return { ok: false, error: "Не удалось загрузить изображение." };
  }
}
