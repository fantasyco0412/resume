"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/api-config";
import { formatCostUsd } from "@/lib/ai-usage";
import { saveCoverLetterPdfToDownloadsFolder, SaveCancelledError } from "@/lib/pdf-download";
import { uploadCoverLetterJson } from "@/lib/supabase/storage";
import { writeClipboardText } from "@/lib/clipboard";
import { createResumeWithArtifacts } from "@/lib/supabase/services/resumes";
import { DEFAULT_JOBSITE, type JobsiteId } from "@/lib/jobsites";
import { getModelProvider } from "@/lib/openrouter-shared";
import type { AnalysisResult } from "@/lib/types/resume";

interface CoverLetterDialogProps {
  open: boolean;
  onClose: () => void;
  result: AnalysisResult | null;
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  jobsite?: JobsiteId;
  resumeId?: string;
  userId?: string;
  providerUsed?: string;
  modelUsed?: string;
  savedCoverLetter?: string;
  onCoverLetterChange?: (text: string) => void;
  onResumeSaved?: (resumeId: string) => void;
  apiModel: string;
  apiProvider: string;
  useOpenRouter: boolean;
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
  onCoverLetterCost?: (costUsd: number) => void;
}

export default function CoverLetterDialog({
  open,
  onClose,
  result,
  jobDescription,
  jobTitle,
  companyName,
  jobsite = DEFAULT_JOBSITE,
  resumeId,
  userId,
  providerUsed,
  modelUsed,
  savedCoverLetter = "",
  onCoverLetterChange,
  onResumeSaved,
  apiModel,
  apiProvider,
  useOpenRouter,
  onError,
  onSuccess,
  onCoverLetterCost,
}: CoverLetterDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [runCostUsd, setRunCostUsd] = useState<number | undefined>(undefined);
  const autoGenerateStartedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!result) {
      onError("Generate a tailored resume for this job first.");
      return;
    }

    setGenerating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(apiUrl("/api/cover-letter"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          resume: result,
          jd: jobDescription,
          apiModel,
          apiProvider,
          useOpenRouter,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const data = await res.json();
      const nextCoverLetter = data.coverLetter || "";
      setCoverLetter(nextCoverLetter);
      onCoverLetterChange?.(nextCoverLetter);
      if (typeof data.coverLetterCostUsd === "number" && data.coverLetterCostUsd > 0) {
        setRunCostUsd((prev) => (prev ?? 0) + data.coverLetterCostUsd);
        onCoverLetterCost?.(data.coverLetterCostUsd);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to generate cover letter");
    } finally {
      setGenerating(false);
    }
  }, [
    result,
    jobDescription,
    apiModel,
    apiProvider,
    useOpenRouter,
    onCoverLetterChange,
    onCoverLetterCost,
    onError,
  ]);

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
    if (!open) {
      setCopied(false);
      autoGenerateStartedRef.current = false;
      return;
    }

    setCoverLetter(savedCoverLetter);

    if (autoGenerateStartedRef.current || !result || savedCoverLetter.trim()) return;

    autoGenerateStartedRef.current = true;
    void handleGenerate();
  }, [open, savedCoverLetter, result, handleGenerate]);

  const handleGenerateClick = () => {
    void handleGenerate();
  };

  const handleCopy = async () => {
    if (!coverLetter.trim()) return;
    try {
      await writeClipboardText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError("Couldn't copy to clipboard");
    }
  };

  const handleSaveAndDownload = async () => {
    if (!coverLetter.trim() || saving || !userId || !result) return;

    setSaving(true);
    try {
      let resumeIdForSave = resumeId;
      if (!resumeIdForSave) {
        const record = await createResumeWithArtifacts({
          userId,
          jd: jobDescription,
          resume: result,
          aiType: providerUsed ?? getModelProvider(apiModel),
          model: modelUsed ?? null,
          jobSite: jobsite,
          jobLink: null,
          jobTitle: jobTitle.trim() || null,
          jobCompany: companyName.trim() || null,
        });
        resumeIdForSave = record.id;
        onResumeSaved?.(record.id);
      }

      await uploadCoverLetterJson(userId, resumeIdForSave, {
        text: coverLetter,
        jobTitle,
        jobCompany: companyName,
        generatedAt: new Date().toISOString(),
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { savedPath } = await saveCoverLetterPdfToDownloadsFolder(coverLetter, {
        companyName,
        jobRole: jobTitle,
        accessToken: session?.access_token,
      });

      onSuccess?.(`Cover letter saved to cloud and saved as ${savedPath}`);
    } catch (err) {
      if (err instanceof SaveCancelledError) return;
      onError(err instanceof Error ? err.message : "Failed to save cover letter");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600/60 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-600/50">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Cover letter
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Creates a short cover letter from your tailored resume and this job description.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {coverLetter.trim() ? (
              <button
                type="button"
                onClick={handleGenerateClick}
                disabled={generating || !result}
                className="btn-soft flex-1"
              >
                {generating ? "Regenerating…" : "Regenerate"}
              </button>
            ) : null}
            {coverLetter.trim() ? (
              <button
                type="button"
                onClick={() => void handleSaveAndDownload()}
                disabled={saving || !userId || generating}
                className="btn-primary shrink-0 px-4"
              >
                {saving ? "Saving…" : "Save & download PDF"}
              </button>
            ) : null}
          </div>

          {generating ? (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-10 dark:border-slate-600/50 dark:bg-slate-800/50">
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {coverLetter.trim() ? "Regenerating cover letter…" : "Generating cover letter…"}
              </span>
            </div>
          ) : coverLetter.trim() ? (
            <div className="relative mt-5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-600/50 dark:bg-slate-800/50">
              {runCostUsd != null && runCostUsd > 0 ? (
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  AI cost for this run:{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {formatCostUsd(runCostUsd)}
                  </span>
                </p>
              ) : null}
              <p className="whitespace-pre-wrap pb-7 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {coverLetter}
              </p>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="absolute bottom-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-slate-800 dark:border-slate-600/60 dark:bg-slate-800 dark:text-slate-300"
                title="Copy cover letter"
              >
                {copied ? "✓" : "⎘"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
