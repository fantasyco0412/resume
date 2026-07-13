"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ToastContainer, useToast } from "@/components/Toast";
import {
  DEFAULT_APPLY_ALERT_SETTINGS,
  DEFAULT_DUPLICATE_APPLY_MONTHS,
  type ApplyAlertSettings,
} from "@/lib/apply-alert-settings";
import { DEFAULT_AI_SETTINGS, type AiSettings } from "@/lib/ai-settings";
import {
  loadApplyAlertSettings,
} from "@/lib/supabase/services/apply-alert-settings";
import { loadAiSettings } from "@/lib/supabase/services/ai-settings";
import { saveGeneralSettings } from "@/lib/supabase/services/general-settings";
import { notifySettingsUpdated } from "@/lib/generator-workspace-storage";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ApplyAlertSettings>(DEFAULT_APPLY_ALERT_SETTINGS);
  const [aiSettings, setAiSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const { toasts, showToast, dismissToast } = useToast();

  useEffect(() => {
    if (!authLoading && user?.id) {
      void loadSettings();
    }
  }, [authLoading, user?.id]);

  const loadSettings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [loadedAlerts, loadedAi] = await Promise.all([
        loadApplyAlertSettings(user.id),
        loadAiSettings(user.id),
      ]);
      setSettings(loadedAlerts);
      setAiSettings(loadedAi);
    } catch (err) {
      console.error("Failed to load settings:", err);
      showToast("error", "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    try {
      const saved = await saveGeneralSettings(user.id, settings, aiSettings);
      setSettings(saved.alerts);
      setAiSettings(saved.ai);
      notifySettingsUpdated();
      showToast("success", "Settings saved.");
    } catch (err) {
      console.error("Failed to save settings:", err);
      showToast("error", "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
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
            General
          </h2>
          <p className="page-subtitle">
            Application alerts and AI provider preferences.
          </p>
        </div>

          <form onSubmit={handleSave} className="space-y-6 p-6">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : (
              <>
                <section className="card space-y-4 p-5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      AI provider
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                      Choose how resume generation connects to language models on the
                      Generator page.
                    </p>
                  </div>

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={aiSettings.use_openrouter}
                      onChange={(e) =>
                        setAiSettings((prev) => ({
                          ...prev,
                          use_openrouter: e.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">
                        Use OpenRouter
                      </span>
                      <span className="mt-1 block text-sm text-slate-500 dark:text-slate-300">
                        When enabled, pick any model via OpenRouter (single{" "}
                        <code className="text-xs">OPENROUTER_API_KEY</code>). When
                        disabled, use direct API keys for OpenAI, Anthropic (Claude), or
                        DeepSeek — configured in backend{" "}
                        <code className="text-xs">.env.local</code>.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={aiSettings.auto_ats_after_resume}
                      onChange={(e) =>
                        setAiSettings((prev) => ({
                          ...prev,
                          auto_ats_after_resume: e.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">
                        Show ATS score after resume generation
                      </span>
                      <span className="mt-1 block text-sm text-slate-500 dark:text-slate-300">
                        Automatically checks ATS match when a resume finishes generating
                        and shows the score on each result card. You can still open the
                        full ATS report with Check ATS match.
                      </span>
                    </span>
                  </label>
                </section>

                <section className="card space-y-4 p-5">
                  <div>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={settings.duplicate_apply_alert_enabled}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            duplicate_apply_alert_enabled: e.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">
                          Alert on duplicate company applications
                        </span>
                        <span className="mt-1 block text-sm text-slate-500 dark:text-slate-300">
                          Warn if you already applied to the same company within a
                          chosen period. Shows previous application date, company, and
                          role.
                        </span>
                      </span>
                    </label>
                  </div>

                  {settings.duplicate_apply_alert_enabled && (
                    <div className="ml-7 max-w-xs">
                      <label htmlFor="duplicate-months" className="field-label">
                        How far back to check (months)
                      </label>
                      <input
                        id="duplicate-months"
                        type="number"
                        min={1}
                        max={24}
                        value={settings.duplicate_apply_months}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setSettings((prev) => ({
                            ...prev,
                            duplicate_apply_months:
                              Number.isFinite(value) && value >= 1
                                ? Math.min(24, Math.round(value))
                                : DEFAULT_DUPLICATE_APPLY_MONTHS,
                          }));
                        }}
                        className="input-shell"
                      />
                    </div>
                  )}
                </section>

                <section className="card space-y-4 p-5">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={settings.hybrid_onsite_alert_enabled}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          hybrid_onsite_alert_enabled: e.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">
                        Alert on hybrid or on-site jobs
                      </span>
                      <span className="mt-1 block text-sm text-slate-500 dark:text-slate-300">
                        Warn when the job description mentions hybrid, onsite, in-office,
                        or similar work location terms.
                      </span>
                    </span>
                  </label>
                </section>

                <div className="flex justify-end">
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? "Saving…" : "Save settings"}
                  </button>
                </div>
              </>
            )}
          </form>
      </div>
    </>
  );
}
