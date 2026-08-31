"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import {
  restoreVersionAction,
  saveVersionAction,
  type FormResult,
} from "@/app/actions";
import type { VersionSummary } from "@/lib/types";

const INITIAL: FormResult = { ok: true };

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString();
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {pending ? "Saving…" : "Save version"}
    </button>
  );
}

function RestoreButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs text-zinc-600 hover:underline disabled:opacity-50 dark:text-zinc-300"
    >
      {pending ? "Restoring…" : "Restore"}
    </button>
  );
}

export default function VersionHistoryPanel({
  docId,
  versions,
  canEdit,
}: {
  docId: string;
  versions: VersionSummary[];
  canEdit: boolean;
}) {
  const [saveState, saveAction] = useActionState(saveVersionAction, INITIAL);
  const [restoreState, restoreAction] = useActionState(restoreVersionAction, INITIAL);

  // After a restore, the editor's in-memory DOM is stale — reload to pick it up.
  useEffect(() => {
    if (restoreState.ok && restoreState.message) {
      const t = setTimeout(() => window.location.reload(), 600);
      return () => clearTimeout(t);
    }
  }, [restoreState]);

  return (
    <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Version history
      </h2>

      {canEdit && (
        <form action={saveAction} className="flex flex-col gap-2">
          <input type="hidden" name="docId" value={docId} />
          <div className="flex items-center gap-2">
            <input
              name="note"
              placeholder="Label (optional), e.g. “final draft”"
              maxLength={200}
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <SaveButton />
          </div>
          {saveState.ok === false && (
            <p className="text-sm text-red-600 dark:text-red-400">{saveState.error}</p>
          )}
          {saveState.ok && saveState.message && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {saveState.message}
            </p>
          )}
        </form>
      )}

      {restoreState.ok === false && (
        <p className="text-sm text-red-600 dark:text-red-400">{restoreState.error}</p>
      )}
      {restoreState.ok && restoreState.message && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {restoreState.message} Reloading…
        </p>
      )}

      <ul className="flex flex-col divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        {versions.length === 0 && (
          <li className="py-2 text-xs text-zinc-400">
            No saved versions yet. Snapshots are captured automatically as you
            edit, and you can save a labelled one above.
          </li>
        )}
        {versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{v.note || "Snapshot"}</p>
              <p className="text-xs text-zinc-500">
                {timeLabel(v.created_at)}
                {v.author ? ` · ${v.author.display_name || v.author.email}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <a
                href={`/doc/${docId}/version/${v.id}`}
                className="text-xs text-zinc-600 hover:underline dark:text-zinc-300"
              >
                Preview
              </a>
              {canEdit && (
                <form action={restoreAction}>
                  <input type="hidden" name="docId" value={docId} />
                  <input type="hidden" name="versionId" value={v.id} />
                  <RestoreButton />
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
