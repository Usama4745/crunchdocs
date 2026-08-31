# Architecture notes

Short version of what I prioritized, and the trade-offs behind each choice.

## What I optimized for

1. **A correct, demonstrable sharing model.** The brief's hard requirements are
   owner / grant-access / owned-vs-shared distinction. Authorization is
   therefore the part I made airtight and tested.
2. **Safe round-tripping of rich text.** Storing user-authored HTML and later
   showing it to *a different user* is an XSS sink. The sanitizer is the second
   thing I made airtight and tested.
3. **Small, legible surface area.** One database, no editor framework. Runtime
   dependencies beyond the framework: `@supabase/supabase-js`; `mammoth`
   (`.docx` import, lazy + server-external); and `docx` + `node-html-parser`
   (`.docx` export, lazy). Everything a reviewer needs to read fits in `lib/`
   plus a handful of components.

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
- `lib/authz.ts::getDocAccess` / `assertAccess` wrap it with the doc+shares
  query and a capability check (`view` / `edit` / `manage`). Every
  Supabase-touching module — `documents`, `versions`, `comments`, `presence` —
  routes through it, so a new feature can't accidentally skip the check.
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

### Export

`lib/export.ts` builds one `buildExportHtml(title, body)` string (title as an
`<h1>`, body re-sanitized) that both export paths share.

- **`.docx`** — a **Route Handler** (`GET /doc/[id]/export/docx`), not a Server
  Action, because the response is a binary file download with
  `Content-Disposition`. It checks the cookie session and `getDocumentForUser`
  (so authorization is identical to viewing), then generates the file. Because
  the stored HTML is a tiny attribute-free allow-list, `htmlToDocxBuffer` walks
  it with `node-html-parser` and emits OOXML directly with the `docx` library
  (headings, bold/italic/underline/strike, bullet + numbered lists, block
  quotes, line breaks). An earlier attempt with a generic `html-to-docx`
  converter produced packages Word rejected for some documents; hand-emitting
  from the known tag set removes that whole failure mode and the test asserts a
  complete zip (PK header **and** end-of-central-directory trailer).
- **PDF** — a dedicated print route (`/doc/[id]/print`) renders just the
  document with a print stylesheet and calls `window.print()`; the user picks
  "Save as PDF". This uses the browser's own renderer — selectable text, real
  pagination, zero new dependencies — instead of shipping a headless Chromium
  (`puppeteer` + `@sparticuz/chromium`), which is heavy and awkward on
  serverless. The trade-off is that it needs a user gesture / dialog rather
  than producing a file on the server.

Both exports are available to anyone with read access, including view-only
collaborators.

### Live collaboration

Three features, kept deliberately simple so they fit the same
Postgres + Server Actions model as everything else.

- **Presence** (`lib/presence.ts`, `docs_document_presence`). Each open document
  page runs a ~10s heartbeat Server Action that upserts one row per
  `(document, user)` and returns everyone with `last_seen` in the last 30s.
  Chosen over **Supabase Realtime** because Realtime would mean shipping a
  browser Supabase client + the anon key and taking on a websocket dependency
  for what is a cosmetic indicator. Polling is ~4 small indexed queries per
  viewer per 10s and needs zero new infrastructure. The heartbeat also sweeps
  rows older than 5 minutes, and the client best-effort deletes its row on
  `pagehide` / unmount.

- **Comments** (`lib/comments.ts`, `docs_comments`). A single document-level
  thread, **not** anchored to text ranges — range anchoring against a
  `contentEditable` surface that also autosaves is fragile (offsets drift on
  every edit) and well beyond scope. Any user with read access can comment
  (that's the point of view access); the comment's author or the document owner
  can resolve/reopen or delete. `canModerate` is computed per-viewer server-side
  so the client never decides permissions.

- **Version history** (`lib/versions.ts`, `docs_document_versions`). An
  append-only snapshot log. `updateDocumentContent` calls `maybeAutoSnapshot`
  after every write, which inserts a row only if the content changed **and** the
  last snapshot is >3 min old — so autosave doesn't create thousands of
  versions. Users can also save a labelled version explicitly. **Restore**
  snapshots the current content first (`"Before restore"`) then overwrites, so
  it's reversible; the editor holds its own DOM, so the client navigates/reloads
  afterwards to pick up the change.

## Testing strategy

Unit tests target the pure, high-risk logic where a bug is silent and
dangerous: the sanitizer (security), `resolveAccess` (authorization), the
import converter (injection + correctness), and the export helpers
(filename/HTML building, plus one check that a real `.docx` buffer comes out).
These need no database and run in ~2s. The Supabase-backed code in
`lib/documents.ts` is thin orchestration over those tested primitives; an
integration test there would mostly be testing PostgREST and was out of scope
for the time budget.

## If I had more time

- Supabase Auth + real RLS policies (magic-link is low-friction).
- Swap polled presence for Supabase Realtime, and add CRDT/OT so body edits
  merge instead of last-write-wins.
- Anchor comments to text ranges, and add a real suggestion mode.
- Round-trip `.docx` fixtures through a test (the binary path is currently
  covered only indirectly, via the sanitizer).
- Optimistic UI for rename/share/comments and a toast system instead of inline
  text; diff view between versions.
- E2E test (Playwright) covering the share → sign-in-as → see-shared-doc loop
  and the comment / restore flows.
