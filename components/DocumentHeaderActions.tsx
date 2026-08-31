"use client";

import { useEffect, useRef, useState } from "react";
import SharePanel from "@/components/SharePanel";
import DocumentTools from "@/components/DocumentTools";
import type { ShareEntry } from "@/lib/types";

type Panel = "share" | "tools";

export default function DocumentHeaderActions({
  docId,
  ownerLabel,
  shares,
  canManage,
  canEdit,
}: {
  docId: string;
  ownerLabel: string;
  shares: ShareEntry[];
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

  const tab = (panel: Panel, label: string) => (
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
    <div ref={ref} className="relative flex items-center gap-2">
      {tab("share", "Share")}
      {tab("tools", "Tools")}

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] drop-shadow-xl">
          {open === "share" ? (
            <SharePanel
              docId={docId}
              ownerLabel={ownerLabel}
              shares={shares}
              canManage={canManage}
            />
          ) : (
            <DocumentTools docId={docId} canEdit={canEdit} canManage={canManage} />
          )}
        </div>
      )}
    </div>
  );
}
