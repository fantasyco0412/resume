import type {
  Profile,
  ProfileBundle,
  UserCertification,
  UserCompany,
  UserEducation,
  UserProject,
} from "@/lib/supabase/database.types";
import type {
  ResumeEducation,
  ResumeExperience,
  ResumeProject,
  UpdatedResume,
} from "@/lib/types/resume";
import { resolveResumeTemplate } from "@/lib/resume-templates";
import { displayDateToIso, isoDateToDisplay } from "@/lib/mappers/date-format";

/** Legacy user_preferences row shape (pre-normalized schema). */
export interface LegacyUserPreferences {
  user_id: string;
  default_resume?: Record<string, unknown> | null;
  company_1?: LegacyCompanyJson | null;
  company_2?: LegacyCompanyJson | null;
  company_3?: LegacyCompanyJson | null;
  company_4?: LegacyCompanyJson | null;
  company_5?: LegacyCompanyJson | null;
}

export interface LegacyCompanyJson {
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  workType?: string;
  description?: string;
  achievements?: string[];
}

function legacyCompanyToUserCompany(
  company: LegacyCompanyJson,
  userId: string,
  displayOrder: number
): UserCompany {
  const isCurrent =
    !company.endDate?.trim() || company.endDate.trim().toLowerCase() === "present";

  return {
    id: `legacy-company-${displayOrder}`,
    user_id: userId,
    company_name: company.company || "",
    title: company.title || null,
    company_location: company.location || null,
    work_type:
      company.workType === "Remote" ||
      company.workType === "Hybrid" ||
      company.workType === "Onsite"
        ? company.workType
        : null,
    start_date: displayDateToIso(company.startDate),
    end_date: isCurrent ? null : displayDateToIso(company.endDate),
    is_current: isCurrent,
    description: company.description || null,
    achievements: company.achievements?.length ? company.achievements : null,
    display_order: displayOrder,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

function legacyEducationToUserEducation(
  edu: ResumeEducation,
  userId: string,
  displayOrder: number
): UserEducation {
  return {
    id: `legacy-education-${displayOrder}`,
    user_id: userId,
    school: edu.school || "",
    degree: edu.degree || null,
    field_of_study: edu.fieldOfStudy || null,
    gpa: edu.gpa ? Number.parseFloat(edu.gpa) : null,
    location: edu.location || null,
    graduation_date: displayDateToIso(edu.graduationDate),
    description: edu.description || null,
    display_order: displayOrder,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

function legacyProjectToUserProject(
  project: ResumeProject,
  userId: string,
  displayOrder: number
): UserProject {
  return {
    id: `legacy-project-${displayOrder}`,
    user_id: userId,
    project_name: project.name || "",
    description: project.description || null,
    technologies: project.technologies?.length ? project.technologies : null,
    github_url: project.githubUrl || null,
    live_url: project.liveUrl || null,
    start_date: displayDateToIso(project.startDate),
    end_date: displayDateToIso(project.endDate),
    display_order: displayOrder,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

function legacyCertificationToUserCertification(
  name: string,
  userId: string,
  index: number
): UserCertification {
  return {
    id: `legacy-cert-${index}`,
    user_id: userId,
    certification_name: name,
    issuing_organization: null,
    issue_date: null,
    expiration_date: null,
    credential_id: null,
    credential_url: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

/**
 * Converts legacy user_preferences into an in-memory ProfileBundle.
 * Used as read-time fallback until data is migrated to normalized tables.
 */
export function legacyPreferencesToProfileBundle(
  preferences: LegacyUserPreferences,
  existingProfile: Profile
): ProfileBundle {
  const defaultResume = (preferences.default_resume ?? {}) as UpdatedResume & {
    resume_template?: string;
    download_path?: string;
  };

  const profile: Profile = {
    ...existingProfile,
    full_name: defaultResume.name ?? existingProfile.full_name,
    phone: defaultResume.phone ?? existingProfile.phone,
    linkedin_url: defaultResume.linkedin ?? existingProfile.linkedin_url,
    summary: defaultResume.summary ?? existingProfile.summary,
    location: defaultResume.location ?? existingProfile.location,
    default_settings: {
      ...existingProfile.default_settings,
      ...(defaultResume.resume_template
        ? {
            resume_template: resolveResumeTemplate(
              String(defaultResume.resume_template)
            ),
          }
        : {}),
    },
  };

  const legacyCompanies = [
    preferences.company_1,
    preferences.company_2,
    preferences.company_3,
    preferences.company_4,
    preferences.company_5,
  ].filter(Boolean) as LegacyCompanyJson[];

  const companies = legacyCompanies.map((company, index) =>
    legacyCompanyToUserCompany(company, existingProfile.id, index)
  );

  const educations = (defaultResume.education ?? []).map((edu, index) =>
    legacyEducationToUserEducation(edu, existingProfile.id, index)
  );

  const projects = (defaultResume.projects ?? []).map((project, index) =>
    legacyProjectToUserProject(project, existingProfile.id, index)
  );

  const certifications = (defaultResume.certifications ?? []).map((cert, index) =>
    legacyCertificationToUserCertification(
      typeof cert === "string" ? cert : String(cert),
      existingProfile.id,
      index
    )
  );

  return {
    profile,
    educations,
    skills: [],
    certifications,
    projects,
    companies,
  };
}

export function legacyCompanyJsonToResumeExperience(
  company: LegacyCompanyJson
): ResumeExperience {
  return {
    title: company.title || "",
    company: company.company || "",
    startDate: company.startDate || "",
    endDate: company.endDate || "Present",
    location: company.location,
    workType:
      company.workType === "Remote" ||
      company.workType === "Hybrid" ||
      company.workType === "Onsite"
        ? company.workType
        : undefined,
    description: company.description,
    achievements: company.achievements,
  };
}
