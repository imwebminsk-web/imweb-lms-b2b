/** Пустой документ TipTap и пробелы считаем пустым текстом. */
export function normalizeRichTextHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed || trimmed === "<p></p>") return "";
  return html;
}

export function isLikelyHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value.trim());
}

/** Текст без тегов — для валидации и aria-label. */
export function plainTextFromRichContent(value: string): string {
  const normalized = normalizeRichTextHtml(value);
  if (!normalized) return "";
  if (!isLikelyHtml(normalized)) return normalized.trim();
  return normalized
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasRichTextContent(value: string): boolean {
  return plainTextFromRichContent(value).length > 0;
}
