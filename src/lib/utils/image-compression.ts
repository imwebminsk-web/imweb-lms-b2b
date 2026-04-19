import imageCompression from "browser-image-compression";

/**
 * Сжимает изображение в браузере перед загрузкой (цель ≤ ~100 КБ для экономии Storage).
 */
export async function compressImage(file: File): Promise<File> {
  const blob = await imageCompression(file, {
    maxSizeMB: 0.1,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
  });
  const base = file.name.replace(/\.[^/.]+$/, "") || "image";
  return new File([blob], `${base}.jpg`, {
    type: blob.type || "image/jpeg",
  });
}
