/**
 * Сжатие изображения в браузере (Canvas) для загрузки в Storage.
 * Цель: ширина ≤ 800px, качество ~0.7, по возможности меньше 100 KB.
 */

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Не удалось прочитать изображение"));
    };
    img.src = objectUrl;
  });
}

export async function compressImageForTestUpload(file: File): Promise<Blob> {
  const img = await loadImageFromFile(file);
  const maxW = 800;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w <= 0 || h <= 0) {
    throw new Error("Некорректные размеры изображения");
  }
  if (w > maxW) {
    h = Math.round((h * maxW) / w);
    w = maxW;
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas недоступен");
  }
  ctx.drawImage(img, 0, 0, w, h);

  async function toBlob(
    type: string,
    quality: number,
  ): Promise<Blob | null> {
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), type, quality);
    });
  }

  const types: { mime: string; minQ: number }[] = [
    { mime: "image/webp", minQ: 0.35 },
    { mime: "image/jpeg", minQ: 0.35 },
  ];

  for (const { mime, minQ } of types) {
    let quality = 0.7;
    for (let step = 0; step < 10; step++) {
      const blob = await toBlob(mime, quality);
      if (blob && blob.size > 0 && blob.size <= 100_000) {
        return blob;
      }
      quality = Math.max(minQ, quality - 0.08);
    }
  }

  const last = await toBlob("image/jpeg", 0.5);
  if (last && last.size > 0) {
    return last;
  }

  throw new Error("Не удалось сжать изображение");
}
