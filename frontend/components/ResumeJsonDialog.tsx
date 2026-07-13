"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { AnalysisResult } from "@/lib/types/resume";

interface ResumeJsonDialogProps {
  open: boolean;
  onClose: () => void;
  jobTitle?: string;
  companyName?: string;
  resume: AnalysisResult;
  onRegenerate: (resume: AnalysisResult) => Promise<void>;
  regenerating?: boolean;
}

function formatResumeJson(resume: AnalysisResult): string {
  return JSON.stringify(resume, null, 2);
}

function parseResumeJson(
  text: string
): { ok: true; value: AnalysisResult } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "JSON must be an object" };
    }
    return { ok: true, value: parsed as AnalysisResult };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

export default function ResumeJsonDialog({
  open,
  onClose,
  jobTitle,
  companyName,
  resume,
  onRegenerate,
  regenerating = false,
}: ResumeJsonDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [jsonDraft, setJsonDraft] = useState(() => formatResumeJson(resume));

  const canonicalJson = useMemo(() => formatResumeJson(resume), [resume]);
  const dirty = jsonDraft !== canonicalJson;
  const parsed = useMemo(() => parseResumeJson(jsonDraft), [jsonDraft]);
  const parseError = parsed.ok ? null : parsed.error;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !regenerating) onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, regenerating]);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    setJsonDraft(formatResumeJson(resume));
    setCopied(false);
  }, [open, resume]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonDraft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleRegenerate = async () => {
    if (!parsed.ok || !dirty || regenerating) return;
    await onRegenerate(parsed.value);
  };

  if (!mounted || !open) return null;

  const subtitle = [companyName, jobTitle].filter(Boolean).join(" · ");

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => {
          if (!regenerating) onClose();
        }}
        aria-label="Close dialog"
      />
      <div className="relative z-10 flex max-h-[min(90vh,780px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600/60 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-600/50">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">
              Resume JSON
            </h2>
            {subtitle ? (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            ) : null}
            {dirty ? (
              <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">Unsaved edits</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={regenerating}
            className="shrink-0 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-5 py-5">
          <textarea
            value={jsonDraft}
            onChange={(event) => setJsonDraft(event.target.value)}
            spellCheck={false}
            disabled={regenerating}
            className={`surface-inset h-full min-h-[20rem] w-full resize-none overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-800 outline-none focus:ring-2 focus:ring-[#007fff]/30 disabled:cursor-not-allowed disabled:opacity-70 dark:text-slate-200 ${
              parseError ? "ring-2 ring-red-300 dark:ring-red-800/60" : ""
            }`}
            aria-label="Resume JSON editor"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-600/50">
          <p className="min-w-0 flex-1 text-xs text-red-600 dark:text-red-400">
            {parseError ?? (dirty ? "Edit the JSON, then regenerate the PDF." : " ")}
          </p>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={regenerating}
              className="btn-soft text-xs"
            >
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={() => void handleRegenerate()}
              disabled={regenerating || !dirty || Boolean(parseError)}
              className="btn-primary text-xs"
            >
              {regenerating ? "Regenerating…" : "Regenerate PDF"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={regenerating}
              className="btn-soft text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
