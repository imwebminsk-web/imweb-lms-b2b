import { vimeoEmbedSrc } from "@/lib/learn/vimeo-embed";
import { youtubeEmbedSrc } from "@/lib/learn/youtube-embed";

function googleDriveEmbedSrc(url: string): string | null {
  const raw = url.trim();
  const fileMatch = raw.match(
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
  );
  if (fileMatch?.[1]) {
    return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  }

  const openMatch = raw.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i);
  if (openMatch?.[1]) {
    return `https://drive.google.com/file/d/${openMatch[1]}/preview`;
  }

  return null;
}

/**
 * Converts a share/watch URL into an iframe-friendly embed URL.
 * Returns the original URL when no known provider pattern matches.
 */
export function getEmbedUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const drive = googleDriveEmbedSrc(trimmed);
  if (drive) return drive;

  const youtube = youtubeEmbedSrc(trimmed);
  if (youtube) return youtube;

  const vimeo = vimeoEmbedSrc(trimmed);
  if (vimeo) return vimeo;

  return trimmed;
}

/** Rewrites iframe `src` attributes in stored HTML to embed-safe URLs. */
export function transformMediaUrlsInHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return html;

  return trimmed.replace(
    /(<iframe\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
    (_match, prefix: string, quote: string, src: string) =>
      `${prefix}${quote}${getEmbedUrl(src)}${quote}`,
  );
}
