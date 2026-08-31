"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AppError,
  createDocument,
  deleteDocument,
  findOrCreateUserByEmail,
  renameDocument,
  shareDocument,
  unshareDocument,
  updateDocumentContent,
  getDocumentForUser,
} from "@/lib/documents";
import {
  convertUploadToHtml,
  titleFromFileName,
  MAX_IMPORT_BYTES,
  SUPPORTED_IMPORT_EXTENSIONS,
} from "@/lib/import";
import { restoreVersion, saveNamedVersion } from "@/lib/versions";
import {
  addComment,
  deleteComment as deleteCommentRow,
  setCommentResolved,
} from "@/lib/comments";
import { heartbeat, leave, type PresenceMode } from "@/lib/presence";
import {
  clearSessionCookie,
  getCurrentUser,
  requireUser,
  setSessionCookie,
} from "@/lib/session";
import type { Permission, PresencePerson } from "@/lib/types";

export type FormResult = { ok: true; message?: string } | { ok: false; error: string };

function errText(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

/** Validate an uploaded import file from FormData. */
function readImportFile(formData: FormData): { file: File } | { error: string } {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to import." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { error: `That file is larger than ${Math.round(MAX_IMPORT_BYTES / 1_000_000)} MB.` };
  }
  const name = file.name.toLowerCase();
  if (!SUPPORTED_IMPORT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return { error: `Unsupported file type. Allowed: ${SUPPORTED_IMPORT_EXTENSIONS.join(", ")}` };
  }
  return { file };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signInAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const email = String(formData.get("email") ?? "");
  try {
    const user = await findOrCreateUserByEmail(email);
    await setSessionCookie(user.id);
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function createDocumentAction(): Promise<void> {
  const user = await requireUser();
  const doc = await createDocument(user.id, {});
  revalidatePath("/");
  redirect(`/doc/${doc.id}`);
}

export async function importDocumentAction(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const user = await requireUser();
  const picked = readImportFile(formData);
  if ("error" in picked) return { ok: false, error: picked.error };
  let newId: string | null = null;

  try {
    const html = await convertUploadToHtml(picked.file);
    const doc = await createDocument(user.id, {
      title: titleFromFileName(picked.file.name),
      contentHtml: html,
    });
    newId = doc.id;
  } catch (err) {
    return { ok: false, error: errText(err) };
  }

  revalidatePath("/");
  redirect(`/doc/${newId}`);
}

export async function importIntoDocumentAction(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const user = await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const picked = readImportFile(formData);
  if ("error" in picked) return { ok: false, error: picked.error };

  try {
    const detail = await getDocumentForUser(docId, user.id);
    if (!detail) return { ok: false, error: "Document not found." };

    const importedHtml = await convertUploadToHtml(picked.file);
    const merged = `${detail.doc.content_html}${importedHtml}`;
    await updateDocumentContent(docId, user.id, merged);
  } catch (err) {
    return { ok: false, error: errText(err) };
  }

  revalidatePath(`/doc/${docId}`);
  return { ok: true, message: "Imported content added to the end of the document." };
}

/** Autosave from the editor. Invoked directly from a Client Component. */
export async function saveDocumentAction(
  docId: string,
  html: string,
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const { updated_at } = await updateDocumentContent(docId, user.id, html);
    return { ok: true, updatedAt: updated_at };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

export async function renameDocumentAction(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const user = await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const title = String(formData.get("title") ?? "");
  try {
    await renameDocument(docId, user.id, title);
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
  revalidatePath(`/doc/${docId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteDocumentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const docId = String(formData.get("docId") ?? "");
  await deleteDocument(docId, user.id);
  revalidatePath("/");
  redirect("/");
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

export async function shareDocumentAction(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const user = await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const email = String(formData.get("email") ?? "");
  const permission = (String(formData.get("permission") ?? "edit") as Permission);

  try {
    const entry = await shareDocument(docId, user.id, email, permission);
    revalidatePath(`/doc/${docId}`);
    revalidatePath("/");
    return {
      ok: true,
      message: `Shared with ${entry.user.email} (${entry.permission}).`,
    };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

export async function unshareDocumentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const targetUserId = String(formData.get("userId") ?? "");
  await unshareDocument(docId, user.id, targetUserId);
  revalidatePath(`/doc/${docId}`);
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Version history
// ---------------------------------------------------------------------------

export async function saveVersionAction(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const user = await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const note = String(formData.get("note") ?? "");
  try {
    await saveNamedVersion(docId, user.id, note);
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
  revalidatePath(`/doc/${docId}`);
  return { ok: true, message: "Version saved." };
}

export async function restoreVersionAction(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const user = await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  try {
    await restoreVersion(docId, user.id, versionId);
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
  revalidatePath(`/doc/${docId}`);
  return { ok: true, message: "Version restored." };
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function addCommentAction(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const user = await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const body = String(formData.get("body") ?? "");
  try {
    await addComment(docId, user.id, body);
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
  revalidatePath(`/doc/${docId}`);
  return { ok: true };
}

export async function resolveCommentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const commentId = String(formData.get("commentId") ?? "");
  const resolved = String(formData.get("resolved") ?? "") === "true";
  await setCommentResolved(docId, user.id, commentId, resolved);
  revalidatePath(`/doc/${docId}`);
}

export async function deleteCommentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const commentId = String(formData.get("commentId") ?? "");
  await deleteCommentRow(docId, user.id, commentId);
  revalidatePath(`/doc/${docId}`);
}

// ---------------------------------------------------------------------------
// Presence (called directly from the client on a ~10s interval)
// ---------------------------------------------------------------------------

export async function presenceHeartbeatAction(
  docId: string,
  mode: PresenceMode,
): Promise<{ ok: true; people: PresencePerson[] } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Signed out." };
    const people = await heartbeat(docId, user.id, mode);
    return { ok: true, people };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

export async function presenceLeaveAction(docId: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (user) await leave(docId, user.id);
  } catch {
    /* best effort on unload */
  }
}
