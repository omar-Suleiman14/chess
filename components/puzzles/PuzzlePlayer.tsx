"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/navigation/PrefetchLink";
import { Board, type LastMove } from "@/components/chess/Board";
import { applyUci, kingSquare, positionStatus, sideToMove, type Square } from "@/lib/chess/rules";
import { gradePuzzleMove, solverColor, THEMES, type Puzzle } from "@/lib/chess/puzzles";
import { useSettings } from "@/lib/client/settings";
import { playSound, unlockAudio, type SoundName } from "@/lib/client/sound";
import { haptic } from "@/lib/client/haptics";

export type PuzzleOutcome = {
  /** Solved with no mistakes, hints or solution. */
  clean: boolean;
};

type Phase = "intro" | "solving" | "opponent" | "solved" | "failed" | "revealing";

type Props = {
  puzzle: Puzzle;
  /** "rush" moves on automatically and ends the attempt at the first mistake. */
  mode: "rated" | "rush" | "practice";
  /** Called once, at the first decisive moment (clean solve, mistake, hint, or solution). */
  onResult?: (outcome: PuzzleOutcome) => void;
  /** Called when the attempt is finished and the player (or rush) moves on. */
  onNext?: () => void;
  /** Rating change to show once known. */
  delta?: number | null;
  ratingLabel?: string;
};

const INTRO_MS = 520;
const REPLY_MS = 420;

function soundFor(applied: NonNullable<ReturnType<typeof applyUci>>, mine: boolean): SoundName {
  if (applied.checkmate) return "checkmate";
  if (applied.check) return "check";
  if (applied.promotion) return "promote";
  if (applied.flags.includes("k") || applied.flags.includes("q")) return "castle";
  if (applied.captured) return "capture";
  return mine ? "move" : "opponent_move";
}

function lastMoveOf(applied: NonNullable<ReturnType<typeof applyUci>>, key: string): LastMove {
  return { from: applied.from, to: applied.to, key };
}

