"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { loadProfileForApp } from "@/lib/supabase/load-profile-for-app";
import { saveProfileForm } from "@/lib/supabase/services/save-profile";
import {
  RESUME_TEMPLATES,
  DEFAULT_RESUME_TEMPLATE,
  type ResumeTemplateId,
} from "@/lib/resume-templates";
import {
  profileBundleToFormState,
  createEmptyCompanyRow,
  newClientId,
  type ProfileFormState,
  type CompanyFormRow,
} from "@/lib/mappers/profile-form";
import { WORK_TYPES } from "@/lib/supabase/database.types";
import { isSupabaseNetworkError } from "@/lib/supabase/network";
import { ToastContainer, useToast } from "@/components/Toast";

function PlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function AddIconButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="btn-primary p-2.5" aria-label={label}>
      <PlusIcon />
    </button>
  );
}

function DeleteIconButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="btn-ghost p-2 text-red-600 hover:bg-red-50" aria-label={label}>
      <TrashIcon />
    </button>
  );
}

const emptyForm = (): ProfileFormState => ({
  fullName: "",
  phone: "",
  location: "",
  linkedin: "",
  summary: "",
  resumeTemplate: DEFAULT_RESUME_TEMPLATE,
  educations: [],
  certifications: [],
  projects: [],
  companies: [],
});

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const { toasts, showToast, dismissToast } = useToast();

  useEffect(() => {
    if (!authLoading && user?.id) {
      loadProfile();
    }
  }, [authLoading, user?.id]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const loaded = await loadProfileForApp(supabase, {
        email: user.email,
        userId: user.id,
      });
      setForm(profileBundleToFormState(loaded.bundle));
    } catch (error) {
      console.warn("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveProfileForm(user.id, form);
      showToast("success", "Profile saved successfully.");
      window.setTimeout(() => router.push("/dashboard"), 1200);
    } catch (error) {
      console.error("Error saving profile:", error);
      if (isSupabaseNetworkError(error)) {
        showToast(
          "error",
          "Could not save — Supabase is unreachable. Check your connection and try again."
        );
      } else {
        showToast("error", "Failed to save profile.");
      }
    } finally {
      setSaving(false);
    }
  };

  const updateCompany = (clientId: string, field: keyof CompanyFormRow, value: string | string[]) => {
    setForm((prev) => ({
      ...prev,
      companies: prev.companies.map((c) =>
        c.clientId === clientId ? { ...c, [field]: value } : c
      ),
    }));
  };

  if (authLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <main className="page-shell">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="mx-auto max-w-4xl">
        <div className="glass-panel overflow-hidden">
          <div className="page-header">
            <h2 className="page-title">Profile</h2>
            <p className="page-subtitle">Manage your default resume data and PDF template.</p>
          </div>

          <div className="space-y-6 p-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : (
              <>
                <section className="border-b pb-6">
                  <h3 className="section-title mb-4">Resume Output</h3>
                  <label className="field-label">PDF Template</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {RESUME_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, resumeTemplate: tpl.id as ResumeTemplateId }))}
                        className={`rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                          form.resumeTemplate === tpl.id
                            ? "border-blue-500 bg-blue-50/80 ring-2 ring-blue-200 shadow-sm"
                            : "border-slate-200 dark:border-slate-600/60 bg-white dark:bg-slate-800 hover:border-slate-300 hover:shadow-sm"
                        }`}
                      >
                        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">{tpl.label}</span>
                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-300">{tpl.description}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="border-b pb-6">
                  <h3 className="section-title mb-4">Contact & summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="field-label">Name</label>
                      <input type="text" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} className="input-shell" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                      <input type="email" value={user.email || ""} readOnly className="input-shell bg-slate-50 dark:bg-slate-800/90 text-slate-500 dark:text-slate-300" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                      <input type="text" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="input-shell" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
                      <input type="text" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} className="input-shell" />
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">LinkedIn</label>
                      <input type="url" value={form.linkedin} onChange={(e) => setForm((p) => ({ ...p, linkedin: e.target.value }))} className="input-shell" />
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Summary</label>
                      <textarea value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} rows={4} className="input-shell" />
                    </div>
                  </div>
                </section>

                <section className="border-b pb-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="section-title">Education</h3>
                    <AddIconButton
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          educations: [...p.educations, { clientId: newClientId(), degree: "", school: "", graduationDate: "", gpa: "" }],
                        }))
                      }
                      label="Add education"
                    />
                  </div>
                  {form.educations.map((edu) => (
                    <div key={edu.clientId} className="mb-4 rounded-lg border p-4">
                      <div className="mb-2 flex justify-end">
                        <DeleteIconButton
                          onClick={() => setForm((p) => ({ ...p, educations: p.educations.filter((e) => e.clientId !== edu.clientId) }))}
                          label="Remove education"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <input placeholder="Degree" value={edu.degree} onChange={(e) => setForm((p) => ({ ...p, educations: p.educations.map((row) => row.clientId === edu.clientId ? { ...row, degree: e.target.value } : row) }))} className="input-shell" />
                        <input placeholder="School" value={edu.school} onChange={(e) => setForm((p) => ({ ...p, educations: p.educations.map((row) => row.clientId === edu.clientId ? { ...row, school: e.target.value } : row) }))} className="input-shell" />
                        <input placeholder="Graduation Date (MM/YYYY)" value={edu.graduationDate} onChange={(e) => setForm((p) => ({ ...p, educations: p.educations.map((row) => row.clientId === edu.clientId ? { ...row, graduationDate: e.target.value } : row) }))} className="input-shell" />
                        <input placeholder="GPA (optional)" value={edu.gpa} onChange={(e) => setForm((p) => ({ ...p, educations: p.educations.map((row) => row.clientId === edu.clientId ? { ...row, gpa: e.target.value } : row) }))} className="input-shell" />
                      </div>
                    </div>
                  ))}
                </section>

                <section className="border-b pb-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="section-title">Certifications</h3>
                    <AddIconButton
                      onClick={() => setForm((p) => ({ ...p, certifications: [...p.certifications, { clientId: newClientId(), name: "" }] }))}
                      label="Add certification"
                    />
                  </div>
                  {form.certifications.map((cert) => (
                    <div key={cert.clientId} className="mb-2 flex gap-2">
                      <input placeholder="Certification name" value={cert.name} onChange={(e) => setForm((p) => ({ ...p, certifications: p.certifications.map((row) => row.clientId === cert.clientId ? { ...row, name: e.target.value } : row) }))} className="flex-1 rounded border px-3 py-2" />
                      <DeleteIconButton onClick={() => setForm((p) => ({ ...p, certifications: p.certifications.filter((c) => c.clientId !== cert.clientId) }))} label="Remove certification" />
                    </div>
                  ))}
                </section>

                <section className="border-b pb-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="section-title">Projects</h3>
                    <AddIconButton
                      onClick={() => setForm((p) => ({ ...p, projects: [...p.projects, { clientId: newClientId(), name: "", description: "", technologies: [] }] }))}
                      label="Add project"
                    />
                  </div>
                  {form.projects.map((project) => (
                    <div key={project.clientId} className="mb-4 rounded-lg border p-4">
                      <div className="mb-2 flex justify-end">
                        <DeleteIconButton onClick={() => setForm((p) => ({ ...p, projects: p.projects.filter((pr) => pr.clientId !== project.clientId) }))} label="Remove project" />
                      </div>
                      <input placeholder="Project Name" value={project.name} onChange={(e) => setForm((p) => ({ ...p, projects: p.projects.map((row) => row.clientId === project.clientId ? { ...row, name: e.target.value } : row) }))} className="input-shell" />
                      <textarea placeholder="Description" value={project.description} onChange={(e) => setForm((p) => ({ ...p, projects: p.projects.map((row) => row.clientId === project.clientId ? { ...row, description: e.target.value } : row) }))} rows={2} className="input-shell" />
                      <input placeholder="Technologies (comma-separated)" value={project.technologies.join(", ")} onChange={(e) => setForm((p) => ({ ...p, projects: p.projects.map((row) => row.clientId === project.clientId ? { ...row, technologies: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) } : row) }))} className="w-full rounded border px-3 py-2" />
                    </div>
                  ))}
                </section>

                <section className="border-b pb-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="section-title">Companies</h3>
                    <AddIconButton
                      onClick={() => setForm((p) => ({ ...p, companies: [...p.companies, createEmptyCompanyRow()] }))}
                      label="Add company"
                    />
                  </div>
                  {form.companies.length === 0 && (
                    <p className="mb-4 text-sm text-slate-500 dark:text-slate-300">No companies added yet. Click the + button to create one.</p>
                  )}
                  {form.companies.map((company, index) => (
                    <div key={company.clientId} className="mb-6 rounded-lg border border-slate-200 dark:border-slate-600/60 p-4 last:mb-0">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-base font-semibold text-gray-700">Company {index + 1}</h4>
                        <DeleteIconButton
                          onClick={() => setForm((p) => ({ ...p, companies: p.companies.filter((c) => c.clientId !== company.clientId) }))}
                          label={`Delete company ${index + 1}`}
                        />
                      </div>
                      <div className="mb-4 grid grid-cols-2 gap-4">
                        <input placeholder="Job Title" value={company.title} onChange={(e) => updateCompany(company.clientId, "title", e.target.value)} className="input-shell" />
                        <input placeholder="Company Name" value={company.company} onChange={(e) => updateCompany(company.clientId, "company", e.target.value)} className="input-shell" />
                        <input placeholder="Start Date (MM/YYYY)" value={company.startDate} onChange={(e) => updateCompany(company.clientId, "startDate", e.target.value)} className="input-shell" />
                        <input placeholder="End Date (MM/YYYY or Present)" value={company.endDate} onChange={(e) => updateCompany(company.clientId, "endDate", e.target.value)} className="input-shell" />
                      </div>
                      <div className="mb-4 grid grid-cols-2 gap-4">
                        <input placeholder="Company Location" value={company.location} onChange={(e) => updateCompany(company.clientId, "location", e.target.value)} className="input-shell" />
                        <select value={company.workType} onChange={(e) => updateCompany(company.clientId, "workType", e.target.value)} className="rounded border bg-white dark:bg-slate-800 px-3 py-2">
                          <option value="">Working type</option>
                          {WORK_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-700">Company Description</label>
                        <textarea value={company.description} onChange={(e) => updateCompany(company.clientId, "description", e.target.value)} rows={3} className="input-shell" placeholder="Enter a brief description about the company and your role" />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">Achievements (one per line)</label>
                        <textarea
                          value={company.achievements.join("\n")}
                          onChange={(e) => updateCompany(company.clientId, "achievements", e.target.value.split("\n").filter((l) => l.trim()))}
                          rows={6}
                          className="input-shell"
                          placeholder="Enter achievements, one per line"
                        />
                      </div>
                    </div>
                  ))}
                </section>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-600/50 px-6 py-4">
            <button onClick={() => router.push("/dashboard")} className="btn-soft">Cancel</button>
            <button onClick={handleSave} disabled={saving || loading} className="btn-primary px-4 py-2.5">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
