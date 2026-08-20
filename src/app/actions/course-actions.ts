"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  ageGroupFormSchema,
  deliveryFormatFormSchema,
} from "@/lib/validations/course-settings-schema";
import type { Database } from "@/types/database.types";
import {
  collectCourseTaxonomyIds,
  type CourseTaxonomySelections,
} from "@/lib/course-taxonomy-map";

export type CreateCourseState = {
  success?: boolean;
  error?: string;
};

export type UpdateCourseState = {
  success?: boolean;
  error?: string;
};

/**
 * Простая транслитерация русских букв в латиницу (для читаемых ASCII-slug).
 * Ъ/Ь опускаются; ё → yo; ж/х/ц/ч/ш/щ → digraph.
 */
function transliterate(text: string): string {
  const map: Record<string, string> = {
    А: "a",
    а: "a",
    Б: "b",
    б: "b",
    В: "v",
    в: "v",
    Г: "g",
    г: "g",
    Д: "d",
    д: "d",
    Е: "e",
    е: "e",
    Ё: "yo",
    ё: "yo",
    Ж: "zh",
    ж: "zh",
    З: "z",
    з: "z",
    И: "i",
    и: "i",
    Й: "y",
    й: "y",
    К: "k",
    к: "k",
    Л: "l",
    л: "l",
    М: "m",
    м: "m",
    Н: "n",
    н: "n",
    О: "o",
    о: "o",
    П: "p",
    п: "p",
    Р: "r",
    р: "r",
    С: "s",
    с: "s",
    Т: "t",
    т: "t",
    У: "u",
    у: "u",
    Ф: "f",
    ф: "f",
    Х: "h",
    х: "h",
    Ц: "ts",
    ц: "ts",
    Ч: "ch",
    ч: "ch",
    Ш: "sh",
    ш: "sh",
    Щ: "shch",
    щ: "shch",
    Ъ: "",
    ъ: "",
    Ы: "y",
    ы: "y",
    Ь: "",
    ь: "",
    Э: "e",
    э: "e",
    Ю: "yu",
    ю: "yu",
    Я: "ya",
    я: "ya",
    І: "i",
    і: "i",
    Ї: "yi",
    ї: "yi",
    Є: "ye",
    є: "ye",
    Ґ: "g",
    ґ: "g",
  };

  let out = "";
  for (const ch of text) {
    out += map[ch] ?? ch;
  }
  return out;
}

/** Slug: транслит → нижний регистр, пробелы → дефисы, только буквы/цифры (латиница после транслита). */
function baseSlugFromTitle(title: string): string {
  const transliterated = transliterate(title.trim());
  const normalized = transliterated
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "");
  const replaced = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return replaced || "course";
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

export async function createCourse(
  _prev: CreateCourseState,
  formData: FormData,
): Promise<CreateCourseState> {
  const title = String(formData.get("title") ?? "").trim();

  if (!title) {
    return { error: "Укажите название курса." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "Профиль не найден." };
  }

  if (
    profile.role !== "teacher" &&
    profile.role !== "admin" &&
    profile.role !== "head_teacher"
  ) {
    return {
      error: "Создавать курсы могут только преподаватели, руководители и администраторы.",
    };
  }

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
  return { success: true };
}

type CourseStatus = Database["public"]["Enums"]["course_status"];

const DURATION_UNIT = new Set(["hours", "weeks", "months"]);

