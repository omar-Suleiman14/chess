import { chromium } from "@playwright/test";
import { mkdir, writeFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";

const option = (name, fallback) => process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : fallback;
const label = option("label", "current");
const baseURL = option("url", "http://127.0.0.1:3100");
const runs = Number(option("runs", "5"));
const duration = Number(option("duration", "1000"));
const matrix = option("matrix", "current");
const backgroundOption = option("background", "minimal");
const backgrounds = backgroundOption === "all" ? ["minimal", "ambient", "off"] : [backgroundOption];
const scrollMs = Number(option("scroll-ms", "0"));
const reviewSteps = Number(option("review-steps", "0"));
const directory = `.cache/performance/${label}`;
await mkdir(directory, { recursive: true });
const presets = matrix === "baseline" ? [
  { name: "classic", appearance: "classic", glass: "off" },
  { name: "legacy-glass", appearance: "glass", glass: "on", glassQuality: "full" },
] : [
  { name: "classic", appearance: "classic", glass: "off" },
  { name: "expressive", appearance: "expressive", glass: "off" },
  ...["full", "balanced", "minimal"].map((glassQuality) => ({ name: `glass-${glassQuality}`, appearance: "glass", glass: "on", glassQuality })),
];
let executablePath = process.env.CHROME_PATH;
if (!executablePath) { try { await access("/usr/bin/chromium"); executablePath = "/usr/bin/chromium"; } catch { /* Playwright's installed browser. */ } }
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"], proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined });
const samples = [];
const percentile = (values, p) => values.length ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)] : null;
try {
  for (const preset of presets) for (const background of backgrounds) for (const evaluation of [false, true]) {
    for (let run = 0; run < runs; run++) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      await context.addInitScript(({ preset, evaluation, background }) => {
        localStorage.setItem("cbc.settings.v1", JSON.stringify({ glass: preset.glass, evalBar: evaluation, sound: false, motion: "full", experience: { appearance: preset.appearance, colorMode: "light", glassQuality: preset.glassQuality ?? "balanced", ambient: { mode: background } } }));
        const qa = window.__chessQA = { frames: [], longTasks: [], interactions: [], cls: 0, lcp: null, visibleMoveMs: null };
        let last;
        const tick = (now) => { if (last !== undefined) qa.frames.push(now - last); last = now; requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
        try { new PerformanceObserver((list) => list.getEntries().forEach((entry) => qa.longTasks.push(entry.duration))).observe({ type: "longtask", buffered: true }); } catch { /* Not supported. */ }
        try { new PerformanceObserver((list) => list.getEntries().forEach((entry) => { if (!entry.hadRecentInput) qa.cls += entry.value; })).observe({ type: "layout-shift", buffered: true }); } catch { /* Not supported. */ }
        try { new PerformanceObserver((list) => { qa.lcp = list.getEntries().at(-1)?.startTime ?? null; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch { /* Not supported. */ }
        let released;
        document.addEventListener("pointerup", () => { released = performance.now(); }, true);
        new MutationObserver(() => {
          if (released && qa.visibleMoveMs === null && document.querySelector("#sq-e4")?.getAttribute("aria-label")?.includes("white pawn")) requestAnimationFrame(() => { qa.visibleMoveMs = performance.now() - released; });
        }).observe(document, { subtree: true, attributes: true, attributeFilter: ["aria-label"] });
      }, { preset, evaluation, background });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");
      await cdp.send("Tracing.start", { categories: "devtools.timeline,blink.user_timing,toplevel,cc", transferMode: "ReturnAsStream" });
      const start = performance.now();
      await page.goto(baseURL, { waitUntil: "domcontentloaded" });
      await page.getByRole("grid").waitFor();
      const boardReadyMs = performance.now() - start;
      await page.waitForTimeout(duration);
      const drawerTimes = [];
      for (let i = 0; i < 10; i++) {
        const before = performance.now();
        await page.getByRole("button", { name: "Friends", exact: true }).click();
        await page.getByRole("dialog", { name: "Friends", exact: true }).waitFor();
        drawerTimes.push(performance.now() - before);
        await page.keyboard.press("Escape");
        await page.getByRole("dialog", { name: "Friends", exact: true }).waitFor({ state: "hidden" });
      }
      const e2 = await page.locator("#sq-e2").boundingBox();
      const e4 = await page.locator("#sq-e4").boundingBox();
      await page.mouse.move(e2.x + e2.width / 2, e2.y + e2.height / 2);
      await page.mouse.down();
      await page.mouse.move(e4.x + e4.width / 2, e4.y + e4.height / 2, { steps: 10 });
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelector("#sq-e4")?.getAttribute("aria-label")?.includes("white pawn"));
      await page.mouse.wheel(0, 250);
      if (scrollMs > 0) {
        const until = performance.now() + scrollMs;
        let direction = 1;
        while (performance.now() < until) { await page.mouse.wheel(0, 250 * direction); direction *= -1; await page.waitForTimeout(100); }
      }
      if (reviewSteps > 0) {
        await page.getByRole("grid").filter({ hasNotText: "unavailable" }).waitFor();
        const back = page.getByRole("button", { name: "Previous move (hold to rewind)", exact: true });
        const forward = page.getByRole("button", { name: "Next move (hold to fast-forward)", exact: true });
        for (let step = 0; step < reviewSteps; step++) { if (await back.isEnabled()) await back.click(); if (await forward.isEnabled()) await forward.click(); }
      }
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(duration);
      if (run === 0) await page.screenshot({ path: `${directory}/${preset.name}-${background}-eval-${evaluation}.png` });
      const result = await page.evaluate(() => window.__chessQA);
      const metrics = await cdp.send("Performance.getMetrics");
      const completion = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
      await cdp.send("Tracing.end");
      const { stream } = await completion;
      let trace = "";
      for (;;) { const chunk = await cdp.send("IO.read", { handle: stream }); trace += chunk.data; if (chunk.eof) break; }
      await cdp.send("IO.close", { handle: stream });
      const events = JSON.parse(trace).traceEvents;
      const main = events.find((event) => event.name === "thread_name" && event.args?.name === "CrRendererMain")?.tid;
      const times = (name) => events.filter((event) => event.name === name && event.ph === "X" && (main === undefined || event.tid === main)).map((event) => event.dur / 1000);
      const paint = times("Paint");
      const layout = times("Layout");
      if (run === 0 || option("traces", "first") === "all") await writeFile(`${directory}/${preset.name}-${background}-eval-${evaluation}-run-${run}.trace.json`, trace);
      const frames = result.frames.slice(5);
      samples.push({ preset: preset.name, background, evaluation, run, boardReadyMs, moveToRafMs: result.visibleMoveMs, drawerMedianMs: percentile(drawerTimes, 0.5), drawerP95Ms: percentile(drawerTimes, 0.95), frameGapP95Ms: percentile(frames, 0.95), rafGapsOver25msPercent: frames.length ? frames.filter((n) => n > 25).length / frames.length * 100 : null, paintMs: paint.reduce((a, b) => a + b, 0), paintP95Ms: percentile(paint, 0.95), layoutMs: layout.reduce((a, b) => a + b, 0), longTaskCount: result.longTasks.length, lcpLabMs: result.lcp, clsLab: result.cls, metrics: Object.fromEntries(metrics.metrics.filter((m) => ["JSHeapUsedSize", "TaskDuration", "LayoutDuration", "RecalcStyleDuration"].includes(m.name)).map((m) => [m.name, m.value])), errors });
      await context.close();
    }
    process.stdout.write(`${label}: ${preset.name}, ${background}, evaluation=${evaluation}, ${runs} runs complete\n`);
  }
  const metadata = { date: new Date().toISOString(), commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), browser: browser.version(), platform: os.platform(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(), viewport: "1366x768 then 1280x800", runs, durationMs: duration, backgrounds, scrollMs, reviewSteps, fixture: "Local signed-out build; real browser/WASM; no signed-in account", limitations: "rAF gaps proxy scheduling, not actual presented/dropped compositor frames. Lab LCP/CLS are not field p75. Node-side drawer timings include automation transport. GPU power/battery unavailable." };
  await writeFile(`${directory}/results.json`, JSON.stringify({ metadata, samples }, null, 2));
  const summary = presets.flatMap((preset) => backgrounds.flatMap((background) => [false, true].map((evaluation) => {
    const rows = samples.filter((sample) => sample.preset === preset.name && sample.background === background && sample.evaluation === evaluation);
    return { preset: preset.name, background, evaluation, runs: rows.length, moveP95Ms: percentile(rows.map((row) => row.moveToRafMs).filter(Number.isFinite), 0.95), paintMedianMs: percentile(rows.map((row) => row.paintMs), 0.5), drawerP95Ms: percentile(rows.map((row) => row.drawerP95Ms), 0.95), clsMedian: percentile(rows.map((row) => row.clsLab), 0.5), errors: rows.flatMap((row) => row.errors) };
  })));
  await writeFile(`${directory}/summary.json`, JSON.stringify({ metadata, summary }, null, 2));
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  if (samples.some((sample) => sample.errors.length)) process.exitCode = 1;
} finally { await browser.close(); }
