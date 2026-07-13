"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { fetchAtsMatch } from "@/lib/check-ats-client";
import { updateResumeAiCosts } from "@/lib/supabase/services/resumes";
import type { AnalysisResult } from "@/lib/types/resume";
import type { AtsMatchResult } from "@/lib/types/ats-match";

interface AtsMatchDialogProps {
  open: boolean;
  onClose: () => void;
  resume: AnalysisResult | null;
  jobDescription: string;
  jobTitle?: string;
  companyName?: string;
  apiModel: string;
  apiProvider: string;
  useOpenRouter: boolean;
  /** When set, dialog shows this result without re-fetching (e.g. auto ATS after resume). */
  initialAts?: AtsMatchResult;
  resumeRecordId?: string;
  onAtsSaved?: (payload: { atsResult: AtsMatchResult; atsCostUsd?: number }) => void;
  onError: (message: string) => void;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreRingColor(score: number): string {
  if (score >= 80) return "border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400";
  if (score >= 60) return "border-amber-500 text-amber-600 dark:border-amber-400 dark:text-amber-400";
  return "border-red-500 text-red-600 dark:border-red-400 dark:text-red-400";
}

function KeywordList({
  title,
  items,
  emptyText,
  variant,
}: {
  title: string;
  items: string[];
  emptyText: string;
  variant: "matched" | "missing";
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li
              key={item}
              className={
                variant === "matched"
                  ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
              }
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function AtsMatchDialog({
  open,
  onClose,
  resume,
  jobDescription,
  jobTitle,
  companyName,
  apiModel,
  apiProvider,
  useOpenRouter,
  initialAts,
  resumeRecordId,
  onAtsSaved,
  onError,
}: AtsMatchDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ats, setAts] = useState<AtsMatchResult | null>(null);
  const onErrorRef = useRef(onError);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onErrorRef.current = onError;
    onCloseRef.current = onClose;
  }, [onError, onClose]);

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
    if (!open) {
      setAts(null);
      setLoading(false);
      return;
    }

    if (!resume || !jobDescription.trim()) {
      onErrorRef.current("Generate a tailored resume and ensure a job description is available.");
      onCloseRef.current();
      return;
    }

    if (initialAts) {
      setAts(initialAts);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setAts(null);

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("You must be signed in to check ATS match");
        }
        const result = await fetchAtsMatch({
          resume,
          jd: jobDescription,
          apiModel,
          apiProvider,
          useOpenRouter,
          accessToken: session.access_token,
        });
        if (!cancelled) {
          setAts(result.ats);
          onAtsSaved?.({ atsResult: result.ats, atsCostUsd: result.atsCostUsd });
          if (resumeRecordId) {
            try {
              await updateResumeAiCosts(resumeRecordId, {
                atsScore: result.ats.score,
                atsCostUsd: result.atsCostUsd,
              });
            } catch (error) {
              console.warn("Failed to save ATS score to history:", error);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          onErrorRef.current(
            err instanceof Error ? err.message : "Failed to check ATS match"
          );
          onCloseRef.current();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, resume, jobDescription, apiModel, apiProvider, useOpenRouter, initialAts, resumeRecordId, onAtsSaved]);

  if (!open || !mounted) return null;

  const title = [jobTitle, companyName].filter(Boolean).join(" · ") || "ATS match";

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
          <h2 className="min-w-0 truncate text-base font-semibold text-slate-900 dark:text-slate-50">
            ATS match — {title}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Analyzing resume against job description…
              </p>
            </div>
          ) : ats ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 text-2xl font-bold ${scoreRingColor(ats.score)}`}
                >
                  {ats.score}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${scoreColor(ats.score)}`}>
                    {ats.score >= 80
                      ? "Strong match"
                      : ats.score >= 60
                        ? "Moderate match"
                        : "Weak match"}
                  </p>
                  {ats.summary ? (
                    <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      {ats.summary}
                    </p>
                  ) : null}
                </div>
              </div>

              <KeywordList
                title="Matched keywords"
                items={ats.matchedKeywords}
                emptyText="No notable keyword matches found."
                variant="matched"
              />
              <KeywordList
                title="Missing keywords to add"
                items={ats.missingKeywords}
                emptyText="No critical gaps identified."
                variant="missing"
              />
              <BulletList title="Strengths" items={ats.strengths} />
              <BulletList title="Suggested improvements" items={ats.improvements} />
              <BulletList title="Formatting notes" items={ats.formattingNotes} />
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-4 dark:border-slate-600/50">
          <button type="button" onClick={onClose} className="btn-primary text-xs">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
