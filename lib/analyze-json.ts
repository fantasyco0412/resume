import { jsonrepair } from "jsonrepair";

export interface JsonParseDiagnostics {
  parseError: string;
  responseLength: number;
  cleanedLength: number;
  hasMarkdownFence: boolean;
  openBraces: number;
  closeBraces: number;
  openBrackets: number;
  closeBrackets: number;
  likelyTruncated: boolean;
  likelyCauses: string[];
  hints: string[];
  previewStart: string;
  previewEnd: string;
  repairAttempted?: boolean;
}

export function cleanJsonText(input: string): string {
  let cleaned = String(input || "").trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned
      .replace(/^```json\n?/g, "")
      .replace(/```\n?$/g, "")
      .replace(/```\n?/g, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```\n?/g, "")
      .replace(/```\n?$/g, "")
      .replace(/```\n?/g, "");
  }
  return cleaned.trim();
}

/** Strip trailing commas that models often leave before } or ]. */
function stripTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, "$1");
}

/**
 * Parse model JSON, applying light repairs when strict parse fails.
 * DeepSeek / OpenRouter often return balanced but slightly invalid JSON
 * (unescaped quotes, trailing commas).
 */
export function parseJsonLenient(input: string): {
  data: unknown;
  repaired: boolean;
} {
  const cleaned = cleanJsonText(input);
  try {
    return { data: JSON.parse(cleaned), repaired: false };
  } catch {
    // continue
  }

  const noTrailing = stripTrailingCommas(cleaned);
  try {
    return { data: JSON.parse(noTrailing), repaired: true };
  } catch {
    // continue
  }

  try {
    const repaired = jsonrepair(cleaned);
    return { data: JSON.parse(repaired), repaired: true };
  } catch {
    // continue
  }

  // Last resort: outermost object / array slice, then repair
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  const candidate = objMatch?.[0] || arrMatch?.[0];
  if (candidate) {
    try {
      return { data: JSON.parse(jsonrepair(candidate)), repaired: true };
    } catch {
      // fall through
    }
  }

  throw new SyntaxError("Unable to parse or repair model JSON");
}

export function diagnoseJsonParseFailure(
  raw: string,
  error: unknown,
  options?: { repairAttempted?: boolean }
): JsonParseDiagnostics {
  const response = String(raw || "");
  const cleaned = cleanJsonText(response);
  const parseError =
    error instanceof Error ? error.message : String(error || "Unknown parse error");
  const repairAttempted = options?.repairAttempted ?? true;

  const openBraces = (cleaned.match(/\{/g) || []).length;
  const closeBraces = (cleaned.match(/\}/g) || []).length;
  const openBrackets = (cleaned.match(/\[/g) || []).length;
  const closeBrackets = (cleaned.match(/\]/g) || []).length;

  const endsAbruptly =
    cleaned.length > 0 &&
    !cleaned.endsWith("}") &&
    !cleaned.endsWith("]") &&
    !cleaned.endsWith('"');

  const likelyTruncated =
    openBraces > closeBraces ||
    openBrackets > closeBrackets ||
    endsAbruptly;

  const likelyCauses: string[] = [];
  if (cleaned.length === 0) {
    likelyCauses.push("Model returned an empty response");
  }
  if (response.includes("```")) {
    likelyCauses.push("Response wrapped in markdown code fences");
  }
  if (likelyTruncated) {
    likelyCauses.push("Response looks truncated (unbalanced JSON or cut off mid-text)");
  }
  if (!likelyTruncated && cleaned.length > 0) {
    likelyCauses.push("JSON syntax error in model output (invalid commas, quotes, or structure)");
  }

  const hints: string[] = [];
  if (repairAttempted) {
    hints.push("Automatic JSON repair was tried and still failed.");
  } else {
    hints.push("Generation was stopped — no repair pass was applied.");
  }
  if (likelyTruncated) {
    hints.push("Try a shorter job description or fewer profile companies.");
    hints.push("For Deepseek, response may exceed token limit — try OpenAI or Claude.");
    hints.push("Check server logs for responseLength vs max_tokens setting.");
  } else {
    hints.push("Retry generation, or switch to OpenAI / Claude for more reliable JSON.");
  }
  if (response.includes("```")) {
    hints.push("Prompt may need stronger 'JSON only, no markdown' enforcement.");
  }
  hints.push("Inspect previewEnd below — truncation usually cuts off inside experience or skills.");

  return {
    parseError,
    responseLength: response.length,
    cleanedLength: cleaned.length,
    hasMarkdownFence: response.includes("```"),
    openBraces,
    closeBraces,
    openBrackets,
    closeBrackets,
    likelyTruncated,
    likelyCauses,
    hints,
    previewStart: response.slice(0, 400),
    previewEnd: response.slice(-400),
    repairAttempted,
  };
}

export function formatJsonParseErrorMessage(
  diagnostics: JsonParseDiagnostics,
  providerUsed?: string,
  modelUsed?: string
): string {
  const lines = [
    "AI returned invalid JSON. Resume generation was stopped.",
    "",
    `Provider: ${providerUsed || "unknown"}${modelUsed ? ` · ${modelUsed}` : ""}`,
    `Parse error: ${diagnostics.parseError}`,
    `Response length: ${diagnostics.responseLength} chars (cleaned: ${diagnostics.cleanedLength})`,
    `Braces: { ${diagnostics.openBraces} vs } ${diagnostics.closeBraces} · Brackets: [ ${diagnostics.openBrackets} vs ] ${diagnostics.closeBrackets}`,
    "",
    "Likely causes:",
    ...diagnostics.likelyCauses.map((cause) => `• ${cause}`),
    "",
    "What to try:",
    ...diagnostics.hints.map((hint) => `• ${hint}`),
    "",
    "--- Response start ---",
    diagnostics.previewStart,
    "",
    "--- Response end ---",
    diagnostics.previewEnd,
  ];

  return lines.join("\n");
}
