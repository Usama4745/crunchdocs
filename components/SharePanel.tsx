"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  shareDocumentAction,
  unshareDocumentAction,
  type FormResult,
} from "@/app/actions";
import type { ShareEntry } from "@/lib/types";

const INITIAL: FormResult = { ok: true };

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Sharing…" : "Share"}
    </button>
  );
}

export default function SharePanel({
  docId,
  ownerLabel,
  shares,
  canManage,
}: {
  docId: string;
  ownerLabel: string;
  shares: ShareEntry[];
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(shareDocumentAction, INITIAL);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Sharing
      </h2>

      <ul className="flex flex-col gap-1.5 text-sm">
        <li className="flex items-center justify-between gap-2">
          <span>{ownerLabel}</span>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-zinc-900">
            Owner
          </span>
        </li>
        {shares.map((s) => (
          <li key={s.user.id} className="flex items-center justify-between gap-2">
            <span className="truncate">{s.user.display_name || s.user.email}</span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                {s.permission === "edit" ? "Can edit" : "View only"}
              </span>
              {canManage && (
                <form action={unshareDocumentAction}>
                  <input type="hidden" name="docId" value={docId} />
                  <input type="hidden" name="userId" value={s.user.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
        {shares.length === 0 && (
          <li className="text-xs text-zinc-400">Not shared with anyone yet.</li>
        )}
      </ul>

      {canManage && (
        <form action={formAction} className="flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <input type="hidden" name="docId" value={docId} />
          <div className="flex flex-wrap items-center gap-2">
            <input
              name="email"
              type="email"
              required
              placeholder="person@example.com"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <select
              name="permission"
              defaultValue="edit"
              className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="edit">Can edit</option>
              <option value="view">View only</option>
            </select>
            <AddButton />
          </div>
          {state.ok === false && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}
          {state.ok && state.message && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{state.message}</p>
          )}
          <p className="text-xs text-zinc-500">
            Unknown emails get an account automatically, so you can demo the
            shared view by signing in as that address.
          </p>
        </form>
      )}
    </div>
  );
}
