/**
 * Some models (esp. DeepSeek) return a JSON array of string fragments
 * instead of plain cover-letter prose. Normalize to readable text.
 */
export function normalizeCoverLetterText(
  raw: string,
  candidateName: string
): string {
  let text = String(raw || "").trim();
  if (!text) return text;

  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json|text|markdown)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  const unwrapped = unwrapJsonCoverLetter(text);
  if (unwrapped) {
    text = unwrapped;
  }

  text = text.replace(/\r\n/g, "\n").trim();
  // Collapse accidental JSON-ish leftovers
  text = text.replace(/^\[+|\]+$/g, "").trim();

  if (!/^Dear Hiring Team/i.test(text)) {
    text = `Dear Hiring Team,\n\n${text}`;
  } else {
    // Avoid duplicated greeting when model + post-process both added it
    text = text.replace(/^(Dear Hiring Team,?\s*)+/i, "Dear Hiring Team,\n\n");
  }

  if (!/Best Regards/i.test(text)) {
    text = `${text}\n\nBest Regards.\n\n${candidateName}`;
  }

  return text.trim();
}

function unwrapJsonCoverLetter(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{") && !trimmed.startsWith('"')) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return coverLetterFromJson(parsed);
  } catch {
    // Try extracting the outermost JSON array/object
    const arr = trimmed.match(/\[[\s\S]*\]/);
    const obj = trimmed.match(/\{[\s\S]*\}/);
    const candidate = arr?.[0] || obj?.[0];
    if (!candidate) return null;
    try {
      return coverLetterFromJson(JSON.parse(candidate));
    } catch {
      return null;
    }
  }
}

function coverLetterFromJson(parsed: unknown): string | null {
  if (typeof parsed === "string") {
    return parsed.trim() || null;
  }

  if (Array.isArray(parsed) && parsed.every((p) => typeof p === "string")) {
    const parts = parsed.map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    // Model often split on commas; rejoin with ", " then fix mid-token splits like "CI, /CD"
    let joined = parts.join(", ");
    joined = joined.replace(/,\s+(\/)/g, "$1");
    joined = joined.replace(/,\s+(\n)/g, "$1");
    return joined.trim() || null;
  }

  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    for (const key of ["coverLetter", "cover_letter", "letter", "text", "content", "body"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (Array.isArray(value) && value.every((p) => typeof p === "string")) {
        return coverLetterFromJson(value);
      }
    }
  }

  return null;
}
