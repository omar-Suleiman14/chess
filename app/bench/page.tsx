"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shell/AppShell";
import { EngineController, ENGINE_BUILD, ENGINE_URL, type WorkerLike } from "@/lib/chess/engine/controller";

// P02 engine benchmark. Run on the real device (iPhone Safari, Android Chrome,
// desktop) and paste the JSON into issue #3. Nothing here is simulated.

const POSITIONS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
  "r2q1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R2QK2R w KQ - 0 9",
  "8/5pk1/6p1/8/3R4/6P1/5PK1/1r6 w - - 0 1",
];

type Result = Record<string, unknown>;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
}

async function measureFrames<T>(work: () => Promise<T>): Promise<{ value: T; maxFrameGapMs: number; frames: number }> {
  let last = performance.now();
  let maxGap = 0;
  let frames = 0;
  let running = true;
  const tick = (t: number) => {
    maxGap = Math.max(maxGap, t - last);
    last = t;
    frames++;
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const value = await work();
  running = false;
  return { value, maxFrameGapMs: Math.round(maxGap), frames };
}

export default function BenchPage() {
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const say = (line: string) => setLog((l) => [...l, line]);

  const run = async () => {
    setRunning(true);
    setLog([]);
    setResult(null);
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string } };
    const out: Result = {
      engine: ENGINE_BUILD,
      url: ENGINE_URL,
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemoryGb: nav.deviceMemory ?? null,
      connection: nav.connection?.effectiveType ?? null,
      online: navigator.onLine,
      date: new Date().toISOString(),
    };
    try {
      // 1. Worker start-up: first (possibly cold network/cache) then warm.
      const startups: number[] = [];
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        const engine = new EngineController(() => new Worker(ENGINE_URL) as unknown as WorkerLike);
        await engine.start();
        const ms = Math.round(performance.now() - t0);
        startups.push(ms);
        say(`worker ready #${i + 1}: ${ms} ms${i === 0 ? " (first in this tab)" : " (warm cache)"}`);
        engine.terminate();
      }
      out.workerReadyFirstMs = startups[0];
      out.workerReadyWarmMedianMs = median(startups.slice(1));

      // 2. Search latency/depth at the app's think presets.
      const engine = new EngineController(() => new Worker(ENGINE_URL) as unknown as WorkerLike);
      await engine.start();
      const presets = [400, 1200, 3500];
      const searches: Result[] = [];
      for (const movetime of presets) {
        const depths: number[] = [];
        const overshoot: number[] = [];
        let maxGap = 0;
        for (const fen of POSITIONS) {
          const { value, maxFrameGapMs } = await measureFrames(() => engine.search({ kind: "move", fen, movetimeMs: movetime }));
          depths.push(value.depth ?? 0);
          overshoot.push(Math.round(value.elapsedMs - movetime));
          maxGap = Math.max(maxGap, maxFrameGapMs);
        }
        const row = { movetimeMs: movetime, medianDepth: median(depths), medianOvershootMs: median(overshoot), maxMainThreadFrameGapMs: maxGap };
        searches.push(row);
        say(`movetime ${movetime}: depth ~${row.medianDepth}, overshoot ~${row.medianOvershootMs} ms, worst frame gap ${maxGap} ms`);
      }
      out.searches = searches;

      // 3. First Fatma reply in a fresh game (handshake already warm).
      const t0 = performance.now();
      await engine.search({ kind: "move", fen: POSITIONS[0], movetimeMs: 1200 });
      out.firstMoveStandardMs = Math.round(performance.now() - t0);
      engine.terminate();
      say(`first move (standard): ${out.firstMoveStandardMs} ms`);
    } catch (error) {
      out.error = error instanceof Error ? error.message : String(error);
      say(`error: ${out.error}`);
    }
    setResult(out);
    setRunning(false);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-12">
      <PageHeader title="Engine benchmark" />
      <div className="grid gap-4 px-4 text-sm">
        <p className="text-muted">
          Measures Stockfish 19 Lite on this device: worker start-up, search depth per thinking time, and whether the page stays smooth while Fatma thinks.
          Takes about 30 seconds. Keep this tab in front.
        </p>
        <button onClick={() => void run()} disabled={running} className="min-h-12 rounded-2xl bg-accent font-semibold text-accent-text disabled:opacity-50">
          {running ? "Running…" : "Run benchmark"}
        </button>
        <ol className="grid gap-1 font-mono text-xs" aria-live="polite">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
        {result && (
          <>
            <textarea readOnly value={JSON.stringify(result, null, 2)} rows={14} className="w-full rounded-xl bg-surface-2 p-3 font-mono text-xs" aria-label="Benchmark results JSON" />
            <button onClick={() => void navigator.clipboard?.writeText(JSON.stringify(result, null, 2))} className="min-h-11 rounded-2xl bg-surface shadow-[var(--shadow)]">
              Copy results
            </button>
          </>
        )}
      </div>
    </main>
  );
}
