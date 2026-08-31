"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import SharePanel from "@/components/SharePanel";
import DocumentTools from "@/components/DocumentTools";
import CommentsPanel from "@/components/CommentsPanel";
import VersionHistoryPanel from "@/components/VersionHistoryPanel";
import type { CommentEntry, ShareEntry, VersionSummary } from "@/lib/types";

type Panel = "comments" | "share" | "history" | "tools";

export default function DocumentHeaderActions({
  docId,
  ownerLabel,
  shares,
  comments,
  versions,
  openCommentCount,
  canManage,
  canEdit,
}: {
  docId: string;
  ownerLabel: string;
  shares: ShareEntry[];
  comments: CommentEntry[];
  versions: VersionSummary[];
  openCommentCount: number;
  canManage: boolean;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState<Panel | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const tab = (panel: Panel, label: ReactNode) => (
    <button
      type="button"
      aria-expanded={open === panel}
      onClick={() => setOpen((cur) => (cur === panel ? null : panel))}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
        open === panel
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
          : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative flex flex-wrap items-center gap-2">
      {tab(
        "comments",
        <>
          Comments
          {openCommentCount > 0 && (
            <span className="ml-1.5 rounded-full bg-zinc-200 px-1.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
              {openCommentCount}
            </span>
          )}
        </>,
      )}
      {tab("share", "Share")}
      {tab("history", "History")}
      {tab("tools", "Tools")}

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[24rem] max-w-[calc(100vw-2rem)] drop-shadow-xl">
          {open === "comments" && (
            <CommentsPanel docId={docId} comments={comments} />
          )}
          {open === "share" && (
            <SharePanel
              docId={docId}
              ownerLabel={ownerLabel}
              shares={shares}
              canManage={canManage}
            />
          )}
          {open === "history" && (
            <VersionHistoryPanel docId={docId} versions={versions} canEdit={canEdit} />
          )}
          {open === "tools" && (
            <DocumentTools docId={docId} canEdit={canEdit} canManage={canManage} />
          )}
        </div>
      )}
    </div>
  );
}
