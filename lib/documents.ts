import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { resolveAccess, canEdit, canManage } from "./access";
import { sanitizeHtml } from "./sanitize";
import type {
  DocumentRow,
  DocumentWithAccess,
  Permission,
  ShareEntry,
  User,
} from "./types";

export class AppError extends Error {
  code:
    | "not_found"
    | "forbidden"
    | "bad_request"
    | "conflict";
  constructor(code: AppError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ") || email;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listUsers(): Promise<User[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("docs_users")
    .select("id, email, display_name, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new AppError("bad_request", error.message);
  return (data ?? []) as User[];
}

export async function findOrCreateUserByEmail(rawEmail: string): Promise<User> {
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_RE.test(email)) {
    throw new AppError("bad_request", "Please enter a valid email address.");
  }
  const db = getSupabaseAdmin();

  const existing = await db
    .from("docs_users")
    .select("id, email, display_name, created_at")
    .eq("email", email)
    .maybeSingle();
  if (existing.data) return existing.data as User;

  const inserted = await db
    .from("docs_users")
    .insert({ email, display_name: displayNameFromEmail(email) })
    .select("id, email, display_name, created_at")
    .single();
  if (inserted.error) {
    // Lost a race to create the same email — read it back.
    const retry = await db
      .from("docs_users")
      .select("id, email, display_name, created_at")
      .eq("email", email)
      .maybeSingle();
    if (retry.data) return retry.data as User;
    throw new AppError("bad_request", inserted.error.message);
  }
  return inserted.data as User;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function ownersById(
  ids: string[],
): Promise<Map<string, Pick<User, "id" | "email" | "display_name">>> {
  const map = new Map<string, Pick<User, "id" | "email" | "display_name">>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return map;
  const { data } = await getSupabaseAdmin()
    .from("docs_users")
    .select("id, email, display_name")
    .in("id", unique);
  for (const u of data ?? []) map.set(u.id, u);
  return map;
}

export async function listDocumentsForUser(userId: string): Promise<{
  owned: DocumentWithAccess[];
  shared: DocumentWithAccess[];
}> {
  const db = getSupabaseAdmin();

  const ownedRes = await db
    .from("docs_documents")
    .select("*")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (ownedRes.error) throw new AppError("bad_request", ownedRes.error.message);

  const sharedRes = await db
    .from("docs_document_shares")
    .select("permission, document:docs_documents(*)")
    .eq("user_id", userId);
  if (sharedRes.error) throw new AppError("bad_request", sharedRes.error.message);

  const ownedRows = (ownedRes.data ?? []) as DocumentRow[];
  const sharedPairs = (sharedRes.data ?? [])
    .map((r) => {
      // PostgREST returns the embedded row as an object for a to-one FK, but
      // normalize defensively in case it comes back wrapped in an array.
      const raw = (r as { document: unknown }).document;
      const document = (Array.isArray(raw) ? raw[0] : raw) as DocumentRow | null;
      return { permission: r.permission as Permission, document };
    })
    .filter((r): r is { permission: Permission; document: DocumentRow } => !!r.document);

  const owners = await ownersById([
    ...ownedRows.map((d) => d.owner_id),
    ...sharedPairs.map((p) => p.document.owner_id),
  ]);
  const selfRef = owners.get(userId) ?? { id: userId, email: "", display_name: null };

  const owned: DocumentWithAccess[] = ownedRows.map((d) => ({
    ...d,
    access: "owner",
    owner: owners.get(d.owner_id) ?? selfRef,
  }));

  const shared: DocumentWithAccess[] = sharedPairs
    .map((p) => ({
      ...p.document,
      access: p.permission,
      owner: owners.get(p.document.owner_id) ?? {
        id: p.document.owner_id,
        email: "",
        display_name: null,
      },
    }))
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

  return { owned, shared };
}

export interface DocumentDetail {
  doc: DocumentWithAccess;
  shares: ShareEntry[];
}

export async function getDocumentForUser(
  docId: string,
  userId: string,
): Promise<DocumentDetail | null> {
  const db = getSupabaseAdmin();

  const docRes = await db.from("docs_documents").select("*").eq("id", docId).maybeSingle();
  if (docRes.error) throw new AppError("bad_request", docRes.error.message);
  const doc = docRes.data as DocumentRow | null;
  if (!doc) return null;

  const sharesRes = await db
    .from("docs_document_shares")
    .select("user_id, permission")
    .eq("document_id", docId);
  if (sharesRes.error) throw new AppError("bad_request", sharesRes.error.message);
  const shareRows = (sharesRes.data ?? []) as { user_id: string; permission: Permission }[];

  const access = resolveAccess({ userId, ownerId: doc.owner_id, shares: shareRows });
  if (!access) return null; // 404, not 403 — don't reveal existence

  const users = await ownersById([doc.owner_id, ...shareRows.map((s) => s.user_id)]);
  const shares: ShareEntry[] = shareRows
    .map((s) => ({
      permission: s.permission,
      user: users.get(s.user_id) ?? { id: s.user_id, email: "", display_name: null },
    }))
    .sort((a, b) => (a.user.email < b.user.email ? -1 : 1));

  return {
    doc: {
      ...doc,
      access,
      owner: users.get(doc.owner_id) ?? {
        id: doc.owner_id,
        email: "",
        display_name: null,
      },
    },
    shares,
  };
}

/** Access level only, for cheap checks inside mutations. */
async function requireAccess(docId: string, userId: string) {
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
  return { doc, access };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createDocument(
  userId: string,
  input: { title?: string; contentHtml?: string } = {},
): Promise<DocumentRow> {
  const title = (input.title ?? "Untitled document").trim().slice(0, 200) || "Untitled document";
  const content_html = sanitizeHtml(input.contentHtml ?? "") || "<p></p>";

  const { data, error } = await getSupabaseAdmin()
    .from("docs_documents")
    .insert({ owner_id: userId, title, content_html })
    .select("*")
    .single();
  if (error) throw new AppError("bad_request", error.message);
  return data as DocumentRow;
}

export async function updateDocumentContent(
  docId: string,
  userId: string,
  html: string,
): Promise<{ updated_at: string }> {
  const { access } = await requireAccess(docId, userId);
  if (!canEdit(access)) throw new AppError("forbidden", "You have view-only access.");

  const content_html = sanitizeHtml(html) || "<p></p>";
  const { data, error } = await getSupabaseAdmin()
    .from("docs_documents")
    .update({ content_html, updated_at: new Date().toISOString() })
    .eq("id", docId)
    .select("updated_at")
    .single();
  if (error) throw new AppError("bad_request", error.message);
  return data as { updated_at: string };
}

export async function renameDocument(
  docId: string,
  userId: string,
  rawTitle: string,
): Promise<void> {
  const { access } = await requireAccess(docId, userId);
  if (!canManage(access)) throw new AppError("forbidden", "Only the owner can rename this document.");

  const title = rawTitle.trim().slice(0, 200);
  if (!title) throw new AppError("bad_request", "Title cannot be empty.");

  const { error } = await getSupabaseAdmin()
    .from("docs_documents")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", docId);
  if (error) throw new AppError("bad_request", error.message);
}

export async function deleteDocument(docId: string, userId: string): Promise<void> {
  const { access } = await requireAccess(docId, userId);
  if (!canManage(access)) throw new AppError("forbidden", "Only the owner can delete this document.");
  const { error } = await getSupabaseAdmin().from("docs_documents").delete().eq("id", docId);
  if (error) throw new AppError("bad_request", error.message);
}

export async function shareDocument(
  docId: string,
  ownerId: string,
  email: string,
  permission: Permission,
): Promise<ShareEntry> {
  const { doc, access } = await requireAccess(docId, ownerId);
  if (!canManage(access)) throw new AppError("forbidden", "Only the owner can share this document.");
  if (permission !== "view" && permission !== "edit") {
    throw new AppError("bad_request", "Invalid permission.");
  }

  const target = await findOrCreateUserByEmail(email);
  if (target.id === doc.owner_id) {
    throw new AppError("bad_request", "You already own this document.");
  }

  const { error } = await getSupabaseAdmin()
    .from("docs_document_shares")
    .upsert(
      { document_id: docId, user_id: target.id, permission },
      { onConflict: "document_id,user_id" },
    );
  if (error) throw new AppError("bad_request", error.message);

  return {
    user: { id: target.id, email: target.email, display_name: target.display_name },
    permission,
  };
}

export async function unshareDocument(
  docId: string,
  ownerId: string,
  targetUserId: string,
): Promise<void> {
  const { access } = await requireAccess(docId, ownerId);
  if (!canManage(access)) {
    throw new AppError("forbidden", "Only the owner can manage sharing.");
  }
  const { error } = await getSupabaseAdmin()
    .from("docs_document_shares")
    .delete()
    .eq("document_id", docId)
    .eq("user_id", targetUserId);
  if (error) throw new AppError("bad_request", error.message);
}
