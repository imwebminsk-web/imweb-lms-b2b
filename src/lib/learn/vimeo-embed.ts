/** URL iframe Vimeo или null, если ссылка не распознана. */
export function vimeoEmbedSrc(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "vimeo.com") {
      const m = u.pathname.match(/\/(?:video\/)?(\d+)/);
      if (m?.[1]) {
        return `https://player.vimeo.com/video/${encodeURIComponent(m[1])}`;
      }
    }
    if (host === "player.vimeo.com") {
      const m = u.pathname.match(/\/video\/(\d+)/);
      if (m?.[1]) {
        return `https://player.vimeo.com/video/${encodeURIComponent(m[1])}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}
