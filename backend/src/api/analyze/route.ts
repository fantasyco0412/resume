import { NextRequest, NextResponse } from "next/server";
import {
  generationMaxTokensForRequest,
  requireAIConfigured,
  resolveAIRequest,
} from "@/lib/ai-api";
import { callAI, extractFirstJson, formatAIProviderError } from "@/lib/ai-provider";
import type { AIMessage } from "@/lib/ai-provider";
import { buildResumeAnalyzeStaticPrompt } from "@/lib/prompts/resume-analyze-static";
import {
  buildBulletGuidanceFromProfile,
  getBulletCountForTenure,
  getTenureYears,
} from "@/lib/resume-bullets";
import {
  cleanJsonText,
  diagnoseJsonParseFailure,
  formatJsonParseErrorMessage,
} from "@/lib/analyze-json";
import {
  DEFAULT_RESUME_TEMPLATE,
  isValidResumeTemplate,
} from "@/lib/resume-templates";
import { generateResumePdfBase64 } from "@/lib/generate-resume-pdf";
import { extractJobFromPageContent } from "@/lib/extract-job-page";
import { AuthError, requireAuthClient } from "@/lib/supabase/server-client";
import { loadResumeGeneratePrompt } from "@/lib/supabase/services/resume-prompt-settings";

