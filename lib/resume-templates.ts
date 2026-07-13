export const RESUME_TEMPLATES = [
  {
    id: "standard",
    label: "Standard",
    description: "Centered single column with section rules. Clean ATS-friendly layout.",
  },
  {
    id: "folio",
    label: "Folio",
    description: "Left-aligned single column. Serif headings, small-caps labels, thin rules.",
  },
] as const;

export type ResumeTemplateId = (typeof RESUME_TEMPLATES)[number]["id"];

export const DEFAULT_RESUME_TEMPLATE: ResumeTemplateId = "standard";

export function isValidResumeTemplate(id: string): id is ResumeTemplateId {
  return RESUME_TEMPLATES.some((t) => t.id === id);
}

/** Resolve saved template; migrates retired "ledger" picks to "folio". */
export function resolveResumeTemplate(saved: string | undefined): ResumeTemplateId {
  if (saved === "folio" || saved === "ledger") return "folio";
  if (saved && isValidResumeTemplate(saved)) return saved;
  return DEFAULT_RESUME_TEMPLATE;
}
