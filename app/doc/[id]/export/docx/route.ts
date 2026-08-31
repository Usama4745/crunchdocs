import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getDocumentForUser } from "@/lib/documents";
import { exportFilename, htmlToDocxBuffer } from "@/lib/export";

/**
 * Download the document as a .docx file. Anyone with access (owner, editor, or
 * viewer) may export; `getDocumentForUser` enforces that and 404s otherwise.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/doc/[id]/export/docx">,
) {
  const { id } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to export.", { status: 401 });

  const detail = await getDocumentForUser(id, user.id);
  if (!detail) return new Response("Document not found.", { status: 404 });

  const buffer = await htmlToDocxBuffer(detail.doc.title, detail.doc.content_html);
  const name = exportFilename(detail.doc.title);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}.docx"; filename*=UTF-8''${encodeURIComponent(
        name,
      )}.docx`,
      "Cache-Control": "no-store",
    },
  });
}
