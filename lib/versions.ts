import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { AppError, assertAccess } from "./authz";
import { sanitizeHtml } from "./sanitize";
import type { DocumentVersionRow, UserRef, VersionSummary } from "./types";

const AUTO_SNAPSHOT_MIN_INTERVAL_MS = 3 * 60 * 1000; // one auto-version / 3 min
const MAX_NOTE_LEN = 200;

async function usersByIds(ids: (string | null)[]): Promise<Map<string, UserRef>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const map = new Map<string, UserRef>();
  if (unique.length === 0) return map;
  const { data } = await getSupabaseAdmin()
    .from("docs_users")
    .select("id, email, display_name")
    .in("id", unique);
  for (const u of data ?? []) map.set(u.id, u as UserRef);
  return map;
}

/**
 * Insert a throttled "Autosave" snapshot. Called from `updateDocumentContent`
 * after every successful write; no-ops when the content is unchanged or the
 * last snapshot is recent. Assumes the caller already checked edit access.
 */
export async function maybeAutoSnapshot(
  docId: string,
  title: string,
  contentHtml: string,
  userId: string,
): Promise<void> {
  const db = getSupabaseAdmin();
  const { data: last } = await db
    .from("docs_document_versions")
    .select("created_at, content_html")
    .eq("document_id", docId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last) {
    if (last.content_html === contentHtml) return;
    const age = Date.now() - new Date(last.created_at as string).getTime();
    if (age < AUTO_SNAPSHOT_MIN_INTERVAL_MS) return;
  }

  await db.from("docs_document_versions").insert({
    document_id: docId,
    title,
    content_html: contentHtml,
    note: "Autosave",
    created_by: userId,
  });
}

/** Explicit, user-named snapshot of the document's current state. */
export async function saveNamedVersion(
  docId: string,
  userId: string,
  note: string,
): Promise<void> {
  await assertAccess(docId, userId, "edit");
  const db = getSupabaseAdmin();

  const { data: doc, error } = await db
    .from("docs_documents")
    .select("title, content_html")
    .eq("id", docId)
    .single();
  if (error) throw new AppError("bad_request", error.message);

  await db.from("docs_document_versions").insert({
    document_id: docId,
    title: (doc as { title: string }).title,
    content_html: (doc as { content_html: string }).content_html,
    note: (note.trim() || "Manual save").slice(0, MAX_NOTE_LEN),
    created_by: userId,
  });
}

export async function listVersions(
  docId: string,
  userId: string,
): Promise<VersionSummary[]> {
  await assertAccess(docId, userId, "view");
  const { data, error } = await getSupabaseAdmin()
    .from("docs_document_versions")
    .select("id, note, created_at, created_by")
    .eq("document_id", docId)
    .order("created_at", { ascending: false })
    .limit(50);
  // Table not created yet (schema.sql not re-run) — treat as "no history".
  if (error?.code === "42P01") return [];
  if (error) throw new AppError("bad_request", error.message);

  const rows = (data ?? []) as {
    id: string;
    note: string | null;
    created_at: string;
    created_by: string | null;
  }[];
  const authors = await usersByIds(rows.map((r) => r.created_by));

  return rows.map((r) => ({
    id: r.id,
    note: r.note,
    created_at: r.created_at,
    author: r.created_by ? authors.get(r.created_by) ?? null : null,
  }));
}

export async function getVersion(
  docId: string,
  userId: string,
  versionId: string,
): Promise<DocumentVersionRow> {
  await assertAccess(docId, userId, "view");
  const { data, error } = await getSupabaseAdmin()
    .from("docs_document_versions")
    .select("*")
    .eq("id", versionId)
    .eq("document_id", docId)
    .maybeSingle();
  if (error) throw new AppError("bad_request", error.message);
  if (!data) throw new AppError("not_found", "Version not found.");
  return data as DocumentVersionRow;
}

/**
 * Restore a past version: snapshot the current content first (so the restore
 * is itself undoable), then overwrite the document body.
 */
export async function restoreVersion(
  docId: string,
  userId: string,
  versionId: string,
): Promise<void> {
  await assertAccess(docId, userId, "edit");
  const db = getSupabaseAdmin();

  const target = await getVersion(docId, userId, versionId);

  const { data: current, error: curErr } = await db
    .from("docs_documents")
    .select("title, content_html")
    .eq("id", docId)
    .single();
  if (curErr) throw new AppError("bad_request", curErr.message);

  await db.from("docs_document_versions").insert({
    document_id: docId,
    title: (current as { title: string }).title,
    content_html: (current as { content_html: string }).content_html,
    note: "Before restore",
    created_by: userId,
  });

  const restored = sanitizeHtml(target.content_html) || "<p></p>";
  const { error: updErr } = await db
    .from("docs_documents")
    .update({ content_html: restored, updated_at: new Date().toISOString() })
    .eq("id", docId);
  if (updErr) throw new AppError("bad_request", updErr.message);

  await db.from("docs_document_versions").insert({
    document_id: docId,
    title: (current as { title: string }).title,
    content_html: restored,
    note: `Restored from ${new Date(target.created_at).toLocaleString()}`,
    created_by: userId,
  });
}
