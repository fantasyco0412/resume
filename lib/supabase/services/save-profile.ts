import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { ProfileFormState } from "@/lib/mappers/profile-form";
import { updateProfile } from "@/lib/supabase/services/profiles";
import { loadProfileBundleForUser } from "@/lib/supabase/load-profile-bundle";
import { syncEducations } from "@/lib/supabase/services/user-educations";
import { syncCertifications } from "@/lib/supabase/services/user-certifications";
import { syncProjects } from "@/lib/supabase/services/user-projects";
import { syncCompanies } from "@/lib/supabase/services/user-companies";

export async function saveProfileForm(
  userId: string,
  form: ProfileFormState,
  client: SupabaseClient = supabase
): Promise<void> {
  const bundle = await loadProfileBundleForUser(userId, client);

  await updateProfile(
    userId,
    {
      full_name: form.fullName.trim() || null,
      phone: form.phone.trim() || null,
      location: form.location.trim() || null,
      linkedin_url: form.linkedin.trim() || null,
      summary: form.summary.trim() || null,
      default_settings: {
        ...bundle.profile.default_settings,
        resume_template: form.resumeTemplate,
      },
    },
    client
  );

  await syncEducations(userId, form.educations, client);
  await syncCertifications(
    userId,
    form.certifications.map((cert) => ({ id: cert.id, name: cert.name })),
    client
  );
  await syncProjects(userId, form.projects, client);
  await syncCompanies(userId, form.companies, client);
}
