import { NextResponse } from "next/server";
import {
  getConfiguredDirectModels,
  resolveExtractModel,
  resolveExtractProvider,
} from "@/lib/ai-api";

export async function GET() {
  const extractProvider = resolveExtractProvider(false);
  return NextResponse.json({
    models: getConfiguredDirectModels(),
    extractProvider: extractProvider ?? "openai",
    extractModel: resolveExtractModel(false),
  });
}
