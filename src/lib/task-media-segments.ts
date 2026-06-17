import { transformMediaUrlsInHtml } from "@/lib/media-utils";

export type InstructionHtmlSegment =
  | { kind: "html"; html: string }
  | { kind: "iframe"; outerHtml: string }
  | {
      kind: "native";
      tag: "audio" | "video";
      src: string;
      poster?: string;
    };

const MEDIA_TAG_PATTERN =
  /<(iframe|audio|video)\b[\s\S]*?<\/\1>|<(iframe|audio|video)\b[^>]*\/>/gi;

function readAttr(
  outerHtml: string,
  name: string,
): string | undefined {
  const re = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i",
  );
  const match = outerHtml.match(re);
  const value = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
  return value || undefined;
}

function resolveNativeMediaSrc(outerHtml: string): string {
  const direct = readAttr(outerHtml, "src");
  if (direct) return direct;

  const sourceMatch = outerHtml.match(
    /<source\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  );
  return (sourceMatch?.[1] ?? sourceMatch?.[2] ?? "").trim();
}

function segmentFromMediaTag(outerHtml: string, tag: "iframe" | "audio" | "video"): InstructionHtmlSegment {
  if (tag === "iframe") {
    return { kind: "iframe", outerHtml };
  }

  return {
    kind: "native",
    tag,
    src: resolveNativeMediaSrc(outerHtml),
    poster: tag === "video" ? readAttr(outerHtml, "poster") : undefined,
  };
}

/**
 * Разбивает HTML инструкции на фрагменты для лимитера native media.
 * Regex-реализация — одинаковый результат на сервере и в браузере (без DOMParser).
 */
export function splitInstructionHtmlForMediaLimiter(
  html: string,
): InstructionHtmlSegment[] {
  const transformed = transformMediaUrlsInHtml(html).trim();
  if (!transformed) return [];

  const matches: { outerHtml: string; index: number }[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(MEDIA_TAG_PATTERN.source, MEDIA_TAG_PATTERN.flags);

  while ((match = pattern.exec(transformed)) !== null) {
    matches.push({
      outerHtml: match[0],
      index: match.index,
    });
  }

  if (matches.length === 0) {
    return [{ kind: "html", html: transformed }];
  }

  const segments: InstructionHtmlSegment[] = [];
  let cursor = 0;

  for (const item of matches) {
    if (item.index > cursor) {
      const part = transformed.slice(cursor, item.index);
      if (part.trim()) {
        segments.push({ kind: "html", html: part });
      }
    }

    const tagMatch = item.outerHtml.match(/^<(iframe|audio|video)\b/i);
    const normalizedTag = (tagMatch?.[1]?.toLowerCase() ?? "video") as
      | "iframe"
      | "audio"
      | "video";
    segments.push(segmentFromMediaTag(item.outerHtml, normalizedTag));
    cursor = item.index + item.outerHtml.length;
  }

  if (cursor < transformed.length) {
    const tail = transformed.slice(cursor);
    if (tail.trim()) {
      segments.push({ kind: "html", html: tail });
    }
  }

  return segments.length > 0 ? segments : [{ kind: "html", html: transformed }];
}

export function instructionHtmlHasNativeMedia(html: string): boolean {
  return /<(audio|video)\b/i.test(html);
}
