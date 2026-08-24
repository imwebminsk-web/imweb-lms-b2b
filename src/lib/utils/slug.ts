/**
 * Транслитерация кириллицы в латиницу (для читаемых ASCII-slug).
 * Ъ/Ь опускаются; ё → yo; ж/х/ц/ч/ш/щ → диграфы.
 */
function transliterateCyrillic(text: string): string {
  const map: Record<string, string> = {
    А: "a",
    а: "a",
    Б: "b",
    б: "b",
    В: "v",
    в: "v",
    Г: "g",
    г: "g",
    Д: "d",
    д: "d",
    Е: "e",
    е: "e",
    Ё: "yo",
    ё: "yo",
    Ж: "zh",
    ж: "zh",
    З: "z",
    з: "z",
    И: "i",
    и: "i",
    Й: "y",
    й: "y",
    К: "k",
    к: "k",
    Л: "l",
    л: "l",
    М: "m",
    м: "m",
    Н: "n",
    н: "n",
    О: "o",
    о: "o",
    П: "p",
    п: "p",
    Р: "r",
    р: "r",
    С: "s",
    с: "s",
    Т: "t",
    т: "t",
    У: "u",
    у: "u",
    Ф: "f",
    ф: "f",
    Х: "h",
    х: "h",
    Ц: "ts",
    ц: "ts",
    Ч: "ch",
    ч: "ch",
    Ш: "sh",
    ш: "sh",
    Щ: "shch",
    щ: "shch",
    Ъ: "",
    ъ: "",
    Ы: "y",
    ы: "y",
    Ь: "",
    ь: "",
    Э: "e",
    э: "e",
    Ю: "yu",
    ю: "yu",
    Я: "ya",
    я: "ya",
    І: "i",
    і: "i",
    Ї: "yi",
    ї: "yi",
    Є: "ye",
    є: "ye",
    Ґ: "g",
    ґ: "g",
  };

  let out = "";
  for (const ch of text) {
    out += map[ch] ?? ch;
  }
  return out;
}

/**
 * Делает slug из человекочитаемой подписи:
 * транслит → нижний регистр → пробелы/знаки становятся дефисами.
 */
export function slugify(text: string, fallback = "item"): string {
  const transliterated = transliterateCyrillic(text.trim());
  const normalized = transliterated
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "");
  const replaced = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return replaced || fallback;
}
