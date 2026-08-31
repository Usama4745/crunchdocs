import { sanitizeHtml } from "./sanitize";

/**
 * Turn a document title into a safe download filename stem (no extension).
 * Pure — unit tested.
 */
export function exportFilename(title: string): string {
  const stem = (title || "document")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  return stem || "document";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Full standalone HTML for an export: the document title as an <h1> followed by
 * the sanitized body. Shared by the .docx route and the print/PDF view.
 */
export function buildExportHtml(title: string, contentHtml: string): string {
  const body = sanitizeHtml(contentHtml) || "<p></p>";
  return `<h1>${escapeHtml(title || "Untitled document")}</h1>${body}`;
}

/** Render the document to a .docx file buffer via `html-to-docx`. */
export async function htmlToDocxBuffer(
  title: string,
  contentHtml: string,
): Promise<Buffer> {
  const { default: HTMLtoDOCX } = await import("html-to-docx");

  const out = await HTMLtoDOCX(buildExportHtml(title, contentHtml), null, {
    title: title || "Untitled document",
    footer: false,
    pageNumber: false,
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
  });

  if (Buffer.isBuffer(out)) return out;
  if (out instanceof ArrayBuffer) return Buffer.from(out);
  return Buffer.from(await (out as Blob).arrayBuffer());
}
