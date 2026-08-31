"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { restoreVersionAction, type FormResult } from "@/app/actions";

const INITIAL: FormResult = { ok: true };

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Restoring…" : "Restore this version"}
    </button>
  );
}

export default function RestoreVersionButton({
  docId,
  versionId,
}: {
  docId: string;
  versionId: string;
}) {
  const [state, action] = useActionState(restoreVersionAction, INITIAL);
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.message) {
      router.push(`/doc/${docId}`);
      router.refresh();
    }
  }, [state, docId, router]);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="docId" value={docId} />
      <input type="hidden" name="versionId" value={versionId} />
      <Btn />
      {state.ok === false && (
        <span className="text-sm text-red-600 dark:text-red-400">{state.error}</span>
      )}
    </form>
  );
}
