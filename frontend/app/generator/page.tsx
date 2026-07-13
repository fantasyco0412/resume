"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import OpenRouterModelSelect from "@/components/OpenRouterModelSelect";
import DirectProviderModelSelect from "@/components/DirectProviderModelSelect";
import AnalysisResultCard, {
  type AnalysisSessionView,
} from "@/components/AnalysisResultCard";
import {
  AnalyseIcon,
  BtnIcon,
  CloseIcon,
  SparklesIcon,
} from "@/components/GeneratorActionIcons";
import AnswerQuestionsDialog, {
  type QuestionAnswer,
} from "@/components/AnswerQuestionsDialog";
import CoverLetterDialog from "@/components/CoverLetterDialog";
import ApplyAlertDialog from "@/components/ApplyAlertDialog";
import BulkCloseAlertDialog, {
  type NeedsResumeCloseSession,
} from "@/components/BulkCloseAlertDialog";
import { ToastContainer, useToast } from "@/components/Toast";
import {
  DEFAULT_JOBSITE,
  JOBSITES,
  type JobsiteId,
} from "@/lib/jobsites";
import {
  DEFAULT_OPENROUTER_MODEL,
  getModelProvider,
} from "@/lib/openrouter-shared";
import type { JobWorkType } from "@/lib/prompts/job-page-extract";
import type { AnalysisResult } from "@/lib/types/resume";
import type { LegacyAnalyzeProfile } from "@/lib/mappers/profile-to-resume";
import { loadProfileForApp } from "@/lib/supabase/load-profile-for-app";
import { loadApplyAlertSettings } from "@/lib/supabase/services/apply-alert-settings";
import { listResumes } from "@/lib/supabase/services/resumes";
import { createResumeWithArtifacts, updateResumeAiCosts, updateResumeJsonArtifact } from "@/lib/supabase/services/resumes";
import {
  scanGenerateApplyAlerts,
  type FlaggedGenerateSession,
} from "@/lib/generator-apply-preflight";
import {
  DEFAULT_APPLY_ALERT_SETTINGS,
  type ApplyAlertSettings,
} from "@/lib/apply-alert-settings";
import {
  DEFAULT_RESUME_TEMPLATE,
  resolveResumeTemplate,
  type ResumeTemplateId,
} from "@/lib/resume-templates";
import { formatPdfSaveMessage, saveGeneratedResumeToDownloads } from "@/lib/pdf-download";
import type { ExtractedJobInfo } from "@/lib/extract-job-page";
import {
  DEFAULT_DIRECT_MODELS,
  isDirectAIProvider,
  type DirectAIProvider,
  type DirectProviderModels,
  type DirectAiModelsResponse,
} from "@/lib/direct-ai-shared";
import type { AtsMatchResult } from "@/lib/types/ats-match";
import { fetchAtsMatch } from "@/lib/check-ats-client";
import { DEFAULT_AI_SETTINGS } from "@/lib/ai-settings";
import { loadAiSettings } from "@/lib/supabase/services/ai-settings";
import { sumCosts } from "@/lib/ai-usage";
import { apiUrl } from "@/lib/api-config";
import {
  loadGeneratorWorkspace,
  normalizeSessionForStorage,
  restoreSessionFromStorage,
  saveGeneratorWorkspace,
  SETTINGS_UPDATED_EVENT,
} from "@/lib/generator-workspace-storage";
import {
  filterSessionIds,
  idsToSet,
  isUngeneratedSession,
  setsEqual,
  type SessionSelectionFilter,
} from "@/lib/generator-session-selection";

interface AnalysisResponse {
  resume: AnalysisResult;
  providerUsed?: string;
  modelUsed?: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  generationCostUsd?: number;
}

interface AnalysisSession {
  id: string;
  createdAt: number;
  pageContent: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  jobLocation: string;
  industry: string;
  securityClearance: string;
  jobType: JobWorkType;
  jobTypes: JobWorkType[];
  requiresTravel: boolean;
  salary: string;
  postedDate: string;
  aiProvider: string;
  aiModel: string;
  useOpenRouter: boolean;
  jobsite: JobsiteId;
  extracting: boolean;
  extractError: string | null;
  generating: boolean;
  generateError: string | null;
  result: AnalysisResult | null;
  downloading?: boolean;
  downloadError?: string | null;
  resumeId?: string;
  resumeTemplate?: string;
  providerUsed?: string;
  modelUsed?: string;
  extractMs?: number;
  analyzeMs?: number;
  pdfMs?: number;
  atsLoading?: boolean;
  atsResult?: AtsMatchResult | null;
  atsError?: string | null;
  extractCostUsd?: number;
  generationCostUsd?: number;
  atsCostUsd?: number;
  answersCostUsd?: number;
  coverLetterCostUsd?: number;
  questionAnswers?: QuestionAnswer[];
  coverLetter?: string;
}

