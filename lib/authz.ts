import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { resolveAccess, canEdit, canManage, type AccessLevel } from "./access";
import type { Permission } from "./types";

export class AppError extends Error {
  code: "not_found" | "forbidden" | "bad_request" | "conflict";
  constructor(code: AppError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export interface DocAccess {
  documentId: string;
  ownerId: string;
  access: AccessLevel;
}

/**
 * Resolve how `userId` may reach `docId`. Throws `not_found` (never `forbidden`)
 * when there is no relationship, so callers don't leak document existence.
 * This is the shared choke point for every feature that touches a document.
 */
export async function getDocAccess(
  docId: string,
  userId: string,
): Promise<DocAccess> {
  const db = getSupabaseAdmin();

  const docRes = await db
    .from("docs_documents")
    .select("id, owner_id")
    .eq("id", docId)
    .maybeSingle();
  if (docRes.error) throw new AppError("bad_request", docRes.error.message);
  const doc = docRes.data as { id: string; owner_id: string } | null;
  if (!doc) throw new AppError("not_found", "Document not found.");

  const sharesRes = await db
    .from("docs_document_shares")
    .select("user_id, permission")
    .eq("document_id", docId);
  if (sharesRes.error) throw new AppError("bad_request", sharesRes.error.message);

  const access = resolveAccess({
    userId,
    ownerId: doc.owner_id,
    shares: (sharesRes.data ?? []) as { user_id: string; permission: Permission }[],
  });
  if (!access) throw new AppError("not_found", "Document not found.");

  return { documentId: doc.id, ownerId: doc.owner_id, access };
}

/** Like `getDocAccess`, but also enforce a minimum capability. */
export async function assertAccess(
  docId: string,
  userId: string,
  need: "view" | "edit" | "manage",
): Promise<DocAccess> {
  const result = await getDocAccess(docId, userId);
  if (need === "edit" && !canEdit(result.access)) {
    throw new AppError("forbidden", "You have view-only access to this document.");
  }
  if (need === "manage" && !canManage(result.access)) {
    throw new AppError("forbidden", "Only the document owner can do that.");
  }
  return result;
}
