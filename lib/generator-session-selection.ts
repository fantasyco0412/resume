export type SelectableAnalysisSession = {
  id: string;
  result: unknown | null;
  extractError?: string | null;
  generateError?: string | null;
  downloadError?: string | null;
  atsError?: string | null;
};

export type SessionSelectionFilter = "all" | "generated" | "ungenerated" | "issue";

export function isGeneratedSession(session: SelectableAnalysisSession): boolean {
  return session.result != null;
}

export function isUngeneratedSession(session: SelectableAnalysisSession): boolean {
  return session.result == null && !sessionHasIssue(session);
}

export function sessionHasIssue(session: SelectableAnalysisSession): boolean {
  return Boolean(
    session.extractError ||
      session.generateError ||
      session.downloadError ||
      session.atsError
  );
}

export function filterSessionIds(
  sessions: SelectableAnalysisSession[],
  filter: SessionSelectionFilter
): string[] {
  switch (filter) {
    case "all":
      return sessions.map((session) => session.id);
    case "generated":
      return sessions.filter(isGeneratedSession).map((session) => session.id);
    case "ungenerated":
      return sessions.filter(isUngeneratedSession).map((session) => session.id);
    case "issue":
      return sessions.filter(sessionHasIssue).map((session) => session.id);
  }
}

export function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

export function idsToSet(ids: string[]): Set<string> {
  return new Set(ids);
}
