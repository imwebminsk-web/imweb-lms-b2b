/**
 * Безопасный Markdown для публичных текстов.
 * Сначала экранирует HTML, потом разрешает **жирный**, _курсив_ и <u>подчёркивание</u>.
 */
export function parseBasicMarkdown(text: string): string {
  const underlinePlaceholders: string[] = [];

  let processed = text.replace(
    /<u>([\s\S]*?)<\/u>/gi,
    (_, content: string) => {
      const index = underlinePlaceholders.length;
      underlinePlaceholders.push(`<u>${escapeHtml(content)}</u>`);
      return `\x00UNDERLINE_${index}\x00`;
    },
  );

  processed = escapeHtml(processed);
  processed = processed.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  processed = processed.replace(/_(.+?)_/g, "<em>$1</em>");

  underlinePlaceholders.forEach((replacement, index) => {
    processed = processed.replace(`\x00UNDERLINE_${index}\x00`, replacement);
  });

  return processed.replace(/\n/g, "<br />");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
