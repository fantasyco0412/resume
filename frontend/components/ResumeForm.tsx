"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { loadProfileForApp } from "@/lib/supabase/load-profile-for-app";
import { loadApplyAlertSettings } from "@/lib/supabase/services/apply-alert-settings";
import { listResumes } from "@/lib/supabase/services/resumes";
import {
  findDuplicateCompanyApplications,
  jobContainsHybridOrOnsite,
  type DuplicateApplicationMatch,
} from "@/lib/apply-alerts";
import {
  DEFAULT_APPLY_ALERT_SETTINGS,
  type ApplyAlertSettings,
} from "@/lib/apply-alert-settings";
import ApplyAlertDialog from "@/components/ApplyAlertDialog";
import { ToastContainer, useToast } from "@/components/Toast";
import {
  DEFAULT_RESUME_TEMPLATE,
  RESUME_TEMPLATES,
  resolveResumeTemplate,
  type ResumeTemplateId,
} from "@/lib/resume-templates";
import type { LegacyAnalyzeProfile } from "@/lib/mappers/profile-to-resume";
import { apiUrl } from "@/lib/api-config";

export interface ExtractedJobFields {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}

interface ResumeFormProps {
  pageContent: string;
  userEmail?: string | null;
  userId?: string;
  onPageContentChange: (value: string) => void;
  onSubmit: (
    pageContent: string,
    resumeContent: string,
    template?: string,
    profileData?: LegacyAnalyzeProfile,
    extracted?: ExtractedJobFields
  ) => void;
  loading: boolean;
}

export default function ResumeForm({
  pageContent,
  userEmail,
  userId,
  onPageContentChange,
  onSubmit,
  loading,
}: ResumeFormProps) {
  const [resumeContent, setResumeContent] = useState("");
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [profileData, setProfileData] = useState<LegacyAnalyzeProfile | null>(null);
  const [resumeTemplate, setResumeTemplate] =
    useState<ResumeTemplateId>(DEFAULT_RESUME_TEMPLATE);
  const [applyAlertSettings, setApplyAlertSettings] = useState<ApplyAlertSettings>(
    DEFAULT_APPLY_ALERT_SETTINGS
  );
  const [alertOpen, setAlertOpen] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateApplicationMatch[]>([]);
  const [showHybridOnsiteAlert, setShowHybridOnsiteAlert] = useState(false);
  const [pendingExtracted, setPendingExtracted] = useState<ExtractedJobFields | null>(null);
  const { toasts, showToast, dismissToast } = useToast();
  const profileNotificationShown = useRef(false);

  useEffect(() => {
    profileNotificationShown.current = false;
    loadProfile();
  }, [userEmail, userId]);

  useEffect(() => {
    if (loadingPrefs || profileNotificationShown.current) return;
    profileNotificationShown.current = true;

    if (resumeContent.trim()) {
      const templateLabel =
        RESUME_TEMPLATES.find((t) => t.id === resumeTemplate)?.label ?? "Standard";
      showToast(
        "success",
        `Profile loaded successfully.\n${templateLabel} template is used.`
      );
    } else {
      showToast("warning", "No profile resume — go to Profile first.");
    }
  }, [loadingPrefs, resumeContent, resumeTemplate, showToast]);

  const loadProfile = async () => {
    setLoadingPrefs(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoadingPrefs(false);
        return;
      }

      const loaded = await loadProfileForApp(supabase, {
        email: userEmail ?? session.user.email,
        userId: userId ?? session.user.id,
      });
      setProfileData(loaded.legacyAnalyzeProfile);
      setResumeTemplate(
        resolveResumeTemplate(loaded.legacyAnalyzeProfile.default_resume?.resume_template)
      );
      setResumeContent(loaded.resumeText);

      const alertSettings = await loadApplyAlertSettings(userId ?? session.user.id);
      setApplyAlertSettings(alertSettings);
    } catch (error) {
      console.warn("Error loading profile:", error);
    } finally {
      setLoadingPrefs(false);
    }
  };

  const extractJobInfo = async (): Promise<ExtractedJobFields> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("You must be signed in to generate a resume");
    }

    const response = await fetch(apiUrl("/api/extract-job"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ pageContent }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        typeof errorData.error === "string" ? errorData.error : "Failed to extract job info"
      );
    }

    return (await response.json()) as ExtractedJobFields;
  };

  const submitGeneration = (extracted: ExtractedJobFields) => {
    if (!extracted.jobDescription.trim() || !resumeContent.trim() || !profileData) return;
    onSubmit(pageContent, resumeContent, resumeTemplate, profileData, extracted);
  };

  const runPreflightChecks = async (extracted: ExtractedJobFields) => {
    let duplicates: DuplicateApplicationMatch[] = [];
    let hybridOnsite = false;

    if (
      applyAlertSettings.duplicate_apply_alert_enabled &&
      extracted.companyName.trim()
    ) {
      try {
        const records = await listResumes(userId!);
        duplicates = findDuplicateCompanyApplications(
          records,
          extracted.companyName,
          applyAlertSettings.duplicate_apply_months
        );
      } catch (error) {
        console.warn("Failed to check duplicate applications:", error);
      }
    }

    if (applyAlertSettings.hybrid_onsite_alert_enabled) {
      hybridOnsite = jobContainsHybridOrOnsite(extracted.jobDescription);
    }

    if (duplicates.length > 0 || hybridOnsite) {
      setPendingExtracted(extracted);
      setDuplicateMatches(duplicates);
      setShowHybridOnsiteAlert(hybridOnsite);
      setAlertOpen(true);
      return;
    }

    submitGeneration(extracted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || loadingPrefs || extracting) return;

    if (!pageContent.trim()) {
      showToast("warning", "Paste the job posting page content first.");
      return;
    }
    if (!resumeContent.trim() || !profileData) {
      showToast("warning", "No profile resume — go to Profile first.");
      return;
    }
    if (!userId) return;

    setExtracting(true);
    try {
      const extracted = await extractJobInfo();
      await runPreflightChecks(extracted);
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "Failed to extract job information"
      );
    } finally {
      setExtracting(false);
    }
  };

  const busy = loading || extracting;

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col gap-4">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ApplyAlertDialog
        open={alertOpen}
        duplicateMatches={duplicateMatches}
        duplicateMonths={applyAlertSettings.duplicate_apply_months}
        showHybridOnsite={showHybridOnsiteAlert}
        onCancel={() => {
          setAlertOpen(false);
          setPendingExtracted(null);
        }}
        onContinue={() => {
          setAlertOpen(false);
          if (pendingExtracted) {
            submitGeneration(pendingExtracted);
            setPendingExtracted(null);
          }
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <label htmlFor="pageContent" className="label-kicker mb-2 block flex-shrink-0">
          Job Page Content
        </label>
        <textarea
          id="pageContent"
          value={pageContent}
          onChange={(e) => onPageContentChange(e.target.value)}
          placeholder="Paste the full job posting page (title, company, and description)…"
          className="input-shell flex-1 resize-none"
          required
        />
      </div>

      <button
        type="submit"
        disabled={busy || loadingPrefs}
        className="btn-primary w-full flex-shrink-0"
      >
        {extracting
          ? "Extracting job info…"
          : loading
            ? "Generating resume…"
            : loadingPrefs
              ? "Loading profile…"
              : "Generate Resume"}
      </button>
    </form>
  );
}