let sessionCounter = 0;

async function fetchDirectModels(): Promise<DirectProviderModels> {
  const response = await fetch(apiUrl("/api/direct-ai-models"));
  if (!response.ok) throw new Error("Failed to load direct AI models");
  const data = (await response.json()) as DirectAiModelsResponse;
  return data.models;
}

function createSessionId(): string {
  sessionCounter += 1;
  return `analysis-${Date.now()}-${sessionCounter}`;
}

function toSessionView(session: AnalysisSession): AnalysisSessionView {
  return {
    id: session.id,
    jobTitle: session.jobTitle,
    companyName: session.companyName,
    jobDescription: session.jobDescription,
    jobLocation: session.jobLocation,
    industry: session.industry,
    securityClearance: session.securityClearance,
    jobType: session.jobType,
    jobTypes: session.jobTypes,
    requiresTravel: session.requiresTravel,
    salary: session.salary,
    postedDate: session.postedDate,
    aiProvider: session.aiProvider,
    aiModel: session.aiModel,
    useOpenRouter: session.useOpenRouter,
    jobsite: session.jobsite,
    extracting: session.extracting,
    extractError: session.extractError,
    generating: session.generating,
    generateError: session.generateError,
    result: session.result,
    downloading: session.downloading,
    downloadError: session.downloadError,
    resumeId: session.resumeId,
    providerUsed: session.providerUsed,
    modelUsed: session.modelUsed,
    extractMs: session.extractMs,
    analyzeMs: session.analyzeMs,
    pdfMs: session.pdfMs,
    atsLoading: session.atsLoading,
    atsResult: session.atsResult,
    atsError: session.atsError,
    extractCostUsd: session.extractCostUsd,
    generationCostUsd: session.generationCostUsd,
    atsCostUsd: session.atsCostUsd,
    answersCostUsd: session.answersCostUsd,
    coverLetterCostUsd: session.coverLetterCostUsd,
  };
}

