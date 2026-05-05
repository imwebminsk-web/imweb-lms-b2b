import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
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

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Пустой файл." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Файл слишком большой (макс. 2 МБ)." },
      { status: 400 },
    );
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Допустимы только JPEG, PNG, WebP или GIF." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Нужна авторизация." }, { status: 401 });
  }

  const ext = extFromMime(file.type);
  const objectPath = `${user.id}/editor/${randomUUID()}.${ext}`;
  const body = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("course-content")
    .upload(objectPath, body, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message || "Ошибка загрузки в Storage." },
      { status: 500 },
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("course-content").getPublicUrl(objectPath);

  return NextResponse.json({ url: publicUrl });
}
