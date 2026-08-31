import TopBar from "@/components/TopBar";
import NewDocumentControls from "@/components/NewDocumentControls";
import DocumentCard from "@/components/DocumentCard";
import { requireUser } from "@/lib/session";
import { listDocumentsForUser } from "@/lib/documents";

export const metadata = { title: "Your documents · CrunchDocs" };

export default async function DashboardPage() {
  const user = await requireUser();
  const { owned, shared } = await listDocumentsForUser(user.id);

  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8">
        <section className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold">Your documents</h1>
          <NewDocumentControls />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Owned by you ({owned.length})
          </h2>
          {owned.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No documents yet. Create one or import a file above.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {owned.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Shared with you ({shared.length})
          </h2>
          {shared.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Nothing shared with you yet. When someone shares a document, it
              shows up here.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shared.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
