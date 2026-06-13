import type { Json } from "@/types/database.types";

export function parseLabelPairsFromAnswerData(
  data: Json | null,
): { imageId: string; wordId: string }[] | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const rec = data as Record<string, unknown>;
  const lp = rec.labelPairs;
  if (!Array.isArray(lp)) return null;
  const out: { imageId: string; wordId: string }[] = [];
  for (const item of lp) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }
    const o = item as Record<string, unknown>;
    if (typeof o.imageId !== "string" || typeof o.wordId !== "string") {
      return null;
    }
    out.push({ imageId: o.imageId, wordId: o.wordId });
  }
  return out;
}

/** Ответ `fill_in_the_blanks`: `{ fillAssignments: Record<blankId, wordId> }`. */
export function parseFillAssignmentsFromAnswerData(
  data: Json | null,
): Record<string, string> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const rec = data as Record<string, unknown>;
  const fa = rec.fillAssignments;
  if (!fa || typeof fa !== "object" || Array.isArray(fa)) {
    return null;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fa)) {
    if (typeof v !== "string") return null;
    out[k] = v;
  }
  return out;
}

/** Ответ `fill_blanks_typing` (legacy flat): `{ fillTyping: Record<blankId, typedString> }`. */
export function parseFillTypingFromAnswerData(
  data: Json | null,
): Record<string, string> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const rec = data as Record<string, unknown>;
  const ft = rec.fillTyping;
  if (!ft || typeof ft !== "object" || Array.isArray(ft)) {
    return null;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ft)) {
    if (typeof v !== "string") return null;
    out[k] = v;
  }
  return out;
}

export {
  parseGroupedFillAssignmentsFromAnswerData,
  parseGroupedFillTypingFromAnswerData,
} from "@/lib/grouped-fill-blanks-utils";

function hashStringFnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed || 1;
  return function next() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Детерминированная перестановка (чистая функция от `seedKey` и массива).
 * Нужна вместо Math.random в render/useMemo — иначе ломается правило чистоты React.
 */
export function shuffleDeterministic<T>(
  items: readonly T[],
  seedKey: string,
): T[] {
  const copy = [...items];
  const rand = mulberry32(hashStringFnv1a(seedKey));
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = copy[i];
    copy[i] = copy[j] as T;
    copy[j] = t as T;
  }
  return copy;
}
