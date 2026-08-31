"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  addCommentAction,
  deleteCommentAction,
  resolveCommentAction,
  type FormResult,
} from "@/app/actions";
import type { CommentEntry } from "@/lib/types";

const INITIAL: FormResult = { ok: true };

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-end rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Posting…" : "Comment"}
    </button>
  );
}

export default function CommentsPanel({
  docId,
  comments,
}: {
  docId: string;
  comments: CommentEntry[];
}) {
  const [state, formAction] = useActionState(addCommentAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const open = comments.filter((c) => !c.resolved);
  const resolved = comments.filter((c) => c.resolved);

  return (
    <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Comments {comments.length > 0 && `(${open.length} open)`}
      </h2>

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="docId" value={docId} />
        <textarea
          name="body"
          required
          rows={3}
          defaultValue=""
          placeholder="Leave a comment for collaborators…"
          className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state.ok === false && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}
        <SendButton />
      </form>

      <ul className="flex flex-col gap-2">
        {open.length === 0 && resolved.length === 0 && (
          <li className="text-xs text-zinc-400">No comments yet.</li>
        )}
        {[...open, ...resolved].map((c) => (
          <li
            key={c.id}
            className={`rounded-lg border p-3 text-sm ${
              c.resolved
                ? "border-zinc-200 bg-zinc-50 opacity-70 dark:border-zinc-800 dark:bg-zinc-950"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {c.author.display_name || c.author.email || "Unknown"}
              </span>
              <span>{timeAgo(c.created_at)}</span>
            </div>
            <p className="whitespace-pre-wrap break-words">{c.body}</p>
            {(c.canModerate || c.resolved) && (
              <div className="mt-2 flex items-center gap-3 text-xs">
                {c.resolved && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                    Resolved
                  </span>
                )}
                {c.canModerate && (
                  <>
                    <form action={resolveCommentAction}>
                      <input type="hidden" name="docId" value={docId} />
                      <input type="hidden" name="commentId" value={c.id} />
                      <input
                        type="hidden"
                        name="resolved"
                        value={(!c.resolved).toString()}
                      />
                      <button
                        type="submit"
                        className="text-zinc-600 hover:underline dark:text-zinc-300"
                      >
                        {c.resolved ? "Reopen" : "Resolve"}
                      </button>
                    </form>
                    <form action={deleteCommentAction}>
                      <input type="hidden" name="docId" value={docId} />
                      <input type="hidden" name="commentId" value={c.id} />
                      <button
                        type="submit"
                        className="text-red-600 hover:underline dark:text-red-400"
                      >
                        Delete
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
