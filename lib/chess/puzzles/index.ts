// Tactics puzzles: original positions mined from Stockfish games by
// scripts/generate-puzzles.mjs. Pure logic, shared by the browser and Convex.
import { Chess } from "chess.js";
import { updateRating, INITIAL_RATING, type Rating } from "../ratings/glicko2";
import { UCI_PATTERN } from "../rules";
import rows from "./data.json";

export type Puzzle = {
  id: string;
  /** Position before the opponent's last move. */
  fen: string;
  /** moves[0] is the opponent's move; then solver, reply, solver… (UCI). */
  moves: string[];
  rating: number;
  themes: string[];
};

type Row = { id: string; fen: string; moves: string; rating: number; themes: string };

export const PUZZLES: Puzzle[] = (rows as Row[]).map((r) => ({ id: r.id, fen: r.fen, moves: r.moves.split(" "), rating: r.rating, themes: r.themes.split(" ") }));

const BY_ID = new Map(PUZZLES.map((p) => [p.id, p]));

export function findPuzzle(id: string): Puzzle | undefined {
  return BY_ID.get(id);
}

/** Puzzle difficulty is a fixed opponent with a moderate uncertainty. */
export const PUZZLE_RD = 80;

export const THEMES: Array<{ id: string; label: string; description: string }> = [
  { id: "mate", label: "Checkmate", description: "Finish the game." },
  { id: "mateIn1", label: "Mate in 1", description: "One move to checkmate." },
  { id: "mateIn2", label: "Mate in 2", description: "Two moves to checkmate." },
  { id: "mateIn3", label: "Mate in 3+", description: "Longer mating attacks." },
  { id: "fork", label: "Fork", description: "Attack two pieces at once." },
  { id: "hangingPiece", label: "Hanging piece", description: "Take what's left undefended." },
  { id: "sacrifice", label: "Sacrifice", description: "Give material to win more." },
  { id: "promotion", label: "Promotion", description: "Push a pawn to the last rank." },
  { id: "backRankMate", label: "Back-rank mate", description: "Exploit a king stuck behind its pawns." },
  { id: "quietMove", label: "Quiet move", description: "No check, no capture, still winning." },
  { id: "endgame", label: "Endgame", description: "Few pieces left." },
  { id: "middlegame", label: "Middlegame", description: "Tactics with a full board." },
  { id: "opening", label: "Opening", description: "Punish early mistakes." },
  { id: "long", label: "Long puzzles", description: "Three moves or more." },
];

/** Puzzles matching a theme ("mateIn3" also covers longer mates). */
export function puzzlesFor(theme: string | null): Puzzle[] {
  if (!theme) return PUZZLES;
  if (theme === "mateIn3") return PUZZLES.filter((p) => p.themes.some((t) => /^mateIn[3-9]$/.test(t)));
  return PUZZLES.filter((p) => p.themes.includes(theme));
}

/**
 * The next puzzle near a target rating, skipping ones already seen. Widens
 * the window until something fits; `random` is injectable for tests.
 */
export function pickPuzzle(target: number, options: { theme?: string | null; exclude?: ReadonlySet<string>; random?: () => number } = {}): Puzzle | null {
  const pool = puzzlesFor(options.theme ?? null);
  if (!pool.length) return null;
  const random = options.random ?? Math.random;
  const fresh = pool.filter((p) => !options.exclude?.has(p.id));
  const source = fresh.length ? fresh : pool;
  for (const window of [100, 200, 350, 600, 1000, 3000]) {
    const near = source.filter((p) => Math.abs(p.rating - target) <= window);
    if (near.length) return near[Math.floor(random() * near.length)];
  }
  return source[0];
}

/** A stable puzzle of the day for a UTC date, picked from mid-range puzzles. */
export function dailyPuzzle(date: Date): Puzzle {
  const day = Math.floor(date.getTime() / 86_400_000);
  const pool = PUZZLES.filter((p) => p.rating >= 1200 && p.rating <= 2000 && p.moves.length >= 4);
  const list = pool.length ? pool : PUZZLES;
  // Multiplicative hash so neighbouring days aren't neighbouring puzzles.
  return list[Math.abs(Math.imul(day, 2654435761)) % list.length];
}

export type PuzzleStep =
  | { kind: "illegal" }
  | { kind: "wrong"; best: string }
  | { kind: "correct"; reply: string; fen: string; replyFen: string }
  | { kind: "solved"; fen: string };

/**
 * Grades the solver's move at `index` in puzzle.moves (an odd index).
 * Any checkmate is accepted, as on every puzzle site, even if it isn't the
 * mined move.
 */
export function gradePuzzleMove(puzzle: Puzzle, fen: string, index: number, uci: string): PuzzleStep {
  if (!UCI_PATTERN.test(uci)) return { kind: "illegal" };
  const chess = new Chess(fen);
  let played;
  try {
    played = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return { kind: "illegal" };
  }
  if (!played) return { kind: "illegal" };
  const expected = puzzle.moves[index];
  if (chess.isCheckmate()) return { kind: "solved", fen: chess.fen() };
  if (uci !== expected) return { kind: "wrong", best: expected };
  if (index + 1 >= puzzle.moves.length) return { kind: "solved", fen: chess.fen() };
  const afterSolver = chess.fen();
  const reply = puzzle.moves[index + 1];
  chess.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
  return { kind: "correct", reply, fen: afterSolver, replyFen: chess.fen() };
}

/** The position the solver faces: the start FEN with the opponent's move played. */
export function puzzleStart(puzzle: Puzzle): { fen: string; from: string; to: string } {
  const chess = new Chess(puzzle.fen);
  const m = puzzle.moves[0];
  chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  return { fen: chess.fen(), from: m.slice(0, 2), to: m.slice(2, 4) };
}

export function solverColor(puzzle: Puzzle): "w" | "b" {
  return puzzle.fen.split(" ")[1] === "w" ? "b" : "w";
}

/** Rating after one attempt. A solve with a hint counts as a miss, as on chess.com. */
export function ratePuzzle(player: Rating, puzzle: Pick<Puzzle, "rating">, solved: boolean): Rating {
  return updateRating(player, [{ opponent: { rating: puzzle.rating, rd: PUZZLE_RD }, score: solved ? 1 : 0 }]);
}

export const INITIAL_PUZZLE_RATING: Rating = { ...INITIAL_RATING, rating: 1200 };

// ---------------------------------------------------------------- Puzzle Rush

export type RushMode = "3min" | "5min" | "survival";
export const RUSH_MODES: Array<{ id: RushMode; label: string; seconds: number | null; detail: string }> = [
  { id: "3min", label: "3 minutes", seconds: 180, detail: "Solve as many as you can. Three misses and you're out." },
  { id: "5min", label: "5 minutes", seconds: 300, detail: "More time, same three strikes." },
  { id: "survival", label: "Survival", seconds: null, detail: "No clock. Three misses and you're out." },
];
export const RUSH_STRIKES = 3;

/** Rush starts easy and gets harder with every puzzle, like the original format. */
export function rushTarget(index: number): number {
  return Math.round(600 + index * 55 + Math.max(0, index - 20) * 25);
}