export default function GeneratorPage() {
  const { user } = useAuth();
  const { toasts, showToast, dismissToast } = useToast();

  const [useOpenRouter, setUseOpenRouter] = useState(DEFAULT_AI_SETTINGS.use_openrouter);
  const [autoAtsAfterResume, setAutoAtsAfterResume] = useState(
    DEFAULT_AI_SETTINGS.auto_ats_after_resume
  );
  const [directModels, setDirectModels] =
    useState<DirectProviderModels>(DEFAULT_DIRECT_MODELS);
  const [aiProvider, setAiProvider] = useState(getModelProvider(DEFAULT_OPENROUTER_MODEL));
  const [aiModel, setAiModel] = useState(DEFAULT_OPENROUTER_MODEL);
  const [jobsite, setJobsite] = useState<JobsiteId>(DEFAULT_JOBSITE);
  const [pageContent, setPageContent] = useState("");

  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [answerDialogSessionId, setAnswerDialogSessionId] = useState<string | null>(null);
  const [coverLetterDialogSessionId, setCoverLetterDialogSessionId] = useState<string | null>(
    null
  );

  const [profileData, setProfileData] = useState<LegacyAnalyzeProfile | null>(null);
  const [resumeContent, setResumeContent] = useState("");
  const [resumeTemplate, setResumeTemplate] =
    useState<ResumeTemplateId>(DEFAULT_RESUME_TEMPLATE);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [applyAlertSettings, setApplyAlertSettings] = useState<ApplyAlertSettings>(
    DEFAULT_APPLY_ALERT_SETTINGS
  );

  const [alertOpen, setAlertOpen] = useState(false);
  const [pendingGenerateIds, setPendingGenerateIds] = useState<string[]>([]);
  const [flaggedGenerateSessions, setFlaggedGenerateSessions] = useState<
    FlaggedGenerateSession[]
  >([]);
  const [closeAlertOpen, setCloseAlertOpen] = useState(false);
  const [pendingCloseIds, setPendingCloseIds] = useState<string[]>([]);
  const [needsResumeCloseSessions, setNeedsResumeCloseSessions] = useState<
    NeedsResumeCloseSession[]
  >([]);

  const profileLoadedRef = useRef(false);
  const hydratedUserIdRef = useRef<string | null>(null);

  const reloadPreferences = useCallback(async () => {
    if (!user?.id) return;

    const [loadedAi, loadedAlerts] = await Promise.all([
      loadAiSettings(user.id),
      loadApplyAlertSettings(user.id),
    ]);
    setUseOpenRouter(loadedAi.use_openrouter);
    setAutoAtsAfterResume(loadedAi.auto_ats_after_resume);
    setApplyAlertSettings(loadedAlerts);

    if (!loadedAi.use_openrouter) {
      try {
        const models = await fetchDirectModels();
        setDirectModels(models);
        setAiProvider((prev) => {
          const provider: DirectAIProvider =
            prev === "openai" || prev === "anthropic" || prev === "deepseek"
              ? (prev as DirectAIProvider)
              : "openai";
          setAiModel(models[provider]);
          return provider;
        });
      } catch (error) {
        console.warn("Failed to reload direct AI models:", error);
      }
    }
  }, [user?.id]);

  const patchSession = useCallback((id: string, patch: Partial<AnalysisSession>) => {
    setSessions((prev) =>
      prev.map((session) => (session.id === id ? { ...session, ...patch } : session))
    );
  }, []);

  const recordAnswersCost = useCallback((sessionId: string, costUsd: number) => {
    if (!Number.isFinite(costUsd) || costUsd <= 0) return;

    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;

        const answersCostUsd = sumCosts(session.answersCostUsd, costUsd);
        if (session.resumeId) {
          void updateResumeAiCosts(session.resumeId, { answersCostUsd }).catch((error) => {
            console.warn("Failed to save answers cost to history:", error);
          });
        }

        return { ...session, answersCostUsd };
      })
    );
  }, []);

  const recordCoverLetterCost = useCallback((sessionId: string, costUsd: number) => {
    if (!Number.isFinite(costUsd) || costUsd <= 0) return;

    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;
        return {
          ...session,
          coverLetterCostUsd: sumCosts(session.coverLetterCostUsd, costUsd),
        };
      })
    );
  }, []);

  const runAutoAtsCheck = useCallback(
    async (
      sessionId: string,
      resume: AnalysisResult,
      context: {
        jobDescription: string;
        aiModel: string;
        aiProvider: string;
        useOpenRouter: boolean;
        accessToken: string;
        resumeRecordId?: string;
      }
    ) => {
      if (!context.jobDescription.trim()) return;

      patchSession(sessionId, {
        atsLoading: true,
        atsResult: null,
        atsError: null,
      });

      try {
        const ats = await fetchAtsMatch({
          resume,
          jd: context.jobDescription,
          apiModel: context.aiModel,
          apiProvider: context.aiProvider,
          useOpenRouter: context.useOpenRouter,
          accessToken: context.accessToken,
        });
        patchSession(sessionId, {
          atsLoading: false,
          atsResult: ats.ats,
          atsError: null,
          atsCostUsd: ats.atsCostUsd,
        });

        if (context.resumeRecordId) {
          try {
            await updateResumeAiCosts(context.resumeRecordId, {
              atsCostUsd: ats.atsCostUsd,
              atsScore: ats.ats.score,
            });
          } catch (error) {
            console.warn("Failed to save ATS result to history:", error);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to check ATS match";
        patchSession(sessionId, { atsLoading: false, atsResult: null, atsError: message });
        console.warn("Auto ATS check failed:", message);
      }
    },
    [patchSession]
  );

  useEffect(() => {
    if (!user?.id || hydratedUserIdRef.current === user.id) return;

    hydratedUserIdRef.current = user.id;
    const saved = loadGeneratorWorkspace(user.id);
    if (!saved) return;

    setPageContent(saved.pageContent);
    setJobsite(saved.jobsite);
    setSessions(saved.sessions.map((session) => restoreSessionFromStorage(session)));
    sessionCounter = Math.max(sessionCounter, saved.sessions.length);
    setLoadingProfile(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (sessions.some((session) => session.extracting)) return;

    const timer = window.setTimeout(() => {
      saveGeneratorWorkspace(user.id, {
        pageContent,
        jobsite,
        sessions: sessions
          .filter((session) => !session.extracting)
          .map((session) => normalizeSessionForStorage(session)),
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [user?.id, pageContent, jobsite, sessions]);

  useEffect(() => {
    if (!user?.id) return;

    const onSettingsUpdated = () => void reloadPreferences();
    window.addEventListener(SETTINGS_UPDATED_EVENT, onSettingsUpdated);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, onSettingsUpdated);
  }, [user?.id, reloadPreferences]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session || cancelled) return;

        const loaded = await loadProfileForApp(supabase, {
          email: user.email,
          userId: user.id,
        });
        if (cancelled) return;

        setProfileData(loaded.legacyAnalyzeProfile);
        setResumeContent(loaded.resumeText);
        setResumeTemplate(
          resolveResumeTemplate(loaded.legacyAnalyzeProfile.default_resume?.resume_template)
        );

        const alertSettings = await loadApplyAlertSettings(user.id);
        if (!cancelled) setApplyAlertSettings(alertSettings);

        const loadedAi = await loadAiSettings(user.id);
        if (!cancelled) {
          setUseOpenRouter(loadedAi.use_openrouter);
          setAutoAtsAfterResume(loadedAi.auto_ats_after_resume);
          if (!loadedAi.use_openrouter) {
            try {
              const models = await fetchDirectModels();
              if (cancelled) return;
              setDirectModels(models);
              setAiProvider("openai");
              setAiModel(models.openai);
            } catch (error) {
              console.warn("Failed to load direct AI models:", error);
              setAiProvider("openai");
              setAiModel(DEFAULT_DIRECT_MODELS.openai);
            }
          }
        }

        if (!profileLoadedRef.current && loaded.resumeText.trim()) {
          profileLoadedRef.current = true;
        }
      } catch (error) {
        console.warn("Error loading profile:", error);
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (useOpenRouter) return;
    const provider: DirectAIProvider = isDirectAIProvider(aiProvider) ? aiProvider : "openai";
    setAiModel(directModels[provider]);
  }, [directModels, useOpenRouter, aiProvider]);

  const dismissSession = useCallback((sessionId: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    setSelectedSessionIds((prev) => {
      if (!prev.has(sessionId)) return prev;
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
    setAnswerDialogSessionId((current) => (current === sessionId ? null : current));
    setCoverLetterDialogSessionId((current) => (current === sessionId ? null : current));
  }, []);

  const toggleSessionSelected = useCallback((sessionId: string, selected: boolean) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(sessionId);
      else next.delete(sessionId);
      return next;
    });
  }, []);

  const applySelectionFilter = useCallback(
    (filter: SessionSelectionFilter) => {
      setSelectedSessionIds(idsToSet(filterSessionIds(sessions, filter)));
    },
    [sessions]
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedSessionIds((prev) => {
      if (sessions.length === 0) return prev;
      if (prev.size === sessions.length) return new Set();
      return idsToSet(filterSessionIds(sessions, "all"));
    });
  }, [sessions]);

  useEffect(() => {
    setSelectedSessionIds((prev) => {
      const validIds = new Set(sessions.map((session) => session.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [sessions]);

  const allSelected = sessions.length > 0 && selectedSessionIds.size === sessions.length;
  const someSelected = selectedSessionIds.size > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const isFilterSelected = useCallback(
    (filter: SessionSelectionFilter) => {
      const filterIds = idsToSet(filterSessionIds(sessions, filter));
      return filterIds.size > 0 && setsEqual(selectedSessionIds, filterIds);
    },
    [sessions, selectedSessionIds]
  );

  const toggleSelectionFilter = useCallback(
    (filter: SessionSelectionFilter) => {
      if (isFilterSelected(filter)) {
        setSelectedSessionIds(new Set());
        return;
      }
      applySelectionFilter(filter);
    },
    [applySelectionFilter, isFilterSelected]
  );

  const selectedSessions = sessions.filter((session) => selectedSessionIds.has(session.id));

  const selectedGeneratableIds = selectedSessions
    .filter(
      (session) =>
        session.jobDescription.trim() &&
        !session.extracting &&
        !session.generating &&
        !session.downloading
    )
    .map((session) => session.id);

  const selectedClosableIds = selectedSessions
    .filter((session) => !session.generating && !session.downloading)
    .map((session) => session.id);

  const extractJobForSession = useCallback(
    async (sessionId: string, sourceContent: string, sessionUseOpenRouter: boolean) => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("You must be signed in");

        const extractStarted = Date.now();
        const response = await fetch(apiUrl("/api/extract-job"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ pageContent: sourceContent, useOpenRouter: sessionUseOpenRouter }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            typeof errorData.error === "string" ? errorData.error : "Failed to analyse job"
          );
        }

        const payload = (await response.json()) as ExtractedJobInfo & {
          extractCostUsd?: number;
        };
        const { extractCostUsd, ...extracted } = payload;

        patchSession(sessionId, {
          extracting: false,
          extractError: null,
          jobTitle: extracted.jobTitle,
          companyName: extracted.companyName,
          jobDescription: extracted.jobDescription,
          jobLocation: extracted.jobLocation,
          industry: extracted.industry,
          securityClearance: extracted.securityClearance,
          jobType: extracted.jobType,
          jobTypes: extracted.jobTypes,
          requiresTravel: extracted.requiresTravel,
          salary: extracted.salary,
          postedDate: extracted.postedDate,
          extractMs: Date.now() - extractStarted,
          extractCostUsd,
        });
      } catch (error) {
        patchSession(sessionId, {
          extracting: false,
          extractError:
            error instanceof Error ? error.message : "Failed to analyse job",
        });
      }
    },
    [patchSession]
  );

  const startAnalyseSession = useCallback(
    (sourceContent: string) => {
      const provider = useOpenRouter ? getModelProvider(aiModel) : aiProvider;
      const sessionId = createSessionId();
      const newSession: AnalysisSession = {
        id: sessionId,
        createdAt: Date.now(),
        pageContent: sourceContent,
        jobTitle: "",
        companyName: "",
        jobDescription: "",
        jobLocation: "",
        industry: "",
        securityClearance: "",
        jobType: "unknown",
        jobTypes: [],
        requiresTravel: false,
        salary: "",
        postedDate: "",
        aiProvider: provider,
        aiModel,
        useOpenRouter,
        jobsite,
        extracting: true,
        extractError: null,
        generating: false,
        generateError: null,
        result: null,
      };

      setSessions((prev) => [newSession, ...prev]);
      setPageContent("");
      void extractJobForSession(sessionId, sourceContent, useOpenRouter);
    },
    [aiModel, aiProvider, extractJobForSession, jobsite, useOpenRouter]
  );

  const handleAnalyse = () => {
    if (loadingProfile) return;
    if (!pageContent.trim()) {
      showToast("warning", "Paste the job posting text before analyzing.");
      return;
    }
    if (!user?.id) return;

    startAnalyseSession(pageContent);
  };

  const openGeneratePreflightIfNeeded = useCallback(
    async (sessionIds: string[]): Promise<boolean> => {
      if (sessionIds.length === 0 || !user?.id) return false;

      const flagged = await scanGenerateApplyAlerts(
        sessions,
        sessionIds,
        applyAlertSettings,
        () => listResumes(user.id)
      );

      if (flagged.length === 0) return false;

      setPendingGenerateIds(sessionIds);
      setFlaggedGenerateSessions(flagged);
      setAlertOpen(true);
      return true;
    },
    [applyAlertSettings, sessions, user?.id]
  );

  const generateResumeForSession = useCallback(
    async (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session || session.extracting || session.generating || session.downloading) return;

      if (!resumeContent.trim() || !profileData) {
        showToast("warning", "Add your resume in Profile before generating.");
        return;
      }
      if (!user?.id) return;

      patchSession(sessionId, {
        generating: true,
        downloading: false,
        generateError: null,
        downloadError: null,
        result: null,
        resumeId: undefined,
        providerUsed: undefined,
        modelUsed: undefined,
        analyzeMs: undefined,
        pdfMs: undefined,
        generationCostUsd: undefined,
        atsCostUsd: undefined,
        atsLoading: false,
        atsResult: null,
        atsError: null,
        coverLetter: undefined,
        coverLetterCostUsd: undefined,
        resumeTemplate,
      });

      let pdfPhase = false;

      try {
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();
        if (!authSession) throw new Error("You must be signed in to generate a resume");

        const analyzeStarted = Date.now();
        const response = await fetch(apiUrl("/api/analyze"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession.access_token}`,
          },
          body: JSON.stringify({
            jd: session.jobDescription,
            jobTitle: session.jobTitle,
            companyName: session.companyName,
            pageContent: session.pageContent,
            resumeContent,
            template: resumeTemplate,
            profileData,
            apiModel: session.aiModel,
            apiProvider: session.aiProvider,
            useOpenRouter: session.useOpenRouter,
          }),
        });

        if (!response.ok) {
          let errorMessage = "Failed to generate resume";
          try {
            const errorData = await response.json();
            errorMessage =
              typeof errorData.error === "string" && errorData.error.trim()
                ? errorData.error
                : errorMessage;
          } catch {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const data: AnalysisResponse = await response.json();
        const resume = data.resume;
        const analyzeMs = Date.now() - analyzeStarted;

        patchSession(sessionId, {
          result: resume,
          generating: false,
          downloading: true,
          providerUsed: data.providerUsed,
          modelUsed: data.modelUsed,
          analyzeMs,
          generationCostUsd: data.generationCostUsd,
          jobTitle: data.jobTitle?.trim() || session.jobTitle,
          companyName: data.companyName?.trim() || session.companyName,
          jobDescription: data.jobDescription?.trim() || session.jobDescription,
        });

        pdfPhase = true;
        const pdfStarted = Date.now();

        const [{ savedPath }, record] = await Promise.all([
          saveGeneratedResumeToDownloads(resume, undefined, {
            companyName: session.companyName,
            jobRole: session.jobTitle,
            personName: resume.name || "resume",
            template: resumeTemplate,
            accessToken: authSession.access_token,
          }),
          createResumeWithArtifacts({
            userId: user.id,
            jd: session.jobDescription,
            resume,
            aiType: data.providerUsed ?? session.aiProvider,
            model: data.modelUsed ?? session.aiModel,
            jobSite: session.jobsite,
            jobLink: null,
            jobTitle: session.jobTitle.trim() || null,
            jobCompany: session.companyName.trim() || null,
            jobLocation: session.jobLocation.trim() || null,
            industry: session.industry.trim() || null,
            securityClearance: session.securityClearance.trim() || null,
            salary: session.salary.trim() || null,
            postedDate: session.postedDate.trim() || null,
            jobTypes: session.jobTypes,
            requiresTravel: session.requiresTravel,
            extractCostUsd: session.extractCostUsd,
            generationCostUsd: data.generationCostUsd,
          }),
        ]);

        patchSession(sessionId, {
          resumeId: record.id,
          downloading: false,
          pdfMs: Date.now() - pdfStarted,
        });
        showToast("success", formatPdfSaveMessage(savedPath, true));

        if (autoAtsAfterResume) {
          void runAutoAtsCheck(sessionId, resume, {
            jobDescription: data.jobDescription?.trim() || session.jobDescription,
            aiModel: session.aiModel,
            aiProvider: session.aiProvider,
            useOpenRouter: session.useOpenRouter,
            accessToken: authSession.access_token,
            resumeRecordId: record.id,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An error occurred";
        patchSession(sessionId, {
          generating: false,
          downloading: false,
          ...(pdfPhase ? { downloadError: message } : { generateError: message }),
        });
        showToast("error", `Failed: ${message}`);
      }
    },
    [sessions, resumeContent, profileData, resumeTemplate, patchSession, showToast, user?.id, autoAtsAfterResume, runAutoAtsCheck]
  );

  const regeneratePdfFromJsonForSession = useCallback(
    async (sessionId: string, resume: AnalysisResult) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session || session.extracting || session.generating || session.downloading) return;
      if (!user?.id) return;

      patchSession(sessionId, {
        result: resume,
        downloading: true,
        downloadError: null,
        atsResult: null,
        atsError: null,
      });

      try {
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();
        if (!authSession) throw new Error("You must be signed in to regenerate a resume");

        const pdfStarted = Date.now();
        const template = session.resumeTemplate ?? resumeTemplate;

        const [{ savedPath }] = await Promise.all([
          saveGeneratedResumeToDownloads(resume, undefined, {
            companyName: session.companyName,
            jobRole: session.jobTitle,
            personName: resume.name || "resume",
            template,
            accessToken: authSession.access_token,
          }),
          session.resumeId
            ? updateResumeJsonArtifact(user.id, session.resumeId, resume)
            : Promise.resolve(),
        ]);

        patchSession(sessionId, {
          downloading: false,
          pdfMs: Date.now() - pdfStarted,
        });
        showToast("success", formatPdfSaveMessage(savedPath, true));
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        patchSession(sessionId, {
          downloading: false,
          downloadError: message,
        });
        showToast("error", `Failed: ${message}`);
        throw err;
      }
    },
    [sessions, resumeTemplate, patchSession, showToast, user?.id]
  );

  const handleGenerateResume = useCallback(
    async (sessionId: string) => {
      const blocked = await openGeneratePreflightIfNeeded([sessionId]);
      if (!blocked) {
        await generateResumeForSession(sessionId);
      }
    },
    [generateResumeForSession, openGeneratePreflightIfNeeded]
  );

  const handleBulkGenerate = useCallback(async () => {
    if (selectedGeneratableIds.length === 0) {
      showToast("warning", "None of the selected jobs are ready to generate a resume.");
      return;
    }
    if (!resumeContent.trim() || !profileData) {
      showToast("warning", "No profile resume — go to Profile first.");
      return;
    }

    const blocked = await openGeneratePreflightIfNeeded(selectedGeneratableIds);
    if (!blocked) {
      for (const sessionId of selectedGeneratableIds) {
        void generateResumeForSession(sessionId);
      }
    }
  }, [
    generateResumeForSession,
    openGeneratePreflightIfNeeded,
    profileData,
    resumeContent,
    selectedGeneratableIds,
    showToast,
  ]);

  const executeBulkClose = useCallback((ids: string[]) => {
    if (ids.length === 0) return;

    const closable = new Set(ids);
    setSessions((prev) => prev.filter((session) => !closable.has(session.id)));
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      closable.forEach((id) => next.delete(id));
      return next;
    });
    setAnswerDialogSessionId((current) =>
      current && closable.has(current) ? null : current
    );
    setCoverLetterDialogSessionId((current) =>
      current && closable.has(current) ? null : current
    );
  }, []);

  const handleBulkClose = useCallback(() => {
    if (selectedClosableIds.length === 0) {
      showToast("warning", "Wait for generation to finish before removing selected jobs.");
      return;
    }

    const needsResume = selectedSessions
      .filter(
        (session) =>
          selectedClosableIds.includes(session.id) && isUngeneratedSession(session)
      )
      .map((session) => ({
        id: session.id,
        jobTitle: session.jobTitle,
        companyName: session.companyName,
      }));

    if (needsResume.length > 0) {
      setPendingCloseIds(selectedClosableIds);
      setNeedsResumeCloseSessions(needsResume);
      setCloseAlertOpen(true);
      return;
    }

    executeBulkClose(selectedClosableIds);
  }, [executeBulkClose, selectedClosableIds, selectedSessions, showToast]);

  const answerDialogSession = sessions.find((s) => s.id === answerDialogSessionId) ?? null;
  const coverLetterDialogSession =
    sessions.find((s) => s.id === coverLetterDialogSessionId) ?? null;

  if (!user) return null;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden p-4 lg:p-5">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <ApplyAlertDialog
        open={alertOpen}
        duplicateMonths={applyAlertSettings.duplicate_apply_months}
        flaggedSessions={flaggedGenerateSessions}
        totalGenerateCount={pendingGenerateIds.length}
        onCancel={() => {
          setAlertOpen(false);
          setPendingGenerateIds([]);
          setFlaggedGenerateSessions([]);
        }}
        onContinue={() => {
          setAlertOpen(false);
          setFlaggedGenerateSessions([]);
          setPendingGenerateIds((ids) => {
            for (const sessionId of ids) {
              void generateResumeForSession(sessionId);
            }
            return [];
          });
        }}
      />

      <BulkCloseAlertDialog
        open={closeAlertOpen}
        flaggedSessions={needsResumeCloseSessions}
        totalCloseCount={pendingCloseIds.length}
        onCancel={() => {
          setCloseAlertOpen(false);
          setPendingCloseIds([]);
          setNeedsResumeCloseSessions([]);
        }}
        onContinue={() => {
          const ids = pendingCloseIds;
          setCloseAlertOpen(false);
          setPendingCloseIds([]);
          setNeedsResumeCloseSessions([]);
          executeBulkClose(ids);
        }}
      />

      <AnswerQuestionsDialog
        open={answerDialogSessionId !== null}
        onClose={() => setAnswerDialogSessionId(null)}
        result={answerDialogSession?.result ?? null}
        savedAnswers={answerDialogSession?.questionAnswers ?? []}
        onAnswersChange={(answers) => {
          if (answerDialogSessionId) {
            patchSession(answerDialogSessionId, { questionAnswers: answers });
          }
        }}
        apiModel={answerDialogSession?.aiModel ?? aiModel}
        apiProvider={answerDialogSession?.aiProvider ?? aiProvider}
        useOpenRouter={answerDialogSession?.useOpenRouter ?? useOpenRouter}
        onError={(message) => showToast("error", message)}
        onAnswersCost={(costUsd) => {
          if (answerDialogSessionId) {
            recordAnswersCost(answerDialogSessionId, costUsd);
          }
        }}
      />

      <CoverLetterDialog
        open={coverLetterDialogSessionId !== null}
        onClose={() => setCoverLetterDialogSessionId(null)}
        result={coverLetterDialogSession?.result ?? null}
        jobDescription={coverLetterDialogSession?.jobDescription ?? ""}
        jobTitle={coverLetterDialogSession?.jobTitle ?? ""}
        companyName={coverLetterDialogSession?.companyName ?? ""}
        jobsite={coverLetterDialogSession?.jobsite}
        resumeId={coverLetterDialogSession?.resumeId}
        userId={user.id}
        providerUsed={coverLetterDialogSession?.providerUsed}
        modelUsed={coverLetterDialogSession?.modelUsed}
        savedCoverLetter={coverLetterDialogSession?.coverLetter ?? ""}
        onCoverLetterChange={(text) => {
          if (coverLetterDialogSessionId) {
            patchSession(coverLetterDialogSessionId, { coverLetter: text });
          }
        }}
        onResumeSaved={(resumeId) => {
          if (coverLetterDialogSessionId) {
            patchSession(coverLetterDialogSessionId, { resumeId });
          }
        }}
        apiModel={coverLetterDialogSession?.aiModel ?? aiModel}
        apiProvider={coverLetterDialogSession?.aiProvider ?? aiProvider}
        useOpenRouter={coverLetterDialogSession?.useOpenRouter ?? useOpenRouter}
        onError={(message) => showToast("error", message)}
        onSuccess={(message) => showToast("success", message)}
        onCoverLetterCost={(costUsd) => {
          if (coverLetterDialogSessionId) {
            recordCoverLetterCost(coverLetterDialogSessionId, costUsd);
          }
        }}
      />

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <div className="panel flex min-h-0 w-full max-w-md flex-col overflow-hidden lg:max-w-lg">
          <p className="label-kicker mb-4 flex-shrink-0">Analyze job posting</p>

          <div className="mb-4 flex-shrink-0 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {useOpenRouter ? (
                <OpenRouterModelSelect
                  aiProvider={aiProvider}
                  aiModel={aiModel}
                  disabled={loadingProfile}
                  onProviderChange={setAiProvider}
                  onModelChange={(model) => {
                    setAiModel(model);
                    setAiProvider(getModelProvider(model));
                  }}
                />
              ) : (
                <DirectProviderModelSelect
                  aiProvider={aiProvider as DirectAIProvider}
                  aiModel={aiModel}
                  directModels={directModels}
                  disabled={loadingProfile}
                  onProviderChange={(provider) => {
                    setAiProvider(provider);
                  }}
                  onModelChange={setAiModel}
                />
              )}
            </div>
            <div>
              <label htmlFor="jobsite" className="label-kicker mb-2 block">
                Job board
              </label>
              <select
                id="jobsite"
                value={jobsite}
                disabled={loadingProfile}
                onChange={(e) => setJobsite(e.target.value as JobsiteId)}
                className="select-shell w-full text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {JOBSITES.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <label htmlFor="pageContent" className="label-kicker mb-2 block flex-shrink-0">
              Job posting text
            </label>
            <textarea
              id="pageContent"
              value={pageContent}
              onChange={(e) => setPageContent(e.target.value)}
              placeholder="Paste the full job page — title, company, and description…"
              className="input-shell min-h-0 flex-1 resize-none"
              disabled={loadingProfile}
            />
          </div>

          <button
            type="button"
            onClick={handleAnalyse}
            disabled={loadingProfile || !pageContent.trim()}
            className="btn-primary mt-4 w-full flex-shrink-0 gap-2"
          >
            <BtnIcon className="h-4 w-4 shrink-0">
              <AnalyseIcon />
            </BtnIcon>
            {loadingProfile ? "Loading your profile…" : "Analyze job"}
          </button>
        </div>

        <div className="panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4">
          <div className="mb-2 flex flex-shrink-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="label-kicker">Results</p>
              {selectedSessionIds.size > 0 ? (
                <span className="text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                  {selectedSessionIds.size} selected
                </span>
              ) : null}
              {sessions.length > 0 ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {sessions.length}
                </span>
              ) : null}
            </div>
            {sessions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 pb-2 text-[11px] text-slate-600 dark:border-slate-700/60 dark:text-slate-300">
                <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#007fff] focus:ring-[#007fff]/30 dark:border-slate-500 dark:bg-slate-800"
                  />
                  Select all
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={isFilterSelected("generated")}
                    onChange={() => toggleSelectionFilter("generated")}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#007fff] focus:ring-[#007fff]/30 dark:border-slate-500 dark:bg-slate-800"
                  />
                  Resume ready
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={isFilterSelected("issue")}
                    onChange={() => toggleSelectionFilter("issue")}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#007fff] focus:ring-[#007fff]/30 dark:border-slate-500 dark:bg-slate-800"
                  />
                  With errors
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={isFilterSelected("ungenerated")}
                    onChange={() => toggleSelectionFilter("ungenerated")}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#007fff] focus:ring-[#007fff]/30 dark:border-slate-500 dark:bg-slate-800"
                  />
                  No resume yet
                </label>
                <button
                  type="button"
                  onClick={handleBulkGenerate}
                  disabled={selectedGeneratableIds.length === 0}
                  className="btn-compact inline-flex items-center gap-1 bg-[#007fff] px-2.5 font-semibold text-white hover:border-[#0066cc] hover:bg-[#0066cc] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-[#0066cc] dark:hover:bg-[#0066cc]"
                >
                  <BtnIcon>
                    <SparklesIcon />
                  </BtnIcon>
                  Generate resumes
                  {selectedGeneratableIds.length > 0
                    ? ` (${selectedGeneratableIds.length})`
                    : ""}
                </button>
                <button
                  type="button"
                  onClick={handleBulkClose}
                  disabled={selectedClosableIds.length === 0}
                  className="btn-compact inline-flex items-center gap-1 px-2.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <BtnIcon>
                    <CloseIcon />
                  </BtnIcon>
                  Remove
                  {selectedClosableIds.length > 0 ? ` (${selectedClosableIds.length})` : ""}
                </button>
              </div>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
            {sessions.length === 0 ? (
              <div className="empty-state flex h-full min-h-[9rem] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/90 bg-slate-50/50 px-4 py-6 dark:border-slate-600/60 dark:bg-slate-800/40">
                <div className="empty-state-icon mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:ring-slate-600/60">
                  <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  No jobs analyzed yet
                </p>
                <p className="mt-1 max-w-xs text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Paste a job posting on the left, then click Analyze job.
                </p>
              </div>
            ) : (
              sessions.map((session, index) => (
                <AnalysisResultCard
                  key={session.id}
                  sequenceNo={index + 1}
                  session={toSessionView(session)}
                  selected={selectedSessionIds.has(session.id)}
                  onSelectedChange={(selected) => toggleSessionSelected(session.id, selected)}
                  onGenerateResume={handleGenerateResume}
                  onGenerateAnswers={setAnswerDialogSessionId}
                  onGenerateCoverLetter={setCoverLetterDialogSessionId}
                  onAtsSaved={(sessionId, payload) => {
                    patchSession(sessionId, {
                      atsResult: payload.atsResult,
                      atsCostUsd: payload.atsCostUsd,
                    });
                  }}
                  onClose={dismissSession}
                  onError={(message) => showToast("error", message)}
                  directModels={directModels}
                  onSessionModelChange={(sessionId, next) => {
                    patchSession(sessionId, {
                      aiProvider: next.aiProvider,
                      aiModel: next.aiModel,
                    });
                  }}
                  onRegenerateFromJson={regeneratePdfFromJsonForSession}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
