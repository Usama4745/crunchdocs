import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { assertAccess } from "./authz";
import type { PresencePerson, UserRef } from "./types";

/** Rows newer than this are "here now". */
const ACTIVE_WINDOW_MS = 30_000;
/** Rows older than this are swept on the next heartbeat. */
const STALE_MS = 5 * 60_000;

export type PresenceMode = "viewing" | "editing";

/**
 * Record that `userId` is on `docId` and return everyone currently present.
 * Near-real-time by polling — clients call this every ~10s. Not Supabase
 * Realtime: keeps the anon key out of the client and needs no extra infra.
 */
export async function heartbeat(
  docId: string,
  userId: string,
  mode: PresenceMode,
): Promise<PresencePerson[]> {
  await assertAccess(docId, userId, "view");
  const db = getSupabaseAdmin();
  const now = Date.now();

  await db.from("docs_document_presence").upsert(
    {
      document_id: docId,
      user_id: userId,
      mode: mode === "editing" ? "editing" : "viewing",
      last_seen: new Date(now).toISOString(),
    },
    { onConflict: "document_id,user_id" },
  );

  // Opportunistic cleanup of long-abandoned rows.
  await db
    .from("docs_document_presence")
    .delete()
    .eq("document_id", docId)
    .lt("last_seen", new Date(now - STALE_MS).toISOString());

  const { data } = await db
    .from("docs_document_presence")
    .select("user_id, mode, last_seen")
    .eq("document_id", docId)
    .gt("last_seen", new Date(now - ACTIVE_WINDOW_MS).toISOString());

  const rows = (data ?? []) as {
    user_id: string;
    mode: PresenceMode;
    last_seen: string;
  }[];
  if (rows.length === 0) return [];

  const { data: us } = await db
    .from("docs_users")
    .select("id, email, display_name")
    .in("id", rows.map((r) => r.user_id));
  const byId = new Map<string, UserRef>();
  for (const u of us ?? []) byId.set(u.id, u as UserRef);

  return rows
    .map((r) => {
      const u = byId.get(r.user_id);
      return {
        id: r.user_id,
        name: u?.display_name || u?.email || "Someone",
        mode: r.mode === "editing" ? "editing" : "viewing",
        isSelf: r.user_id === userId,
      } satisfies PresencePerson;
    })
    .sort((a, b) => (a.isSelf ? -1 : b.isSelf ? 1 : a.name.localeCompare(b.name)));
}

export async function leave(docId: string, userId: string): Promise<void> {
  await getSupabaseAdmin()
    .from("docs_document_presence")
    .delete()
    .eq("document_id", docId)
    .eq("user_id", userId);
}
