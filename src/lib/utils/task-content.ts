import type { Json } from "@/types/database.types";
import { z } from "zod";

const taskContentRootSchema = z.object({
  text: z.string().optional(),
  example_text: z.string().optional(),
});

export type TaskPresentation = {
  instructionHtml: string;
  exampleText: string | null;
  mediaPlayLimit: number;
};

/** Переносит legacy `audio_url` в HTML, если URL ещё не в тексте. */
export function mergeLegacyAudioUrlIntoHtml(text: string, audioUrl: string): string {
  const url = audioUrl.trim();
  if (!url || text.includes(url)) return text;
  const tag = `<audio controls preload="metadata" src="${url.replace(/"/g, "&quot;")}"></audio>`;
  if (!text.trim()) return `<p>${tag}</p>`;
  return `${text}<p>${tag}</p>`;
}

export function parseTaskPresentation(
  content: Json,
  mediaPlayLimit = 0,
): TaskPresentation {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return { instructionHtml: "", exampleText: null, mediaPlayLimit };
  }

  const parsed = taskContentRootSchema.safeParse(content);
  if (!parsed.success) {
    return { instructionHtml: "", exampleText: null, mediaPlayLimit };
  }

  const legacyAudio =
    typeof (content as Record<string, unknown>).audio_url === "string"
      ? String((content as Record<string, unknown>).audio_url)
      : "";

  let instructionHtml = parsed.data.text ?? "";
  if (legacyAudio) {
    instructionHtml = mergeLegacyAudioUrlIntoHtml(instructionHtml, legacyAudio);
  }

  const exampleRaw = parsed.data.example_text?.trim();

  return {
    instructionHtml,
    exampleText: exampleRaw ? exampleRaw : null,
    mediaPlayLimit: Math.max(0, mediaPlayLimit),
  };
}

export function buildTaskContentPayload(params: {
  text: string;
  exampleText?: string;
  includeExample?: boolean;
}): {
  text: string;
  example_text?: string;
} {
  const payload: {
    text: string;
    example_text?: string;
  } = {
    text: params.text,
  };

  if (params.includeExample) {
    const example = params.exampleText?.trim();
    if (example) {
      payload.example_text = example;
    }
  }

  return payload;
}
