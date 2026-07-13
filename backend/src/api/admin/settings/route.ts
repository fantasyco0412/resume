import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { parseGeneralAppSettings } from "@/lib/general-app-settings";
import {
  getGeneralAppSettings,
  saveGeneralAppSettings,
} from "@/lib/supabase/services/app-settings";
import { pruneResumeHistoryWithoutInterviews } from "@/lib/supabase/services/prune-resume-history";
import { runManualResumePrune } from "@/lib/supabase/services/scheduled-prune";
import { AuthError } from "@/lib/supabase/server-client";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const settings = await getGeneralAppSettings();
    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/admin/settings]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = (await request.json()) as {
      pruneResumeNoInterviewMonths?: number;
      runPrune?: boolean;
    };

    const current = await getGeneralAppSettings();
    const next = parseGeneralAppSettings({
      ...current,
      ...(body.pruneResumeNoInterviewMonths !== undefined
        ? { prune_resume_no_interview_months: body.pruneResumeNoInterviewMonths }
        : {}),
    });

    const settings = await saveGeneralAppSettings(next);

    const shouldRunPrune = body.runPrune !== false;
    const pruneResult = shouldRunPrune
      ? await pruneResumeHistoryWithoutInterviews(settings.prune_resume_no_interview_months)
      : null;

    return NextResponse.json({ settings, pruneResult });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[PATCH /api/admin/settings]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { settings, pruneResult } = await runManualResumePrune();

    return NextResponse.json({ settings, pruneResult });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/admin/settings]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run cleanup" },
      { status: 500 }
    );
  }
}
