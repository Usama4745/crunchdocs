"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  createDocumentAction,
  importDocumentAction,
  type FormResult,
} from "@/app/actions";

const INITIAL: FormResult = { ok: true };

function PendingButton({
  idle,
  busy,
  variant = "primary",
}: {
  idle: string;
  busy: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  const base =
    "rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 whitespace-nowrap";
  const styles =
    variant === "primary"
      ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";
  return (
    <button type="submit" disabled={pending} className={`${base} ${styles}`}>
      {pending ? busy : idle}
    </button>
  );
}

export default function NewDocumentControls() {
  const [importState, importAction] = useActionState(importDocumentAction, INITIAL);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-3">
        <form action={createDocumentAction}>
          <PendingButton idle="+ New document" busy="Creating…" />
        </form>

        <span className="text-sm text-zinc-400">or import a file</span>

        <form
          action={importAction}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            ref={fileRef}
            name="file"
            type="file"
            accept=".txt,.md,.markdown,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            required
            className="text-sm file:mr-2 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:file:bg-zinc-800"
          />
          <PendingButton idle="Import" busy="Importing…" variant="secondary" />
        </form>
      </div>

      <p className="text-xs text-zinc-500">
        Supported import types: <strong>.txt</strong>, <strong>.md</strong> /{" "}
        <strong>.markdown</strong>, <strong>.docx</strong> (max 5&nbsp;MB). The
        file is converted to a new editable rich-text document.
      </p>

      {importState.ok === false && (
        <p className="text-sm text-red-600 dark:text-red-400">{importState.error}</p>
      )}
    </div>
  );
}
