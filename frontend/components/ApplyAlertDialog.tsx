"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { DuplicateApplicationMatch } from "@/lib/apply-alerts";
import type { FlaggedGenerateSession } from "@/lib/generator-apply-preflight";

interface ApplyAlertDialogProps {
  open: boolean;
  duplicateMonths: number;
  onCancel: () => void;
  onContinue: () => void;
  /** Legacy single-job display (ResumeForm). */
  duplicateMatches?: DuplicateApplicationMatch[];
  showHybridOnsite?: boolean;
  /** Multi-job display (generator bulk/single with job context). */
  flaggedSessions?: FlaggedGenerateSession[];
  totalGenerateCount?: number;
}

function FlaggedJobAlerts({
  item,
  duplicateMonths,
}: {
  item: FlaggedGenerateSession;
  duplicateMonths: number;
}) {
  const period =
    duplicateMonths === 1 ? "the last month" : `the last ${duplicateMonths} months`;
  const jobLabel = [item.jobTitle, item.companyName].filter(Boolean).join(" · ");

  return (
    <div className="space-y-3 rounded-xl border border-slate-200/90 bg-white/70 p-4 dark:border-slate-600/50 dark:bg-slate-900/40">
      {jobLabel ? (
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{jobLabel}</p>
      ) : null}

      {item.showHybridOnsite ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50/80 p-3 dark:border-orange-900/40 dark:bg-orange-950/30">
          <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">
            Hybrid or on-site role
          </p>
          <p className="mt-1 text-sm text-orange-800 dark:text-orange-300/90">
            This job mentions hybrid or on-site work. Review location requirements before applying.
          </p>
        </div>
      ) : null}

      {item.duplicateMatches.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            You may have already applied here
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300/90">
            You already applied to this company within {period}:
          </p>
          <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1">
            {item.duplicateMatches.map((match, index) => (
              <li
                key={`${item.sessionId}-${match.date}-${match.role}-${index}`}
                className="rounded-md border border-amber-200/80 bg-white/70 px-2.5 py-1.5 text-sm dark:border-amber-900/30 dark:bg-slate-800/80"
              >
                <span className="font-medium text-slate-900 dark:text-slate-50">
                  {match.date}
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  {" "}
                  — {match.company} — {match.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function ApplyAlertDialog({
  open,
  duplicateMonths,
  onCancel,
  onContinue,
  duplicateMatches = [],
  showHybridOnsite = false,
  flaggedSessions,
  totalGenerateCount = 1,
}: ApplyAlertDialogProps) {
  const [mounted, setMounted] = useState(false);

  const displayItems = useMemo(() => {
    if (flaggedSessions && flaggedSessions.length > 0) return flaggedSessions;
    if (duplicateMatches.length > 0 || showHybridOnsite) {
      return [
        {
          sessionId: "legacy",
          jobTitle: "",
          companyName: "",
          duplicateMatches,
          showHybridOnsite,
        },
      ];
    }
    return [];
  }, [duplicateMatches, flaggedSessions, showHybridOnsite]);

  const isBulk = totalGenerateCount > 1 || displayItems.length > 1;

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

  const subtitle = isBulk
    ? `${displayItems.length} of ${totalGenerateCount} selected ${
        totalGenerateCount === 1 ? "job needs" : "jobs need"
      } review before generating.`
    : "Review the following before generating this resume.";

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className={`glass-panel flex max-h-[min(90vh,720px)] w-full flex-col overflow-hidden ${
          isBulk ? "max-w-2xl" : "max-w-lg"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-alert-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex-shrink-0 border-b border-slate-200/80 px-6 py-4 dark:border-slate-600/50">
          <h3 id="apply-alert-title" className="page-title text-xl">
            Application alert{isBulk ? "s" : ""}
          </h3>
          <p className="page-subtitle mt-1">{subtitle}</p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
          {displayItems.map((item) => (
            <FlaggedJobAlerts
              key={item.sessionId}
              item={item}
              duplicateMonths={duplicateMonths}
            />
          ))}
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-slate-200/80 px-6 py-4 dark:border-slate-600/50">
          <button type="button" onClick={onCancel} className="btn-soft">
            Cancel
          </button>
          <button type="button" onClick={onContinue} className="btn-primary">
            {isBulk
              ? `Generate all ${totalGenerateCount} anyway`
              : "Generate anyway"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
