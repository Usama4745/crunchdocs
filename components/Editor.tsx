"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { saveDocumentAction } from "@/app/actions";
import { sanitizeHtml } from "@/lib/sanitize";

type SaveStatus = "saved" | "dirty" | "saving" | "error";

const AUTOSAVE_MS = 800;

interface ToolButton {
  label: string;
  title: string;
  command: string;
  value?: string;
  className?: string;
}

const TOOLS: ToolButton[][] = [
  [
    { label: "B", title: "Bold (Ctrl+B)", command: "bold", className: "font-bold" },
    { label: "I", title: "Italic (Ctrl+I)", command: "italic", className: "italic" },
    { label: "U", title: "Underline (Ctrl+U)", command: "underline", className: "underline" },
    { label: "S", title: "Strikethrough", command: "strikeThrough", className: "line-through" },
  ],
  [
    { label: "H1", title: "Heading 1", command: "formatBlock", value: "<h1>" },
    { label: "H2", title: "Heading 2", command: "formatBlock", value: "<h2>" },
    { label: "H3", title: "Heading 3", command: "formatBlock", value: "<h3>" },
    { label: "P", title: "Body text", command: "formatBlock", value: "<p>" },
    { label: "❝", title: "Quote", command: "formatBlock", value: "<blockquote>" },
  ],
  [
    { label: "• List", title: "Bulleted list", command: "insertUnorderedList" },
    { label: "1. List", title: "Numbered list", command: "insertOrderedList" },
    { label: "Clear", title: "Clear formatting", command: "removeFormat" },
  ],
];

export default function Editor({
  docId,
  initialHtml,
  initialUpdatedAt,
}: {
  docId: string;
  initialHtml: string;
  initialUpdatedAt: string;
}) {
  const initialClean = useMemo(
    () => sanitizeHtml(initialHtml) || "<p></p>",
    [initialHtml],
  );
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>(initialClean);
  // Latest editor HTML, kept current so we can still save during unmount /
  // client-side navigation, when the DOM node is already gone.
  const latestHtml = useRef<string>(initialClean);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string>(initialUpdatedAt);

  const flush = useCallback(async () => {
    const raw = ref.current?.innerHTML ?? latestHtml.current;
    const html = sanitizeHtml(raw) || "<p></p>";
    if (html === lastSaved.current) {
      setStatus("saved");
      return;
    }
    setStatus("saving");
    setError(null);
    const res = await saveDocumentAction(docId, html);
    if (res.ok) {
      lastSaved.current = html;
      setSavedAt(res.updatedAt);
      // Only mark saved if nothing new was typed while the request was in flight.
      const current = sanitizeHtml(ref.current?.innerHTML ?? html) || "<p></p>";
      setStatus(current === lastSaved.current ? "saved" : "dirty");
    } else {
      setStatus("error");
      setError(res.error);
    }
  }, [docId]);

  const scheduleSave = useCallback(() => {
    if (ref.current) latestHtml.current = ref.current.innerHTML;
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  // Flush pending edits on unmount (e.g. navigating back to the dashboard).
  const flushRef = useRef(flush);
  const statusRef = useRef(status);
  useEffect(() => {
    flushRef.current = flush;
    statusRef.current = status;
  });
  useEffect(() => {
    return () => {
      if (statusRef.current === "dirty" || statusRef.current === "saving") {
        void flushRef.current();
      }
    };
  }, []);

  // Load initial content once, and turn off CSS styling so execCommand emits tags.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = lastSaved.current;
    try {
      // Emit semantic tags (<strong>, <em>) instead of inline styles.
      (document as unknown as {
        execCommand: (c: string, ui: boolean, v: boolean) => void;
      }).execCommand("styleWithCSS", false, false);
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      /* not supported — fine */
    }
  }, []);

  // Best-effort save when leaving the page.
  useEffect(() => {
    const onHide = () => {
      if (status === "dirty" || status === "saving") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush, status]);

  const exec = (button: ToolButton) => {
    ref.current?.focus();
    try {
      document.execCommand(button.command, false, button.value);
    } catch {
      /* ignore unsupported command */
    }
    scheduleSave();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    const safe = html
      ? sanitizeHtml(html)
      : text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    try {
      document.execCommand("insertHTML", false, safe || text);
    } catch {
      document.execCommand("insertText", false, text);
    }
    scheduleSave();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-3 z-10 flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-white/85 p-1.5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85">
        {TOOLS.map((group, gi) => (
          <div key={gi} className="flex items-center gap-1">
            {gi > 0 && <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />}
            {group.map((b) => (
              <button
                key={b.label}
                type="button"
                title={b.title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => exec(b)}
                className={`min-w-8 rounded px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${b.className ?? ""}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2 px-2 text-xs text-zinc-500">
          <StatusPill status={status} />
          <button
            type="button"
            onClick={() => void flush()}
            className="rounded border border-zinc-200 px-2 py-1 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
            disabled={status === "saved" || status === "saving"}
          >
            Save now
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Could not save: {error}
        </p>
      )}

      <div
        ref={ref}
        className="doc-content min-h-[72vh] rounded-xl bg-white p-8 shadow-xl shadow-zinc-300/40 ring-1 ring-zinc-200/80 sm:p-14 dark:bg-zinc-900 dark:shadow-black/40 dark:ring-zinc-800"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        data-placeholder="Start writing…"
        onInput={scheduleSave}
        onBlur={() => void flush()}
        onPaste={onPaste}
      />

      <p className="text-xs text-zinc-400" suppressHydrationWarning>
        Last saved {new Date(savedAt).toLocaleString()}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, { text: string; cls: string }> = {
    saved: { text: "All changes saved", cls: "text-emerald-600 dark:text-emerald-400" },
    dirty: { text: "Unsaved changes", cls: "text-amber-600 dark:text-amber-400" },
    saving: { text: "Saving…", cls: "text-zinc-500" },
    error: { text: "Save failed", cls: "text-red-600 dark:text-red-400" },
  };
  const { text, cls } = map[status];
  return <span className={cls}>{text}</span>;
}
