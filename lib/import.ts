import { sanitizeHtml } from "./sanitize";

/** File extensions accepted by the import feature. Keep in sync with the UI/README. */
export const SUPPORTED_IMPORT_EXTENSIONS = [".txt", ".md", ".markdown"] as const;
export const MAX_IMPORT_BYTES = 1_000_000; // 1 MB

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inline markdown: **bold**, *italic* / _italic_, `code`. Input must be pre-escaped. */
function inlineMd(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<span>$1</span>");
}

/**
 * Minimal Markdown -> HTML conversion covering the formatting the editor
 * supports: ATX headings (#, ##, ###), unordered lists (-, *, +), ordered
 * lists (1.), block quotes (>), bold/italic/inline-code, and blank-line
 * separated paragraphs. Anything fancier (tables, links, images, code
 * fences) is rendered as plain text. Output is sanitized before returning.
 */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inlineMd(escapeHtml(paragraph.join(" ")))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === "") {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMd(escapeHtml(heading[2].trim()))}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      out.push(`<blockquote>${inlineMd(escapeHtml(quote[1].trim()))}</blockquote>`);
      continue;
    }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushParagraph();
      const wanted = ul ? "ul" : "ol";
      if (listType !== wanted) {
        closeList();
        out.push(`<${wanted}>`);
        listType = wanted;
      }
      const item = (ul ? ul[1] : ol![1]).trim();
      out.push(`<li>${inlineMd(escapeHtml(item))}</li>`);
      continue;
    }

    closeList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();

  return sanitizeHtml(out.join("")) || "<p></p>";
}

/** Plain text -> HTML: each non-empty line becomes a paragraph. */
export function plainTextToHtml(text: string): string {
  const html = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) =>
      block.trim()
        ? `<p>${escapeHtml(block.trim()).replace(/\n/g, "<br />")}</p>`
        : "",
    )
    .join("");
  return sanitizeHtml(html) || "<p></p>";
}

export function importFileToHtml(fileName: string, contents: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return markdownToHtml(contents);
  }
  return plainTextToHtml(contents);
}

/** Best-effort document title from an uploaded file name. */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base ? base.slice(0, 120) : "Imported document";
}
