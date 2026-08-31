import Link from "next/link";
import { signOutAction } from "@/app/actions";
import type { User } from "@/lib/types";

export default function TopBar({ user }: { user: User }) {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Crunch<span className="text-zinc-400">Docs</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-500" title={user.email}>
            {user.display_name || user.email}
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
