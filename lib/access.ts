import type { Permission } from "./types";

export type AccessLevel = "owner" | Permission;

interface ResolveArgs {
  userId: string | null | undefined;
  ownerId: string;
  shares: { user_id: string; permission: Permission }[];
}

/**
 * Decide how a user reaches a document. Pure logic, no I/O — the single
 * source of truth for authorization, exercised directly by the tests.
 *
 * - The owner always has full ("owner") access.
 * - Otherwise the highest matching share grant applies ("edit" beats "view").
 * - No relationship -> `null` (caller should 404, not 403, to avoid leaking
 *   the existence of the document).
 */
export function resolveAccess({ userId, ownerId, shares }: ResolveArgs): AccessLevel | null {
  if (!userId) return null;
  if (userId === ownerId) return "owner";

  let level: Permission | null = null;
  for (const share of shares) {
    if (share.user_id !== userId) continue;
    if (share.permission === "edit") return "edit";
    level = "view";
  }
  return level;
}

export function canView(access: AccessLevel | null): boolean {
  return access === "owner" || access === "edit" || access === "view";
}

export function canEdit(access: AccessLevel | null): boolean {
  return access === "owner" || access === "edit";
}

/** Only the owner may rename, delete, or manage sharing. */
export function canManage(access: AccessLevel | null): boolean {
  return access === "owner";
}
