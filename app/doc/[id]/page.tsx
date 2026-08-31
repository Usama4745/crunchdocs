import Link from "next/link";
import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import Editor from "@/components/Editor";
import DocViewer from "@/components/DocViewer";
import DocumentTitle from "@/components/DocumentTitle";
import DocumentHeaderActions from "@/components/DocumentHeaderActions";
import { requireUser } from "@/lib/session";
import { getDocumentForUser } from "@/lib/documents";
import { canEdit, canManage } from "@/lib/access";

export default async function DocumentPage({ params }: PageProps<"/doc/[id]">) {
  const { id } = await params;
  const user = await requireUser();

  const detail = await getDocumentForUser(id, user.id);
  if (!detail) notFound();

  const { doc, shares } = detail;
  const editable = canEdit(doc.access);
  const manageable = canManage(doc.access);
  const ownerLabel =
    doc.owner.id === user.id
      ? "You"
      : doc.owner.display_name || doc.owner.email || "Owner";

  return (
    <>
      <TopBar user={user} />

      {/* Document sub-header: back, title, status, and Share / Tools menus */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-8">
          <Link
            href="/"
            aria-label="Back to all documents"
            className="shrink-0 rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <DocumentTitle docId={doc.id} title={doc.title} canRename={manageable} />
          </div>
          <span className="hidden shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 sm:inline dark:bg-zinc-800">
            {editable ? "Editing" : "Read only"}
          </span>
          <DocumentHeaderActions
            docId={doc.id}
            ownerLabel={ownerLabel}
            shares={shares}
            canManage={manageable}
            canEdit={editable}
          />
        </div>
      </div>

      {/* Editor sits on a soft grey desk, wide but with breathing room */}
      <main className="flex-1 bg-zinc-100 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl px-4 pt-8 pb-20 sm:px-8 sm:pt-12 lg:px-10">
          {editable ? (
            <Editor
              docId={doc.id}
              initialHtml={doc.content_html}
              initialUpdatedAt={doc.updated_at}
            />
          ) : (
            <DocViewer html={doc.content_html} />
          )}
        </div>
      </main>
    </>
  );
}
