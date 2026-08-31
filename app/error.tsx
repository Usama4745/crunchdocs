"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const looksLikeConfig = /supabase is not configured/i.test(error.message);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-24">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      {looksLikeConfig ? (
        <p className="text-sm text-zinc-500">
          The database isn&apos;t configured. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code>, fill in your Supabase URL and service role
          key, run <code>supabase/schema.sql</code>, then restart the dev server.
          Full steps are in the README.
        </p>
      ) : (
        <p className="text-sm text-zinc-500">{error.message}</p>
      )}
      <button
        onClick={reset}
        className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Try again
      </button>
    </main>
  );
}
