"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Board, type LastMove } from "@/components/chess/Board";
import { EvalBar } from "@/components/chess/EvalBar";
import { toast } from "@/lib/client/toast";
import dynamic from "next/dynamic";
// The editor is only needed after "Custom…" / "Set up position…": load it then, not with the board.
const PositionEditor = dynamic(() => import("@/components/chess/PositionEditor").then((m) => m.PositionEditor), { ssr: false, loading: () => <p className="p-6 text-sm text-muted" role="status">Opening the position editor…</p> });
import { PageHeader } from "@/components/shell/AppShell";
import { SearchCancelled } from "@/lib/chess/engine/controller";
import { formatScore, type WhiteScore } from "@/lib/chess/engine/uci";
import { applyUci, checkFen, DEFAULT_POSITION, kingSquare, positionStatus, sideToMove, type Color, type Square } from "@/lib/chess/rules";
import { getEngine, supportsEngine } from "@/lib/client/engine";
import { useSettings } from "@/lib/client/settings";
import { playSound, unlockAudio, type SoundName } from "@/lib/client/sound";

type Line = { multipv: number; score: WhiteScore; depth?: number; pv: string[] };

const LINES = 3;
const THINK_MS = 4000;

function soundFor(applied: NonNullable<ReturnType<typeof applyUci>>): SoundName {
  if (applied.checkmate) return "checkmate";
  if (applied.check) return "check";
  if (applied.promotion) return "promote";
  if (applied.flags.includes("k") || applied.flags.includes("q")) return "castle";
  return applied.captured ? "capture" : "move";
}

/** SAN for a principal variation, numbered like a move list. */
function pvSan(fen: string, pv: string[], limit = 8): string {
  const parts: string[] = [];
  let position = fen;
  for (const uci of pv.slice(0, limit)) {
    const applied = applyUci(position, uci);
    if (!applied) break;
    const [, turn, , , , full] = position.split(" ");
    if (turn === "w") parts.push(`${full}.`);
    else if (parts.length === 0) parts.push(`${full}…`);
    parts.push(applied.san);
    position = applied.fen;
  }
  return parts.join(" ");
}

