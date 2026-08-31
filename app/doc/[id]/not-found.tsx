import Link from "next/link";

export default function DocumentNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Document not available</h1>
      <p className="text-sm text-zinc-500">
        This document doesn&apos;t exist, or it hasn&apos;t been shared with your
        account.
      </p>
      <Link
        href="/"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
      >
        Back to your documents
      </Link>
    </main>
  );
}
