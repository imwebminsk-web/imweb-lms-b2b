"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { verifyAccess, type Role } from "@/lib/auth/rbac";
import {
  assertCourseDeleteAccess,
  assertCourseMutationAccess,
  loadCourseForMutation,
} from "@/lib/auth/course-access";
import { createClient } from "@/lib/supabase/server";
import {
  changeOwnerSchema,
  type ChangeOwnerPayload,
} from "@/lib/validations/course-schemas";
import {
  createLessonSchema,
  createModuleSchema,
  deleteLessonSchema,
  deleteModuleSchema,
  reorderLessonSchema,
  reorderModuleSchema,
  updateLessonSchema,
  updateModuleSchema,
  type CreateLessonPayload,
  type CreateModulePayload,
  type ReorderLessonPayload,
  type ReorderModulePayload,
  type UpdateLessonPayload,
  type UpdateModulePayload,
} from "@/lib/validations/curriculum-schema";
import type { Database, Json } from "@/types/database.types";

export type CurriculumMutationResult =
  | { ok: true }
  | { ok: false; error: string };

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

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Проверьте введённые данные.";
}

function callerRole(profile: unknown): Role {
  return (profile as unknown as { role: Role }).role;
}

async function prepareCurriculumWrite(
  userId: string,
  role: Role,
  courseId: string,
): Promise<
  | {
      ok: true;
      course: { id: string; teacher_id: string; slug: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      writer: any;
    }
  | { ok: false; error: string }
> {
  const loaded = await loadCourseForMutation(courseId);
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
    course: loaded.course,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    writer: userClient as any,
  };
}

export async function createModule(
  data: CreateModulePayload,
): Promise<CurriculumMutationResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = createModuleSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const prepared = await prepareCurriculumWrite(
    user.id,
    callerRole(profile),
    parsed.data.courseId,
  );
  if (!prepared.ok) {
    return prepared;
  }

  try {
    const { data: lastRow } = await prepared.writer
      .from("modules")
      .select("order_index")
      .eq("course_id", parsed.data.courseId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error: insertError } = await prepared.writer.from("modules").insert({
      course_id: parsed.data.courseId,
      title: parsed.data.title,
      order_index: nextOrderIndex(lastRow?.order_index),
    });

    if (insertError) {
      console.error("[createModule]", insertError.message);
      return { ok: false, error: "Не удалось создать модуль." };
    }
  } catch (err) {
    console.error("[createModule]", err);
    return { ok: false, error: "Не удалось создать модуль." };
  }

  revalidatePath(`/dashboard/courses/${prepared.course.slug}`);
  revalidatePath("/dashboard/courses");
  return { ok: true };
}

export async function updateModule(
  data: UpdateModulePayload,
): Promise<CurriculumMutationResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = updateModuleSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();

  try {
    const { data: moduleRow, error: moduleErr } = await supabase
      .from("modules")
      .select("id, course_id")
      .eq("id", parsed.data.moduleId)
      .maybeSingle();

    if (moduleErr || !moduleRow) {
      if (moduleErr) {
        console.error("[updateModule]", moduleErr.message);
      }
      return { ok: false, error: "Модуль не найден." };
    }

    const prepared = await prepareCurriculumWrite(
      user.id,
      callerRole(profile),
      moduleRow.course_id,
    );
    if (!prepared.ok) {
      return prepared;
    }

    const { error: updateError } = await prepared.writer
      .from("modules")
      .update({ title: parsed.data.title })
      .eq("id", parsed.data.moduleId);

    if (updateError) {
      console.error("[updateModule]", updateError.message);
      return { ok: false, error: "Не удалось сохранить модуль." };
    }

    revalidatePath(`/dashboard/courses/${prepared.course.slug}`);
    revalidatePath("/dashboard/courses");
    return { ok: true };
  } catch (err) {
    console.error("[updateModule]", err);
    return { ok: false, error: "Не удалось сохранить модуль." };
  }
}

