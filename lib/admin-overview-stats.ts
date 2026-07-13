import { formatCostUsd, sumCosts } from "@/lib/ai-usage";
import { countByField, countByJobSite, isInDateRange, type CountEntry } from "@/lib/dashboard-stats";
import type { InterviewRecord, ResumeRecord, UserLevel } from "@/lib/supabase/database.types";
import { DEFAULT_STORED_USER_LEVEL } from "@/lib/user-level";

export interface AdminUserBidEntry {
  userId: string;
  label: string;
  email: string;
  level: UserLevel;
  bidCount: number;
  interviewCount: number;
  aiCostUsd: number;
  bidsByModel: CountEntry[];
  bidsByJobsite: CountEntry[];
}
export interface AdminOverviewStats {
  totalBids: number;
  totalInterviews: number;
  totalAiCostUsd: number;  aiCostBreakdown: {
    extractUsd: number;
    generationUsd: number;
    atsUsd: number;
    answersUsd: number;
  };
  bidsByUser: AdminUserBidEntry[];
  bidsByModel: CountEntry[];
  bidsByJobsite: CountEntry[];
}

export interface AdminUserLabel {
  userId: string;
  email: string;
  fullName: string | null;
  level: UserLevel;
}
export interface AdminOverviewData {
  users: AdminUserLabel[];
  records: ResumeRecord[];
  interviews: InterviewRecord[];
}

export function filterInterviewsByDateRange(
  interviews: InterviewRecord[],
  from: string,
  to: string
): InterviewRecord[] {
  if (!from && !to) return interviews;
  return interviews.filter((row) => isInDateRange(row.interview_date, from, to));
}
function recordAiCostUsd(record: ResumeRecord): number {
  return sumCosts(
    record.extract_cost_usd,
    record.generation_cost_usd,
    record.ats_cost_usd,
    record.answers_cost_usd
  );
}

function userDisplayLabel(user: AdminUserLabel): string {
  return user.fullName?.trim() || user.email || user.userId;
}

export function computeAdminOverviewStats(
  records: ResumeRecord[],
  interviews: InterviewRecord[],
  users: AdminUserLabel[]
): AdminOverviewStats {
  const userById = new Map(users.map((user) => [user.userId, user]));
  const recordsByUser = new Map<string, ResumeRecord[]>();
  const bidsByUserMap = new Map<string, { bidCount: number; aiCostUsd: number }>();
  const interviewsByUserMap = new Map<string, number>();

  let extractUsd = 0;
  let generationUsd = 0;
  let atsUsd = 0;
  let answersUsd = 0;

  for (const interview of interviews) {
    interviewsByUserMap.set(
      interview.user_id,
      (interviewsByUserMap.get(interview.user_id) ?? 0) + 1
    );
  }

  for (const record of records) {    extractUsd += record.extract_cost_usd ?? 0;
    generationUsd += record.generation_cost_usd ?? 0;
    atsUsd += record.ats_cost_usd ?? 0;
    answersUsd += record.answers_cost_usd ?? 0;

    const userRecords = recordsByUser.get(record.user_id) ?? [];
    userRecords.push(record);
    recordsByUser.set(record.user_id, userRecords);

    const entry = bidsByUserMap.get(record.user_id) ?? { bidCount: 0, aiCostUsd: 0 };
    entry.bidCount += 1;
    entry.aiCostUsd += recordAiCostUsd(record);
    bidsByUserMap.set(record.user_id, entry);
  }

  const allUserIds = new Set([
    ...bidsByUserMap.keys(),
    ...interviewsByUserMap.keys(),
  ]);

  const bidsByUser: AdminUserBidEntry[] = Array.from(allUserIds)
    .map((userId) => {
      const user = userById.get(userId);
      const stats = bidsByUserMap.get(userId) ?? { bidCount: 0, aiCostUsd: 0 };
      const userRecords = recordsByUser.get(userId) ?? [];
      return {
        userId,
        label: user ? userDisplayLabel(user) : userId.slice(0, 8),
        email: user?.email ?? "",
        level: user?.level ?? DEFAULT_STORED_USER_LEVEL,
        bidCount: stats.bidCount,
        interviewCount: interviewsByUserMap.get(userId) ?? 0,
        aiCostUsd: stats.aiCostUsd,
        bidsByModel: countByField(userRecords, "model"),
        bidsByJobsite: countByJobSite(userRecords),
      };
    })
    .sort(
      (a, b) =>
        b.bidCount - a.bidCount ||
        b.interviewCount - a.interviewCount ||
        b.aiCostUsd - a.aiCostUsd
    );

  return {
    totalBids: records.length,
    totalInterviews: interviews.length,
    totalAiCostUsd: sumCosts(extractUsd, generationUsd, atsUsd, answersUsd),    aiCostBreakdown: {
      extractUsd,
      generationUsd,
      atsUsd,
      answersUsd,
    },
    bidsByUser,
    bidsByModel: countByField(records, "model"),
    bidsByJobsite: countByJobSite(records),
  };
}

export function formatAdminOverviewCost(totalUsd: number): string {
  return formatCostUsd(totalUsd);
}
