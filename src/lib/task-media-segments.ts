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

function resolveNativeMediaSrc(el: Element): string {
  const direct = el.getAttribute("src")?.trim();
  if (direct) return direct;
  const source = el.querySelector("source");
  return source?.getAttribute("src")?.trim() ?? "";
}

/** Разбивает HTML инструкции на фрагменты для лимитера native media. */
export function splitInstructionHtmlForMediaLimiter(
  html: string,
): InstructionHtmlSegment[] {
  const transformed = transformMediaUrlsInHtml(html).trim();
  if (!transformed) return [];

  if (typeof DOMParser === "undefined") {
    return [{ kind: "html", html: transformed }];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString("<div data-root></div>", "text/html");
  const root = doc.querySelector("[data-root]");
  if (!root) return [{ kind: "html", html: transformed }];

  root.innerHTML = transformed;

  const placeholders: InstructionHtmlSegment[] = [];
  let markerIndex = 0;

  root.querySelectorAll("iframe, audio, video").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const marker = `__MEDIA_SEGMENT_${markerIndex}__`;
    markerIndex += 1;

    if (tag === "iframe") {
      placeholders.push({ kind: "iframe", outerHtml: el.outerHTML });
    } else {
      placeholders.push({
        kind: "native",
        tag: tag as "audio" | "video",
        src: resolveNativeMediaSrc(el),
        poster:
          tag === "video"
            ? el.getAttribute("poster")?.trim() || undefined
            : undefined,
      });
    }

    el.replaceWith(doc.createComment(marker));
  });

  if (placeholders.length === 0) {
    return [{ kind: "html", html: transformed }];
  }

  const markerToSegment = new Map<string, InstructionHtmlSegment>(
    placeholders.map(
      (segment, index) => [
        `__MEDIA_SEGMENT_${index}__`,
        segment,
      ] as const,
    ),
  );

  const parts = root.innerHTML.split(/<!--(__MEDIA_SEGMENT_\d+__)-->/g);
  const segments: InstructionHtmlSegment[] = [];

  for (const part of parts) {
    const markerSegment = markerToSegment.get(part);
    if (markerSegment) {
      segments.push(markerSegment);
      continue;
    }
    if (part.trim()) {
      segments.push({ kind: "html", html: part });
    }
  }

  return segments.length > 0 ? segments : [{ kind: "html", html: transformed }];
}

export function instructionHtmlHasNativeMedia(html: string): boolean {
  return /<(audio|video)\b/i.test(html);
}