/** One puzzle: the opponent's move animates in, then the solver plays the line. */
export function PuzzlePlayer({ puzzle, mode, onResult, onNext, delta = null, ratingLabel }: Props) {
  const { settings, reducedMotion } = useSettings();
  const solver = solverColor(puzzle);
  const [fen, setFen] = useState(puzzle.fen);
  const [index, setIndex] = useState(1); // next solver move index in puzzle.moves
  const [phase, setPhase] = useState<Phase>("intro");
  const [lastMove, setLastMove] = useState<LastMove>(null);
  const [badge, setBadge] = useState<{ square: Square; kind: "correct" | "wrong" } | null>(null);
  const [hint, setHint] = useState<0 | 1 | 2>(0);
  const [mistakes, setMistakes] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [orientation, setOrientation] = useState(solver);
  const reported = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seq = useRef(0);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, reducedMotion ? Math.min(ms, 120) : ms));
  };
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const sound = (name: SoundName) => { if (settings.sound) playSound(name, settings.volume); };

  // The opponent's move plays itself shortly after the puzzle appears.
  useEffect(() => {
    const t = setTimeout(() => {
      const applied = applyUci(puzzle.fen, puzzle.moves[0]);
      if (!applied) return;
      setFen(applied.fen);
      setLastMove(lastMoveOf(applied, `o${++seq.current}`));
      setPhase("solving");
      if (settings.sound) playSound(soundFor(applied, false), settings.volume);
    }, reducedMotion ? 60 : INTRO_MS);
    return () => clearTimeout(t);
  }, [puzzle, reducedMotion, settings.sound, settings.volume]);

  const report = (clean: boolean) => {
    if (reported.current) return;
    reported.current = true;
    onResult?.({ clean });
  };

  const onMove = (uci: string) => {
    if (phase !== "solving") return false;
    unlockAudio();
    const result = gradePuzzleMove(puzzle, fen, index, uci);
    if (result.kind === "illegal") return false;
    const applied = applyUci(fen, uci)!;
    setBadge(null);
    if (result.kind === "wrong") {
      // Show the wrong move with a cross, then put the position back.
      setFen(applied.fen);
      setLastMove(lastMoveOf(applied, `w${++seq.current}`));
      setBadge({ square: applied.to, kind: "wrong" });
      sound("wrong");
      haptic("illegal");
      setMistakes((m) => m + 1);
      report(false);
      if (mode === "rush") {
        setPhase("failed");
        later(650, () => onNext?.());
        return true;
      }
      setPhase("failed");
      return true;
    }
    setFen(applied.fen);
    setLastMove(lastMoveOf(applied, `s${++seq.current}`));
    setBadge({ square: applied.to, kind: "correct" });
    sound(soundFor(applied, true));
    setHint(0);
    if (result.kind === "solved") {
      later(140, () => sound("correct"));
      report(mistakes === 0 && hint === 0);
      setPhase("solved");
      if (mode === "rush") later(420, () => onNext?.());
      return true;
    }
    setPhase("opponent");
    later(REPLY_MS, () => {
      const reply = applyUci(result.fen, result.reply)!;
      setFen(result.replyFen);
      setLastMove(lastMoveOf(reply, `r${++seq.current}`));
      setBadge(null);
      setIndex((i) => i + 2);
      setPhase("solving");
      sound(soundFor(reply, false));
    });
    return true;
  };

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  /** Back to the position before the current solver move. */
  const rewind = () => {
    const at = positionAt(puzzle, index);
    setFen(at.fen);
    setLastMove(at.last ? lastMoveOf(at.last, `b${++seq.current}`) : null);
    setBadge(null);
    return at.fen;
  };

  const retry = () => {
    clearTimers();
    rewind();
    setPhase("solving");
  };

  const showHint = () => {
    report(false);
    setHint((h) => (h < 2 ? ((h + 1) as 1 | 2) : h));
  };

  const showSolution = () => {
    report(false);
    clearTimers();
    setRevealed(true);
    setPhase("revealing");
    let position = rewind();
    const rest = puzzle.moves.slice(index);
    rest.forEach((move, i) => {
      const applied = applyUci(position, move);
      if (!applied) return;
      position = applied.fen;
      later(350 + i * 650, () => {
        setFen(applied.fen);
        setLastMove(lastMoveOf(applied, `v${++seq.current}`));
        sound(soundFor(applied, i % 2 === 0));
        if (i === rest.length - 1) {
          setBadge({ square: applied.to, kind: "correct" });
          setPhase("solved");
        }
      });
    });
  };

  const expected = puzzle.moves[index];
  const hintFrom = hint >= 1 && phase === "solving" ? (expected.slice(0, 2) as Square) : null;
  const hintMove = hint >= 2 && phase === "solving" ? { from: expected.slice(0, 2) as Square, to: expected.slice(2, 4) as Square } : undefined;
  const status = useMemo(() => positionStatus(fen), [fen]);
  const turn = sideToMove(fen);
  const done = phase === "solved" || (phase === "failed" && mode === "rush");
  const themeLabels = puzzle.themes.map((t) => THEMES.find((x) => x.id === t)?.label).filter(Boolean) as string[];

  const toMove = solver === "w" ? "White" : "Black";
  let title = `${toMove} to move`;
  let detail = "Find the best move.";
  let tone: "neutral" | "good" | "bad" = "neutral";
  if (phase === "solved" && revealed) { title = "Solution shown"; detail = "Study the line, then try the next one."; }
  else if (phase === "solved") { title = mistakes || hint ? "Solved" : "Correct!"; detail = mode === "practice" ? "Nicely done." : mistakes || hint ? "Not counted as a clean solve." : "You found the whole line."; tone = "good"; }
  else if (phase === "failed") { title = "Incorrect"; detail = mode === "rush" ? "Strike!" : "That's not it. Try again or see the solution."; tone = "bad"; }
  else if (phase === "opponent") { title = "Best move!"; detail = "Keep going."; tone = "good"; }
  else if (phase === "revealing") { title = "Solution"; detail = "Watch the line."; }
  else if (index > 1) { title = "Keep going"; detail = `${toMove} to move.`; }

  return (
    <div data-puzzle-id={puzzle.id} className="puzzle-layout grid w-full gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-220px),720px)]">
        <Board
          fen={fen}
          orientation={orientation}
          movable={phase === "solving" && turn === solver ? solver : null}
          onMove={onMove}
          lastMove={lastMove}
          checkSquare={status.check ? kingSquare(fen, turn) ?? null : null}
          showLegalDots={settings.legalDots}
          coordinates={settings.coordinates}
          reducedMotion={reducedMotion}
          hintSquares={hintFrom ? [hintFrom] : []}
          hintMove={hintMove}
          badge={badge}
          onFlip={() => setOrientation((o) => (o === "w" ? "b" : "w"))}
          label={`Puzzle board. ${title}. ${detail}`}
        />
      </div>

      <aside className="grid gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow)]" aria-live="polite">
        <div className={`flex items-center gap-3 rounded-xl px-3 py-3 ${tone === "good" ? "bg-[#81b64c]/15" : tone === "bad" ? "bg-[#e05f4e]/15" : "bg-surface-2"}`}>
          <span
            aria-hidden="true"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg font-black ${tone === "good" ? "bg-[#81b64c] text-white" : tone === "bad" ? "bg-[#e05f4e] text-white" : solver === "w" ? "border border-line bg-white text-black" : "bg-[#1f1e1b] text-white"}`}
          >
            {tone === "good" ? "✓" : tone === "bad" ? "✕" : solver === "w" ? "♔" : "♚"}
          </span>
          <span className="min-w-0">
            <span data-puzzle-status className="block text-lg font-bold leading-tight">{title}</span>
            <span className="block text-sm text-muted">{detail}</span>
          </span>
        </div>

        {(ratingLabel || delta !== null) && (
          <p className="flex items-baseline justify-between text-sm">
            <span className="text-muted">{ratingLabel ?? "Rating"}</span>
            {delta !== null && delta !== 0 && (
              <span data-rating-delta className={`font-bold tabular-nums ${delta > 0 ? "text-[#81b64c]" : "text-[#e05f4e]"}`}>{delta > 0 ? `+${delta}` : delta}</span>
            )}
          </p>
        )}

        {(phase === "solved" || phase === "failed" || phase === "revealing") && mode !== "rush" && (
          <Link href={`/analysis?fen=${encodeURIComponent(positionAt(puzzle, 1).fen)}`} className="text-sm font-semibold underline">Analyse this position</Link>
        )}
        {(phase === "solved" || phase === "failed" || phase === "revealing") && mode !== "rush" && (
          <p className="text-sm text-muted">
            Puzzle {puzzle.id} · rated {puzzle.rating}
            {themeLabels.length > 0 && <> · {themeLabels.join(", ")}</>}
          </p>
        )}

        {mode !== "rush" && (
          <div className="grid grid-cols-2 gap-2">
            {phase === "failed" && <button onClick={retry} className="min-h-12 rounded-xl bg-surface-2 font-semibold">Retry</button>}
            {(phase === "solving" || phase === "opponent") && (
              <button onClick={showHint} disabled={phase !== "solving" || hint >= 2} className="min-h-12 rounded-xl bg-surface-2 font-semibold disabled:opacity-40">
                {hint === 0 ? "Hint" : hint === 1 ? "Show move" : "Hint shown"}
              </button>
            )}
            {phase !== "solved" && phase !== "revealing" && (
              <button onClick={showSolution} className="min-h-12 rounded-xl bg-surface-2 font-semibold">Solution</button>
            )}
            {(phase === "solved" || done || phase === "failed") && onNext && (
              <button onClick={onNext} className={`min-h-12 rounded-xl font-bold ${phase === "solved" ? "col-span-2 bg-accent text-accent-text" : "bg-accent text-accent-text"}`}>
                Next puzzle
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

/** The position before solver move `index`, and the move that led to it. */
function positionAt(puzzle: Puzzle, index: number) {
  let fen = puzzle.fen;
  let last: ReturnType<typeof applyUci> = null;
  for (let i = 0; i < index; i++) {
    last = applyUci(fen, puzzle.moves[i]);
    if (!last) break;
    fen = last.fen;
  }
  return { fen, last };
}