/** Free analysis: both sides move, Stockfish shows its top lines. */
export function AnalysisBoard({ initialFen }: { initialFen: string | null }) {
  const { settings, reducedMotion } = useSettings();
  const start = useMemo(() => {
    const checked = initialFen ? checkFen(initialFen) : null;
    return checked?.ok ? checked.fen : DEFAULT_POSITION;
  }, [initialFen]);
  const [root, setRoot] = useState(start);
  const [moves, setMoves] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [orientation, setOrientation] = useState<Color>(sideToMove(start));
  const [engineOn, setEngineOn] = useState(true);
  const [lines, setLines] = useState<{ fen: string; list: Line[] }>({ fen: "", list: [] });
  const [fenInput, setFenInput] = useState("");
  const [fenError, setFenError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Every position along the line, so stepping back and forth is instant.
  const path = useMemo(() => {
    const out: Array<{ fen: string; san?: string; last?: LastMove }> = [{ fen: root }];
    let fen = root;
    moves.forEach((uci, i) => {
      const applied = applyUci(fen, uci);
      if (!applied) return;
      fen = applied.fen;
      out.push({ fen, san: applied.san, last: { from: applied.from, to: applied.to, key: `m${i}` } });
    });
    return out;
  }, [root, moves]);
  const current = path[Math.min(cursor, path.length - 1)];
  const fen = current.fen;
  const status = useMemo(() => positionStatus(fen), [fen]);
  const turn = sideToMove(fen);

  // Engine lines for the shown position.
  useEffect(() => {
    if (!engineOn || !supportsEngine() || status.over) return;
    const abort = new AbortController();
    const found = new Map<number, Line>();
    let painted = 0;
    const paint = () => setLines({ fen, list: [...found.values()].sort((a, b) => a.multipv - b.multipv) });
    getEngine()
      .search({
        kind: "eval",
        fen,
        movetimeMs: THINK_MS,
        multiPv: LINES,
        signal: abort.signal,
        onInfo: (info) => {
          if (!info.pv.length) return;
          found.set(info.multipv, { multipv: info.multipv, score: info.score, depth: info.depth, pv: info.pv });
          const now = performance.now();
          if (now - painted > 200) { painted = now; paint(); }
        },
      })
      .then(paint)
      .catch((error) => { if (!(error instanceof SearchCancelled)) paint(); });
    return () => abort.abort();
  }, [fen, engineOn, status.over]);

  const shown = lines.fen === fen ? lines.list : [];
  const best = shown[0];

  const play = useCallback((uci: string) => {
    const applied = applyUci(fen, uci);
    if (!applied) return false;
    unlockAudio();
    if (settings.sound) playSound(soundFor(applied), settings.volume);
    // Playing from an earlier move replaces the rest of the line.
    if (moves[cursor] === uci) { setCursor(cursor + 1); return true; }
    setMoves([...moves.slice(0, cursor), uci]);
    setCursor(cursor + 1);
    return true;
  }, [fen, moves, cursor, settings.sound, settings.volume]);

  const go = useCallback((index: number) => setCursor(Math.max(0, Math.min(path.length - 1, index))), [path.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); go(cursor - 1); }
      else if (event.key === "ArrowRight") { event.preventDefault(); go(cursor + 1); }
      else if (event.key === "Home") go(0);
      else if (event.key === "End") go(path.length - 1);
      else if (event.key === "f") setOrientation((o) => (o === "w" ? "b" : "w"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, go, path.length]);

  const applyPosition = (next: string) => {
    setFenError(null);
    setRoot(next);
    setMoves([]);
    setCursor(0);
    setOrientation(sideToMove(next));
  };

  const loadFen = () => {
    const checked = checkFen(fenInput);
    if (!checked.ok) { setFenError(checked.error); return; }
    applyPosition(checked.fen);
    toast("Position loaded");
  };

  const reset = () => { setRoot(DEFAULT_POSITION); setMoves([]); setCursor(0); setOrientation("w"); };

  const rows: Array<{ n: number; white?: { san: string; ply: number }; black?: { san: string; ply: number } }> = [];
  path.slice(1).forEach((p, i) => {
    const ply = i + 1;
    const before = path[i].fen;
    const isWhite = sideToMove(before) === "w";
    const n = Number(before.split(" ")[5]);
    let row = rows[rows.length - 1];
    if (!row || row.n !== n || (isWhite && row.white)) { row = { n }; rows.push(row); }
    if (isWhite) row.white = { san: p.san!, ply }; else row.black = { san: p.san!, ply };
  });

  const resultText = status.over ? (status.reason === "checkmate" ? `Checkmate · ${turn === "w" ? "Black" : "White"} wins` : "Draw") : null;
  const navButton = "grid min-h-11 place-items-center rounded-xl bg-surface-2 text-lg font-bold disabled:opacity-35";

  return (
    <main id="main-content" className="mx-auto min-h-dvh max-w-6xl px-3 pb-32 sm:pb-8">
      <PageHeader title="Analysis" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex w-full gap-2">
          {engineOn && (
            <div className="hidden shrink-0 sm:flex">
              <EvalBar score={best?.score ?? null} orientation={orientation} depth={best?.depth} reducedMotion={reducedMotion} stale={!best} />
            </div>
          )}
          <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-200px),720px)]">
            {engineOn && (
              <div className="mb-2 grid gap-1.5 sm:hidden" data-engine-header>
                <EvalBar horizontal score={best?.score ?? null} orientation={orientation} depth={best?.depth} reducedMotion={reducedMotion} stale={!best} />
                {shown.slice(0, 2).map((line) => {
                  const white = line.score.mate !== undefined ? line.score.mate > 0 : (line.score.cp ?? 0) >= 0;
                  return (
                    <button key={line.multipv} onClick={() => play(line.pv[0])} className="flex min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap text-start text-sm [scrollbar-width:none]">
                      <span className={`min-w-14 shrink-0 rounded-md px-1.5 py-0.5 text-center font-bold tabular-nums ${white ? "bg-white text-black ring-1 ring-line" : "bg-[#262522] text-white"}`}>{formatScore(line.score)}</span>
                      <span>{pvSan(fen, line.pv, 12)}</span>
                    </button>
                  );
                })}
                {shown.length === 0 && !resultText && <p className="text-sm text-muted">Stockfish is analysing this position…</p>}
              </div>
            )}
            <Board
              fen={fen}
              orientation={orientation}
              movable={status.over ? null : turn}
              onMove={play}
              lastMove={current.last ?? null}
              checkSquare={status.check ? kingSquare(fen, turn) ?? null : null}
              showLegalDots={settings.legalDots}
              coordinates={settings.coordinates}
              reducedMotion={reducedMotion}
              hintMove={engineOn && best?.pv[0] ? { from: best.pv[0].slice(0, 2) as Square, to: best.pv[0].slice(2, 4) as Square } : undefined}
              onFlip={() => setOrientation((o) => (o === "w" ? "b" : "w"))}
              label="Analysis board. Both sides can move."
            />
            <p className="mt-2 text-center text-sm font-semibold text-muted" aria-live="polite">{cursor === 0 ? "Starting position" : `${Math.ceil(cursor / 2)}${cursor % 2 ? "." : "…"} ${current.san}`}{resultText ? ` · ${resultText}` : ""}</p>
          </div>
        </div>

        <aside className="grid gap-3">
          <section className="hidden rounded-2xl bg-surface p-3 shadow-[var(--shadow)] sm:block" aria-label="Engine lines">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Stockfish{best?.depth ? <span className="font-normal text-muted"> · depth {best.depth}</span> : null}</span>
              <button role="switch" aria-checked={engineOn} onClick={() => setEngineOn((on) => !on)} className={`relative h-7 w-12 rounded-full transition-colors ${engineOn ? "bg-[#81b64c]" : "bg-surface-2"}`}>
                <span className="sr-only">Engine</span>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${engineOn ? "left-6" : "left-1"}`} />
              </button>
            </div>
            {resultText ? (
              <p className="py-2 font-semibold">{resultText}</p>
            ) : !engineOn ? (
              <p className="py-2 text-sm text-muted">Engine off.</p>
            ) : shown.length === 0 ? (
              <p className="py-2 text-sm text-muted">Analysing…</p>
            ) : (
              <ul className="grid gap-1">
                {shown.map((line) => {
                  const white = line.score.mate !== undefined ? line.score.mate > 0 : (line.score.cp ?? 0) >= 0;
                  return (
                    <li key={line.multipv}>
                      <button onClick={() => play(line.pv[0])} className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1.5 text-start text-sm hover:bg-surface-2">
                        <span data-engine-score className={`min-w-14 rounded-md px-1.5 py-0.5 text-center font-bold tabular-nums ${white ? "bg-white text-black ring-1 ring-line" : "bg-[#262522] text-white"}`}>{formatScore(line.score)}</span>
                        <span className="min-w-0 break-words">{pvSan(fen, line.pv)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl bg-surface p-3 shadow-[var(--shadow)]" aria-label="Moves">
            <ol className="grid max-h-56 grid-cols-[2.5rem_1fr_1fr] gap-x-1 overflow-y-auto text-sm">
              {rows.length === 0 && <li className="col-span-3 py-1 text-muted">Make a move for either side.</li>}
              {rows.map((row) => (
                <li key={`${row.n}-${row.white?.ply ?? row.black?.ply}`} className="contents">
                  <span className="py-1 text-muted tabular-nums">{row.n}.</span>
                  {[row.white, row.black].map((m, i) =>
                    m ? (
                      <button key={i} onClick={() => go(m.ply)} aria-current={cursor === m.ply ? "true" : undefined} className={`rounded-md px-1.5 py-1 text-start font-semibold ${cursor === m.ply ? "bg-[color-mix(in_srgb,var(--brand)_22%,transparent)]" : "hover:bg-surface-2"}`}>{m.san}</button>
                    ) : (
                      <span key={i} className="px-1.5 py-1 text-muted">{i === 0 ? "…" : ""}</span>
                    ),
                  )}
                </li>
              ))}
            </ol>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              <button aria-label="First position" className={navButton} disabled={cursor === 0} onClick={() => go(0)}>«</button>
              <button aria-label="Previous move" className={navButton} disabled={cursor === 0} onClick={() => go(cursor - 1)}>‹</button>
              <button aria-label="Next move" className={navButton} disabled={cursor >= path.length - 1} onClick={() => go(cursor + 1)}>›</button>
              <button aria-label="Last position" className={navButton} disabled={cursor >= path.length - 1} onClick={() => go(path.length - 1)}>»</button>
              <button aria-label="Flip board" className={navButton} onClick={() => setOrientation((o) => (o === "w" ? "b" : "w"))}>⇅</button>
            </div>
          </section>

          <section className="grid gap-2 rounded-2xl bg-surface p-3 shadow-[var(--shadow)]" aria-label="Position">
            <label className="text-sm font-semibold" htmlFor="fen">FEN</label>
            <div className="flex gap-2">
              <input id="fen" value={fenInput} onChange={(e) => setFenInput(e.target.value)} placeholder={fen} className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface-2 px-3 font-mono text-xs" />
              <button onClick={loadFen} className="min-h-11 rounded-xl bg-accent px-3 font-semibold text-accent-text">Load FEN</button>
            </div>
            {fenError && <p role="alert" className="text-sm text-danger">{fenError}</p>}
            <div className="flex gap-2 text-sm">
              <button onClick={() => void navigator.clipboard?.writeText(fen).then(() => toast("Position copied (FEN)"), () => toast("Couldn't copy. Select the FEN in the box and copy it manually.", "error"))} className="min-h-10 flex-1 rounded-xl bg-surface-2 font-semibold">Copy FEN</button>
              <button onClick={reset} className="min-h-10 flex-1 rounded-xl bg-surface-2 font-semibold">Starting position</button>
            </div>
            <button data-edit-position onClick={() => setEditing(true)} className="min-h-11 rounded-xl bg-accent font-semibold text-accent-text">Set up position…</button>
          </section>
        </aside>
      </div>
      <nav aria-label="Analysis controls" className="sticky-action pointer-events-none fixed inset-x-0 z-40 px-3 sm:hidden">
        <div className="pointer-events-auto mx-auto grid max-w-xl grid-cols-4 gap-2 rounded-[22px] bg-bg/90 p-2 backdrop-blur-md">
          <button onClick={() => setEditing(true)} className="grid min-h-14 place-items-center rounded-2xl bg-surface-2 text-xs font-bold">Set up</button>
          <button onClick={() => setOrientation((o) => (o === "w" ? "b" : "w"))} className="grid min-h-14 place-items-center rounded-2xl bg-surface-2 text-xs font-bold">⇅ Flip</button>
          <button onClick={() => go(cursor - 1)} disabled={cursor === 0} aria-label="Previous move" className="grid min-h-14 place-items-center rounded-2xl bg-surface-2 text-2xl font-black disabled:opacity-40">‹</button>
          <button onClick={() => go(cursor + 1)} disabled={cursor >= path.length - 1} aria-label="Next move" className="grid min-h-14 place-items-center rounded-2xl bg-[#81b64c] text-2xl font-black text-white shadow-[0_5px_0_#5d8a33] disabled:opacity-50">›</button>
        </div>
      </nav>
      {editing && (
        <div className="fixed inset-0 z-[110] overflow-y-auto bg-bg p-3 pt-[max(12px,env(safe-area-inset-top))]" role="dialog" aria-label="Set up a position">
          <h2 className="mb-3 px-1 text-2xl font-bold">Set up a position</h2>
          <PositionEditor initialFen={fen} doneLabel="Analyse this position" onCancel={() => setEditing(false)} onDone={(next) => { applyPosition(next); setEditing(false); toast("Position set up"); }} />
        </div>
      )}
    </main>
  );
}
