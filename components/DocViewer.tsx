import { sanitizeHtml } from "@/lib/sanitize";

/** Read-only rendering for viewers without edit access. Content is re-sanitized here. */
export default function DocViewer({ html }: { html: string }) {
  const safe = sanitizeHtml(html) || "<p></p>";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="doc-view" dangerouslySetInnerHTML={{ __html: safe }} />
    </div>
  );
}
