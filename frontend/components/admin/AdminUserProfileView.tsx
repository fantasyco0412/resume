"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ToastContainer, useToast } from "@/components/Toast";
import { adminFetch, readAdminError } from "@/lib/admin-api";
import { profileBundleToFormState } from "@/lib/mappers/profile-form";
import { parseAiSettings } from "@/lib/ai-settings";
import { getJobsiteLabel, resolveJobsite } from "@/lib/jobsites";
import { RESUME_TEMPLATES, resolveResumeTemplate } from "@/lib/resume-templates";
import type { AdminUserDetail, AdminUserRow } from "@/lib/supabase/services/admin-users";
import { userLevelBadgeClass, userLevelLabel } from "@/lib/user-level";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900 dark:text-slate-50">{value || "—"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-slate-200/80 pb-6 last:border-b-0 last:pb-0 dark:border-slate-600/60">
      <h3 className="section-title mb-4">{title}</h3>
      {children}
    </section>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>;
}

export default function AdminUserProfileView({ detail }: { detail: AdminUserDetail }) {
  const { toasts, showToast, dismissToast } = useToast();
  const [adminNote, setAdminNote] = useState(detail.bundle.profile.admin_note ?? "");
  const [savedNote, setSavedNote] = useState(detail.bundle.profile.admin_note ?? "");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    const note = detail.bundle.profile.admin_note ?? "";
    setAdminNote(note);
    setSavedNote(note);
  }, [detail.id, detail.bundle.profile.admin_note]);

  const form = profileBundleToFormState(detail.bundle);
  const templateId = resolveResumeTemplate(
    detail.bundle.profile.default_settings?.resume_template as string | undefined
  );
  const templateLabel =
    RESUME_TEMPLATES.find((template) => template.id === templateId)?.label ?? templateId;
  const jobsiteLabel = getJobsiteLabel(
    resolveJobsite(detail.bundle.profile.default_settings?.default_jobsite as string | undefined)
  );
  const aiSettings = parseAiSettings(detail.bundle.profile.default_settings);
  const defaultSettingsJson = JSON.stringify(detail.bundle.profile.default_settings ?? {}, null, 2);

  const handleSaveNote = async () => {
    if (adminNote.trim() === savedNote.trim()) return;

    setSavingNote(true);

    try {
      const response = await adminFetch("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({
          userId: detail.id,
          adminNote,
        }),
      });

      if (!response.ok) {
        throw new Error(await readAdminError(response));
      }

      const updated = (await response.json()) as AdminUserRow;
      const nextNote = updated.adminNote ?? "";
      setAdminNote(nextNote);
      setSavedNote(nextNote);
      showToast("success", "Note saved.");
    } catch (saveError) {
      console.error("Failed to save admin note:", saveError);
      showToast(
        "error",
        saveError instanceof Error ? saveError.message : "Failed to save note"
      );
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/users"
            className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
          >
            ← Back to users
          </Link>
          <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">
            {form.fullName || detail.email || "User profile"}
          </h2>
          {form.fullName && detail.email ? (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{detail.email}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 font-medium ${userLevelBadgeClass(detail.level)}`}
          >
            {userLevelLabel(detail.level)}
          </span>
          <span className="badge">{detail.resumeCount} bids</span>
          <span className="badge">{detail.interviewCount} interviews</span>
        </div>
      </div>

      <div className="glass-panel space-y-6 p-6">
        <Section title="Account">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" value={detail.email} />
            <Field label="Full name" value={form.fullName} />
            <Field label="User level" value={userLevelLabel(detail.level)} />
            <Field label="Joined" value={formatDate(detail.authCreatedAt)} />
            <Field label="Last sign-in" value={formatDate(detail.lastSignInAt)} />
            <Field label="Profile updated" value={formatDate(detail.bundle.profile.updated_at)} />
          </dl>
        </Section>

        <Section title="Admin note">
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Internal note visible only to admins. Not shown to the user.
          </p>
          <textarea
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            rows={4}
            placeholder="Add an internal note about this user…"
            className="filter-control resize-y"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => void handleSaveNote()}
              disabled={savingNote}
              className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingNote ? "Saving…" : "Save note"}
            </button>
          </div>
        </Section>

        <Section title="Contact & summary">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" value={form.phone} />
            <Field label="Location" value={form.location} />
            <Field
              label="LinkedIn"
              value={
                form.linkedin ? (
                  <a
                    href={form.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline dark:text-blue-300"
                  >
                    {form.linkedin}
                  </a>
                ) : (
                  "—"
                )
              }
              className="sm:col-span-2"
            />
            <Field label="Summary" value={form.summary} className="sm:col-span-2" />
          </dl>
        </Section>

        <Section title="Preferences">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Resume template" value={templateLabel} />
            <Field label="Default jobsite" value={jobsiteLabel} />
            <Field label="Use OpenRouter" value={aiSettings.use_openrouter ? "Yes" : "No"} />
            <Field
              label="Auto ATS after resume"
              value={aiSettings.auto_ats_after_resume ? "Yes" : "No"}
            />
          </dl>
        </Section>

        <Section title="Work experience">
          {form.companies.length === 0 ? (
            <EmptyBlock message="No companies added." />
          ) : (
            <div className="space-y-4">
              {form.companies.map((company) => (
                <div
                  key={company.clientId}
                  className="rounded-xl border border-slate-200/90 p-4 dark:border-slate-600/60"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {company.title || "Untitled role"}
                    {company.company ? ` · ${company.company}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {[company.startDate, company.endDate].filter(Boolean).join(" – ") || "—"}
                    {company.location ? ` · ${company.location}` : ""}
                    {company.workType ? ` · ${company.workType}` : ""}
                  </p>
                  {company.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                      {company.description}
                    </p>
                  ) : null}
                  {company.achievements.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
                      {company.achievements.map((item, index) => (
                        <li key={`${company.clientId}-achievement-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Education">
          {form.educations.length === 0 ? (
            <EmptyBlock message="No education added." />
          ) : (
            <div className="space-y-3">
              {form.educations.map((education) => (
                <div
                  key={education.clientId}
                  className="rounded-xl border border-slate-200/90 p-4 dark:border-slate-600/60"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {education.degree || "Degree"}
                    {education.school ? ` · ${education.school}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {[education.graduationDate, education.gpa ? `GPA ${education.gpa}` : ""]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Certifications">
          {form.certifications.length === 0 ? (
            <EmptyBlock message="No certifications added." />
          ) : (
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              {form.certifications.map((certification) => (
                <li key={certification.clientId}>{certification.name || "—"}</li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Projects">
          {form.projects.length === 0 ? (
            <EmptyBlock message="No projects added." />
          ) : (
            <div className="space-y-4">
              {form.projects.map((project) => (
                <div
                  key={project.clientId}
                  className="rounded-xl border border-slate-200/90 p-4 dark:border-slate-600/60"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {project.name || "Untitled project"}
                  </p>
                  {project.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                      {project.description}
                    </p>
                  ) : null}
                  {project.technologies.length > 0 ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {project.technologies.join(", ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Skills">
          {detail.bundle.skills.length === 0 ? (
            <EmptyBlock message="No skills added." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {detail.bundle.skills.map((skill) => (
                <span
                  key={skill.id}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 dark:border-slate-600/60 dark:bg-slate-800/90 dark:text-slate-200"
                >
                  {skill.skill_name}
                  {skill.category ? ` · ${skill.category}` : ""}
                  {skill.proficiency ? ` (${skill.proficiency})` : ""}
                </span>
              ))}
            </div>
          )}
        </Section>

        <Section title="Raw default settings">
          <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950/95 p-4 text-xs text-slate-100">
            {defaultSettingsJson}
          </pre>
        </Section>
      </div>
    </div>
  );
}
