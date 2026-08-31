# Architecture notes

Short version of what I prioritized, and the trade-offs behind each choice.

## What I optimized for

1. **A correct, demonstrable sharing model.** The brief's hard requirements are
   owner / grant-access / owned-vs-shared distinction. Authorization is
   therefore the part I made airtight and tested.
2. **Safe round-tripping of rich text.** Storing user-authored HTML and later
   showing it to *a different user* is an XSS sink. The sanitizer is the second
   thing I made airtight and tested.
3. **Small, legible surface area.** One database, two runtime dependencies
   (`@supabase/supabase-js`, and `mammoth` for `.docx` import), no editor
   framework. Everything a reviewer needs to read fits in `lib/` plus a handful
   of components.

## Request flow

```
Browser ──(Server Action / RSC)──► Next.js server ──► lib/documents.ts ──► Supabase (Postgres)
                                        │
                                        ├─ lib/session.ts   verify signed cookie → current user
                                        ├─ lib/access.ts    resolveAccess(user, owner, shares)
                                        └─ lib/sanitize.ts   clean HTML on every write
```

- **Reads**: Server Components (`app/page.tsx`, `app/doc/[id]/page.tsx`) call
  `lib/documents.ts` directly. No client-side data fetching, no API layer to
  keep in sync.
- **Writes**: Server Actions in `app/actions.ts`. Each one re-derives the
  current user from the cookie and calls into `lib/documents.ts`, which
  **re-checks authorization on every mutation** (`requireAccess`) — actions are
  reachable by direct POST, so the check can't live only in the UI.
- **Autosave**: the editor calls the `saveDocumentAction` Server Action
  directly (debounced), not through a form.

## Key decisions & trade-offs

### Auth: signed-cookie "sign in as an email"
The brief explicitly allows seeded/mocked/lightweight auth. A real password or
OAuth flow would be the largest single piece of work and adds nothing to what's
being evaluated (the *sharing* logic). So: enter an email → look up or create a
`users` row → set an `httpOnly`, `SameSite=Lax` cookie containing
`userId.HMAC(userId, APP_SECRET)`. The HMAC stops trivial cookie forgery; it is
**not** a substitute for real auth. Swapping in Supabase Auth later means
replacing `lib/session.ts` and nothing else.

### Authorization in app code + service-role key (not RLS)
Because sessions aren't Supabase Auth JWTs, Postgres RLS has no `auth.uid()` to
work with. Options were (a) mint custom JWTs and write RLS policies, or (b) use
the service-role key and enforce access in one well-tested module. I chose (b):

- `lib/access.ts::resolveAccess` is a **pure function** — the entire
  authz policy in ~15 lines, exhaustively unit-tested.
- `lib/documents.ts` is the only module that talks to Supabase, and every read
  and write funnels through `resolveAccess` / `requireAccess`.
- RLS is still **enabled with no policies**, so the anon/public key can't touch
  the tables even if it leaked.

Trade-off: defense-in-depth at the DB layer is weaker than real RLS. For this
scope, a single tested choke-point is easier to verify than a set of SQL
policies. The seam to migrate is small and marked.

### Rich text: `contentEditable` + `execCommand` + allow-list sanitizer
A framework (TipTap/Lexical/Slate) would be ~15+ dependencies and its own
learning curve. For "bold/italic/underline/headings/lists" the browser's own
`execCommand` covers every command with zero runtime deps.

The catch is that `execCommand` produces arbitrary HTML, so:
- `lib/sanitize.ts` runs on **every save** (server-side, in the Server Action)
  and again when rendering the read-only view. It's an allow-list: a fixed set
  of formatting tags, **all attributes stripped**, `<script>`/`<style>`/
  comments removed, aliases normalized (`b→strong`, `div→p`, …). Because the
  editor never needs a single attribute, "strip them all" is both safe and
  simple.
- Paste is intercepted and sanitized before it enters the document.

Trade-off: `execCommand` is deprecated and its cross-browser HTML is a little
inconsistent (e.g. `removeFormat` only clears inline marks). Acceptable for a
small app; the sanitizer means the *stored* representation stays clean
regardless.

### Content stored as sanitized HTML
Alternative was a JSON block model. HTML keeps the editor, the storage format,
and the read-only renderer identical, and Postgres stores it as plain `text`.
The sanitizer is what makes this safe.

### Data model
Three tables, all `docs_`-prefixed so they can coexist with other tables in a
shared Supabase project — `docs_users`, `docs_documents`, `docs_document_shares`
(with `unique(document_id, user_id)` and a `permission` check constraint).
`owner_id` on `docs_documents` is the owner; a row in `docs_document_shares` is
a grant. "Owned vs. shared" is just `docs_documents.owner_id = me` vs. a join
through `docs_document_shares`.
`updated_at` is maintained by a trigger so autosave ordering is trustworthy.

### File import
`.txt`, `.md`, and `.docx`, ≤5 MB, validated by extension **and** size in the
Server Action (`readImportFile`).

- **Markdown** is converted by a ~60-line function (headings, emphasis, inline
  code, lists, block quotes) rather than pulling in a Markdown library; anything
  it doesn't recognize degrades to a paragraph. The converter escapes HTML
  first.
- **`.docx`** is converted with `mammoth`, the one library worth the dependency
  here — reimplementing OOXML parsing is not in scope. It's a lazy
  `import("mammoth")` inside the converter and listed in
  `serverExternalPackages`, so it only loads when a `.docx` is actually
  uploaded and never touches the client bundle or the test path.

Every path's output goes through the same allow-list sanitizer, so an uploaded
file can't inject markup and unsupported `.docx` constructs (images, tables,
comments) are dropped rather than trusted. `convertUploadToHtml(file)` is the
single entry point; both "import as new document" and "append to this document"
call it.

## Testing strategy

Unit tests target the pure, high-risk logic where a bug is silent and
dangerous: the sanitizer (security), `resolveAccess` (authorization), and the
import converter (injection + correctness). These need no database and run in
~1s. The Supabase-backed code in `lib/documents.ts` is thin orchestration over
those tested primitives; an integration test there would mostly be testing
PostgREST and was out of scope for the time budget.

## If I had more time

- Supabase Auth + real RLS policies (magic-link is low-friction).
- Realtime presence / CRDT so concurrent editors don't last-write-wins.
- Round-trip `.docx` fixtures through a test (the binary path is currently
  covered only indirectly, via the sanitizer).
- Optimistic UI for rename/share and a toast system instead of inline text.
- E2E test (Playwright) covering the share → sign-in-as → see-shared-doc loop.
