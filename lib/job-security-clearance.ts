/** Standard display labels for required security clearance. */
export type SecurityClearanceLabel =
  | "TS/SCI + FS Poly"
  | "TS/SCI + CI Poly"
  | "TS/SCI"
  | "Top Secret"
  | "Secret"
  | "Confidential"
  | "Public Trust (High)"
  | "Public Trust (Moderate)"
  | "DOE Q"
  | "Eligible to obtain clearance"
  | "Active clearance required";

const NONE_PATTERNS = [
  /\bno\s+(?:active\s+)?clearance\s+(?:is\s+)?required\b/i,
  /\b(?:does|do)\s+not\s+require\s+(?:a\s+)?(?:security\s+)?clearance\b/i,
  /\bclearance\s*[:\-–]\s*(?:none|not required|n\/a)\b/i,
  /\bwithout\s+(?:a\s+)?(?:security\s+)?clearance\b/i,
];

const CLEARANCE_RULES: Array<{ pattern: RegExp; label: SecurityClearanceLabel }> = [
  {
    pattern:
      /\bts\s*\/\s*sci\b[^.\n]{0,80}\b(?:full[\s-]*scope|fs)\s*poly(?:graph)?\b|\b(?:full[\s-]*scope|fs)\s*poly(?:graph)?\b[^.\n]{0,80}\bts\s*\/\s*sci\b/i,
    label: "TS/SCI + FS Poly",
  },
  {
    pattern:
      /\bts\s*\/\s*sci\b[^.\n]{0,80}\b(?:ci|counter[\s-]*intelligence)\s*poly(?:graph)?\b|\b(?:ci|counter[\s-]*intelligence)\s*poly(?:graph)?\b[^.\n]{0,80}\bts\s*\/\s*sci\b/i,
    label: "TS/SCI + CI Poly",
  },
  { pattern: /\bts\s*\/\s*sci\b|\btop\s*secret\s*\/\s*sci\b/i, label: "TS/SCI" },
  {
    pattern: /\btop\s*secret\b(?!\s*\/\s*sci)|\bclearance[^.\n]{0,40}\btop\s*secret\b/i,
    label: "Top Secret",
  },
  {
    pattern:
      /\b(?:active\s+)?secret\s+clearance\b|\bclearance[^.\n]{0,30}\bsecret\b|\bsecret\s+level\s+clearance\b/i,
    label: "Secret",
  },
  {
    pattern: /\bconfidential\s+clearance\b|\bclearance[^.\n]{0,30}\bconfidential\b/i,
    label: "Confidential",
  },
  {
    pattern: /\bpublic\s+trust[^.\n]{0,40}\bhigh\b|\bhigh[\s-]risk\s+public\s+trust\b/i,
    label: "Public Trust (High)",
  },
  {
    pattern:
      /\bpublic\s+trust[^.\n]{0,40}\bmoderate\b|\bmoderate[\s-]risk\s+public\s+trust\b|\bpublic\s+trust\s+clearance\b/i,
    label: "Public Trust (Moderate)",
  },
  { pattern: /\bdoe\s+q\b|\bdepartment\s+of\s+energy\s+q\b/i, label: "DOE Q" },
  {
    pattern:
      /\b(?:must|ability|able)\s+to\s+(?:obtain|get|acquire)\s+(?:a\s+)?(?:security\s+)?clearance\b|\beligible\s+(?:to\s+)?(?:obtain|for)\s+(?:a\s+)?(?:security\s+)?clearance\b|\bclearance\s+eligibility\b/i,
    label: "Eligible to obtain clearance",
  },
  {
    pattern:
      /\bactive\s+(?:security\s+)?clearance\s+(?:is\s+)?required\b|\b(?:must|required\s+to)\s+(?:have|hold|possess)\s+(?:an?\s+)?active\s+(?:security\s+)?clearance\b|\bcurrent\s+(?:security\s+)?clearance\s+required\b/i,
    label: "Active clearance required",
  },
];

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Normalize AI or heuristic clearance text to a standard label when possible. */
export function normalizeSecurityClearance(value: unknown): string {
  const text = normalizeWhitespace(String(value ?? ""));
  if (!text) return "";

  const lower = text.toLowerCase();
  if (
    lower === "none" ||
    lower === "n/a" ||
    lower === "not required" ||
    lower.includes("no clearance")
  ) {
    return "";
  }

  for (const rule of CLEARANCE_RULES) {
    if (rule.pattern.test(text)) return rule.label;
  }

  if (/^ts\s*\/\s*sci/i.test(text)) return "TS/SCI";
  if (/top\s*secret/i.test(text)) return "Top Secret";
  if (/\bsecret\b/i.test(text) && !/top\s*secret/i.test(text)) return "Secret";
  if (/confidential/i.test(text)) return "Confidential";
  if (/public\s*trust/i.test(text)) return "Public Trust (Moderate)";

  return text.length <= 80 ? text : text.slice(0, 77) + "…";
}

/** Detect required security clearance from job page or JD text. */
export function extractSecurityClearanceFromText(text: string): string {
  const source = text.trim();
  if (!source) return "";

  for (const pattern of NONE_PATTERNS) {
    if (pattern.test(source)) return "";
  }

  for (const rule of CLEARANCE_RULES) {
    if (rule.pattern.test(source)) return rule.label;
  }

  const labeled = source.match(
    /\b(?:security\s+)?clearance\s*(?:required|level)?\s*[:\-–]\s*([^\n|•;]+)/i
  );
  if (labeled?.[1]) {
    return normalizeSecurityClearance(labeled[1]);
  }

  return "";
}

export function securityClearanceBadgeClass(): string {
  return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
}
