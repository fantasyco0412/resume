"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { JobWorkType } from "@/lib/prompts/job-page-extract";
import FormattedJobDescription from "@/components/FormattedJobDescription";
import { prepareJobDescriptionForDisplay } from "@/lib/normalize-job-description";
import { formatJobDescriptionForCopy } from "@/lib/format-job-description-for-copy";
import { writeClipboardText } from "@/lib/clipboard";

interface JobDescriptionDialogProps {
  open: boolean;
  onClose: () => void;
  jobTitle?: string;
  companyName?: string;
  jobDescription: string;
  jobLocation?: string;
  industry?: string;
  securityClearance?: string;
  salary?: string;
  postedDate?: string;
  jobTypes?: JobWorkType[];
  requiresTravel?: boolean;
}

export default function JobDescriptionDialog({
  open,
  onClose,
  jobTitle,
  companyName,
  jobDescription,
  jobLocation,
  industry,
  securityClearance,
  salary,
  postedDate,
  jobTypes,
  requiresTravel,
}: JobDescriptionDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const displayDescription = prepareJobDescriptionForDisplay(jobDescription);
  const copyText = formatJobDescriptionForCopy(jobDescription, {
    jobTitle,
    companyName,
    jobLocation,
    industry,
    securityClearance,
    salary,
    postedDate,
    jobTypes,
    requiresTravel,
  });

  const handleCopy = async () => {
    try {
      await writeClipboardText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className="relative z-10 flex max-h-[min(90vh,780px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600/60 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-600/50">
          <h2 className="min-w-0 truncate text-base font-semibold text-slate-900 dark:text-slate-50">
            Job posting
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <FormattedJobDescription
            jobDescription={displayDescription}
            jobTitle={jobTitle}
            companyName={companyName}
            jobLocation={jobLocation}
            industry={industry}
            securityClearance={securityClearance}
            salary={salary}
            postedDate={postedDate}
            jobTypes={jobTypes}
            requiresTravel={requiresTravel}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-600/50">
          <button type="button" onClick={handleCopy} className="btn-soft text-xs">
            {copied ? "Copied" : "Copy description"}
          </button>
          <button type="button" onClick={onClose} className="btn-primary text-xs">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
