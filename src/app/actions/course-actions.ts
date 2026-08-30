"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { verifyAccess, type Role } from "@/lib/auth/rbac";
import {
  assertCourseMutationAccess,
  COURSE_MUTATION_SELECT,
  getCourseOwnerRole,
} from "@/lib/auth/course-access";
import { createClient } from "@/lib/supabase/server";
import {
  courseSettingsSchema,
  type CourseSettingsPayload,
} from "@/lib/validations/course-schemas";
import { taxonomyIdsFormSchema } from "@/lib/validations/course-settings-schema";
import type { Database } from "@/types/database.types";
import { slugify } from "@/lib/utils/slug";

export type CreateCourseState = {
  success?: boolean;
  error?: string;
};

export type UpdateCourseResult =
  | { ok: true }
  | { ok: false; error: string };

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
    return "Не удалось сохранить таксономии курса.";
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
    return "Не удалось сохранить таксономии курса.";
  }

  return null;
}

export async function updateCourse(
  courseId: string,
  data: CourseSettingsPayload,
): Promise<UpdateCourseResult> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const parsed = courseSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте введённые данные.",
    };
  }

  const payload = parsed.data;
  const id = courseId.trim();
  if (!id) {
    return { ok: false, error: "Не указан курс." };
  }

  if (payload.status === "archived") {
    return {
      ok: false,
      error: "Чтобы архивировать курс, используйте действие «В архив».",
    };
  }

  const title = payload.title;
  const newSlug = sanitizeSlug(payload.slug);
  if (!newSlug) {
    return { ok: false, error: "URL курса не может быть пустым." };
  }

  const descriptionRaw = (payload.description ?? "").trim();
  const detailedDescriptionRaw = (payload.landingDescription ?? "").trim();
  const youtubeRaw = (payload.youtube_url ?? "").trim();
  const vimeoRaw = (payload.vimeo_url ?? "").trim();
  const priceRaw = payload.price == null ? "" : String(payload.price).trim();
  const durationValueRaw =
    payload.duration == null ? "" : String(payload.duration).trim();
  const durationUnitRaw = (payload.duration_unit ?? "").trim();
  const startDateRaw = (payload.start_date ?? "").trim();
  const hasCertificateRaw = payload.certificateEnabled;
  const teams = (payload.teams ?? []).filter((t) => typeof t === "string");
  const jobTitles = (payload.jobTitles ?? []).filter((t) => typeof t === "string");
  const tags = (payload.tags ?? []).filter((t) => typeof t === "string");
  const shouldSyncB2b =
    payload.isGlobal !== undefined ||
    payload.teams !== undefined ||
    payload.jobTitles !== undefined ||
    payload.tags !== undefined;
  const is_global = payload.isGlobal === true;

  const priceNum = Number(priceRaw);
  if (priceRaw.length > 0 && (!Number.isFinite(priceNum) || priceNum < 0)) {
    return { ok: false, error: "Укажите корректную цену (число ≥ 0)." };
  }

  let taxonomyIds: string[] | undefined;
  if (payload.taxonomy_ids !== undefined) {
    const taxonomyParse = taxonomyIdsFormSchema.safeParse(payload.taxonomy_ids);
    if (!taxonomyParse.success) {
      return { ok: false, error: "Некорректные фильтры каталога." };
    }
    taxonomyIds = [...new Set(taxonomyParse.data)];
  }

  const userClient = await createClient();
  // `as any`: `course_tags` нет в generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writer = userClient as any;

  if (durationUnitRaw.length > 0 && !DURATION_UNIT.has(durationUnitRaw)) {
    return { ok: false, error: "Некорректная единица длительности." };
  }

  let durationValue: number | null = null;
  if (durationValueRaw.length > 0) {
    const n = Number(durationValueRaw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return { ok: false, error: "Длительность: укажите целое число ≥ 0." };
    }
    durationValue = n;
  }

  let start_date: string | null = null;
  if (startDateRaw.length > 0) {
    const d = new Date(`${startDateRaw}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: "Некорректная дата старта." };
    }
    start_date = d.toISOString();
  }

  const status = payload.status as CourseStatus;

  const { data: existing, error: fetchError } = await writer
    .from("courses")
    .select(COURSE_MUTATION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false, error: "Курс не найден." };
  }

  const accessError = await assertCourseMutationAccess(userClient, {
    userId: user.id,
    role: (profile as unknown as { role: Role }).role,
    courseId: existing.id,
    teacherId: existing.teacher_id,
    courseOwnerRole: getCourseOwnerRole(existing),
  });
  if (accessError) {
    return { ok: false, error: accessError };
  }

  const slugChanged = newSlug !== existing.slug;

  if (slugChanged) {
    const { data: taken } = await writer
      .from("courses")
      .select("id")
      .eq("slug", newSlug)
      .maybeSingle();

    if (taken) {
      return { ok: false, error: "Этот URL уже занят другим курсом." };
    }
  }

  const description = descriptionRaw.length > 0 ? descriptionRaw : null;
  const detailed_description =
    detailedDescriptionRaw.length > 0 ? detailedDescriptionRaw : null;
  const youtube_url = youtubeRaw.length > 0 ? youtubeRaw : null;
  const vimeo_url = vimeoRaw.length > 0 ? vimeoRaw : null;
  const duration_unit = durationUnitRaw.length > 0 ? durationUnitRaw : null;
  const has_certificate = hasCertificateRaw === true;

  const existingGallery = Array.isArray(existing.promotional_images)
    ? existing.promotional_images.filter(
        (x: unknown): x is string => typeof x === "string" && x.trim().length > 0,
      )
    : [];
  let promotional_images = existingGallery;
  if (payload.promotional_images !== undefined) {
    const urls = payload.promotional_images.filter(
      (x) =>
        typeof x === "string" &&
        x.trim().length > 0 &&
        /^https?:\/\//i.test(x.trim()),
    );
    if (urls.length > 24) {
      return { ok: false, error: "В галерее не более 24 изображений." };
    }
    promotional_images = [...new Set(urls.map((u) => u.trim()))];
  }

  const coursePatch: Database["public"]["Tables"]["courses"]["Update"] = {
    title,
    slug: newSlug,
    description,
    status,
  };

  if (payload.price !== undefined && priceRaw.length > 0 && Number.isFinite(priceNum)) {
    coursePatch.price = priceNum.toFixed(2);
  }
  if (payload.landingDescription !== undefined) {
    coursePatch.detailed_description = detailed_description;
  }
  if (payload.youtube_url !== undefined) {
    coursePatch.youtube_url = youtube_url;
  }
  if (payload.vimeo_url !== undefined) {
    coursePatch.vimeo_url = vimeo_url;
  }
  if (payload.promotional_images !== undefined) {
    coursePatch.promotional_images = promotional_images;
  }
  if (payload.duration !== undefined || payload.duration_unit !== undefined) {
    coursePatch.duration_value = durationValue;
    coursePatch.duration_unit = duration_unit;
  }
  if (payload.start_date !== undefined) {
    coursePatch.start_date = start_date;
  }
  if (payload.certificateEnabled !== undefined) {
    coursePatch.has_certificate = has_certificate;
  }

  const { error: updateError } = await writer
    .from("courses")
    .update(
      shouldSyncB2b
        ? ({ ...coursePatch, is_global } as typeof coursePatch)
        : coursePatch,
    )
    .eq("id", id);

  if (updateError) {
    console.error("[updateCourse]", updateError.message);
    return { ok: false, error: "Не удалось сохранить изменения." };
  }

  if (taxonomyIds !== undefined) {
    if (taxonomyIds.length > 0) {
      const { data: existingTaxonomies, error: taxonomyLookupError } =
        await writer.from("taxonomies").select("id").in("id", taxonomyIds);

      if (taxonomyLookupError) {
        console.error("[updateCourse:taxonomies]", taxonomyLookupError.message);
        return { ok: false, error: "Не удалось проверить фильтры каталога." };
      }

      if ((existingTaxonomies ?? []).length !== taxonomyIds.length) {
        return { ok: false, error: "Некорректные фильтры каталога." };
      }
    }

    const taxonomySyncError = await syncCourseTaxonomies(writer, id, taxonomyIds);

    if (taxonomySyncError) {
      return { ok: false, error: "Не удалось сохранить таксономии курса." };
    }
  }

  try {
    if (shouldSyncB2b && is_global) {
      await writer.from("team_courses").delete().eq("course_id", id);
      await writer.from("job_title_courses").delete().eq("course_id", id);
      await writer.from("course_tags").delete().eq("course_id", id);
    } else if (shouldSyncB2b) {
      await writer.from("team_courses").delete().eq("course_id", id);
      if (teams.length > 0) {
        const { error: teamInsertError } = await writer.from("team_courses").insert(
          teams.map((team_id) => ({ course_id: id, team_id })),
        );
        if (teamInsertError) {
          console.error("[updateCourse] team_courses insert error:", teamInsertError.message);
        }
      }

      await writer.from("job_title_courses").delete().eq("course_id", id);
      if (jobTitles.length > 0) {
        const { error: jobInsertError } = await writer.from("job_title_courses").insert(
          jobTitles.map((job_title_id) => ({ course_id: id, job_title_id })),
        );
        if (jobInsertError) {
          console.error("[updateCourse] job_title_courses insert error:", jobInsertError.message);
        }
      }

      await writer.from("course_tags").delete().eq("course_id", id);
      if (tags.length > 0) {
        const { error: tagsInsertError } = await writer.from("course_tags").insert(
          tags.map((tag_id) => ({ course_id: id, tag_id })),
        );
        if (tagsInsertError) {
          console.error("[updateCourse] course_tags insert error:", tagsInsertError.message);
        }
      }
    }
  } catch (err) {
    console.error("[updateCourse] B2B matrix sync error:", err);
  }

  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${existing.slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath(`/courses/${encodeURIComponent(existing.slug)}`);

  if (slugChanged) {
    revalidatePath(`/dashboard/courses/${newSlug}`);
    revalidatePath(`/courses/${encodeURIComponent(newSlug)}`);
  }

  return { ok: true };
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

/** Обновляет только `image_url` (обложка из Storage). */
export async function updateCourseImage(
  courseId: string,
  publicUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user, profile } = await verifyAccess(["admin", "head_teacher", "teacher"]);

  const id = courseId.trim();
  const url = publicUrl.trim();

  if (!id) {
    return { ok: false, error: "Не указан курс." };
  }

  const userClient = await createClient();

  try {
    const { data: course, error: fetchError } = await userClient
      .from("courses")
      .select(COURSE_MUTATION_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !course) {
      if (fetchError) {
        console.error("[updateCourseImage]", fetchError.message);
      }
      return { ok: false, error: "Курс не найден." };
    }

    const accessError = await assertCourseMutationAccess(userClient, {
      userId: user.id,
      role: (profile as unknown as { role: Role }).role,
      courseId: (course as { id: string }).id,
      teacherId: (course as { teacher_id: string }).teacher_id,
      courseOwnerRole: getCourseOwnerRole(course),
    });
    if (accessError) {
      return { ok: false, error: accessError };
    }

    const { error: updateError } = await userClient
      .from("courses")
      .update({ image_url: url.length > 0 ? url : null })
      .eq("id", id);

    if (updateError) {
      console.error("[updateCourseImage]", updateError.message);
      return { ok: false, error: "Не удалось обновить обложку." };
    }
  } catch (err) {
    console.error("[updateCourseImage]", err);
    return { ok: false, error: "Не удалось обновить обложку." };
  }

  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard");
  return { ok: true };
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