async function syncCourseTaxonomies(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseId: string,
  selections: CourseTaxonomySelections,
): Promise<string | null> {
  const taxonomyIds = collectCourseTaxonomyIds(selections);

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
  const ageGroupRaw = String(formData.get("age_group") ?? "").trim();
  const durationValueRaw = String(formData.get("duration_value") ?? "").trim();
  const durationUnitRaw = String(formData.get("duration_unit") ?? "").trim();
  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  const hasCertificateRaw = String(formData.get("has_certificate") ?? "").trim();
  const promotionalImagesRaw = String(
    formData.get("promotional_images") ?? "",
  ).trim();
  const deliveryFormatRaw = String(
    formData.get("delivery_format") ?? "",
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

  const ageParsed = ageGroupFormSchema.safeParse(ageGroupRaw);
  if (!ageParsed.success) {
    return { error: "Некорректная возрастная группа." };
  }

  const deliveryParsed = deliveryFormatFormSchema.safeParse(deliveryFormatRaw);
  if (!deliveryParsed.success) {
    return { error: "Некорректный формат проведения." };
  }

  const delivery_format =
    deliveryParsed.data.length > 0 ? deliveryParsed.data : null;
  const age_group = ageParsed.data.length > 0 ? ageParsed.data : null;

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("courses")
    .select("id, teacher_id, slug")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: "Курс не найден." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdminOrHead =
    profile?.role === "admin" || profile?.role === "head_teacher";

  if (!isAdminOrHead && existing.teacher_id !== user.id) {
    return { error: "Нет прав на изменение этого курса." };
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

  if (!isAdminOrHead) {
    query = query.eq("teacher_id", user.id);
  }

  const { error: updateError } = await query;

  if (updateError) {
    console.error("[updateCourse]", updateError.message);
    return {
      error: updateError.message || "Не удалось сохранить изменения.",
    };
  }

  const taxonomySyncError = await syncCourseTaxonomies(supabase, id, {
    marketing_audience: null,
    delivery_format,
    language: null,
    age_group,
    level: null,
  });

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

/** Серверный потолок после клиентского сжатия (~100 КБ); допускаем запас. */
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: row, error: fetchError } = await supabase
    .from("courses")
    .select("id, teacher_id")
    .eq("id", cid)
    .maybeSingle();

  if (fetchError || !row) {
    return { error: "Курс не найден." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdminOrHead =
    profile?.role === "admin" || profile?.role === "head_teacher";

  if (!isAdminOrHead && row.teacher_id !== user.id) {
    return { error: "Нет прав на загрузку." };
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
  const id = courseId.trim();
  const url = imageUrl.trim();

  if (!id) {
    return { error: "Не указан курс." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: course, error: fetchError } = await supabase
    .from("courses")
    .select("id, teacher_id, slug")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !course) {
    return { error: "Курс не найден." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdminOrHead =
    profile?.role === "admin" || profile?.role === "head_teacher";

  if (!isAdminOrHead && course.teacher_id !== user.id) {
    return { error: "Нет прав." };
  }

  let query = supabase
    .from("courses")
    .update({ image_url: url.length > 0 ? url : null })
    .eq("id", id);

  if (!isAdminOrHead) {
    query = query.eq("teacher_id", user.id);
  }

  const { error: updateError } = await query;

  if (updateError) {
    console.error("[updateCourseImage]", updateError.message);
    return { error: updateError.message || "Не удалось сохранить обложку." };
  }

  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${course.slug}`);
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
  const id = courseId.trim();
  const url = videoUrl.trim();

  if (!id) {
    return { error: "Не указан курс." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Нужна авторизация." };
  }

  const { data: course, error: fetchError } = await supabase
    .from("courses")
    .select("id, teacher_id, slug")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !course) {
    return { error: "Курс не найден." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdminOrHead =
    profile?.role === "admin" || profile?.role === "head_teacher";

  if (!isAdminOrHead && course.teacher_id !== user.id) {
    return { error: "Нет прав." };
  }

  let query = supabase
    .from("courses")
    .update({ video_url: url.length > 0 ? url : null })
    .eq("id", id);

  if (!isAdminOrHead) {
    query = query.eq("teacher_id", user.id);
  }

  const { error: updateError } = await query;

  if (updateError) {
    console.error("[updateCourseVideo]", updateError.message);
    return { error: updateError.message || "Не удалось сохранить видео." };
  }

  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${course.slug}`);
  revalidatePath("/dashboard");
  return { success: true };
}
