"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/api-config";
import { formatCostUsd } from "@/lib/ai-usage";
import type { AnalysisResult } from "@/lib/types/resume";
import { mergeQuestionAnswers } from "@/lib/merge-question-answers";
import { writeClipboardText } from "@/lib/clipboard";

export interface QuestionAnswer {
  question: string;
  answer: string;
}

interface AnswerQuestionsDialogProps {
  open: boolean;
  onClose: () => void;
  result: AnalysisResult | null;
  savedAnswers?: QuestionAnswer[];
  onAnswersChange?: (answers: QuestionAnswer[]) => void;
  apiModel: string;
  apiProvider: string;
  useOpenRouter: boolean;
  onError: (message: string) => void;
  onAnswersCost?: (costUsd: number) => void;
}

export default function AnswerQuestionsDialog({
  open,
  onClose,
  result,
  savedAnswers = [],
  onAnswersChange,
  apiModel,
  apiProvider,
  useOpenRouter,
  onError,
  onAnswersCost,
}: AnswerQuestionsDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [questionsText, setQuestionsText] = useState("");
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [answersCostUsd, setAnswersCostUsd] = useState<number | undefined>(undefined);

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
      setQuestionsText("");
      setCopiedIndex(null);
      return;
    }
    setAnswers(savedAnswers);
  }, [open, savedAnswers]);

  const handleGenerate = async () => {
    if (!result) {
      onError("Generate a tailored resume for this job first.");
      return;
    }
    const questions = questionsText
      .split(/\n/)
      .map((q) => q.trim())
      .filter(Boolean);
    if (questions.length === 0) {
      onError("Enter at least one question (one per line).");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(apiUrl("/api/answer-questions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          questions,
          resume: result,
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
      setAnswers((prev) => {
        const nextAnswers = mergeQuestionAnswers(prev, data.answers || []);
        onAnswersChange?.(nextAnswers);
        return nextAnswers;
      });
      setQuestionsText("");
      if (typeof data.answersCostUsd === "number" && data.answersCostUsd > 0) {
        setAnswersCostUsd((prev) => (prev ?? 0) + data.answersCostUsd);
        onAnswersCost?.(data.answersCostUsd);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to generate answers");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (index: number, text: string) => {
    try {
      await writeClipboardText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      onError("Couldn't copy to clipboard");
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
            Answer application questions
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
            Paste application or interview questions (one per line). Answers are based on your tailored resume.
          </p>
          <textarea
            value={questionsText}
            onChange={(e) => setQuestionsText(e.target.value)}
            placeholder={"e.g. Tell me about a time you led a project.\nWhy do you want to join us?"}
            className="input-shell mt-3 min-h-[120px] resize-y"
            rows={5}
          />
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={loading || !questionsText.trim() || !result}
            className="btn-primary mt-3 w-full"
          >
            {loading ? "Generating answers…" : "Generate answers"}
          </button>

          {answers.length > 0 && (
            <div className="mt-5 space-y-4">
              {answersCostUsd != null && answersCostUsd > 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  AI cost for this generation:{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {formatCostUsd(answersCostUsd)}
                  </span>
                </p>
              ) : null}
              {answers.map((qa, i) => (
                <div
                  key={qa.question.trim().toLowerCase()}
                  className="relative rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-600/50 dark:bg-slate-800/50"
                >
                  <p className="mb-1 pr-8 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    Q: {qa.question}
                  </p>
                  <p className="whitespace-pre-wrap pb-6 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    {qa.answer}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleCopy(i, qa.answer)}
                    className="absolute bottom-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-slate-800 dark:border-slate-600/60 dark:bg-slate-800 dark:text-slate-300"
                    title="Copy answer"
                  >
                    {copiedIndex === i ? "✓" : "⎘"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
