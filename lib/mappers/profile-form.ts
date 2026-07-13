import type {
  ProfileBundle,
  UserCompany,
  WorkType,
} from "@/lib/supabase/database.types";
import type { ResumeExperience } from "@/lib/types/resume";
import {
  displayDateToIso,
  formatGpa,
  isoDateToDisplay,
} from "@/lib/mappers/date-format";
import {
  userCertificationToName,
  userCompanyToResumeExperience,
  userEducationToResumeEducation,
  userProjectToResumeProject,
} from "@/lib/mappers/profile-to-resume";
import { generateId } from "@/lib/generate-id";
import { resolveResumeTemplate, type ResumeTemplateId } from "@/lib/resume-templates";

export interface EducationFormRow {
  clientId: string;
  id?: string;
  degree: string;
  school: string;
  graduationDate: string;
  gpa: string;
}

export interface ProjectFormRow {
  clientId: string;
  id?: string;
  name: string;
  description: string;
  technologies: string[];
}

export interface CompanyFormRow {
  clientId: string;
  id?: string;
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  location: string;
  workType: WorkType | "";
  description: string;
  achievements: string[];
}

export interface ProfileFormState {
  fullName: string;
  phone: string;
  location: string;
  linkedin: string;
  summary: string;
  resumeTemplate: ResumeTemplateId;
  educations: EducationFormRow[];
  certifications: Array<{ clientId: string; id?: string; name: string }>;
  projects: ProjectFormRow[];
  companies: CompanyFormRow[];
}

export function newClientId(): string {
  return generateId();
}

export function createEmptyCompanyRow(): CompanyFormRow {
  return {
    clientId: newClientId(),
    title: "",
    company: "",
    startDate: "",
    endDate: "",
    location: "",
    workType: "",
    description: "",
    achievements: [],
  };
}

export function profileBundleToFormState(bundle: ProfileBundle): ProfileFormState {
  return {
    fullName: bundle.profile.full_name || "",
    phone: bundle.profile.phone || "",
    location: bundle.profile.location || "",
    linkedin: bundle.profile.linkedin_url || "",
    summary: bundle.profile.summary || "",
    resumeTemplate: resolveResumeTemplate(
      bundle.profile.default_settings?.resume_template as string | undefined
    ),
    educations: bundle.educations.map((edu) => {
      const mapped = userEducationToResumeEducation(edu);
      return {
        clientId: edu.id,
        id: edu.id,
        degree: mapped.degree,
        school: mapped.school,
        graduationDate: mapped.graduationDate,
        gpa: mapped.gpa || "",
      };
    }),
    certifications: bundle.certifications.map((cert) => ({
      clientId: cert.id,
      id: cert.id,
      name: userCertificationToName(cert),
    })),
    projects: bundle.projects.map((project) => {
      const mapped = userProjectToResumeProject(project);
      return {
        clientId: project.id,
        id: project.id,
        name: mapped.name,
        description: mapped.description || "",
        technologies: mapped.technologies || [],
      };
    }),
    companies: bundle.companies.map((company) => {
      const mapped = userCompanyToResumeExperience(company);
      return companyRowFromExperience(company.id, mapped);
    }),
  };
}

export function companyRowFromExperience(
  id: string | undefined,
  exp: ResumeExperience
): CompanyFormRow {
  return {
    clientId: id || newClientId(),
    id,
    title: exp.title,
    company: exp.company,
    startDate: exp.startDate,
    endDate: exp.endDate,
    location: exp.location || "",
    workType: exp.workType || "",
    description: exp.description || "",
    achievements: exp.achievements || [],
  };
}

export function companyFormRowToDbPayload(
  row: CompanyFormRow,
  userId: string,
  displayOrder: number
): Omit<UserCompany, "created_at" | "updated_at"> {
  const isCurrent =
    !row.endDate.trim() || row.endDate.trim().toLowerCase() === "present";

  return {
    id: row.id || newClientId(),
    user_id: userId,
    company_name: row.company,
    title: row.title || null,
    company_location: row.location || null,
    work_type: row.workType || null,
    start_date: displayDateToIso(row.startDate),
    end_date: isCurrent ? null : displayDateToIso(row.endDate),
    is_current: isCurrent,
    description: row.description || null,
    achievements: row.achievements.length ? row.achievements : null,
    display_order: displayOrder,
  };
}

export function educationFormRowToDbPayload(
  row: EducationFormRow,
  userId: string,
  displayOrder: number
) {
  const gpaNum = row.gpa.trim() ? Number.parseFloat(row.gpa) : null;

  return {
    id: row.id || newClientId(),
    user_id: userId,
    school: row.school,
    degree: row.degree || null,
    field_of_study: null,
    gpa: gpaNum != null && !Number.isNaN(gpaNum) ? gpaNum : null,
    location: null,
    graduation_date: displayDateToIso(row.graduationDate),
    description: null,
    display_order: displayOrder,
  };
}

export function projectFormRowToDbPayload(
  row: ProjectFormRow,
  userId: string,
  displayOrder: number
) {
  return {
    id: row.id || newClientId(),
    user_id: userId,
    project_name: row.name,
    description: row.description || null,
    technologies: row.technologies.length ? row.technologies : null,
    github_url: null,
    live_url: null,
    start_date: null,
    end_date: null,
    display_order: displayOrder,
  };
}

export function certificationFormRowToDbPayload(
  row: { id?: string; name: string },
  userId: string
) {
  return {
    id: row.id || newClientId(),
    user_id: userId,
    certification_name: row.name,
    issuing_organization: null,
    issue_date: null,
    expiration_date: null,
    credential_id: null,
    credential_url: null,
  };
}

export function formatGpaForForm(gpa: number | null | undefined): string {
  return formatGpa(gpa) || "";
}

export { isoDateToDisplay, displayDateToIso };
