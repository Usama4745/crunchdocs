"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { renameDocumentAction, type FormResult } from "@/app/actions";

const INITIAL: FormResult = { ok: true };

export default function DocumentTitle({
  docId,
  title,
  canRename,
}: {
  docId: string;
  title: string;
  canRename: boolean;
}) {
  const [state, formAction] = useActionState(renameDocumentAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(title);
  const committed = useRef(title);

  useEffect(() => {
    if (state.ok) committed.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!canRename) {
    return <h1 className="text-2xl font-semibold">{title || "Untitled document"}</h1>;
  }

  const submitIfChanged = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== committed.current) {
      formRef.current?.requestSubmit();
    } else if (!trimmed) {
      setValue(committed.current);
    }
  };

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="docId" value={docId} />
      <input
        name="title"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={submitIfChanged}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Document title"
        className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-2xl font-semibold outline-none hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-700"
      />
      {state.ok === false && (
        <span className="px-1 text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
    </form>
  );
}
