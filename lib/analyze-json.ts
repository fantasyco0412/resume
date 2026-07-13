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

export function diagnoseJsonParseFailure(
  raw: string,
  error: unknown
): JsonParseDiagnostics {
  const response = String(raw || "");
  const cleaned = cleanJsonText(response);
  const parseError =
    error instanceof Error ? error.message : String(error || "Unknown parse error");

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

  const hints: string[] = [
    "Generation was stopped — no repair pass was applied.",
  ];
  if (likelyTruncated) {
    hints.push("Try a shorter job description or fewer profile companies.");
    hints.push("For Deepseek, response may exceed token limit — try OpenAI or Claude.");
    hints.push("Check server logs for responseLength vs max_tokens setting.");
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