export async function createLesson(
  data: CreateLessonPayload,
): Promise<CurriculumMutationResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = createLessonSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();

  try {
    const { data: moduleRow, error: moduleError } = await supabase
      .from("modules")
      .select("id, course_id")
      .eq("id", parsed.data.moduleId)
      .maybeSingle();

    if (moduleError || !moduleRow) {
      if (moduleError) {
        console.error("[createLesson]", moduleError.message);
      }
      return { ok: false, error: "Модуль не найден." };
    }

    const prepared = await prepareCurriculumWrite(
      user.id,
      callerRole(profile),
      moduleRow.course_id,
    );
    if (!prepared.ok) {
      return prepared;
    }

    const { data: lastLesson } = await prepared.writer
      .from("lessons")
      .select("order_index")
      .eq("module_id", parsed.data.moduleId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: insertedLesson, error: insertError } = await prepared.writer
      .from("lessons")
      .insert({
        module_id: parsed.data.moduleId,
        title: parsed.data.title,
        type: "text",
        order_index: nextOrderIndex(lastLesson?.order_index),
        content: {},
      })
      .select("id")
      .single();

    if (insertError || !insertedLesson) {
      console.error("[createLesson]", insertError?.message);
      return { ok: false, error: "Не удалось создать урок." };
    }

    const { error: blockErr } = await prepared.writer.from("lesson_blocks").insert({
      lesson_id: insertedLesson.id,
      type: defaultFirstLessonBlock.type,
      content: defaultFirstLessonBlock.content,
      order_index: 0,
    });

    if (blockErr) {
      console.error("[createLesson] lesson_blocks", blockErr.message);
      await prepared.writer.from("lessons").delete().eq("id", insertedLesson.id);
      return { ok: false, error: "Не удалось создать урок." };
    }

    revalidatePath(`/dashboard/courses/${prepared.course.slug}`);
    revalidatePath("/dashboard/courses");
    return { ok: true };
  } catch (err) {
    console.error("[createLesson]", err);
    return { ok: false, error: "Не удалось создать урок." };
  }
}

export async function updateLesson(
  data: UpdateLessonPayload,
): Promise<CurriculumMutationResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = updateLessonSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();

  try {
    const { data: lessonRow, error: lessonErr } = await supabase
      .from("lessons")
      .select("id, module_id")
      .eq("id", parsed.data.lessonId)
      .maybeSingle();

    if (lessonErr || !lessonRow) {
      if (lessonErr) {
        console.error("[updateLesson]", lessonErr.message);
      }
      return { ok: false, error: "Урок не найден." };
    }

    const { data: moduleRow, error: moduleErr } = await supabase
      .from("modules")
      .select("id, course_id")
      .eq("id", lessonRow.module_id)
      .maybeSingle();

    if (moduleErr || !moduleRow) {
      if (moduleErr) {
        console.error("[updateLesson]", moduleErr.message);
      }
      return { ok: false, error: "Модуль не найден." };
    }

    const prepared = await prepareCurriculumWrite(
      user.id,
      callerRole(profile),
      moduleRow.course_id,
    );
    if (!prepared.ok) {
      return prepared;
    }

    let content: Json = {};
    let test_id: string | null = null;
    const typeRaw = parsed.data.type;

    if (typeRaw === "video") {
      content = { videoUrl: (parsed.data.videoUrl ?? "").trim() };
    } else if (typeRaw === "text") {
      content = { body: parsed.data.body ?? "" };
    } else {
      test_id = parsed.data.testId?.trim() || null;
      if (!test_id) {
        return {
          ok: false,
          error: "Выберите тест для урока с типом «тест / квиз».",
        };
      }
      content = {};
    }

    const { error: updateError } = await prepared.writer
      .from("lessons")
      .update({
        title: parsed.data.title,
        type: typeRaw,
        content,
        is_published: parsed.data.isPublished === true,
        test_id: typeRaw === "text" || typeRaw === "video" ? null : test_id,
      })
      .eq("id", parsed.data.lessonId);

    if (updateError) {
      console.error("[updateLesson]", updateError.message);
      return { ok: false, error: "Не удалось сохранить урок." };
    }

    revalidatePath(
      `/dashboard/courses/${prepared.course.slug}/lessons/${parsed.data.lessonId}`,
    );
    revalidatePath(`/dashboard/courses/${prepared.course.slug}`);
    revalidatePath("/dashboard/courses");
    return { ok: true };
  } catch (err) {
    console.error("[updateLesson]", err);
    return { ok: false, error: "Не удалось сохранить урок." };
  }
}

