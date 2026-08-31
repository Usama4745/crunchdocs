import { sanitizeHtml } from "@/lib/sanitize";

/** Read-only rendering for viewers without edit access. Content is re-sanitized here. */
export default function DocViewer({ html }: { html: string }) {
  const safe = sanitizeHtml(html) || "<p></p>";
  return (
    <div className="min-h-[72vh] rounded-xl bg-white p-8 shadow-xl shadow-zinc-300/40 ring-1 ring-zinc-200/80 sm:p-14 dark:bg-zinc-900 dark:shadow-black/40 dark:ring-zinc-800">
      <div className="doc-view" dangerouslySetInnerHTML={{ __html: safe }} />
    </div>
  );
}
