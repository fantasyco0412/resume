"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ToastContainer, useToast } from "@/components/Toast";
import { adminFetch, readAdminError } from "@/lib/admin-api";
import {
  DEFAULT_GENERAL_APP_SETTINGS,
  DEFAULT_PRUNE_RESUME_NO_INTERVIEW_MONTHS,
  type GeneralAppSettings,
} from "@/lib/general-app-settings";
import type { PruneResumeHistoryResult } from "@/lib/supabase/services/prune-resume-history";

export default function AdminSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toasts, showToast, dismissToast } = useToast();
  const [settings, setSettings] = useState<GeneralAppSettings>(DEFAULT_GENERAL_APP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPruneResult, setLastPruneResult] = useState<PruneResumeHistoryResult | null>(null);

  const loadSettings = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);
    setForbidden(false);

    try {
      const response = await adminFetch("/api/admin/settings");

      if (response.status === 403) {
        setForbidden(true);
        return;
      }

      if (!response.ok) {
        throw new Error(await readAdminError(response));
      }

      setSettings((await response.json()) as GeneralAppSettings);
    } catch (loadError) {
      console.error("Failed to load admin settings:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      void loadSettings();
    }
  }, [authLoading, user?.id, loadSettings]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await adminFetch("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          pruneResumeNoInterviewMonths: settings.prune_resume_no_interview_months,
          runPrune: true,
        }),
      });

      if (!response.ok) {
        throw new Error(await readAdminError(response));
      }

      const body = (await response.json()) as {
        settings: GeneralAppSettings;
        pruneResult: PruneResumeHistoryResult | null;
      };

      setSettings(body.settings);
      if (body.pruneResult) {
        setLastPruneResult(body.pruneResult);
        showToast(
          "success",
          body.pruneResult.deletedCount === 0
            ? "Settings saved. No bids matched for cleanup."
            : `Settings saved. Removed ${body.pruneResult.deletedCount} bid(s) with no interview.`
        );
      } else {
        showToast("success", "Settings saved.");
      }
    } catch (saveError) {
      console.error("Failed to save admin settings:", saveError);
      showToast(
        "error",
        saveError instanceof Error ? saveError.message : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRunCleanup = async () => {
    setPruning(true);

    try {
      const response = await adminFetch("/api/admin/settings", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readAdminError(response));
      }

      const body = (await response.json()) as {
        settings: GeneralAppSettings;
        pruneResult: PruneResumeHistoryResult;
      };

      setSettings(body.settings);
      setLastPruneResult(body.pruneResult);
      showToast(
        "success",
        body.pruneResult.deletedCount === 0
          ? "No bids matched for cleanup."
          : `Removed ${body.pruneResult.deletedCount} bid(s) with no interview.`
      );
    } catch (pruneError) {
      console.error("Failed to run cleanup:", pruneError);
      showToast(
        "error",
        pruneError instanceof Error ? pruneError.message : "Failed to run cleanup"
      );
    } finally {
      setPruning(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Access denied</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Your account is not configured as an admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="glass-panel overflow-hidden">
        <div className="page-header">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">General settings</h2>
          <p className="page-subtitle">
            Global retention rules for bid history across all users.
          </p>
        </div>

        {error ? (
          <p className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <form onSubmit={(event) => void handleSave(event)} className="space-y-6 p-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              <section className="card space-y-4 p-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    Remove bids without interviews
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    Delete bid history older than the selected number of months when no
                    interview is linked to that bid. Bids with at least one linked
                    interview are kept.
                  </p>
                </div>

                <div className="max-w-xs">
                  <label htmlFor="prune-months" className="filter-label">
                    Retention period (months)
                  </label>
                  <input
                    id="prune-months"
                    type="number"
                    min={1}
                    max={24}
                    value={settings.prune_resume_no_interview_months}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setSettings((current) => ({
                        ...current,
                        prune_resume_no_interview_months:
                          Number.isFinite(value) && value >= 1
                            ? Math.min(24, Math.round(value))
                            : DEFAULT_PRUNE_RESUME_NO_INTERVIEW_MONTHS,
                      }));
                    }}
                    className="filter-control"
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Default is {DEFAULT_PRUNE_RESUME_NO_INTERVIEW_MONTHS} months. Cleanup also
                    runs automatically every Sunday at 3:00 AM server time. Saving runs cleanup
                    immediately using this value.
                  </p>
                </div>

                {settings.last_scheduled_prune_at ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Last automatic cleanup:{" "}
                    {new Date(settings.last_scheduled_prune_at).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    .
                  </p>
                ) : null}

                {lastPruneResult ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Last manual cleanup: removed {lastPruneResult.deletedCount} bid(s) created before{" "}
                    {new Date(lastPruneResult.cutoffDate).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    .
                  </p>
                ) : null}
              </section>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void handleRunCleanup()}
                  disabled={pruning || saving}
                  className="btn-soft disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pruning ? "Running cleanup…" : "Run cleanup now"}
                </button>
                <button type="submit" disabled={saving || pruning} className="btn-primary">
                  {saving ? "Saving…" : "Save settings"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
