import imageCompression from "browser-image-compression";

/** Цель сжатия для картинок курса и редактора (1 МБ). */
export const COURSE_IMAGE_MAX_SIZE_MB = 1;
export const COURSE_IMAGE_MAX_BYTES = COURSE_IMAGE_MAX_SIZE_MB * 1024 * 1024;

type CompressImageOptions = {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
};

/**
 * Сжимает изображение в браузере перед загрузкой.
 * По умолчанию — до 1 МБ и ширины 1920px (курс / редактор).
 * Для аватара передайте меньший maxSizeMB.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  const blob = await imageCompression(file, {
    maxSizeMB: options.maxSizeMB ?? COURSE_IMAGE_MAX_SIZE_MB,
    maxWidthOrHeight: options.maxWidthOrHeight ?? 1920,
    useWebWorker: true,
  });
  const base = file.name.replace(/\.[^/.]+$/, "") || "image";
  return new File([blob], `${base}.jpg`, {
    type: blob.type || "image/jpeg",
  });
}
