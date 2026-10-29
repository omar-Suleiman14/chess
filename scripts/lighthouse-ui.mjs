import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { mkdir, writeFile } from "node:fs/promises";

const directory = ".cache/performance/lighthouse";
await mkdir(directory, { recursive: true });
const chrome = await launch({ chromePath: process.env.CHROME_PATH ?? "/usr/bin/chromium", chromeFlags: ["--headless", "--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const rows = [];
  for (const formFactor of ["desktop", "mobile"]) {
    const result = await lighthouse(process.env.QA_URL ?? "http://127.0.0.1:3100", { port: chrome.port, output: "json", onlyCategories: ["performance", "accessibility"], formFactor, screenEmulation: formFactor === "desktop" ? { mobile: false, width: 1366, height: 768, deviceScaleFactor: 1, disabled: false } : undefined });
    if (!result) throw new Error("Lighthouse returned no report");
    await writeFile(`${directory}/${formFactor}.json`, result.report);
    const audits = result.lhr.audits;
    rows.push({ formFactor, performance: result.lhr.categories.performance.score, accessibility: result.lhr.categories.accessibility.score, lcpLabMs: audits["largest-contentful-paint"].numericValue, clsLab: audits["cumulative-layout-shift"].numericValue, tbtLabMs: audits["total-blocking-time"].numericValue, initialTransferBytes: audits["total-byte-weight"].numericValue });
    // Controlled lab regression ceiling, distinct from the stricter field goals.
    if (audits["cumulative-layout-shift"].numericValue > 0.05 || audits["total-blocking-time"].numericValue > 600) process.exitCode = 1;
  }
  await writeFile(`${directory}/summary.json`, JSON.stringify({ date: new Date().toISOString(), note: "Simulated lab throttling; these are not field p75 or presented-frame measurements.", rows }, null, 2));
  console.log(rows);
} finally { await chrome.kill(); }
