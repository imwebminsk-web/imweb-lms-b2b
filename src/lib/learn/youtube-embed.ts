/** Возвращает URL для iframe YouTube или null, если ссылка не распознана. */
export function youtubeEmbedSrc(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname.startsWith("/embed/")) {
        return `${u.origin}${u.pathname}${u.search}`;
      }
      const v = u.searchParams.get("v");
      if (v) {
        return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
      }
      const shorts = u.pathname.match(/^\/shorts\/([^/]+)/);
      if (shorts?.[1]) {
        return `https://www.youtube.com/embed/${encodeURIComponent(shorts[1])}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}
