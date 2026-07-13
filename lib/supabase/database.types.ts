import type { ResumeTemplateId } from "@/lib/resume-templates";
import type { JobsiteId } from "@/lib/jobsites";
import type { JobWorkType } from "@/lib/prompts/job-page-extract";

export type WorkType = "Remote" | "Hybrid" | "Onsite";

export type BidStatus =
  | "applied"
  | "interviewing"
  | "rejected"
  | "offer"
  | "accepted";

export type InterviewCallType =
  | "intro"
  | "hr"
  | "live_coding"
  | "system_design"
  | "culture"
  | "final";

/** Stored on profiles.user_level — admin is env-based, not stored here. */
export type StoredUserLevel = "manager" | "bidder" | "member";

export type UserLevel = "admin" | StoredUserLevel;

/** Stored in profiles.default_settings — not separate columns. */
export interface DefaultSettings {
  resume_template?: ResumeTemplateId;
  default_jobsite?: JobsiteId;
  [key: string]: unknown;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  linkedin_url: string | null;
  summary: string | null;
  location: string | null;
  user_level: StoredUserLevel;
  admin_note: string | null;
  default_settings: DefaultSettings;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  summary?: string | null;
  location?: string | null;
  user_level?: StoredUserLevel;
  admin_note?: string | null;
  default_settings?: DefaultSettings;
}

export interface ProfileUpdate {
  full_name?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  summary?: string | null;
  location?: string | null;
  user_level?: StoredUserLevel;
  admin_note?: string | null;
  default_settings?: DefaultSettings;
}

export interface UserEducation {
  id: string;
  user_id: string;
  school: string;
  degree: string | null;
  field_of_study: string | null;
  gpa: number | null;
  location: string | null;
  graduation_date: string | null;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserSkill {
  id: string;
  user_id: string;
  skill_name: string;
  category: string | null;
  proficiency: string | null;
  display_order: number;
  created_at: string;
}

export interface UserCertification {
  id: string;
  user_id: string;
  certification_name: string;
  issuing_organization: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  credential_id: string | null;
  credential_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProject {
  id: string;
  user_id: string;
  project_name: string;
  description: string | null;
  technologies: string[] | null;
  github_url: string | null;
  live_url: string | null;
  start_date: string | null;
  end_date: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserCompany {
  id: string;
  user_id: string;
  company_name: string;
  title: string | null;
  company_location: string | null;
  work_type: WorkType | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  achievements: string[] | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ResumeRecord {
  id: string;
  user_id: string;
  ai_type: string | null;
  model: string | null;
  job_site: string | null;
  job_link: string | null;
  job_title: string | null;
  job_company: string | null;
  job_location: string | null;
  industry: string | null;
  security_clearance: string | null;
  salary: string | null;
  posted_date: string | null;
  job_types: JobWorkType[] | null;
  requires_travel: boolean | null;
  extract_cost_usd: number | null;
  generation_cost_usd: number | null;
  ats_cost_usd: number | null;
  answers_cost_usd: number | null;
  ats_score: number | null;
  jd_file_path: string | null;
  resume_file_path: string | null;
  bid_status: BidStatus | null;
  created_at: string;
  updated_at: string;
}

export interface InterviewRecord {
  id: string;
  user_id: string;
  resume_id: string | null;
  interview_date: string;
  caller: string | null;
  interviewer: string | null;
  call_type: InterviewCallType | null;
  video_name: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** Full profile payload used for resume generation and profile UI. */
export interface ProfileBundle {
  profile: Profile;
  educations: UserEducation[];
  skills: UserSkill[];
  certifications: UserCertification[];
  projects: UserProject[];
  companies: UserCompany[];
}

export const WORK_TYPES: WorkType[] = ["Remote", "Hybrid", "Onsite"];

export const DEFAULT_BID_STATUS: BidStatus = "applied";

export const BID_STATUSES: BidStatus[] = [
  "applied",
  "interviewing",
  "rejected",
  "offer",
  "accepted",
];

export const INTERVIEW_CALL_TYPES: InterviewCallType[] = [
  "intro",
  "hr",
  "live_coding",
  "system_design",
  "culture",
  "final",
];

export const JD_STORAGE_BUCKET = "jds";
export const RESUME_STORAGE_BUCKET = "resumes";
