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
import {
  clearSessionCookie,
  requireUser,
  setSessionCookie,
} from "@/lib/session";
import type { Permission } from "@/lib/types";

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
