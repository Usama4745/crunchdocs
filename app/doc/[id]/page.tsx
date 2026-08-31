import Link from "next/link";
import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import Editor from "@/components/Editor";
import DocViewer from "@/components/DocViewer";
import DocumentTitle from "@/components/DocumentTitle";
import SharePanel from "@/components/SharePanel";
import DocumentTools from "@/components/DocumentTools";
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
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            ← All documents
          </Link>
          <span className="text-xs text-zinc-400">
            {editable ? "Editing" : "Read only"}
          </span>
        </div>

        <DocumentTitle docId={doc.id} title={doc.title} canRename={manageable} />

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div>
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

          <aside className="flex flex-col gap-4">
            <SharePanel
              docId={doc.id}
              ownerLabel={ownerLabel}
              shares={shares}
              canManage={manageable}
            />
            <DocumentTools docId={doc.id} canEdit={editable} canManage={manageable} />
          </aside>
        </div>
      </main>
    </>
  );
}
