import { createClient } from "@/lib/supabase/client";

const BUCKET = "test-attachments";
const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
]);

function extensionForFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".wav")) return "wav";
  if (name.endsWith(".ogg")) return "ogg";
  if (name.endsWith(".m4a")) return "m4a";
  return "mp3";
}

export async function uploadTestAttachmentAudio(file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type) && !/\.(mp3|wav|ogg|m4a)$/i.test(file.name)) {
    throw new Error("Допустимы только аудиофайлы (MP3, WAV и др.)");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Файл слишком большой (максимум 15 МБ)");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Войдите в систему, чтобы загрузить аудио");
  }

  const ext = extensionForFile(file);
  const path = `${user.id}/editor/${crypto.randomUUID()}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType:
      file.type ||
      (ext === "wav" ? "audio/wav" : ext === "ogg" ? "audio/ogg" : "audio/mpeg"),
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
