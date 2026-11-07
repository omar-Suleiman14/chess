"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/navigation/PrefetchLink";
import { PageHeader } from "@/components/shell/AppShell";
import { pickPuzzle, RUSH_MODES, RUSH_STRIKES, rushTarget, type Puzzle, type RushMode } from "@/lib/chess/puzzles";
import { rushBest, usePuzzleStats } from "@/lib/client/puzzleStats";
import { useSettings } from "@/lib/client/settings";
import { playSound } from "@/lib/client/sound";
import { PuzzlePlayer } from "./PuzzlePlayer";

type Attempt = { id: string; rating: number; solved: boolean };
type Run = { mode: RushMode; startedAt: number; endsAt: number | null; puzzle: Puzzle; round: number; seen: Set<string>; attempts: Attempt[]; over: boolean; best: boolean };

function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function PuzzleRush() {
  const { stats, saveRush, markSeen } = usePuzzleStats();
  const { settings } = useSettings();
  const [run, setRun] = useState<Run | null>(null);
  const [countdown, setCountdown] = useState<{ mode: RushMode; n: number } | null>(null);
  const [now, setNow] = useState(0);
  const ending = useRef(false);
  // PuzzlePlayer calls onNext from a timer, after onResult; read the latest run, not a stale render's.
  const latest = useRef<Run | null>(null);
  useEffect(() => { latest.current = run; });

  const strikes = run ? run.attempts.filter((a) => !a.solved).length : 0;
  const score = run ? run.attempts.filter((a) => a.solved).length : 0;
  const remaining = run?.endsAt ? run.endsAt - now : null;

  const finish = (final: Run) => {
    if (ending.current) return;
    ending.current = true;
    const solved = final.attempts.filter((a) => a.solved).length;
    setRun({ ...final, over: true });
    if (settings.sound) playSound("end", settings.volume);
    void saveRush(final.mode, solved).then((best) => setRun((r) => (r ? { ...r, best } : r)));
  };

  // 3-2-1 before the clock starts.
  useEffect(() => {
    if (!countdown) return;
    const t = setTimeout(() => {
      if (countdown.n > 1) { setCountdown({ ...countdown, n: countdown.n - 1 }); return; }
      const mode = RUSH_MODES.find((m) => m.id === countdown.mode)!;
      const startedAt = Date.now();
      const first = pickPuzzle(rushTarget(0), { exclude: new Set(stats.seen) })!;
      ending.current = false;
      setNow(startedAt);
      setRun({ mode: mode.id, startedAt, endsAt: mode.seconds ? startedAt + mode.seconds * 1000 : null, puzzle: first, round: 0, seen: new Set([first.id]), attempts: [], over: false, best: false });
      setCountdown(null);
      if (settings.sound) playSound("start", settings.volume);
    }, 650);
    return () => clearTimeout(t);
  }, [countdown, stats.seen, settings.sound, settings.volume]);

  // The clock: a light tick that also ends timed runs.
  useEffect(() => {
    if (!run || run.over || !run.endsAt) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const current = latest.current;
      if (current?.endsAt && t >= current.endsAt) finish(current);
    }, 200);
    return () => clearInterval(id);
  }, [run?.startedAt, run?.over, run?.endsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const onResult = ({ clean }: { clean: boolean }) => {
    const r = latest.current;
    if (!r || r.over) return;
    const updated = { ...r, attempts: [...r.attempts, { id: r.puzzle.id, rating: r.puzzle.rating, solved: clean }] };
    latest.current = updated;
    setRun(updated);
  };

  const onNext = () => {
    const r = latest.current;
    if (!r || r.over) return;
    markSeen(r.puzzle.id);
    const missed = r.attempts.filter((a) => !a.solved).length;
    if (missed >= RUSH_STRIKES) return finish(r);
    const next = pickPuzzle(rushTarget(r.attempts.length), { exclude: r.seen }) ?? r.puzzle;
    const updated = { ...r, puzzle: next, round: r.round + 1, seen: new Set([...r.seen, next.id]) };
    latest.current = updated;
    setRun(updated);
  };

  if (countdown) {
    return (
      <main id="main-content" className="grid min-h-dvh place-items-center">
        <p key={countdown.n} className="rush-count text-[120px] font-black tabular-nums" aria-live="assertive">{countdown.n}</p>
      </main>
    );
  }

  if (!run) {
    return (
      <main id="main-content" className="mx-auto min-h-dvh max-w-xl pb-12">
        <PageHeader title="Puzzle Rush" />
        <div className="grid gap-3 px-4">
          <p className="text-sm leading-6 text-muted">Puzzles start easy and get harder. Every solve is a point; a wrong move is a strike. Three strikes and the run is over.</p>
          {RUSH_MODES.map((m) => (
            <button key={m.id} onClick={() => setCountdown({ mode: m.id, n: 3 })} className="flex items-center justify-between gap-4 rounded-3xl bg-surface p-5 text-start shadow-[var(--shadow)] transition-transform active:scale-[.99]">
              <span>
                <span className="block text-xl font-bold">{m.label}</span>
                <span className="block text-sm text-muted">{m.detail}</span>
              </span>
              <span className="text-end">
                <span className="block text-xs uppercase tracking-wide text-muted">Best</span>
                <span className="block text-2xl font-black tabular-nums">{rushBest(stats, m.id)}</span>
              </span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  if (run.over) {
    return (
      <main id="main-content" className="mx-auto min-h-dvh max-w-xl pb-12">
        <PageHeader title="Puzzle Rush" />
        <div className="grid gap-4 px-4">
          <section className="result-pop rounded-3xl bg-surface p-6 text-center shadow-[var(--shadow)]" aria-live="polite">
            <p className="text-sm uppercase tracking-wide text-muted">{RUSH_MODES.find((m) => m.id === run.mode)!.label}</p>
            <p data-rush-score className="text-7xl font-black tabular-nums">{score}</p>
            <p className="mt-1 font-semibold">{run.best ? "New personal best!" : `Best ${Math.max(rushBest(stats, run.mode), score)}`}</p>
          </section>
          <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-8" aria-label="Puzzles in this run">
            {run.attempts.map((a, i) => (
              <li key={`${a.id}-${i}`}>
                <Link href={`/puzzles/${a.id}`} title={`Puzzle ${a.id}, rated ${a.rating}`} className={`grid h-11 place-items-center rounded-lg text-xs font-bold text-white ${a.solved ? "bg-[#81b64c]" : "bg-[#e05f4e]"}`}>{a.rating}</Link>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setCountdown({ mode: run.mode, n: 3 })} className="min-h-12 rounded-2xl bg-accent font-bold text-accent-text">Play again</button>
            <button onClick={() => setRun(null)} className="min-h-12 rounded-2xl bg-surface font-semibold shadow-[var(--shadow)]">Modes</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto min-h-dvh max-w-6xl px-3 pb-6">
      <div className="safe-top flex items-center justify-between gap-3 py-3">
        <button onClick={() => finish(run)} className="rounded-full bg-surface px-3 py-1.5 text-sm font-semibold shadow-[var(--shadow)]">End</button>
        <span data-rush-clock className={`text-3xl font-black tabular-nums ${remaining !== null && remaining < 10_000 ? "text-[#e05f4e]" : ""}`}>{remaining === null ? "∞" : formatClock(remaining)}</span>
        <span className="flex items-center gap-3">
          <span className="flex gap-1" aria-label={`${strikes} of ${RUSH_STRIKES} strikes`}>
            {Array.from({ length: RUSH_STRIKES }, (_, i) => (
              <span key={i} className={`grid h-6 w-6 place-items-center rounded-full text-xs font-black ${i < strikes ? "bg-[#e05f4e] text-white" : "bg-surface-2 text-muted"}`}>✕</span>
            ))}
          </span>
          <span data-rush-live-score className="min-w-10 rounded-xl bg-[#81b64c] px-2.5 py-1 text-center text-xl font-black tabular-nums text-white">{score}</span>
        </span>
      </div>
      <PuzzlePlayer key={run.round} puzzle={run.puzzle} mode="rush" onResult={onResult} onNext={onNext} />
    </main>
  );
}