export async function reorderModule(
  data: ReorderModulePayload,
): Promise<CurriculumMutationResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = reorderModuleSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const prepared = await prepareCurriculumWrite(
    user.id,
    callerRole(profile),
    parsed.data.courseId,
  );
  if (!prepared.ok) {
    return prepared;
  }

  try {
    const { data: rows, error: listErr } = await prepared.writer
      .from("modules")
      .select("id, order_index")
      .eq("course_id", parsed.data.courseId)
      .order("order_index", { ascending: true });

    if (listErr || !rows?.length) {
      if (listErr) {
        console.error("[reorderModule]", listErr.message);
      }
      return { ok: false, error: "Модули не найдены." };
    }

    const sorted = [...rows].sort((a, b) => a.order_index - b.order_index);
    const i = sorted.findIndex((r) => r.id === parsed.data.moduleId);
    if (i === -1) {
      return { ok: false, error: "Модуль не найден в этом курсе." };
    }
    const j = parsed.data.direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= sorted.length) {
      return { ok: true };
    }

    const a = sorted[i]!;
    const b = sorted[j]!;

    const { error: e1 } = await prepared.writer
      .from("modules")
      .update({ order_index: b.order_index })
      .eq("id", a.id);
    if (e1) {
      console.error("[reorderModule] update a", e1.message);
      return { ok: false, error: "Не удалось изменить порядок." };
    }

    const { error: e2 } = await prepared.writer
      .from("modules")
      .update({ order_index: a.order_index })
      .eq("id", b.id);
    if (e2) {
      console.error("[reorderModule] update b", e2.message);
      return { ok: false, error: "Не удалось изменить порядок." };
    }

    revalidatePath(`/dashboard/courses/${prepared.course.slug}`);
    revalidatePath("/dashboard/courses");
    return { ok: true };
  } catch (err) {
    console.error("[reorderModule]", err);
    return { ok: false, error: "Не удалось изменить порядок." };
  }
}

export async function reorderLesson(
  data: ReorderLessonPayload,
): Promise<CurriculumMutationResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = reorderLessonSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();

  try {
    const { data: moduleRow, error: moduleErr } = await supabase
      .from("modules")
      .select("id, course_id")
      .eq("id", parsed.data.moduleId)
      .maybeSingle();

    if (moduleErr || !moduleRow) {
      if (moduleErr) {
        console.error("[reorderLesson]", moduleErr.message);
      }
      return { ok: false, error: "Модуль не найден." };
    }

    const prepared = await prepareCurriculumWrite(
      user.id,
      callerRole(profile),
      moduleRow.course_id,
    );
    if (!prepared.ok) {
      return prepared;
    }

    const { data: rows, error: listErr } = await prepared.writer
      .from("lessons")
      .select("id, order_index")
      .eq("module_id", parsed.data.moduleId)
      .order("order_index", { ascending: true });

    if (listErr || !rows?.length) {
      if (listErr) {
        console.error("[reorderLesson]", listErr.message);
      }
      return { ok: false, error: "Уроки не найдены." };
    }

    const sorted = [...rows].sort((a, b) => a.order_index - b.order_index);
    const i = sorted.findIndex((r) => r.id === parsed.data.lessonId);
    if (i === -1) {
      return { ok: false, error: "Урок не найден в этом модуле." };
    }
    const j = parsed.data.direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= sorted.length) {
      return { ok: true };
    }

    const a = sorted[i]!;
    const b = sorted[j]!;

    const { error: e1 } = await prepared.writer
      .from("lessons")
      .update({ order_index: b.order_index })
      .eq("id", a.id);
    if (e1) {
      console.error("[reorderLesson] update a", e1.message);
      return { ok: false, error: "Не удалось изменить порядок." };
    }

    const { error: e2 } = await prepared.writer
      .from("lessons")
      .update({ order_index: a.order_index })
      .eq("id", b.id);
    if (e2) {
      console.error("[reorderLesson] update b", e2.message);
      return { ok: false, error: "Не удалось изменить порядок." };
    }

    revalidatePath(`/dashboard/courses/${prepared.course.slug}`);
    revalidatePath("/dashboard/courses");
    return { ok: true };
  } catch (err) {
    console.error("[reorderLesson]", err);
    return { ok: false, error: "Не удалось изменить порядок." };
  }
}

export async function deleteModule(
  moduleId: string,
): Promise<CurriculumMutationResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = deleteModuleSchema.safeParse({ moduleId });
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();

  try {
    const { data: moduleRow, error: moduleErr } = await supabase
      .from("modules")
      .select("id, course_id")
      .eq("id", parsed.data.moduleId)
      .maybeSingle();

    if (moduleErr || !moduleRow) {
      if (moduleErr) {
        console.error("[deleteModule]", moduleErr.message);
      }
      return { ok: false, error: "Модуль не найден." };
    }

    const prepared = await prepareCurriculumWrite(
      user.id,
      callerRole(profile),
      moduleRow.course_id,
    );
    if (!prepared.ok) {
      return prepared;
    }

    const { data: moduleLessons, error: lessonsListErr } = await prepared.writer
      .from("lessons")
      .select("id, type, content")
      .eq("module_id", parsed.data.moduleId);

    if (lessonsListErr) {
      console.error("[deleteModule] list lessons", lessonsListErr.message);
      return { ok: false, error: "Не удалось удалить модуль." };
    }

    const lessonIdsForModule = (moduleLessons ?? []).map((l: { id: string }) => l.id);
    await removeImageBlocksForLessons(prepared.writer, lessonIdsForModule);

    for (const row of moduleLessons ?? []) {
      await removeSelfHostedLessonVideoFromStorage(
        prepared.writer,
        row.type as LessonType,
        row.content as Json,
      );
    }

    const { error: delErr } = await prepared.writer
      .from("modules")
      .delete()
      .eq("id", parsed.data.moduleId);

    if (delErr) {
      console.error("[deleteModule]", delErr.message);
      return { ok: false, error: "Не удалось удалить модуль." };
    }

    revalidatePath(`/dashboard/courses/${prepared.course.slug}`);
    revalidatePath("/dashboard/courses");
    return { ok: true };
  } catch (err) {
    console.error("[deleteModule]", err);
    return { ok: false, error: "Не удалось удалить модуль." };
  }
}

