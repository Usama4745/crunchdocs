import Link from "next/link";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/authz";
import { requireUser } from "@/lib/session";
import { getVersion } from "@/lib/versions";
import { sanitizeHtml } from "@/lib/sanitize";
import { buildExportHtml } from "@/lib/export";
import RestoreVersionButton from "@/components/RestoreVersionButton";
import { canEdit } from "@/lib/access";
import { getDocumentForUser } from "@/lib/documents";

export const metadata = { title: "Version · CrunchDocs" };

export default async function VersionPreviewPage({
  params,
}: PageProps<"/doc/[id]/version/[versionId]">) {
  const { id, versionId } = await params;
  const user = await requireUser();

  let version;
  try {
    version = await getVersion(id, user.id, versionId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }

  const detail = await getDocumentForUser(id, user.id);
  const editable = detail ? canEdit(detail.doc.access) : false;
  const html = sanitizeHtml(buildExportHtml(version.title, version.content_html));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href={`/doc/${id}`}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          ← Back to document
        </Link>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          Read-only snapshot
        </span>
        {editable && <RestoreVersionButton docId={id} versionId={versionId} />}
      </div>

      <p className="mb-4 text-sm text-zinc-500">
        {version.note ? `“${version.note}” — ` : ""}
        saved {new Date(version.created_at).toLocaleString()}
      </p>

      <article
        className="doc-view rounded-xl bg-white p-8 shadow-xl ring-1 ring-zinc-200/80 sm:p-12 dark:bg-zinc-900 dark:ring-zinc-800"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
