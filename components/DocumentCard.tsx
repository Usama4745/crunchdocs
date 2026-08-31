import Link from "next/link";
import type { DocumentWithAccess } from "@/lib/types";

function plainSnippet(html: string, max = 140): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const BADGES: Record<DocumentWithAccess["access"], { text: string; cls: string }> = {
  owner: {
    text: "Owner",
    cls: "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
  },
  edit: {
    text: "Can edit",
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  view: {
    text: "View only",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
};

export default function DocumentCard({ doc }: { doc: DocumentWithAccess }) {
  const badge = BADGES[doc.access];
  const snippet = plainSnippet(doc.content_html);

  return (
    <Link
      href={`/doc/${doc.id}`}
      className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium leading-tight">{doc.title || "Untitled document"}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
          {badge.text}
        </span>
      </div>
      <p className="line-clamp-2 text-sm text-zinc-500">
        {snippet || "No content yet"}
      </p>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-400">
        {doc.access !== "owner" && (
          <span>Owner: {doc.owner.display_name || doc.owner.email || "unknown"}</span>
        )}
        <span>Updated {new Date(doc.updated_at).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}
