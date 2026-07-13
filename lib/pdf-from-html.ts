import fs from "fs";
import puppeteer, { type Browser, type LaunchOptions } from "puppeteer";

let pdfRenderChain: Promise<void> = Promise.resolve();

const LAUNCH_TIMEOUT_MS = 60_000;
const RENDER_TIMEOUT_MS = 90_000;

function pdfLog(step: string, detail?: Record<string, unknown> | string) {
  if (detail === undefined) {
    console.log(`[pdf] ${step}`);
    return;
  }
  if (typeof detail === "string") {
    console.log(`[pdf] ${step}: ${detail}`);
    return;
  }
  console.log(`[pdf] ${step}`, detail);
}

async function withPdfRenderLock<T>(label: string, fn: () => Promise<T>): Promise<T> {
  pdfLog("Waiting for render lock", label);
  const lockStarted = Date.now();
  const run = pdfRenderChain.then(fn, fn);
  pdfRenderChain = run.then(
    () => undefined,
    () => undefined
  );
  pdfLog("Render lock acquired", { label, waitMs: Date.now() - lockStarted });
  try {
    return await run;
  } finally {
    pdfLog("Render lock released", label);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function resolveChromeExecutablePath(): string | undefined {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const localAppData = process.env.LOCALAPPDATA || "";
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    localAppData ? `${localAppData}\\Google\\Chrome\\Application\\chrome.exe` : "",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return undefined;
}

async function getLaunchOptions(): Promise<LaunchOptions> {
  const executablePath = resolveChromeExecutablePath();
  const options: LaunchOptions = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--disable-extensions",
    ],
    timeout: LAUNCH_TIMEOUT_MS,
  };

  if (executablePath) {
    options.executablePath = executablePath;
    return options;
  }

  try {
    options.executablePath = await puppeteer.executablePath();
  } catch {
    throw new Error(
      "Chrome not found for PDF generation. Install Google Chrome or run " +
        "`npx puppeteer browsers install chrome`, or set PUPPETEER_EXECUTABLE_PATH in backend/.env.local"
    );
  }

  return options;
}

/** Launch a dedicated Chrome for one PDF render (avoids stuck shared-browser state). */
async function launchBrowser(): Promise<Browser> {
  const launchOptions = await getLaunchOptions();
  pdfLog("Launching Chrome", {
    executablePath: launchOptions.executablePath ?? "(bundled)",
    timeoutMs: LAUNCH_TIMEOUT_MS,
  });
  const browser = await withTimeout(
    puppeteer.launch(launchOptions),
    LAUNCH_TIMEOUT_MS,
    "Chrome launch"
  );
  pdfLog("Chrome launched", { connected: browser.connected });
  return browser;
}

export async function renderHtmlToPdfBase64(html: string): Promise<string> {
  return withPdfRenderLock("renderHtmlToPdfBase64", async () => {
    const started = Date.now();
    pdfLog("renderHtmlToPdfBase64 started", { htmlChars: html.length });

    const browser = await launchBrowser();
    pdfLog("Browser ready", { elapsedMs: Date.now() - started });

    try {
      pdfLog("Opening new page");
      const page = await browser.newPage();
      pdfLog("Page opened", { elapsedMs: Date.now() - started });

      try {
        pdfLog("Setting page content (domcontentloaded, 15s timeout)");
        await withTimeout(
          page.setContent(html, {
            waitUntil: "domcontentloaded",
            timeout: 15_000,
          }),
          20_000,
          "HTML render"
        );
        pdfLog("Page content set", { elapsedMs: Date.now() - started });

        pdfLog("Exporting PDF", { timeoutMs: RENDER_TIMEOUT_MS });
        const pdfBuffer = await withTimeout(
          page.pdf({
            format: "A4",
            margin: {
              top: "10mm",
              right: "10mm",
              bottom: "10mm",
              left: "10mm",
            },
            printBackground: true,
          }),
          RENDER_TIMEOUT_MS,
          "PDF export"
        );

        const pdfBytes = Buffer.from(pdfBuffer).length;
        pdfLog("PDF export complete", {
          pdfBytes,
          base64Chars: Buffer.from(pdfBuffer).toString("base64").length,
          elapsedMs: Date.now() - started,
        });
        return Buffer.from(pdfBuffer).toString("base64");
      } finally {
        pdfLog("Closing page");
        await page.close().catch((err) => {
          pdfLog("Page close failed", err instanceof Error ? err.message : String(err));
        });
      }
    } catch (error) {
      pdfLog("renderHtmlToPdfBase64 failed", {
        elapsedMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      pdfLog("Closing browser");
      await browser.close().catch((err) => {
        pdfLog("Browser close failed", err instanceof Error ? err.message : String(err));
      });
      pdfLog("Browser closed", { elapsedMs: Date.now() - started });
    }
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function generateCoverLetterPdfBase64(text: string): Promise<string> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    body {
      font-family: Georgia, "Times New Roman", Times, serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #111;
      margin: 0;
    }
    .letter {
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="letter">${escapeHtml(text)}</div>
</body>
</html>`;

  return renderHtmlToPdfBase64(html);
}

/** Smoke-test Chrome launch for PDF generation. */
export async function warmPdfBrowser(): Promise<void> {
  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    console.log("[pdf] Chrome ready");
  } catch (error) {
    console.warn(
      "[pdf] Chrome warm-up failed:",
      error instanceof Error ? error.message : error
    );
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
