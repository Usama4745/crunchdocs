"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteDocumentAction,
  importIntoDocumentAction,
  type FormResult,
} from "@/app/actions";

const INITIAL: FormResult = { ok: true };

function Pending({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {pending ? busy : idle}
    </button>
  );
}

export default function DocumentTools({
  docId,
  canEdit,
  canManage,
}: {
  docId: string;
  canEdit: boolean;
  canManage: boolean;
}) {
  const [state, importAction] = useActionState(importIntoDocumentAction, INITIAL);

  // The editor holds its own DOM, so reload to pick up appended content.
  useEffect(() => {
    if (state.ok && state.message) {
      const t = setTimeout(() => window.location.reload(), 700);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Tools
      </h2>

      {canEdit ? (
        <form action={importAction} className="flex flex-col gap-2">
          <input type="hidden" name="docId" value={docId} />
          <label className="text-sm text-zinc-500">
            Append a <strong>.txt</strong> / <strong>.md</strong> file to this document
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              name="file"
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              required
              className="min-w-0 flex-1 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 dark:file:bg-zinc-800"
            />
            <Pending idle="Append" busy="Importing…" />
          </div>
          {state.ok === false && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}
          {state.ok && state.message && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {state.message} Reload to see it.
            </p>
          )}
        </form>
      ) : (
        <p className="text-sm text-zinc-400">
          You have view-only access, so editing tools are disabled.
        </p>
      )}

      {canManage && (
        <form
          action={deleteDocumentAction}
          className="border-t border-zinc-200 pt-3 dark:border-zinc-800"
        >
          <input type="hidden" name="docId" value={docId} />
          <button
            type="submit"
            className="text-sm text-red-600 hover:underline dark:text-red-400"
            onClick={(e) => {
              if (!confirm("Delete this document for everyone? This cannot be undone.")) {
                e.preventDefault();
              }
            }}
          >
            Delete document
          </button>
        </form>
      )}
    </div>
  );
}
