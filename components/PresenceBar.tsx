"use client";

import { useEffect, useRef, useState } from "react";
import { presenceHeartbeatAction, presenceLeaveAction } from "@/app/actions";
import type { PresencePerson } from "@/lib/types";

const POLL_MS = 10_000;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export default function PresenceBar({
  docId,
  selfId,
  mode,
}: {
  docId: string;
  selfId: string;
  mode: "viewing" | "editing";
}) {
  const [people, setPeople] = useState<PresencePerson[]>([]);
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    let active = true;

    const tick = async () => {
      const res = await presenceHeartbeatAction(docId, modeRef.current);
      if (active && res.ok) setPeople(res.people);
    };

    void tick();
    const iv = setInterval(tick, POLL_MS);
    const onLeave = () => void presenceLeaveAction(docId);
    window.addEventListener("pagehide", onLeave);

    return () => {
      active = false;
      clearInterval(iv);
      window.removeEventListener("pagehide", onLeave);
      void presenceLeaveAction(docId);
    };
  }, [docId]);

  const others = people.filter((p) => p.id !== selfId);
  const editingOthers = others.filter((p) => p.mode === "editing").length;

  if (people.length === 0) return null;

  const shown = people.slice(0, 5);
  const extra = people.length - shown.length;

  const summary =
    others.length === 0
      ? "Only you are here"
      : `${others.length} other${others.length > 1 ? "s" : ""} here` +
        (editingOthers > 0 ? ` · ${editingOthers} editing` : "");

  return (
    <div
      className="flex shrink-0 items-center gap-2"
      title={people
        .map((p) => `${p.isSelf ? "You" : p.name} (${p.mode})`)
        .join("\n")}
    >
      <div className="flex -space-x-2">
        {shown.map((p) => (
          <span
            key={p.id}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white ${
              p.mode === "editing"
                ? "border-emerald-400 dark:border-emerald-500"
                : "border-white dark:border-zinc-900"
            }`}
            style={{ backgroundColor: `hsl(${hue(p.id)} 55% 45%)` }}
          >
            {p.isSelf ? "You".slice(0, 2) : initials(p.name)}
          </span>
        ))}
        {extra > 0 && (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-zinc-400 text-[10px] font-semibold text-white dark:border-zinc-900">
            +{extra}
          </span>
        )}
      </div>
      <span className="hidden text-xs text-zinc-500 lg:inline">{summary}</span>
    </div>
  );
}
