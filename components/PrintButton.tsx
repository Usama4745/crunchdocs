"use client";

import { useEffect } from "react";

/**
 * Opens the browser print dialog (where the user picks "Save as PDF").
 * Auto-triggers shortly after mount since this is a dedicated print view,
 * and stays available as a manual button.
 */
export default function PrintButton() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      Print / Save as PDF
    </button>
  );
}
