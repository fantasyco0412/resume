import { prepareJobDescriptionForDisplay } from "@/lib/normalize-job-description";

export type JobDescriptionBlock =
  | { type: "heading"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "paragraph"; text: string };

const KNOWN_SECTION =
  /^(?:responsibilities|requirements|qualifications|about(?: the)?(?: role| job| company| us)?|what you(?:'ll| will)|key responsibilities|nice to have|must have|preferred(?: qualifications)?|skills(?: and)?|experience|education|benefits|overview|job description|description|who you are|who we(?:'re| are) looking for|what we offer|your role|the role|summary|duties|minimum qualifications|preferred qualifications)$/i;

function isSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  if (trimmed.endsWith(":") && trimmed.length <= 80) return true;

  const withoutColon = trimmed.replace(/:$/, "").trim();
  if (KNOWN_SECTION.test(withoutColon)) return true;

  if (
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]/.test(trimmed) &&
    trimmed.length >= 3 &&
    trimmed.length <= 60
  ) {
    return true;
  }

  return false;
}

function headingText(line: string): string {
  return line.trim().replace(/:$/, "").trim();
}

function parseBullet(line: string): string | null {
  const match = line.match(/^(?:[•\-\*–—]|\d+[.)])\s+(.+)$/);
  return match ? match[1].trim() : null;
}

export function parseJobDescriptionBlocks(raw: string): JobDescriptionBlock[] {
  const text = prepareJobDescriptionForDisplay(raw);
  if (!text) return [];

  const blocks: JobDescriptionBlock[] = [];
  let paragraphBuffer: string[] = [];
  let bulletBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    blocks.push({ type: "paragraph", text: paragraphBuffer.join(" ") });
    paragraphBuffer = [];
  };

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    blocks.push({ type: "bullets", items: [...bulletBuffer] });
    bulletBuffer = [];
  };

  const flushAll = () => {
    flushBullets();
    flushParagraph();
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushAll();
      continue;
    }

    if (isSectionHeading(line)) {
      flushAll();
      blocks.push({ type: "heading", text: headingText(line) });
      continue;
    }

    const bullet = parseBullet(line);
    if (bullet) {
      flushParagraph();
      bulletBuffer.push(bullet);
      continue;
    }

    flushBullets();
    paragraphBuffer.push(line);
  }

  flushAll();
  return blocks;
}
