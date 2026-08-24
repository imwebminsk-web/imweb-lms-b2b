"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { verifyAccess } from "@/lib/auth/rbac";
import {
  assertCourseMutationAccess,
  COURSE_MUTATION_SELECT,
  getCourseOwnerRole,
} from "@/lib/auth/course-access";
import { createClient } from "@/lib/supabase/server";
import { taxonomyIdsFormSchema } from "@/lib/validations/course-settings-schema";
import type { Database } from "@/types/database.types";
import { slugify } from "@/lib/utils/slug";

export type CreateCourseState = {
  success?: boolean;
  error?: string;
};

export type UpdateCourseState = {
  success?: boolean;
  error?: string;
};

/** Slug курса: транслит названия → латиница, дефисы, fallback «course». */
function baseSlugFromTitle(title: string): string {
  return slugify(title, "course");
}

/** Нормализация slug из ручного ввода: lowercase, только a-z, 0-9 и дефисы. */
function sanitizeSlug(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "");
  return normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const DEFAULT_COURSE_TITLE = "Новый курс";

/**
 * Создаёт черновик курса с названием по умолчанию и сразу
 * перенаправляет в редактор `/dashboard/courses/[slug]`.
 *
 * Сигнатура с `_prev` и `formData` нужна для `useActionState` у кнопки:
 * React передаёт предыдущее состояние и данные формы. Название мы
 * больше не берём из формы — модалка убрана.
 */
