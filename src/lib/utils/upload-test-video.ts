import { createClient } from "@/lib/supabase/client";

const BUCKET = "test-attachments";
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
]);

function extensionForFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".webm")) return "webm";
  if (name.endsWith(".ogg")) return "ogg";
  return "mp4";
}

function contentTypeForExtension(ext: string, fileType: string): string {
  if (fileType) return fileType;
  if (ext === "webm") return "video/webm";
  if (ext === "ogg") return "video/ogg";
  return "video/mp4";
}

export async function uploadTestAttachmentVideo(file: File): Promise<string> {
  if (
    !ALLOWED_TYPES.has(file.type) &&
    !/\.(mp4|webm|ogg)$/i.test(file.name)
  ) {
    throw new Error("Допустимы только видеофайлы MP4, WebM или OGG");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Файл слишком большой. Максимум 50 МБ.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Войдите в систему, чтобы загрузить видео");
  }

  const ext = extensionForFile(file);
  const path = `${user.id}/editor/${crypto.randomUUID()}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: contentTypeForExtension(ext, file.type),
  });

  if (upErr) {
    throw new Error(upErr.message);
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!pub?.publicUrl) {
    throw new Error("Не удалось получить публичный URL");
  }

  return pub.publicUrl;
}
