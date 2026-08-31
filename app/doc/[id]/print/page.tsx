import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { requireUser } from "@/lib/session";
import { getDocumentForUser } from "@/lib/documents";
import { buildExportHtml } from "@/lib/export";

export const metadata = { title: "Print · CrunchDocs" };

export default async function PrintPage({ params }: PageProps<"/doc/[id]/print">) {
  const { id } = await params;
  const user = await requireUser();

  const detail = await getDocumentForUser(id, user.id);
  if (!detail) notFound();

  const html = buildExportHtml(detail.doc.title, detail.doc.content_html);

  return (
    <main className="print-page mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="no-print mb-8 flex items-center gap-3">
        <PrintButton />
        <Link
          href={`/doc/${id}`}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Back to document
        </Link>
        <p className="text-xs text-zinc-500">
          Choose “Save as PDF” as the destination in the print dialog.
        </p>
      </div>

      <article className="doc-view" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
