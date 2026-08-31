import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { AppError, assertAccess } from "./authz";
import type { CommentEntry, UserRef } from "./types";

const MAX_COMMENT_LEN = 4000;

export async function listComments(
  docId: string,
  userId: string,
): Promise<CommentEntry[]> {
  const { access } = await assertAccess(docId, userId, "view");
  const db = getSupabaseAdmin();

  const { data, error } = await db
    .from("docs_comments")
    .select("id, body, resolved, created_at, author_id")
    .eq("document_id", docId)
    .order("created_at", { ascending: true });
  // Table not created yet (schema.sql not re-run) — treat as "no comments".
  if (error?.code === "42P01") return [];
  if (error) throw new AppError("bad_request", error.message);

  const rows = (data ?? []) as {
    id: string;
    body: string;
    resolved: boolean;
    created_at: string;
    author_id: string;
  }[];

  const ids = [...new Set(rows.map((r) => r.author_id))];
  const authors = new Map<string, UserRef>();
  if (ids.length) {
    const { data: us } = await db
      .from("docs_users")
      .select("id, email, display_name")
      .in("id", ids);
    for (const u of us ?? []) authors.set(u.id, u as UserRef);
  }

  const isOwner = access === "owner";
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    resolved: r.resolved,
    created_at: r.created_at,
    author: authors.get(r.author_id) ?? {
      id: r.author_id,
      email: "",
      display_name: null,
    },
    canModerate: isOwner || r.author_id === userId,
  }));
}

export async function addComment(
  docId: string,
  userId: string,
  body: string,
): Promise<void> {
  // Anyone with access to the document may comment, including view-only.
  await assertAccess(docId, userId, "view");
  const text = body.trim();
  if (!text) throw new AppError("bad_request", "Comment can't be empty.");

  const { error } = await getSupabaseAdmin().from("docs_comments").insert({
    document_id: docId,
    author_id: userId,
    body: text.slice(0, MAX_COMMENT_LEN),
  });
  if (error) throw new AppError("bad_request", error.message);
}

async function loadComment(commentId: string, docId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("docs_comments")
    .select("id, author_id")
    .eq("id", commentId)
    .eq("document_id", docId)
    .maybeSingle();
  if (error) throw new AppError("bad_request", error.message);
  if (!data) throw new AppError("not_found", "Comment not found.");
  return data as { id: string; author_id: string };
}

/** Comment author or the document owner may moderate. */
async function assertCanModerate(docId: string, userId: string, commentId: string) {
  const { access } = await assertAccess(docId, userId, "view");
  const comment = await loadComment(commentId, docId);
  if (access !== "owner" && comment.author_id !== userId) {
    throw new AppError("forbidden", "You can only change your own comments.");
  }
}

export async function setCommentResolved(
  docId: string,
  userId: string,
  commentId: string,
  resolved: boolean,
): Promise<void> {
  await assertCanModerate(docId, userId, commentId);
  const { error } = await getSupabaseAdmin()
    .from("docs_comments")
    .update({ resolved })
    .eq("id", commentId);
  if (error) throw new AppError("bad_request", error.message);
}

export async function deleteComment(
  docId: string,
  userId: string,
  commentId: string,
): Promise<void> {
  await assertCanModerate(docId, userId, commentId);
  const { error } = await getSupabaseAdmin()
    .from("docs_comments")
    .delete()
    .eq("id", commentId);
  if (error) throw new AppError("bad_request", error.message);
}
