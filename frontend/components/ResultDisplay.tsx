"use client";

import React from "react";
import type { AnalysisResult } from "@/lib/types/resume";
import { ToastContainer, useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { uploadCoverLetterJson } from "@/lib/supabase/storage";
import { createResumeWithArtifacts } from "@/lib/supabase/services/resumes";
import { DEFAULT_JOBSITE, type JobsiteId } from "@/lib/jobsites";
import { formatPdfSaveMessage, saveCoverLetterPdfToDownloadsFolder, saveGeneratedResumeToDownloads, SaveCancelledError } from "@/lib/pdf-download";
import { writeClipboardText } from "@/lib/clipboard";
import { formatSupabaseConnectionError, isSupabaseNetworkError } from "@/lib/supabase/network";
import { formatProviderLabel, getModelProvider } from "@/lib/openrouter-shared";
import { apiUrl } from "@/lib/api-config";
import { mergeQuestionAnswers } from "@/lib/merge-question-answers";

export interface QuestionAnswer {
  question: string;
  answer: string;
}

interface ResultDisplayProps {
  result: AnalysisResult;
  pdfBase64?: string;
  pdfError?: string;
  sessionApiModel: string;
  providerUsed?: string;
  modelUsed?: string;
  jobRole?: string;
  companyName?: string;
  jobsite?: JobsiteId;
  resumeId?: string;
  resumeTemplate?: string;
  userId?: string;
  onResumeSaved?: (resumeId: string) => void;
  questionsText: string;
  setQuestionsText: (value: string) => void;
  coverLetter: string;
  setCoverLetter: (value: string) => void;
  answers: QuestionAnswer[];
  setAnswers: (value: QuestionAnswer[]) => void;
  lastJd?: string;
}

export default function ResultDisplay({
  result,
  pdfBase64,
  pdfError,
  sessionApiModel,
  providerUsed,
  modelUsed,
  jobRole = "",
  companyName = "",
  jobsite = DEFAULT_JOBSITE,
  resumeId,
  resumeTemplate,
  userId,
  onResumeSaved,
  questionsText,
  setQuestionsText,
  coverLetter,
  setCoverLetter,
  answers,
  setAnswers,
  lastJd = "",
}: ResultDisplayProps) {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [savedResumeId, setSavedResumeId] = React.useState<string | undefined>(resumeId);
  const [lastDiskSavePath, setLastDiskSavePath] = React.useState<string | null>(null);
  const downloadingRef = React.useRef(false);
  const [answersLoading, setAnswersLoading] = React.useState(false);
  const [coverLetterLoading, setCoverLetterLoading] = React.useState(false);
  const [coverLetterSaving, setCoverLetterSaving] = React.useState(false);
  const [coverLetterCopied, setCoverLetterCopied] = React.useState(false);
  const [copiedAnswerIndex, setCopiedAnswerIndex] = React.useState<number | null>(null);
  const { toasts, showToast, dismissToast } = useToast();

  React.useEffect(() => {
    setSavedResumeId(resumeId);
  }, [resumeId]);

  const effectiveResumeId = savedResumeId ?? resumeId;

  const handleDownloadPDF = React.useCallback(async () => {
    if (!pdfBase64 || !userId || downloadingRef.current) return;

    downloadingRef.current = true;
    setIsDownloading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { savedPath } = await saveGeneratedResumeToDownloads(result, pdfBase64, {
        companyName,
        jobRole,
        personName: result.name || "resume",
        template: resumeTemplate,
        accessToken: session?.access_token,
      });
      setLastDiskSavePath(savedPath);

      let newlySaved = false;

      if (!effectiveResumeId) {
        const record = await createResumeWithArtifacts({
          userId,
          jd: lastJd,
          resume: result,
          aiType: providerUsed ?? getModelProvider(sessionApiModel),
          model: modelUsed ?? null,
          jobSite: jobsite,
          jobLink: null,
          jobTitle: jobRole.trim() || null,
          jobCompany: companyName.trim() || null,
        });
        setSavedResumeId(record.id);
        onResumeSaved?.(record.id);
        newlySaved = true;
      }

      showToast("success", formatPdfSaveMessage(savedPath, newlySaved));
    } catch (error) {
      if (error instanceof SaveCancelledError) return;
      console.error("Failed to save resume or PDF:", error);

      const message = isSupabaseNetworkError(error)
        ? formatSupabaseConnectionError(error)
        : error instanceof Error
          ? error.message
          : "Could not save";

      showToast("error", `Failed: ${message}`);
    } finally {
      downloadingRef.current = false;
      setIsDownloading(false);
    }
  }, [
    pdfBase64,
    userId,
    result,
    jobRole,
    companyName,
    resumeTemplate,
    lastJd,
    effectiveResumeId,
    providerUsed,
    sessionApiModel,
    modelUsed,
    jobsite,
    onResumeSaved,
    showToast,
  ]);

  const handleCoverLetter = React.useCallback(async () => {
    setCoverLetterLoading(true);
    setCoverLetter("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl("/api/cover-letter"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ resume: result, jd: lastJd, apiModel: sessionApiModel }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const data = await res.json();
      setCoverLetter(data.coverLetter || "");
      showToast("success", "Cover letter ready — review below.");
    } catch (err) {
      showToast("error", `Cover letter failed: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setCoverLetterLoading(false);
    }
  }, [result, lastJd, sessionApiModel, setCoverLetter, showToast]);

  const handleSaveAndDownloadCoverLetter = React.useCallback(async () => {
    if (!coverLetter || coverLetterSaving || !userId) return;

    setCoverLetterSaving(true);
    try {
      let resumeIdForSave = effectiveResumeId;
      if (!resumeIdForSave) {
        const record = await createResumeWithArtifacts({
          userId,
          jd: lastJd,
          resume: result,
          aiType: providerUsed ?? getModelProvider(sessionApiModel),
          model: modelUsed ?? null,
          jobSite: jobsite,
          jobLink: null,
          jobTitle: jobRole.trim() || null,
          jobCompany: companyName.trim() || null,
        });
        resumeIdForSave = record.id;
        setSavedResumeId(record.id);
        onResumeSaved?.(record.id);
      }

      await uploadCoverLetterJson(userId, resumeIdForSave, {
        text: coverLetter,
        jobTitle: jobRole,
        jobCompany: companyName,
        generatedAt: new Date().toISOString(),
      });

      const { data: { session } } = await supabase.auth.getSession();
      const { savedPath } = await saveCoverLetterPdfToDownloadsFolder(coverLetter, {
        companyName,
        jobRole,
        accessToken: session?.access_token,
      });

      showToast("success", `Cover letter saved to cloud and saved as ${savedPath}`);
    } catch (err) {
      if (err instanceof SaveCancelledError) return;
      showToast("error", `Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setCoverLetterSaving(false);
    }
  }, [
    coverLetter,
    coverLetterSaving,
    effectiveResumeId,
    userId,
    lastJd,
    result,
    providerUsed,
    sessionApiModel,
    modelUsed,
    jobsite,
    jobRole,
    companyName,
    onResumeSaved,
    showToast,
  ]);

  const handleCopyCoverLetter = React.useCallback(async () => {
    if (!coverLetter) return;
    try {
      await writeClipboardText(coverLetter);
      setCoverLetterCopied(true);
      setTimeout(() => setCoverLetterCopied(false), 2000);
    } catch {
      showToast("error", "Copy failed");
    }
  }, [coverLetter, showToast]);

  const handleCopyAnswer = React.useCallback(
    async (index: number, text: string) => {
      if (!text) return;
      try {
        await writeClipboardText(text);
        setCopiedAnswerIndex(index);
        setTimeout(() => setCopiedAnswerIndex(null), 2000);
      } catch {
        showToast("error", "Copy failed");
      }
    },
    [showToast]
  );

  const handleGetAnswers = React.useCallback(async () => {
    const questions = questionsText
      .split(/\n/)
      .map((q) => q.trim())
      .filter(Boolean);
    if (questions.length === 0) {
      showToast("warning", "Enter at least one question (one per line).");
      return;
    }
    setAnswersLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl("/api/answer-questions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ questions, resume: result, apiModel: sessionApiModel }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const data = await res.json();
      setAnswers(mergeQuestionAnswers(answers, data.answers || []));
      setQuestionsText("");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to get answers");
    } finally {
      setAnswersLoading(false);
    }
  }, [questionsText, result, sessionApiModel, answers, setAnswers, setQuestionsText, showToast]);

  if (!result) return null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain pb-2 pr-1">
        {pdfBase64 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <svg className="h-5 w-5 flex-shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-900">PDF ready</p>
              {(providerUsed || modelUsed) && (
                <p className="text-xs text-emerald-700">
                  {formatProviderLabel(providerUsed || getModelProvider(sessionApiModel))}
                  {modelUsed ? ` · ${modelUsed}` : ""}
                </p>
              )}
              {effectiveResumeId && (
                <p className="text-xs text-emerald-600">Saved to cloud · <a href="/history" className="underline">View history</a></p>
              )}
            </div>
          </div>
        ) : pdfError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/30">
            <p className="text-sm font-semibold text-red-900 dark:text-red-200">PDF generation failed</p>
            <p className="mt-1 text-sm text-red-800 dark:text-red-300/90">{pdfError}</p>
          </div>
        ) : null}

        <button onClick={handleDownloadPDF} disabled={!pdfBase64 || isDownloading || !userId} className="btn-primary w-full gap-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {isDownloading
            ? "Saving…"
            : pdfBase64
              ? effectiveResumeId
                ? lastDiskSavePath
                  ? "Download PDF again"
                  : "Download PDF"
                : "Save & Download PDF"
              : "PDF unavailable"}
        </button>

        <div className="flex gap-2">
          <button onClick={handleCoverLetter} disabled={coverLetterLoading} className="btn-soft flex-1">
            {coverLetterLoading ? "Generating…" : "Generate Cover Letter"}
          </button>
          {coverLetter.trim() && (
            <button
              onClick={handleSaveAndDownloadCoverLetter}
              disabled={coverLetterSaving || !userId}
              className="btn-primary gap-2 px-4"
            >
              {coverLetterSaving ? "Saving…" : "Save and Download"}
            </button>
          )}
        </div>

        {coverLetter.trim() && (
        <div className="relative rounded-xl border border-slate-200 dark:border-slate-600/60 bg-white dark:bg-slate-800 px-4 py-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Cover letter</h3>
          <p className="whitespace-pre-wrap pb-7 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{coverLetter}</p>
          <button
            type="button"
            onClick={() => void handleCopyCoverLetter()}
            className="absolute bottom-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 dark:border-slate-600/60 bg-white dark:bg-slate-800 text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-800 dark:text-slate-100"
            title={coverLetterCopied ? "Copied" : "Copy cover letter"}
            aria-label={coverLetterCopied ? "Copied" : "Copy cover letter"}
          >
            {coverLetterCopied ? (
              <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      )}

      <section className="rounded-xl border-2 border-indigo-200 bg-indigo-50/40 px-4 py-4">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Interview questions</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Enter questions from the job posting (one per line). Answers are generated from your resume.</p>
        <textarea
          value={questionsText}
          onChange={(e) => setQuestionsText(e.target.value)}
          placeholder={"e.g. Tell me about a time you led a project.\nWhat are your strengths?\nWhy do you want to join us?"}
          className="input-shell mt-3 min-h-[100px] resize-y"
          rows={4}
        />
        <button
          type="button"
          onClick={handleGetAnswers}
          disabled={answersLoading || !questionsText.trim()}
          className="btn-primary mt-3 w-full"
        >
          {answersLoading ? "Generating answers…" : "Get answers"}
        </button>
      </section>

      {answers.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-600/60 bg-white dark:bg-slate-800 px-4 py-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Answers</h3>
          <div className="space-y-4">
            {answers.map((qa, i) => (
              <div key={i} className="relative border-b border-slate-100 dark:border-slate-600/50 pb-4 last:border-0 last:pb-0">
                <p className="mb-1 pr-8 text-xs font-semibold text-blue-700">Q: {qa.question}</p>
                <p className="whitespace-pre-wrap pb-7 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{qa.answer}</p>
                <button
                  type="button"
                  onClick={() => void handleCopyAnswer(i, qa.answer)}
                  className="absolute bottom-3 right-0 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 dark:border-slate-600/60 bg-white dark:bg-slate-800 text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-800 dark:text-slate-100"
                  title={copiedAnswerIndex === i ? "Copied" : "Copy answer"}
                  aria-label={copiedAnswerIndex === i ? "Copied" : "Copy answer"}
                >
                  {copiedAnswerIndex === i ? (
                    <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
