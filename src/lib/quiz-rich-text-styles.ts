import { cn } from "@/lib/utils";

/** Ограничение размера встроенных картинок в HTML вопросов (prose / parsed HTML). */
export const QUIZ_PROSE_EMBEDDED_IMG =
  "[&_img]:mx-auto [&_img]:my-4 [&_img]:max-h-80 [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:object-contain";

/** Базовые классы prose для HTML-инструкций и текста заданий в квизе. */
export const QUIZ_PROSE_BASE =
  "prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 [&_p+p]:mt-2";

const EMBEDDED_IMG_CLASS =
  "mx-auto my-4 max-h-80 w-auto max-w-full rounded-lg object-contain";

/** Снимает inline width/height и добавляет единые классы на `<img>` в сохранённом HTML. */
export function normalizeEmbeddedImagesInHtml(html: string): string {
  return html.replace(/<img\b([^>]*)\/?>/gi, (_full, rawAttrs: string) => {
    let attrs = rawAttrs;

    attrs = attrs.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*'|\S+)/gi, "");

    attrs = attrs.replace(
      /\sstyle\s*=\s*("([^"]*)"|'([^']*)')/i,
      (_styleMatch, _quote, doubleQuoted: string, singleQuoted: string) => {
        const style = (doubleQuoted ?? singleQuoted ?? "")
          .replace(/\s*(?:max-)?width\s*:\s*[^;]+;?/gi, "")
          .replace(/\s*(?:max-)?height\s*:\s*[^;]+;?/gi, "")
          .trim();
        return style ? ` style="${style}"` : "";
      },
    );

    const classMatch = attrs.match(/\sclass\s*=\s*("([^"]*)"|'([^']*)')/i);
    if (classMatch) {
      const existing = classMatch[2] ?? classMatch[3] ?? "";
      const merged = cn(existing, EMBEDDED_IMG_CLASS);
      attrs = attrs.replace(classMatch[0], ` class="${merged}"`);
    } else {
      attrs = ` class="${EMBEDDED_IMG_CLASS}"${attrs}`;
    }

    return `<img${attrs}>`;
  });
}
