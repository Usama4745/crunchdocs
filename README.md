# CrunchDocs

A small full-stack document editor: create rich-text documents in the browser,
import `.txt` / `.md` files, and share documents with other people with
view-only or edit access. Built with Next.js 16 (App Router) and Supabase
(Postgres).

- **Live demo:** _add your Vercel URL here after deploying (see [Deployment](#deployment))_
- **Demo accounts:** `alice@crunchdocs.test`, `bob@crunchdocs.test`,
  `carol@crunchdocs.test` (no password — this is a lightweight demo login).

---

## Features

### 1. Document creation & editing
- Create a blank document, rename it inline, edit it in the browser, and reopen
  it later — content is persisted to Postgres.
- Rich-text formatting in the toolbar: **bold**, _italic_, underline,
  strikethrough, H1/H2/H3 + body text, block quote, bulleted and numbered
  lists, and clear-formatting.
- **Autosave** (debounced ~0.8s) plus a manual **Save now** button and a
  save-status indicator. Content is also flushed when the tab is hidden or
  closed.
- **Light / dark theme toggle** in the header. Defaults to the OS setting on
  first visit; an explicit choice is remembered in `localStorage` and applied
  before first paint (no flash).
- **Export** from the document's Tools panel (owners, editors, and viewers):
  - **Download `.docx`** — `GET /doc/[id]/export/docx` renders the current
    content to a Word file with [`html-to-docx`](https://www.npmjs.com/package/html-to-docx).
  - **Print / PDF** — opens `/doc/[id]/print`, a clean print view that triggers
    the browser print dialog; choose "Save as PDF" as the destination. Uses the
    browser's own renderer (selectable text, no extra dependency) rather than a
    bundled headless Chromium.

### 2. File upload / import
- **Import a file as a new document** from the dashboard, or **append a file to
  an open document** from the document's Tools panel. Either way the file is
  converted to editable rich text.
- **Supported types: `.txt`, `.md` / `.markdown`, and `.docx`, up to 5 MB.**
  Anything else is rejected with a message in the UI.
  - `.docx` is converted with [`mammoth`](https://github.com/mwilliamson/mammoth.js):
    headings, bold/italic/underline, lists, and block quotes carry over; images,
    tables, and other unsupported constructs are dropped.
  - Markdown support covers headings, bold/italic/inline-code,
    ordered/unordered lists, and block quotes; richer Markdown (tables, links,
    images, code fences) is imported as plain text.
- All imported HTML passes through the same allow-list sanitizer as editor
  content, so an uploaded file can't inject markup or scripts.

### 3. Sharing
- Every document has a single **owner**.
- The owner can **share by email** with `view` or `edit` permission, change or
  remove access at any time. Sharing with an unknown email creates that account
  automatically, so you can immediately sign in as that address to see the
  shared view.
- The dashboard separates **"Owned by you"** from **"Shared with you"**, and
  each document shows an access badge (`Owner` / `Can edit` / `View only`).
- View-only collaborators get a read-only rendering; the editor and management
  tools are hidden.

### 4. Persistence
- Documents, users, and shares are stored in Supabase Postgres. Content is
  stored as sanitized HTML, so formatting survives refresh and reopen.
- Sharing state is queried on every load, so revoking access takes effect
  immediately.

### 5. Live collaboration

- **Presence indicators** in the document header show who else is on the
  document right now, as stacked initials with an "editing" ring, updated by a
  ~10s heartbeat. (Polling, not websockets — see ARCHITECTURE.md.)
- **Comments** — a document-level thread in the **Comments** menu. Anyone with
  access can comment (including view-only). The comment's author or the
  document owner can resolve/reopen or delete it. An open-count badge sits on
  the button.
- **Version history** — snapshots are captured automatically as you edit
  (throttled to one per ~3 minutes) and you can save a labelled version at any
  time. The **History** menu lists them; **Preview** opens a read-only snapshot
  at `/doc/[id]/version/[versionId]`, and **Restore** rolls the document back
  (snapshotting the current state first, so a restore is itself undoable).

> Suggestion / tracked-changes mode is not implemented; commenting covers the
> "comment or suggest" requirement.

---

## Tech stack

| Concern        | Choice                                                            |
| -------------- | --------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router, React Server Components, Server Actions) |
| Language       | TypeScript                                                      |
| Styling        | Tailwind CSS v4                                                  |
| Database       | Supabase (Postgres) via `@supabase/supabase-js`                 |
| Auth           | Lightweight signed-cookie session ("sign in as an email")       |
| Editor         | `contentEditable` + `document.execCommand` + allow-list sanitizer |
| `.docx` import | `mammoth`                                                       |
| `.docx` export | `html-to-docx`                                                 |
| PDF export     | browser print-to-PDF (`/doc/[id]/print` + `window.print()`)     |
| Presence       | polled heartbeat table (~10s), no websockets                    |
| Tests          | Vitest                                                          |
| Deployment     | Vercel (any Node host works)                                    |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for what was prioritized and why.

---

## Setup

### Prerequisites
- Node.js 20+
- A Supabase project (free tier is fine)

### 1. Install
```bash
npm install
```

### 2. Create the database schema
In the Supabase dashboard, open **SQL Editor** and run the contents of
[`supabase/schema.sql`](./supabase/schema.sql). It creates the `docs_`-prefixed
tables (`docs_users`, `docs_documents`, `docs_document_shares`,
`docs_document_versions`, `docs_comments`, `docs_document_presence` — prefixed
so they can share a Supabase project with other tables), an `updated_at`
trigger, enables RLS (the app uses the service role key and enforces access in
application code), and seeds the three demo accounts. The script is safe to
re-run — **re-run it after pulling this change** to add the collaboration
tables.

### 3. Configure environment variables
```bash
cp .env.example .env.local
```
Fill in:

| Variable                        | Where to find it                                             |
| ------------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL             |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase → Project Settings → API → `service_role` secret   |
| `APP_SECRET`                    | Any long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

> The service role key is used **only on the server** (`lib/supabase.ts` imports
> `server-only`). Do not prefix it with `NEXT_PUBLIC_`.

### 4. Run
```bash
npm run dev
```
Open http://localhost:3000, sign in as `alice@crunchdocs.test` (or any email),
and start creating documents.

To demo sharing: as Alice, create a document and share it with
`bob@crunchdocs.test` (edit) and `carol@crunchdocs.test` (view). Sign out, sign
back in as Bob or Carol, and the document appears under **Shared with you** with
the matching access level.

---

## Tests

```bash
npm test          # run once
npm run test:watch
```

The suite (Vitest, 41 assertions) covers the security- and correctness-critical
logic:

- **`lib/sanitize.test.ts`** – the HTML sanitizer: strips `<script>`/`<style>`,
  event-handler attributes, `javascript:` URLs, `<img>`/`<iframe>` and other
  non-text tags; keeps and normalizes allowed formatting tags. This is the
  boundary that makes it safe to store user HTML and show it to a person it was
  shared with.
- **`lib/access.test.ts`** – `resolveAccess`, the single source of truth for
  authorization (owner vs. edit vs. view vs. no access, signed-out, duplicate
  grants).
- **`lib/import.test.ts`** – Markdown/plain-text → HTML conversion and upload
  routing, including that imported files cannot inject markup.
- **`lib/export.test.ts`** – export filename slugging and export-HTML building
  (title escaped, body sanitized), plus a check that a real `.docx` buffer is
  produced.

---

## Deployment

The app runs on any Node host. Instructions for **Vercel**:

1. Push this repo to GitHub and **Import** it in Vercel (framework auto-detected
   as Next.js).
2. Add the three environment variables from `.env.example` in
   **Project Settings → Environment Variables** (Production + Preview).
3. Make sure `supabase/schema.sql` has been run against the Supabase project the
   keys point at.
4. Deploy. The health check `GET /api/health` returns
   `{"status":"ok","supabaseConfigured":true}` when the environment is wired up.

No build-time secrets are required — pages that need data render on demand.

---

## Project layout

```
app/
  actions.ts                  Server Actions (auth, CRUD, sharing, import)
  page.tsx                    Dashboard: owned vs. shared documents
  login/page.tsx              Sign-in
  doc/[id]/page.tsx           Editor / viewer + header (presence, comments, history, share, tools)
  doc/[id]/print/page.tsx     Clean print view (browser "Save as PDF")
  doc/[id]/export/docx/route.ts       Download the document as .docx
  doc/[id]/version/[versionId]/page.tsx  Read-only snapshot + restore
  api/health/route.ts         Readiness check
lib/
  access.ts             resolveAccess() + permission helpers (pure, tested)
  authz.ts              getDocAccess()/assertAccess() — shared DB access checks
  sanitize.ts           allow-list HTML sanitizer (pure, tested)
  import.ts             file import -> sanitized HTML (.txt/.md pure + tested; .docx via mammoth)
  export.ts             title/body -> export HTML + .docx buffer (filename/html pure + tested)
  documents.ts          document data access (Supabase)
  versions.ts           version history: snapshot / list / restore
  comments.ts           document comment thread
  presence.ts           polled presence heartbeat
  session.ts            signed-cookie session
  supabase.ts           server-only service-role client
components/              editor, toolbar, presence bar, comments/history/share panels, ...
supabase/schema.sql     database schema + seed data
```

## Known limitations (scope)

- Auth is a demo: an email + signed cookie, no password. Fine for evaluating the
  sharing model; not production auth.
- Authorization is enforced in application code with the service-role key rather
  than Postgres RLS policies (see ARCHITECTURE.md for the trade-off).
- The editor uses `document.execCommand`. It is deprecated but universally
  supported and keeps the dependency footprint tiny for this scope.
- Presence is polled (~10s), not a websocket; concurrent edits to the body are
  last-write-wins (autosave), and version snapshots are the safety net rather
  than an operational-transform / CRDT merge.
- Comments are document-level, not anchored to a text range, and there is no
  suggestion / tracked-changes mode.
- `.docx` import preserves structure and inline formatting but not layout,
  fonts, images, tables, or track-changes. Legacy `.doc` is not supported.
