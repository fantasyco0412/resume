/** Preserve line breaks; collapse only horizontal whitespace per line. */
export function normalizeJobDescription(value: unknown): string {
  let text = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, "•");

  const lines = text.split("\n").map((line) => line.replace(/[\t ]+/g, " ").trim());

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Best-effort reflow when extraction collapsed the JD into one line. */
export function reflowCollapsedJobDescription(text: string): string {
  const normalized = normalizeJobDescription(text);
  if (normalized.includes("\n")) return normalized;

  let reflowed = normalized;

  reflowed = reflowed.replace(
    /\s+(?=(?:Responsibilities|Requirements|Qualifications|About(?: the)?(?: Role| Job| Company| Us)?|What you(?:'ll| will)|Key responsibilities|Nice to have|Must have|Preferred qualifications|Skills(?: and)?|Experience|Education|Benefits|Overview|Job description|Description|Who you are|Who we're looking for|What we offer|Your role|The role|Summary)\s*:?\s)/gi,
    "\n\n"
  );

  reflowed = reflowed.replace(/\s+[•\-\*–—]\s+/g, "\n• ");
  reflowed = reflowed.replace(/\s+(\d+[.)])\s+/g, "\n$1 ");

  return normalizeJobDescription(reflowed);
}

export function prepareJobDescriptionForDisplay(value: unknown): string {
  return reflowCollapsedJobDescription(String(value ?? ""));
}
