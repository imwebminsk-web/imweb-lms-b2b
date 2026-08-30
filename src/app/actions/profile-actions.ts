"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { verifyAccess } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateProfileSchema } from "@/lib/validations/profile-schema";

export type ProfileMutationResult =
  | { ok: true }
  | { ok: false; error: string };

export type UploadAvatarResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export async function updateProfileName(
  data: z.infer<typeof updateProfileSchema>,
): Promise<ProfileMutationResult> {
  const parsed = updateProfileSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте введённые данные.",
    };
  }

  const { user } = await verifyAccess([
    "admin",
    "head_teacher",
    "teacher",
    "student",
  ]);

  const admin = createAdminClient();
  if (!admin) {
    console.error("[updateProfileName] admin client is not configured");
    return { ok: false, error: "Не удалось сохранить изменения. Попробуйте снова." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id);

  if (error) {
    console.error("[updateProfileName]", error.message);
    return {
      ok: false,
      error: "Не удалось сохранить изменения. Попробуйте снова.",
    };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function uploadAvatar(
  formData: FormData,
): Promise<UploadAvatarResult> {
  const { user } = await verifyAccess([
    "admin",
    "head_teacher",
    "teacher",
    "student",
  ]);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Выберите файл изображения." };
  }

  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return { ok: false, error: "Допустимы только JPEG, PNG, WebP или GIF." };
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Файл слишком большой." };
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error("[uploadAvatar] admin client is not configured");
    return { ok: false, error: "Не удалось загрузить аватар." };
  }

  try {
    const ext = extFromMime(file.type);
    const objectPath = `${user.id}/avatar.${ext}`;
    const body = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from(AVATAR_BUCKET)
      .upload(objectPath, body, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("[uploadAvatar]", uploadError.message);
      return { ok: false, error: "Не удалось загрузить аватар." };
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath);

    const url = `${publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await admin
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", user.id);

    if (updateError) {
      console.error("[uploadAvatar]", updateError.message);
      return { ok: false, error: "Не удалось сохранить аватар." };
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/", "layout");
    return { ok: true, url };
  } catch (err) {
    console.error("[uploadAvatar]", err);
    return { ok: false, error: "Не удалось загрузить аватар." };
  }
}