/** Resume + PDF generation can take several minutes. */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let resumeData: any = undefined;

  try {
    const { userId, client } = await requireAuthClient(request);

    const {
      account,
      jd: requestJd,
      pageContent,
      jobTitle: requestJobTitle,
      companyName: requestCompanyName,
      resumeContent,
      template: requestedTemplate,
      profileData,
      apiModel,
      apiProvider,
      useOpenRouter: useOpenRouterBody,
    } = await request.json();

    if (!resumeContent) {
      return NextResponse.json(
        { error: "Resume content is required" },
        { status: 400 }
      );
    }

    const aiRequest = resolveAIRequest({
      useOpenRouter: useOpenRouterBody,
      apiModel,
      apiProvider,
    });
    requireAIConfigured(aiRequest.useOpenRouter, aiRequest.provider);
    const selectedModel = aiRequest.model;

    let jd = typeof requestJd === "string" ? requestJd.trim() : "";
    let jobTitle =
      typeof requestJobTitle === "string" ? requestJobTitle.trim() : "";
    let companyName =
      typeof requestCompanyName === "string" ? requestCompanyName.trim() : "";

    if (!jd) {
      const source =
        typeof pageContent === "string" && pageContent.trim()
          ? pageContent
          : "";
      if (!source) {
        return NextResponse.json(
          { error: "Job page content or job description is required" },
          { status: 400 }
        );
      }
      const extracted = await extractJobFromPageContent(source, {
        useOpenRouter: aiRequest.useOpenRouter,
      });
      jd = extracted.extracted.jobDescription;
      jobTitle = jobTitle || extracted.extracted.jobTitle;
      companyName = companyName || extracted.extracted.companyName;
    }

    if (!jd) {
      return NextResponse.json(
        { error: "Could not determine job description for resume generation" },
        { status: 400 }
      );
    }

    const bulletGuidance = profileData
      ? buildBulletGuidanceFromProfile(profileData)
      : "";

    const userPrompt = bulletGuidance.trim()
      ? bulletGuidance
      : "Generate the updated resume JSON per the system instructions.";

    // Handle API provider selection
    let jsonText: string;
    let analysisResult: any;
    let providerUsed = "";
    let modelUsed = selectedModel;
    let generationCostUsd: number | undefined;
    const generationMaxTokens = generationMaxTokensForRequest(aiRequest);

    const sanitizeJobTitle = (rawTitle: unknown): string => {
      const original = String(rawTitle || "").trim().replace(/\s+/g, " ");
      if (!original) return "";

      let cleaned = original;
      // Remove noisy repeated separators often seen in scraped JDs (e.g., "|||", "///", "\\\\").
      cleaned = cleaned.replace(/\s*[|/\\]{2,}\s*/g, " ");
      // Remove trailing punctuation/separator noise.
      cleaned = cleaned.replace(/[|/\\,:;\-]+$/g, "");
      cleaned = cleaned.replace(/\s+/g, " ").trim();

      // Keep original if cleanup would erase too much.
      return cleaned || original;
    };

    const customResumePrompt = await loadResumeGeneratePrompt(userId, client);

    // Use centralized callAI helper which normalizes providers and provides text/json/raw
    try {
      const messages: AIMessage[] = [
        {
          role: "system",
          content: buildResumeAnalyzeStaticPrompt(jd, resumeContent, {
            template: customResumePrompt,
          }),
        },
        { role: "user", content: userPrompt },
      ];

      const aiStarted = Date.now();
      const aiResp = await callAI({
        useOpenRouter: aiRequest.useOpenRouter,
        model: selectedModel,
        ...(aiRequest.provider ? { provider: aiRequest.provider } : {}),
        messages,
        temperature: 0.7,
        max_tokens: generationMaxTokens,
        tryParseJson: true,
      });

      providerUsed = aiResp.providerUsed;
      modelUsed = aiResp.modelUsed;
      generationCostUsd = aiResp.costUsd;
      console.log(
        `Analyze AI finished in ${Date.now() - aiStarted}ms (provider=${providerUsed}, model=${modelUsed}${generationCostUsd != null ? `, cost=$${generationCostUsd.toFixed(4)}` : ""})`
      );

      // prefer parsed json when available, otherwise extract from text
      if (aiResp.json) {
        jsonText = typeof aiResp.json === "string" ? aiResp.json : JSON.stringify(aiResp.json);
      } else {
        const extracted = extractFirstJson(aiResp.text || "");
        jsonText = extracted
          ? JSON.stringify(extracted)
          : aiResp.text || "";
      }
    } catch (err: any) {
      throw new Error(
        formatAIProviderError(err, selectedModel, err?.elapsedMs, {
          useOpenRouter: aiRequest.useOpenRouter,
          provider: aiRequest.provider,
        })
      );
    }

    const cleanAchievements = (items: unknown): string[] =>
      Array.isArray(items)
        ? items.map((item) => String(item || "").trim()).filter(Boolean)
        : [];

    const shouldPreferProfileAchievements = (
      aiAchievements: string[],
      profileAchievements: string[],
      startDate: string,
      endDate: string
    ) => {
      if (profileAchievements.length === 0) return false;
      if (aiAchievements.length === 0) return true;

      const target = getBulletCountForTenure(
        getTenureYears(startDate || "", endDate || "Present")
      );

      if (aiAchievements.length < Math.max(2, Math.floor(target * 0.6))) {
        return true;
      }
      if (aiAchievements.length < Math.floor(profileAchievements.length * 0.5)) {
        return true;
      }
      return false;
    };

    // Parse the JSON response — stop immediately on failure (no repair pass)
    try {
      analysisResult = JSON.parse(cleanJsonText(jsonText));
    } catch (parseError) {
      const diagnostics = diagnoseJsonParseFailure(jsonText, parseError);
      const errorMessage = formatJsonParseErrorMessage(
        diagnostics,
        providerUsed,
        modelUsed
      );

      console.error("AI JSON parse failed — generation stopped.", {
        provider: providerUsed,
        model: modelUsed,
        diagnostics,
      });

      return NextResponse.json(
        {
          error: errorMessage,
          diagnostics,
          providerUsed,
          modelUsed,
          rawResponse: jsonText.slice(0, 12000),
        },
        { status: 422 }
      );
    }

    // Return only the resume JSON (remove any analysis fields if present)
    resumeData = analysisResult.updatedResume || analysisResult;

    // Merge profile data (company details, skills, education, etc.) to ensure they're always included
    if (profileData) {
      // Merge company details into experience
      if (
        profileData.company_1 ||
        profileData.company_2 ||
        profileData.company_3 ||
        profileData.company_4 ||
        profileData.company_5
      ) {
        const profileCompanies = [
          profileData.company_1,
          profileData.company_2,
          profileData.company_3,
          profileData.company_4,
          profileData.company_5,
        ].filter(Boolean);

        if (profileCompanies.length > 0) {
          // Merge profile companies with AI-generated experience
          const existingExperience = resumeData.experience || [];
          const profileExperience = profileCompanies.map((comp: any) => ({
            title: sanitizeJobTitle(comp.title || ""),
            company: comp.company || "",
            startDate: comp.startDate || "",
            endDate: comp.endDate || "",
            achievements: comp.achievements || [],
          }));

          // AI entries first, profile second — on duplicate company+dates keep AI
          // title/dates but fall back to profile achievements when AI bullets are thin
          const combined = [...existingExperience, ...profileExperience];
          const finalMerged: any[] = [];
          const indexByCompanyDates = new Map<string, number>();

          const companyDateKey = (exp: any) =>
            `${exp.company || ""}|${exp.startDate || ""}|${exp.endDate || ""}`
              .toLowerCase()
              .trim();

          for (const exp of combined) {
            const key = companyDateKey(exp);
            const existingIdx = indexByCompanyDates.get(key);

            if (existingIdx === undefined) {
              indexByCompanyDates.set(key, finalMerged.length);
              finalMerged.push(exp);
              continue;
            }

            const aiEntry = finalMerged[existingIdx];
            const profileEntry = exp;
            const aiAchievements = cleanAchievements(aiEntry.achievements);
            const profileAchievements = cleanAchievements(profileEntry.achievements);

            if (
              shouldPreferProfileAchievements(
                aiAchievements,
                profileAchievements,
                profileEntry.startDate || aiEntry.startDate || "",
                profileEntry.endDate || aiEntry.endDate || "Present"
              )
            ) {
              finalMerged[existingIdx] = {
                ...aiEntry,
                title: aiEntry.title || profileEntry.title,
                achievements: profileAchievements,
              };
              console.log(
                `Merge phase: Using profile achievements for ${profileEntry.company} (AI had ${aiAchievements.length}, profile has ${profileAchievements.length})`
              );
            } else {
              console.log(
                `Merge phase: Keeping AI achievements for ${profileEntry.company} (AI ${aiAchievements.length}, profile ${profileAchievements.length})`
              );
            }
          }

          resumeData.experience = finalMerged;
        }
      }

      // Merge hardSkills from profile
      if (profileData.default_resume?.hardSkills) {
        resumeData.hardSkills = {
          ...profileData.default_resume.hardSkills,
          ...(resumeData.hardSkills || {}),
        };
      } else if (profileData.default_resume?.skills) {
        // Backward compatibility: if profile has old "skills" format, convert to hardSkills
        resumeData.hardSkills = {
          ...profileData.default_resume.skills,
          ...(resumeData.hardSkills || {}),
        };
      }
      // Merge softSkills from profile
      if (profileData.default_resume?.softSkills) {
        const profileSoftSkills = profileData.default_resume.softSkills;
        const existingSoftSkills = resumeData.softSkills || [];
        const combined = [...profileSoftSkills, ...existingSoftSkills];
        resumeData.softSkills = Array.from(
          new Set(combined.map((s: string) => s.trim().toLowerCase()))
        ).map((skill) => {
          const original = [...profileSoftSkills, ...existingSoftSkills].find(
            (s) => s.trim().toLowerCase() === skill
          );
          return original || skill;
        });
      }

      // Education: always use profile data exclusively.
      // The AI receives education as plain text and may reformat school names or dates,
      // causing string-based deduplication to fail and producing duplicates in the PDF.
      // Profile data is the authoritative source — no merging needed.
      if (
        profileData.default_resume?.education &&
        profileData.default_resume.education.length > 0
      ) {
        resumeData.education = profileData.default_resume.education;
      }

      // Merge certifications from profile
      if (
        profileData.default_resume?.certifications &&
        profileData.default_resume.certifications.length > 0
      ) {
        const profileCerts = profileData.default_resume.certifications;
        const existingCerts = resumeData.certifications || [];
        const combined = [...profileCerts, ...existingCerts];
        resumeData.certifications = Array.from(
          new Set(
            combined.map((c: any) => {
              // Handle both string and object formats
              const certStr =
                typeof c === "string" ? c : c.name || c.title || String(c);
              return certStr.trim().toLowerCase();
            })
          )
        ).map((certLower) => {
          const original = [...profileCerts, ...existingCerts].find(
            (c: any) => {
              const certStr =
                typeof c === "string" ? c : c.name || c.title || String(c);
              return certStr.trim().toLowerCase() === certLower;
            }
          );
          // Return string format for templates
          return typeof original === "string"
            ? original
            : original?.name || original?.title || String(original || "");
        });
      }

      // Merge projects from profile
      if (
        profileData.default_resume?.projects &&
        profileData.default_resume.projects.length > 0
      ) {
        const profileProjects = profileData.default_resume.projects;
        const existingProjects = resumeData.projects || [];
        const combined = [...profileProjects, ...existingProjects];
        const seen = new Set<string>();
        resumeData.projects = combined.filter((proj: any) => {
          const key = (proj.name || "").toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      // Ensure contact info from profile is preserved (profile data takes priority)
      if (profileData.default_resume) {
        // Preserve contact info - profile data takes priority, then AI-generated, then fallback
        resumeData.name = profileData.default_resume.name || resumeData.name;
        resumeData.email = profileData.default_resume.email || resumeData.email;
        resumeData.phone = profileData.default_resume.phone || resumeData.phone;
        resumeData.location =
          profileData.default_resume.location || resumeData.location;
        // Only use AI-generated linkedin if profile explicitly has one set.
        // If profile has no linkedin, clear any hallucinated value from the AI.
        resumeData.linkedin = profileData.default_resume.linkedin || "";
      }
    }

    // Remove location and description from experience if present, deduplicate, and ensure correct order
    if (resumeData.experience && Array.isArray(resumeData.experience)) {
      resumeData.experience = resumeData.experience.map((exp: any) => {
        const { location, description, ...rest } = exp;
        return {
          ...rest,
          title: sanitizeJobTitle(rest?.title || ""),
        };
      });

      // Final aggressive deduplication: same company + same dates = duplicate (regardless of title)
      // SIMPLE RULE: First occurrence wins, all others with same company+dates are skipped
      const finalExperience: any[] = [];
      const seenCompanyDates = new Set<string>();

      for (const exp of resumeData.experience) {
        // Key: company + dates ONLY (same company, same dates = duplicate, even if title differs)
        const companyDateKey = `${exp.company || ""}|${exp.startDate || ""}|${
          exp.endDate || ""
        }`
          .toLowerCase()
          .trim();

        // Simple check: if we've seen this company+date combo, skip it entirely
        if (!seenCompanyDates.has(companyDateKey)) {
          // First time seeing this company+date combination
          seenCompanyDates.add(companyDateKey);
          finalExperience.push(exp);
        } else {
          // Duplicate found - skip it (first occurrence already in array)
          console.log(
            `Skipping duplicate experience:`,
            exp.title,
            exp.company,
            exp.startDate,
            exp.endDate
          );
        }
      }

      resumeData.experience = finalExperience.filter((exp: any) => {
        const company = String(exp.company || "").trim();
        const title = String(exp.title || "").trim();
        return company.length > 0 || title.length > 0;
      });

      // Sort experience from latest (most recent) to oldest first
      resumeData.experience.sort((a: any, b: any) => {
        // Parse dates (MM/YYYY format)
        const parseDate = (dateStr: string) => {
          if (dateStr === "Present" || dateStr === "present") {
            return new Date(9999, 11, 31); // Far future date for "Present"
          }
          const [month, year] = dateStr.split("/");
          return new Date(parseInt(year), parseInt(month) - 1);
        };

        // Compare by endDate first (most recent endDate comes first)
        const aEndDate = parseDate(a.endDate || a.startDate);
        const bEndDate = parseDate(b.endDate || b.startDate);

        if (aEndDate.getTime() !== bEndDate.getTime()) {
          return bEndDate.getTime() - aEndDate.getTime(); // Descending order
        }

        // If endDates are equal, sort by startDate (more recent startDate comes first)
        const aStartDate = parseDate(a.startDate);
        const bStartDate = parseDate(b.startDate);
        return bStartDate.getTime() - aStartDate.getTime(); // Descending order
      });

      // Limit to 5 most recent positions; cap bullets by tenure (not fixed slot order)
      if (resumeData.experience.length > 5) {
        resumeData.experience = resumeData.experience.slice(0, 5);
      }
      resumeData.experience = resumeData.experience.map((exp: any) => {
        if (exp.achievements && Array.isArray(exp.achievements)) {
          const seenAchievements = new Set<string>();
          const uniqueAchievements = exp.achievements
            .map((ach: string) => String(ach || "").trim())
            .filter(Boolean)
            .filter((ach: string) => {
              const normalized = ach.toLowerCase();
              if (seenAchievements.has(normalized)) return false;
              seenAchievements.add(normalized);
              return true;
            });
          const tenureYears = getTenureYears(exp.startDate || "", exp.endDate || "Present");
          const maxBullets = getBulletCountForTenure(tenureYears);
          exp.achievements = uniqueAchievements.slice(0, maxBullets);
        }
        return exp;
      });
    }

    // Template is provided in the request; default to 'standard' if missing
    const template = isValidResumeTemplate(requestedTemplate || "")
      ? requestedTemplate
      : DEFAULT_RESUME_TEMPLATE;

    // PDF is slow (Puppeteer cold start). Skip here by default; client generates in background.
    const generatePdfInline = process.env.ANALYZE_GENERATE_PDF === "true";

    let pdfBase64: string | undefined = undefined;
    let pdfError: string | undefined = undefined;
    if (generatePdfInline) {
      try {
        console.log("Attempting PDF generation...");
        pdfBase64 = (await generateResumePdfBase64(resumeData, template)) ?? undefined;
        if (pdfBase64) {
          console.log("PDF generation successful");
        } else {
          console.log("PDF generation returned null (likely API key missing)");
        }
      } catch (pdfErr: any) {
        console.error("PDF generation failed - caught in outer handler", pdfErr);
        // Extract error message more carefully
        try {
          if (pdfErr instanceof Error) {
            pdfError = pdfErr.message;
          } else if (typeof pdfErr === "string") {
            pdfError = pdfErr;
          } else if (pdfErr?.message) {
            pdfError = pdfErr.message;
          } else if (pdfErr?.error?.message) {
            pdfError = pdfErr.error.message;
          } else if (pdfErr?.error?.error?.message) {
            pdfError = pdfErr.error.error.message;
          } else {
            pdfError =
              "PDF generation failed. Please check your PDFShift API key configuration.";
          }
          console.log("PDF error message extracted:", pdfError);
        } catch (parseErr) {
          console.error("Error parsing PDF error:", parseErr);
          pdfError =
            "PDF generation failed. Ensure Puppeteer/Chromium is installed (e.g. npm install puppeteer).";
        }
      }
    }

    // Always return the resume, even if PDF generation failed
    return NextResponse.json({
      resume: resumeData,
      providerUsed,
      modelUsed,
      jobTitle,
      companyName,
      jobDescription: jd,
      ...(generationCostUsd != null ? { generationCostUsd } : {}),
      ...(pdfBase64 && { pdfBase64 }),
      ...(pdfError && { pdfError }),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error analyzing resume:", error);
    // If we have resumeData, still return it even if there was an error
    // This handles cases where the error occurred after resume generation
    if (typeof resumeData !== "undefined") {
      console.warn("Returning resume despite error:", error);
      return NextResponse.json({
        resume: resumeData,
        pdfError: error instanceof Error ? error.message : "An error occurred",
      });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An error occurred while analyzing the resume",
      },
      {
        status:
          error instanceof Error && /timed out|timeout/i.test(error.message)
            ? 504
            : 500,
      }
    );
  }
}