export async function createCourse(
  _prev: CreateCourseState,
  _formData: FormData,
): Promise<CreateCourseState> {
  const { user } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const title = DEFAULT_COURSE_TITLE;

  const supabase = await createClient();

  const base = baseSlugFromTitle(title);
  let slug = base;
  let suffix = 0;
  const maxAttempts = 50;

  while (suffix < maxAttempts) {
    const candidate = suffix === 0 ? slug : `${base}-${suffix}`;
    const { data: row } = await supabase
      .from("courses")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (!row) {
      slug = candidate;
      break;
    }
    suffix += 1;
  }

  if (suffix >= maxAttempts) {
    return { error: "Не удалось подобрать уникальный адрес (slug) для курса." };
  }

  const { error: insertError } = await supabase.from("courses").insert({
    title,
    price: "0.00",
    slug,
    teacher_id: user.id,
    status: "draft",
  });

  if (insertError) {
    console.error("[createCourse]", insertError.message);
    return {
      error: insertError.message || "Не удалось сохранить курс.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  // redirect() специально вызывается вне try/catch: внутри Next.js
  // это throw, и его нельзя «проглатывать», иначе переход не сработает.
  redirect(`/dashboard/courses/${slug}`);
}

type CourseStatus = Database["public"]["Enums"]["course_status"];

const DURATION_UNIT = new Set(["hours", "weeks", "months"]);

async function syncCourseTaxonomies(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseId: string,
  taxonomyIds: string[],
): Promise<string | null> {
  const { error: deleteError } = await supabase
    .from("course_taxonomies")
    .delete()
    .eq("course_id", courseId);

  if (deleteError) {
    console.error("[syncCourseTaxonomies:delete]", deleteError.message);
    return deleteError.message;
  }

  if (taxonomyIds.length === 0) {
    return null;
  }

  const { error: insertError } = await supabase.from("course_taxonomies").insert(
    taxonomyIds.map((taxonomy_id) => ({
      course_id: courseId,
      taxonomy_id,
    })),
  );

  if (insertError) {
    console.error("[syncCourseTaxonomies:insert]", insertError.message);
    return insertError.message;
  }

  return null;
}

export async function updateCourse(
  _prev: UpdateCourseState,
  formData: FormData,
): Promise<UpdateCourseState> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const detailedDescriptionRaw = String(
    formData.get("detailed_description") ?? "",
  ).trim();
  const youtubeRaw = String(formData.get("youtube_url") ?? "").trim();
  const vimeoRaw = String(formData.get("vimeo_url") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const durationValueRaw = String(formData.get("duration_value") ?? "").trim();
  const durationUnitRaw = String(formData.get("duration_unit") ?? "").trim();
  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  const hasCertificateRaw = String(formData.get("has_certificate") ?? "").trim();
  const promotionalImagesRaw = String(
    formData.get("promotional_images") ?? "",
  ).trim();

  let teams: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("teams") ?? "[]").trim());
    if (Array.isArray(parsed)) teams = parsed.filter(t => typeof t === "string");
  } catch {
    // ignore
  }

  let jobTitles: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("jobTitles") ?? "[]").trim());
    if (Array.isArray(parsed)) jobTitles = parsed.filter(t => typeof t === "string");
  } catch {
    // ignore
  }

  let tags: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("tags") ?? "[]").trim());
    if (Array.isArray(parsed)) tags = parsed.filter(t => typeof t === "string");
  } catch {
    // ignore
  }

  const isGlobalRaw = String(formData.get("isGlobal") ?? "false").trim();
  const is_global = isGlobalRaw === "true";

  if (!id) {
    return { error: "Не указан курс." };
  }

  if (!title) {
    return { error: "Укажите название курса." };
  }

  const newSlug = sanitizeSlug(rawSlug);
  if (!newSlug) {
    return { error: "URL курса не может быть пустым." };
  }

  const priceNum = Number(priceRaw);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return { error: "Укажите корректную цену (число ≥ 0)." };
  }

  if (statusRaw !== "draft" && statusRaw !== "published") {
    return { error: "Некорректный статус курса." };
  }

  let taxonomyIds: string[] = [];
  try {
    const parsed = JSON.parse(
      String(formData.get("taxonomy_ids") ?? "[]").trim(),
    );
    const result = taxonomyIdsFormSchema.safeParse(parsed);
    if (!result.success) {
      return { error: "Некорректные фильтры каталога." };
    }
    taxonomyIds = [...new Set(result.data)];
  } catch {
    return { error: "Некорректные фильтры каталога." };
  }

  const supabase = await createClient();

  if (durationUnitRaw.length > 0 && !DURATION_UNIT.has(durationUnitRaw)) {
    return { error: "Некорректная единица длительности." };
  }

  let durationValue: number | null = null;
  if (durationValueRaw.length > 0) {
    const n = Number(durationValueRaw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return { error: "Длительность: укажите целое число ≥ 0." };
    }
    durationValue = n;
  }

  let start_date: string | null = null;
  if (startDateRaw.length > 0) {
    const d = new Date(`${startDateRaw}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      return { error: "Некорректная дата старта." };
    }
    start_date = d.toISOString();
  }

  const status = statusRaw as CourseStatus;

  const { data: existing, error: fetchError } = await supabase
    .from("courses")
    // @ts-expect-error owner alias is not in generated Database types yet
    .select(COURSE_MUTATION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: "Курс не найден." };
  }

  const accessError = await assertCourseMutationAccess(supabase, {
    userId: user.id,
    role: profile.role,
    courseId: existing.id,
    teacherId: existing.teacher_id,
    courseOwnerRole: getCourseOwnerRole(existing),
  });
  if (accessError) {
    return { error: accessError };
  }

  const slugChanged = newSlug !== existing.slug;

  if (slugChanged) {
    const { data: taken } = await supabase
      .from("courses")
      .select("id")
      .eq("slug", newSlug)
      .maybeSingle();

    if (taken) {
      return { error: "Этот URL уже занят другим курсом." };
    }
  }

  const description = descriptionRaw.length > 0 ? descriptionRaw : null;
  const detailed_description =
    detailedDescriptionRaw.length > 0 ? detailedDescriptionRaw : null;
  const youtube_url = youtubeRaw.length > 0 ? youtubeRaw : null;
  const vimeo_url = vimeoRaw.length > 0 ? vimeoRaw : null;
  const duration_unit =
    durationUnitRaw.length > 0 ? durationUnitRaw : null;
  const has_certificate = hasCertificateRaw === "true";
  const price = priceNum.toFixed(2);

  let promotional_images: string[] = [];
  if (promotionalImagesRaw.length > 0) {
    try {
      const parsed = JSON.parse(promotionalImagesRaw) as unknown;
      if (!Array.isArray(parsed)) {
        return { error: "Некорректный формат галереи (ожидается массив URL)." };
      }
      const urls = parsed.filter(
        (x): x is string =>
          typeof x === "string" &&
          x.trim().length > 0 &&
          /^https?:\/\//i.test(x.trim()),
      );
      if (urls.length > 24) {
        return { error: "В галерее не более 24 изображений." };
      }
      promotional_images = [...new Set(urls.map((u) => u.trim()))];
    } catch {
      return { error: "Некорректный JSON галереи изображений." };
    }
  }

  let query = supabase
    .from("courses")
    .update({
      title,
      slug: newSlug,
      description,
      detailed_description,
      youtube_url,
      vimeo_url,
      price,
      status,
      promotional_images,
      duration_value: durationValue,
      duration_unit,
      start_date,
      has_certificate,
      is_global,
    })
    .eq("id", id);

  const { error: updateError } = await query;

  if (updateError) {
    console.error("[updateCourse]", updateError.message);
    return {
      error: updateError.message || "Не удалось сохранить изменения.",
    };
  }

  if (taxonomyIds.length > 0) {
    const { data: existingTaxonomies, error: taxonomyLookupError } =
      await supabase.from("taxonomies").select("id").in("id", taxonomyIds);

    if (taxonomyLookupError) {
      console.error("[updateCourse:taxonomies]", taxonomyLookupError.message);
      return { error: "Не удалось проверить фильтры каталога." };
    }

    if ((existingTaxonomies ?? []).length !== taxonomyIds.length) {
      return { error: "Некорректные фильтры каталога." };
    }
  }

  const taxonomySyncError = await syncCourseTaxonomies(supabase, id, taxonomyIds);

  if (taxonomySyncError) {
    return {
      error: taxonomySyncError || "Не удалось сохранить таксономии курса.",
    };
  }

  // Sync B2B Matrix
  try {
    if (is_global) {
      // If global, clear all specific assignments
      await supabase.from("team_courses").delete().eq("course_id", id);
      await supabase.from("job_title_courses").delete().eq("course_id", id);
      await supabase.from("course_tags").delete().eq("course_id", id);
    } else {
      // Sync Teams
      await supabase.from("team_courses").delete().eq("course_id", id);
      if (teams.length > 0) {
        const { error: teamInsertError } = await supabase.from("team_courses").insert(
          teams.map((team_id) => ({ course_id: id, team_id }))
        );
        if (teamInsertError) {
          console.error("[updateCourse] team_courses insert error:", teamInsertError.message);
        }
      }

      // Sync Job Titles
      await supabase.from("job_title_courses").delete().eq("course_id", id);
      if (jobTitles.length > 0) {
        const { error: jobInsertError } = await supabase.from("job_title_courses").insert(
          jobTitles.map((job_title_id) => ({ course_id: id, job_title_id }))
        );
        if (jobInsertError) {
          console.error("[updateCourse] job_title_courses insert error:", jobInsertError.message);
        }
      }

      // Sync Tags
      await supabase.from("course_tags").delete().eq("course_id", id);
      if (tags.length > 0) {
        const { error: tagsInsertError } = await supabase.from("course_tags").insert(
          tags.map((tag_id) => ({ course_id: id, tag_id }))
        );
        if (tagsInsertError) {
          console.error("[updateCourse] course_tags insert error:", tagsInsertError.message);
        }
      }
    }
  } catch (err) {
    console.error("[updateCourse] B2B matrix sync error:", err);
    // We don't return an error here to prevent blocking the main course update, 
    // but in a production app we might want to handle it more strictly.
  }

  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${existing.slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath(`/courses/${encodeURIComponent(existing.slug)}`);

  if (slugChanged) {
    revalidatePath(`/dashboard/courses/${newSlug}`);
    revalidatePath(`/courses/${encodeURIComponent(newSlug)}`);
    redirect(`/dashboard/courses/${newSlug}`);
  }

  return { success: true };
}

/** Серверный потолок после клиентского сжатия (цель 1 МБ); допускаем запас. */
const GALLERY_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

function galleryExtFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export type UploadCourseGalleryImageResult =
  | { url: string; error?: undefined }
  | { url?: undefined; error: string };

/** Загрузка одного сжатого кадра галереи в `course-covers` (путь: `{uid}/gallery/{courseId}/…`). */
export async function uploadCourseGalleryImage(
  courseId: string,
  formData: FormData,
): Promise<UploadCourseGalleryImageResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const cid = courseId.trim();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Файл не передан." };
  }
  if (file.size === 0) {
    return { error: "Пустой файл." };
  }
  if (file.size > GALLERY_UPLOAD_MAX_BYTES) {
    return {
      error: "Файл слишком большой (макс. 2 МБ). Сожмите изображение на клиенте.",
    };
  }

  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);
  if (!allowed.has(file.type)) {
    return { error: "Допустимы только JPEG, PNG, WebP или GIF." };
  }

  const supabase = await createClient();

  const { data: row, error: fetchError } = await supabase
    .from("courses")
    // @ts-expect-error owner alias is not in generated Database types yet
    .select(COURSE_MUTATION_SELECT)
    .eq("id", cid)
    .maybeSingle();

  if (fetchError || !row) {
    return { error: "Курс не найден." };
  }

  const accessError = await assertCourseMutationAccess(supabase, {
    userId: user.id,
    role: profile.role,
    courseId: row.id,
    teacherId: row.teacher_id,
    courseOwnerRole: getCourseOwnerRole(row),
  });
  if (accessError) {
    return { error: accessError };
  }

  const ext = galleryExtFromMime(file.type);
  const objectPath = `${user.id}/gallery/${cid}/${randomUUID()}.${ext}`;
  const body = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("course-covers")
    .upload(objectPath, body, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError.message || "Ошибка загрузки в Storage." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("course-covers").getPublicUrl(objectPath);

  return { url: publicUrl };
}

export type UpdateCourseImageState = {
  success?: boolean;
  error?: string;
};

/** Обновляет только `image_url` (обложка из Storage). */
export async function updateCourseImage(
  courseId: string,
  imageUrl: string,
): Promise<UpdateCourseImageState> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const id = courseId.trim();
  const url = imageUrl.trim();

  if (!id) {
    return { error: "Не указан курс." };
  }

  const supabase = await createClient();

  const { data: course, error: fetchError } = await supabase
    .from("courses")
    // @ts-expect-error owner alias is not in generated Database types yet
    .select(COURSE_MUTATION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !course) {
    return { error: "Курс не найден." };
  }

  const accessError = await assertCourseMutationAccess(supabase, {
    userId: user.id,
    role: profile.role,
    courseId: course.id,
    teacherId: course.teacher_id,
    courseOwnerRole: getCourseOwnerRole(course),
  });
  if (accessError) {
    return { error: accessError };
  }

  const { error: updateError } = await supabase
    .from("courses")
    .update({ image_url: url.length > 0 ? url : null })
    .eq("id", id);

  if (updateError) {
    console.error("[updateCourseImage]", updateError.message);
    return { error: updateError.message || "Не удалось сохранить обложку." };
  }

  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard");
  return { success: true };
}

export type UpdateCourseVideoState = {
  success?: boolean;
  error?: string;
};

/** Обновляет только `video_url` (self-hosted видео из Storage). */
export async function updateCourseVideo(
  courseId: string,
  videoUrl: string,
): Promise<UpdateCourseVideoState> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const id = courseId.trim();
  const url = videoUrl.trim();

  if (!id) {
    return { error: "Не указан курс." };
  }

  const supabase = await createClient();

  const { data: course, error: fetchError } = await supabase
    .from("courses")
    // @ts-expect-error owner alias is not in generated Database types yet
    .select(COURSE_MUTATION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !course) {
    return { error: "Курс не найден." };
  }

  const accessError = await assertCourseMutationAccess(supabase, {
    userId: user.id,
    role: profile.role,
    courseId: course.id,
    teacherId: course.teacher_id,
    courseOwnerRole: getCourseOwnerRole(course),
  });
  if (accessError) {
    return { error: accessError };
  }

  const { error: updateError } = await supabase
    .from("courses")
    .update({ video_url: url.length > 0 ? url : null })
    .eq("id", id);

  if (updateError) {
    console.error("[updateCourseVideo]", updateError.message);
    return { error: updateError.message || "Не удалось сохранить видео." };
  }

  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard");
  return { success: true };
}
