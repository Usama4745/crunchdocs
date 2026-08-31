"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, type FormResult } from "@/app/actions";

const INITIAL: FormResult = { ok: true };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Signing in…" : label}
    </button>
  );
}

export default function SignInForm({
  seededEmails,
}: {
  seededEmails: string[];
}) {
  const [state, formAction] = useActionState(signInAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          list="seeded-emails"
          placeholder="you@example.com"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <datalist id="seeded-emails">
          {seededEmails.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
      </label>

      {state.ok === false && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <SubmitButton label="Continue" />

      {seededEmails.length > 0 && (
        <p className="text-xs text-zinc-500">
          Demo accounts: {seededEmails.join(", ")}. Any other email creates a new
          account instantly.
        </p>
      )}
    </form>
  );
}
