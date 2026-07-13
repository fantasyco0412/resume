import "./load-env.js";
import express from "express";
import cors from "cors";
import { registerRoute } from "./next-adapter.js";

import { POST as analyzePost } from "./api/analyze/route.js";
import { POST as extractJobPost } from "./api/extract-job/route.js";
import { POST as answerQuestionsPost } from "./api/answer-questions/route.js";
import { POST as checkAtsPost } from "./api/check-ats/route.js";
import { POST as coverLetterPost } from "./api/cover-letter/route.js";
import { POST as generatePdfPost } from "./api/generate-pdf/route.js";
import { POST as generateCoverLetterPdfPost } from "./api/generate-cover-letter-pdf/route.js";
import { GET as directAiModelsGet } from "./api/direct-ai-models/route.js";
import { GET as openrouterModelsGet } from "./api/openrouter-models/route.js";
import { POST as savePdfPost } from "./api/save-pdf/route.js";
import { POST as saveResumePdfPost } from "./api/save-resume-pdf/route.js";
import { POST as saveTextPost } from "./api/save-text/route.js";
import { GET as adminOverviewGet } from "./api/admin/overview/route.js";
import { GET as adminUsersGet, POST as adminUsersPost, PATCH as adminUsersPatch, DELETE as adminUsersDelete } from "./api/admin/users/route.js";
import { GET as adminUserProfileGet } from "./api/admin/user-profile/route.js";
import { GET as adminSettingsGet, PATCH as adminSettingsPatch, POST as adminSettingsPost } from "./api/admin/settings/route.js";
import { startWeeklyCleanupScheduler } from "./weekly-cleanup-scheduler.js";
import { warmSupabaseJwksCache } from "@/lib/supabase/verify-access-token";

const app = express();
const port = Number(process.env.PORT || 4000);

const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: corsOrigin ? corsOrigin.split(",").map((s) => s.trim()) : true,
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

registerRoute(app, "post", "/api/analyze", analyzePost);
registerRoute(app, "post", "/api/extract-job", extractJobPost);
registerRoute(app, "post", "/api/answer-questions", answerQuestionsPost);
registerRoute(app, "post", "/api/check-ats", checkAtsPost);
registerRoute(app, "post", "/api/cover-letter", coverLetterPost);
registerRoute(app, "post", "/api/generate-pdf", generatePdfPost);
registerRoute(app, "post", "/api/generate-cover-letter-pdf", generateCoverLetterPdfPost);
registerRoute(app, "get", "/api/direct-ai-models", directAiModelsGet);
registerRoute(app, "get", "/api/openrouter-models", openrouterModelsGet);
registerRoute(app, "post", "/api/save-pdf", savePdfPost);
registerRoute(app, "post", "/api/save-resume-pdf", saveResumePdfPost);
registerRoute(app, "post", "/api/save-text", saveTextPost);
registerRoute(app, "get", "/api/admin/overview", adminOverviewGet);
registerRoute(app, "get", "/api/admin/users", adminUsersGet);
registerRoute(app, "post", "/api/admin/users", adminUsersPost);
registerRoute(app, "patch", "/api/admin/users", adminUsersPatch);
registerRoute(app, "delete", "/api/admin/users", adminUsersDelete);
registerRoute(app, "get", "/api/admin/user-profile", adminUserProfileGet);
registerRoute(app, "get", "/api/admin/settings", adminSettingsGet);
registerRoute(app, "patch", "/api/admin/settings", adminSettingsPatch);
registerRoute(app, "post", "/api/admin/settings", adminSettingsPost);

app.listen(port, () => {
  console.log(`Resume API backend listening on http://localhost:${port}`);
  startWeeklyCleanupScheduler();
  void warmSupabaseJwksCache();
}).setTimeout(300_000);
