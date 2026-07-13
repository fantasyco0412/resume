"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface NeedsResumeCloseSession {
  id: string;
  jobTitle: string;
  companyName: string;
}

interface BulkCloseAlertDialogProps {
  open: boolean;
  flaggedSessions: NeedsResumeCloseSession[];
  totalCloseCount: number;
  onCancel: () => void;
  onContinue: () => void;
}

export default function BulkCloseAlertDialog({
  open,
  flaggedSessions,
  totalCloseCount,
  onCancel,
  onContinue,
}: BulkCloseAlertDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onCancel]);

  if (!mounted || !open) return null;

  const isBulk = totalCloseCount > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="glass-panel flex max-h-[min(90vh,560px)] w-full max-w-lg flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-close-alert-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex-shrink-0 border-b border-slate-200/80 px-6 py-4 dark:border-slate-600/50">
          <h3 id="bulk-close-alert-title" className="page-title text-xl">
            Remove jobs without a resume?
          </h3>
          <p className="page-subtitle mt-1">
            {flaggedSessions.length} of {totalCloseCount} selected{" "}
            {totalCloseCount === 1 ? "job still needs" : "jobs still need"} a resume and will be
            removed.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Jobs without a resume
            </p>
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {flaggedSessions.map((session) => {
                const label =
                  [session.jobTitle, session.companyName].filter(Boolean).join(" · ") ||
                  "Unknown role";
                return (
                  <li
                    key={session.id}
                    className="rounded-md border border-amber-200/80 bg-white/70 px-2.5 py-1.5 text-sm dark:border-amber-900/30 dark:bg-slate-800/80"
                  >
                    {label}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-slate-200/80 px-6 py-4 dark:border-slate-600/50">
          <button type="button" onClick={onCancel} className="btn-soft">
            Cancel
          </button>
          <button type="button" onClick={onContinue} className="btn-primary">
            {isBulk ? `Remove all ${totalCloseCount}` : "Remove anyway"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
