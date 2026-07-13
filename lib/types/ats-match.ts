import { extractFirstJson } from "@/lib/ai-provider";
import { cleanJsonText } from "@/lib/analyze-json";

export interface AtsMatchResult {
  score: number;
  summary: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  improvements: string[];
  formattingNotes: string[];
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseScore(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (match) {
      return Math.max(0, Math.min(100, Math.round(Number(match[0]))));
    }
  }
  return 0;
}

function tryParseJsonValue(value: unknown): unknown | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const attempts = [
    trimmed,
    cleanJsonText(trimmed),
  ];

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // continue
    }
    const extracted = extractFirstJson(attempt);
    if (extracted) return extracted;
  }

  return null;
}

/** Unwrap common nested response shapes from LLMs. */
export function unwrapAtsPayload(raw: unknown): Record<string, unknown> {
  const normalized = tryParseJsonValue(raw);
  let current: unknown = normalized ?? raw;

  for (let depth = 0; depth < 4; depth++) {
    const parsed = tryParseJsonValue(current);
    if (parsed) current = parsed;

    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return {};
    }

    const obj = current as Record<string, unknown>;
    const hasScore =
      obj.score !== undefined ||
      obj.matchScore !== undefined ||
      obj.match_score !== undefined ||
      obj.atsScore !== undefined;
    const hasSummary =
      typeof obj.summary === "string" ||
      typeof obj.assessment === "string" ||
      typeof obj.overall === "string";
    const hasKeywordLists =
      Array.isArray(obj.matchedKeywords) ||
      Array.isArray(obj.matched_keywords) ||
      Array.isArray(obj.missingKeywords) ||
      Array.isArray(obj.missing_keywords);

    if (hasScore || hasSummary || hasKeywordLists) {
      return obj;
    }

    const nestedKey = ["ats", "result", "analysis", "data", "response"].find(
      (key) => obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])
    );
    if (!nestedKey) return obj;
    current = obj[nestedKey];
  }

  return current && typeof current === "object" && !Array.isArray(current)
    ? (current as Record<string, unknown>)
    : {};
}

export function parseAtsMatchResult(raw: unknown): AtsMatchResult {
  const data = unwrapAtsPayload(raw);

  const score = parseScore(
    data.score ?? data.matchScore ?? data.match_score ?? data.atsScore ?? data.rating
  );

  let summary = String(
    data.summary ?? data.assessment ?? data.overall ?? data.overallAssessment ?? ""
  ).trim();

  // Some models put the full JSON object in the summary field as a string.
  if (summary.startsWith("{") && summary.includes('"score"')) {
    const nested = tryParseJsonValue(summary);
    if (nested) {
      const reparsed = parseAtsMatchResult(nested);
      if (!isEmptyAtsMatchResult(reparsed)) {
        return reparsed;
      }
    }
  }

  return {
    score,
    summary,
    matchedKeywords: toStringList(
      data.matchedKeywords ??
        data.matched_keywords ??
        data.keywordsMatched ??
        data.matched
    ),
    missingKeywords: toStringList(
      data.missingKeywords ??
        data.missing_keywords ??
        data.keywordsMissing ??
        data.missing
    ),
    strengths: toStringList(data.strengths ?? data.pros ?? data.positives),
    improvements: toStringList(
      data.improvements ?? data.suggestions ?? data.cons ?? data.gaps
    ),
    formattingNotes: toStringList(
      data.formattingNotes ?? data.formatting_notes ?? data.formatNotes
    ),
  };
}

export function isEmptyAtsMatchResult(result: AtsMatchResult): boolean {
  const summaryLooksLikeJson =
    result.summary.startsWith("{") && result.summary.includes('"score"');

  return (
    summaryLooksLikeJson ||
    (!result.summary &&
      result.score === 0 &&
      result.matchedKeywords.length === 0 &&
      result.missingKeywords.length === 0 &&
      result.strengths.length === 0 &&
      result.improvements.length === 0 &&
      result.formattingNotes.length === 0)
  );
}

export function collectAtsCandidates(aiResp: {
  json?: unknown;
  text?: string;
  raw?: unknown;
}): unknown[] {
  const seen = new Set<unknown>();
  const candidates: unknown[] = [];

  const push = (value: unknown) => {
    if (value === null || value === undefined) return;

    const parsed = tryParseJsonValue(value) ?? value;
    if (seen.has(parsed)) return;
    seen.add(parsed);
    candidates.push(parsed);

    if (parsed !== value) {
      if (!seen.has(value)) {
        seen.add(value);
        candidates.push(value);
      }
    }
  };

  // Skip raw chat.completion wrappers (bad fallback from older DeepSeek handling).
  if (aiResp.json && typeof aiResp.json === "object" && aiResp.json !== null) {
    const obj = aiResp.json as Record<string, unknown>;
    if (obj.object !== "chat.completion") {
      push(aiResp.json);
    }
  } else if (aiResp.json) {
    push(aiResp.json);
  }

  const text = String(aiResp.text || "").trim();
  if (text && !text.includes('"object":"chat.completion"')) {
    push(text);
    push(extractFirstJson(text));
    try {
      push(JSON.parse(cleanJsonText(text)));
    } catch {
      // ignore
    }
  }

  if (aiResp.raw && typeof aiResp.raw === "object" && aiResp.raw !== null) {
    const rawAny = aiResp.raw as {
      choices?: Array<{ message?: { content?: string; reasoning_content?: string }; text?: string }>;
    };
    const message = rawAny.choices?.[0]?.message;
    const fromRaw = String(
      message?.content ||
        message?.reasoning_content ||
        rawAny.choices?.[0]?.text ||
        ""
    ).trim();
    if (fromRaw) {
      push(fromRaw);
      push(extractFirstJson(fromRaw));
    }
  }

  return candidates;
}

export function parseAtsFromAiResponse(aiResp: {
  json?: unknown;
  text?: string;
  raw?: unknown;
}): AtsMatchResult {
  for (const candidate of collectAtsCandidates(aiResp)) {
    const parsed = parseAtsMatchResult(candidate);
    if (!isEmptyAtsMatchResult(parsed)) {
      return parsed;
    }
  }

  return parseAtsMatchResult(null);
}
