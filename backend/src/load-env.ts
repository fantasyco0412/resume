import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Load env file; later files override earlier ones (non-empty values only). */
function mergeEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const parsed = dotenv.parse(fs.readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== "") {
      process.env[key] = value;
    }
  }
}

// Must run before any other backend imports (ESM hoists static imports).
// Least specific first, then backend/.env.local wins for non-empty keys.
mergeEnvFile(path.resolve(__dirname, "../../.env.local"));
mergeEnvFile(path.resolve(__dirname, "../.env.local"));
mergeEnvFile(path.resolve(__dirname, "../.env"));
