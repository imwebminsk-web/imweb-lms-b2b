import type {
  FillInTheBlanksContent,
  FillInTheBlanksSegment,
  FillInTheBlanksWord,
} from "@/lib/validations/fill-in-the-blanks-schema";

function newBlankId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b-${Math.random().toString(36).slice(2, 11)}`;
}

function shuffleInPlace<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j]!;
    a[j] = t!;
  }
  return a;
}

/**
 * Разбор текста вида «Мама [мыла] раму» в структуру для `questions.content`
 * при типе `fill_in_the_blanks`.
 */
export function parseFillInTheBlanks(
  rawText: string,
  extraWords: string[] = [],
): FillInTheBlanksContent {
  const segments: FillInTheBlanksSegment[] = [];
  const wordBank: FillInTheBlanksWord[] = [];
  const correctMapping: Record<string, string> = {};

  const regex = /\[([^\]]*)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let wordCounter = 1;

  const wordIdForText = (wordText: string): string => {
    const existing = wordBank.find((w) => w.text === wordText);
    if (existing) return existing.id;
    const wordId = `w-${wordCounter++}`;
    wordBank.push({ id: wordId, text: wordText });
    return wordId;
  };

  while ((match = regex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: rawText.slice(lastIndex, match.index),
      });
    }

    const inner = match[1]!.trim();
    lastIndex = regex.lastIndex;

    const blankId = newBlankId();
    segments.push({ type: "blank", id: blankId });

    if (inner) {
      const wordId = wordIdForText(inner);
      correctMapping[blankId] = wordId;
    }
  }

  if (lastIndex < rawText.length) {
    segments.push({
      type: "text",
      value: rawText.slice(lastIndex),
    });
  }

  for (const w of extraWords) {
    const trimmed = w.trim();
    if (!trimmed || wordBank.some((x) => x.text === trimmed)) continue;
    wordBank.push({ id: `w-${wordCounter++}`, text: trimmed });
  }

  const shuffledBank = shuffleInPlace(wordBank);

  return {
    segments,
    wordBank: shuffledBank,
    correctMapping,
  };
}
