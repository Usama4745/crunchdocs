import { redirect } from "next/navigation";
import SignInForm from "@/components/SignInForm";
import { getCurrentUser } from "@/lib/session";
import { listUsers } from "@/lib/documents";

export const metadata = { title: "Sign in · CrunchDocs" };

export default async function LoginPage() {
  const existing = await getCurrentUser();
  if (existing) redirect("/");

  let seededEmails: string[] = [];
  let configError = false;
  try {
    seededEmails = (await listUsers()).map((u) => u.email);
  } catch {
    configError = true;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Crunch<span className="text-zinc-400">Docs</span>
        </h1>
        <p className="text-sm text-zinc-500">
          Sign in with an email to start writing. This is a lightweight demo
          login — no password, just pick or type an address.
        </p>
      </div>

      {configError && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Supabase is not configured yet. Add the environment variables from{" "}
          <code>.env.example</code> and run <code>supabase/schema.sql</code>. See
          the README.
        </p>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <SignInForm seededEmails={seededEmails} />
      </div>
    </main>
  );
}