export async function deleteLesson(
  lessonId: string,
): Promise<CurriculumMutationResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = deleteLessonSchema.safeParse({ lessonId });
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();

  try {
    const { data: lesson, error: lessonErr } = await supabase
      .from("lessons")
      .select("id, module_id, type, content")
      .eq("id", parsed.data.lessonId)
      .maybeSingle();

    if (lessonErr || !lesson) {
      if (lessonErr) {
        console.error("[deleteLesson]", lessonErr.message);
      }
      return { ok: false, error: "Урок не найден." };
    }

    const { data: moduleRow, error: moduleErr } = await supabase
      .from("modules")
      .select("id, course_id")
      .eq("id", lesson.module_id)
      .maybeSingle();

    if (moduleErr || !moduleRow) {
      if (moduleErr) {
        console.error("[deleteLesson]", moduleErr.message);
      }
      return { ok: false, error: "Модуль не найден." };
    }

    const prepared = await prepareCurriculumWrite(
      user.id,
      callerRole(profile),
      moduleRow.course_id,
    );
    if (!prepared.ok) {
      return prepared;
    }

    await removeImageBlocksForLessons(prepared.writer, [parsed.data.lessonId]);
    await removeSelfHostedLessonVideoFromStorage(
      prepared.writer,
      lesson.type as LessonType,
      lesson.content as Json,
    );

    const { error: delErr } = await prepared.writer
      .from("lessons")
      .delete()
      .eq("id", parsed.data.lessonId);

    if (delErr) {
      console.error("[deleteLesson]", delErr.message);
      return { ok: false, error: "Не удалось удалить урок." };
    }

    revalidatePath(`/dashboard/courses/${prepared.course.slug}`);
    revalidatePath(
      `/dashboard/courses/${prepared.course.slug}/lessons/${parsed.data.lessonId}`,
    );
    revalidatePath("/dashboard/courses");
    return { ok: true };
  } catch (err) {
    console.error("[deleteLesson]", err);
    return { ok: false, error: "Не удалось удалить урок." };
  }
}

