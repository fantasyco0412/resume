import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import Mustache from "mustache";
import {
  DEFAULT_RESUME_TEMPLATE,
  isValidResumeTemplate,
} from "@/lib/resume-templates";
import { renderHtmlToPdfBase64 } from "@/lib/pdf-from-html";

export async function generateResumePdfBase64(
  resume: Record<string, unknown>,
  template?: string | null
): Promise<string> {
  const started = Date.now();
  const tmpl = isValidResumeTemplate(template || "")
    ? template!
    : DEFAULT_RESUME_TEMPLATE;

  const templatesDir = (() => {
    if (process.env.TEMPLATES_DIR) return process.env.TEMPLATES_DIR;
    const local = path.join(process.cwd(), "templates");
    if (fsSync.existsSync(local)) return local;
    return path.join(process.cwd(), "..", "templates");
  })();

  const tplPath = path.join(templatesDir, `${tmpl}.html`);
  console.log("[generate-pdf] Loading template", { template: tmpl, tplPath, templatesDir });
  let tpl = "";
  try {
    tpl = await fs.readFile(tplPath, "utf8");
    console.log("[generate-pdf] Template loaded", {
      tplPath,
      tplChars: tpl.length,
      elapsedMs: Date.now() - started,
    });
  } catch (readErr) {
    const fallback = path.join(templatesDir, "standard.html");
    console.warn("[generate-pdf] Template read failed, using fallback", {
      tplPath,
      fallback,
      error: readErr instanceof Error ? readErr.message : String(readErr),
    });
    tpl = await fs.readFile(fallback, "utf8");
    console.log("[generate-pdf] Fallback template loaded", {
      fallback,
      tplChars: tpl.length,
      elapsedMs: Date.now() - started,
    });
  }

  const view: Record<string, unknown> = {
    name: resume.name || "",
    email: resume.email || "",
    phone: resume.phone || "",
    location: resume.location || "",
    linkedin: resume.linkedin || "",
    summary: resume.summary || "",
  };

  view.hasSummary = !!(
    resume.summary &&
    String(resume.summary).trim().length > 0
  );

  if (
    resume.hardSkills &&
    typeof resume.hardSkills === "object" &&
    Object.keys(resume.hardSkills as object).length > 0
  ) {
    view.hasHardSkills = true;
    view.hardSkills = Object.entries(resume.hardSkills as Record<string, unknown>).map(
      ([k, v]) => {
        const skillsArray = Array.isArray(v) ? v : [String(v)];
        return {
          key: k,
          value: skillsArray,
          valueString: skillsArray.join(", "),
        };
      }
    );
  } else {
    view.hasHardSkills = false;
    view.hardSkills = [];
  }

  if (Array.isArray(resume.softSkills) && resume.softSkills.length > 0) {
    view.hasSoftSkills = true;
    view.softSkills = resume.softSkills;
    view.softSkillsString = resume.softSkills.join(", ");
  } else {
    view.hasSoftSkills = false;
    view.softSkills = [];
    view.softSkillsString = "";
  }
  view.hasSkills = !!(view.hasHardSkills || view.hasSoftSkills);

  if (resume.hardSkills && typeof resume.hardSkills === "object") {
    view.skills = Object.entries(resume.hardSkills as Record<string, unknown>).map(
      ([k, v]) => {
        const skillsArray = Array.isArray(v) ? v : [String(v)];
        return {
          key: k,
          value: skillsArray,
          valueString: skillsArray.join(", "),
        };
      }
    );
  } else {
    view.skills = [];
  }

  if (Array.isArray(resume.experience) && resume.experience.length > 0) {
    const seenCompanyDates = new Set<string>();
    const uniqueExperience: Record<string, unknown>[] = [];

    for (const exp of resume.experience as Record<string, unknown>[]) {
      const company = String(exp.company || "").trim().toLowerCase();
      const startDate = String(exp.startDate || "").trim().toLowerCase();
      const endDate = String(exp.endDate || "").trim().toLowerCase();
      const companyDateKey = `${company}|${startDate}|${endDate}`;

      if (!seenCompanyDates.has(companyDateKey)) {
        seenCompanyDates.add(companyDateKey);
        uniqueExperience.push(exp);
      }
    }

    const renderableExperience = uniqueExperience.filter((exp) => {
      const company = String(exp.company || "").trim();
      const title = String(exp.title || "").trim();
      return company.length > 0 || title.length > 0;
    });

    view.hasExperience = renderableExperience.length > 0;
    view.experience = renderableExperience.map((exp) => {
      const start = String(exp.startDate || "").trim();
      const end = String(exp.endDate || "").trim();
      const dateRange = start && end ? `${start} – ${end}` : start || end || "";
      const achievements = Array.isArray(exp.achievements)
        ? exp.achievements
            .map((ach) => String(ach || "").trim())
            .filter(Boolean)
            .map((s) => (s.endsWith(".") ? s : `${s}.`))
        : [];

      return {
        ...exp,
        company: String(exp.company || "").trim(),
        title: String(exp.title || "").trim(),
        dateRange,
        achievements,
        hasAchievements: achievements.length > 0,
      };
    });
  } else {
    view.hasExperience = false;
    view.experience = [];
  }

  if (Array.isArray(resume.education) && resume.education.length > 0) {
    const seenSchoolDate = new Set<string>();
    const uniqueEducation = (resume.education as Record<string, unknown>[]).filter(
      (edu) => {
        const key = `${edu.school || ""}|${edu.graduationDate || ""}`
          .toLowerCase()
          .trim();
        if (seenSchoolDate.has(key)) return false;
        seenSchoolDate.add(key);
        return true;
      }
    );

    view.hasEducation = uniqueEducation.length > 0;
    view.education = uniqueEducation;
  } else {
    view.hasEducation = false;
    view.education = [];
  }

  if (Array.isArray(resume.certifications) && resume.certifications.length > 0) {
    view.hasCertifications = true;
    view.certifications = resume.certifications.map((c: unknown) =>
      typeof c === "string" ? c : (c as { name?: string; title?: string }).name ||
        (c as { name?: string; title?: string }).title ||
        String(c)
    );
  } else {
    view.hasCertifications = false;
    view.certifications = [];
  }

  if (Array.isArray(resume.projects) && resume.projects.length > 0) {
    view.hasProjects = true;
    view.projects = (resume.projects as Record<string, unknown>[]).map((proj) => {
      if (proj.technologies && Array.isArray(proj.technologies)) {
        return {
          ...proj,
          technologiesString: proj.technologies.join(", "),
          technologies: proj.technologies,
        };
      }
      return proj;
    });
  } else {
    view.hasProjects = false;
    view.projects = [];
  }

  const html = Mustache.render(tpl, view);
  console.log("[generate-pdf] HTML rendered", {
    htmlChars: html.length,
    experienceCount: Array.isArray(view.experience) ? view.experience.length : 0,
    elapsedMs: Date.now() - started,
  });

  console.log("[generate-pdf] Starting Puppeteer render…");
  const pdfBase64 = await renderHtmlToPdfBase64(html);
  console.log("[generate-pdf] Puppeteer render finished", {
    base64Chars: pdfBase64.length,
    elapsedMs: Date.now() - started,
  });
  return pdfBase64;
}
