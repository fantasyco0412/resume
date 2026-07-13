"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ToastContainer, useToast } from "@/components/Toast";
import { getDefaultResumeGeneratePromptTemplate } from "@/lib/prompts/resume-analyze-static";
import {
  RESUME_PROMPT_PLACEHOLDERS,
  validateResumeGeneratePromptTemplate,
} from "@/lib/resume-prompt-settings";
import {
  loadResumeGeneratePrompt,
  saveResumeGeneratePrompt,
} from "@/lib/supabase/services/resume-prompt-settings";
import { notifySettingsUpdated } from "@/lib/generator-workspace-storage";

export default function PromptSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [usesCustomPrompt, setUsesCustomPrompt] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  const defaultTemplate = useMemo(() => getDefaultResumeGeneratePromptTemplate(), []);

  useEffect(() => {
    if (!authLoading && user?.id) {
      void loadPrompt();
    }
  }, [authLoading, user?.id]);

  const loadPrompt = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const custom = await loadResumeGeneratePrompt(user.id);
      if (custom) {
        setPrompt(custom);
        setUsesCustomPrompt(true);
      } else {
        setPrompt(defaultTemplate);
        setUsesCustomPrompt(false);
      }
    } catch (err) {
      console.error("Failed to load resume prompt:", err);
      showToast("error", "Failed to load resume prompt.");
      setPrompt(defaultTemplate);
      setUsesCustomPrompt(false);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPrompt(defaultTemplate);
    setUsesCustomPrompt(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validationError = validateResumeGeneratePromptTemplate(prompt);
    if (validationError) {
      showToast("error", validationError);
      return;
    }

    const trimmed = prompt.trim();
    const isDefault = trimmed === defaultTemplate.trim();

    setSaving(true);
    try {
      const saved = await saveResumeGeneratePrompt(
        user.id,
        isDefault ? null : trimmed
      );
      if (saved) {
        setPrompt(saved);
        setUsesCustomPrompt(true);
        showToast("success", "Custom resume prompt saved.");
        notifySettingsUpdated();
      } else {
        setPrompt(defaultTemplate);
        setUsesCustomPrompt(false);
        showToast("success", "Using the default resume prompt.");
      }
      notifySettingsUpdated();
    } catch (err) {
      console.error("Failed to save resume prompt:", err);
      showToast("error", "Failed to save resume prompt.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="glass-panel overflow-hidden">
        <div className="page-header">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Resume generation prompt
          </h2>
          <p className="page-subtitle">
            Edit the system prompt used when generating resumes on the Generator
            page. Placeholders are replaced with the job description and your
            profile resume content at generation time.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5 p-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              <section className="card space-y-3 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Placeholders
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {RESUME_PROMPT_PLACEHOLDERS.map((item) => (
                    <li
                      key={item.token}
                      className="rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-sm dark:border-slate-600/50 dark:bg-slate-800/60"
                    >
                      <code className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                        {item.token}
                      </code>
                      <span className="mt-1 block text-slate-600 dark:text-slate-300">
                        {item.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="resume-prompt" className="field-label mb-0">
                    Prompt template
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {prompt.length.toLocaleString()} characters
                    {usesCustomPrompt ? " · custom" : " · default"}
                  </span>
                </div>
                <textarea
                  id="resume-prompt"
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setUsesCustomPrompt(
                      e.target.value.trim() !== defaultTemplate.trim()
                    );
                  }}
                  rows={28}
                  spellCheck={false}
                  className="input-shell min-h-[28rem] font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="btn-soft"
                >
                  Reset to default
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? "Saving…" : "Save prompt"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </>
  );
}