export async function archiveCourse(
  courseId: string,
): Promise<CurriculumMutationResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const cid = courseId.trim();
  if (!cid) {
    return { ok: false, error: "Не указан курс." };
  }

  const loaded = await loadCourseForMutation(cid);
  if (!loaded.ok) {
    return loaded;
  }

  const supabase = await createClient();
  const accessError = await assertCourseDeleteAccess(supabase, {
    userId: user.id,
    role: profile.role,
    courseId: loaded.course.id,
    teacherId: loaded.course.teacher_id,
    courseOwnerRole: loaded.course.courseOwnerRole,
  });
  if (accessError) {
    return { ok: false, error: accessError };
  }

  const { error: archiveErr } = await supabase
    .from("courses")
    .update({ is_archived: true })
    .eq("id", cid);

  if (archiveErr) {
    console.error("[archiveCourse]", archiveErr.message);
    return {
      ok: false,
      error: archiveErr.message || "Не удалось архивировать курс.",
    };
  }

  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${loaded.course.slug}`);
  return { ok: true };
}

export async function restoreCourse(
  courseId: string,
  newTeacherId?: string | null,
): Promise<CurriculumMutationResult> {
  await verifyAccess(["admin"]);

  const cid = courseId.trim();
  const teacherId = newTeacherId?.trim() ?? "";

  if (!cid) {
    return { ok: false, error: "Не указан курс." };
  }

  const loaded = await loadCourseForMutation(cid);
  if (!loaded.ok) {
    return loaded;
  }

  const supabase = await createClient();

  if (!teacherId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: currentOwner, error: ownerErr } = await (supabase as any)
      .from("profiles")
      .select("id, is_active")
      .eq("id", loaded.course.teacher_id)
      .maybeSingle();

    if (ownerErr || !currentOwner) {
      return { ok: false, error: "Текущий владелец курса не найден." };
    }

    if (currentOwner.is_active === false) {
      return {
        ok: false,
        error:
          "Текущий создатель деактивирован. Назначьте нового активного владельца.",
      };
    }

    const { error: updateErr } = await supabase
      .from("courses")
      .update({ is_archived: false })
      .eq("id", cid);

    if (updateErr) {
      console.error("[restoreCourse]", updateErr.message);
      return {
        ok: false,
        error: updateErr.message || "Не удалось восстановить курс.",
      };
    }

    revalidatePath("/dashboard/courses");
    revalidatePath(`/dashboard/courses/${loaded.course.slug}`);
    return { ok: true };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher, error: teacherErr } = await (supabase as any)
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", teacherId)
    .maybeSingle();

  if (teacherErr || !teacher) {
    return { ok: false, error: "Пользователь не найден." };
  }

  if (teacher.is_active === false) {
    return {
      ok: false,
      error: "Нельзя назначить деактивированного пользователя.",
    };
  }

  if (
    teacher.role !== "teacher" &&
    teacher.role !== "head_teacher" &&
    teacher.role !== "admin"
  ) {
    return {
      ok: false,
      error:
        "Владельцем может быть только преподаватель, завуч или администратор.",
    };
  }

  const { error: updateErr } = await supabase
    .from("courses")
    .update({ is_archived: false, teacher_id: teacherId })
    .eq("id", cid);

  if (updateErr) {
    console.error("[restoreCourse]", updateErr.message);
    return {
      ok: false,
      error: updateErr.message || "Не удалось восстановить курс.",
    };
  }

  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${loaded.course.slug}`);
  return { ok: true };
}

export async function hardDeleteCourse(
  courseId: string,
): Promise<CurriculumMutationResult> {
  await verifyAccess(["admin"]);

  const cid = courseId.trim();
  if (!cid) {
    return { ok: false, error: "Не указан курс." };
  }

  const supabase = await createClient();

  const { data: deleted, error: deleteErr } = await supabase
    .from("courses")
    .delete()
    .eq("id", cid)
    .eq("is_archived", true)
    .select("id");

  if (deleteErr) {
    console.error("[hardDeleteCourse]", deleteErr.message);
    return {
      ok: false,
      error: deleteErr.message || "Не удалось удалить курс.",
    };
  }

  if (!deleted?.length) {
    return {
      ok: false,
      error: "Курс не найден в архиве или уже удалён.",
    };
  }

  revalidatePath("/dashboard/courses");
  return { ok: true };
}

export type ReassignCourseOwnerResult =
  | { ok: true }
  | { ok: false; error: string };

export async function reassignCourseOwner(
  data: ChangeOwnerPayload,
): Promise<ReassignCourseOwnerResult> {
  await verifyAccess(["admin"]);

  const parsed = changeOwnerSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте введённые данные.",
    };
  }

  const { courseId: cid, newOwnerId: teacherId } = parsed.data;

  try {
    const supabase = await createClient();

    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, slug, teacher_id")
      .eq("id", cid)
      .maybeSingle();

    if (courseErr || !course) {
      return { ok: false, error: "Курс не найден." };
    }

    if (course.teacher_id === teacherId) {
      return { ok: false, error: "Этот пользователь уже владелец курса." };
    }

    // is_active ещё нет в generated Database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: teacher, error: teacherErr } = await (supabase as any)
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", teacherId)
      .maybeSingle();

    if (teacherErr || !teacher) {
      return { ok: false, error: "Пользователь не найден." };
    }

    if (teacher.role !== "teacher" && teacher.role !== "head_teacher") {
      return { ok: false, error: "Владельцем может быть только преподаватель или завуч." };
    }

    if (teacher.is_active === false) {
      return { ok: false, error: "Нельзя назначить деактивированного сотрудника." };
    }

    const { data: updated, error: updateErr } = await supabase
      .from("courses")
      .update({ teacher_id: teacherId })
      .eq("id", cid)
      .select("id")
      .maybeSingle();

    if (updateErr || !updated) {
      console.error("[reassignCourseOwner]", updateErr?.message);
      return { ok: false, error: "Не удалось сменить владельца курса" };
    }

    revalidatePath("/dashboard/courses");
    revalidatePath(`/dashboard/courses/${course.slug}`);
    return { ok: true };
  } catch (err) {
    console.error("[reassignCourseOwner] Unexpected error:", err);
    return { ok: false, error: "Не удалось сменить владельца курса" };
  }
}
