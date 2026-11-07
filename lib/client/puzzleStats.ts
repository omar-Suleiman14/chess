"use client";

// Puzzle rating and records. Guests keep them on this device; signed-in
// players use the server (which rates each puzzle once) and the local copy
// only remembers which puzzles were seen recently.
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useCallback, useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";
import { findPuzzle, INITIAL_PUZZLE_RATING, ratePuzzle, type RushMode } from "@/lib/chess/puzzles";

export type PuzzleStats = {
  rating: number;
  rd: number;
  volatility: number;
  attempts: number;
  solved: number;
  streak: number;
  bestStreak: number;
  rush3: number;
  rush5: number;
  survival: number;
  /** Recent puzzle ids, newest last (bounded), so picks don't repeat. */
  seen: string[];
  /** Puzzles that already changed this device's rating (each is rated once). */
  rated: string[];
  /** Rating after each recent rated attempt, oldest first (bounded). */
  history: number[];
};

const KEY = "cbc.puzzles.v1";
const MAX_SEEN = 600;
const MAX_RATED = 5000;
const MAX_HISTORY = 60;

export const EMPTY_STATS: PuzzleStats = {
  rating: INITIAL_PUZZLE_RATING.rating,
  rd: INITIAL_PUZZLE_RATING.rd,
  volatility: INITIAL_PUZZLE_RATING.volatility,
  attempts: 0,
  solved: 0,
  streak: 0,
  bestStreak: 0,
  rush3: 0,
  rush5: 0,
  survival: 0,
  seen: [],
  rated: [],
  history: [],
};

let cache: PuzzleStats | null = null;
const listeners = new Set<() => void>();

function read(): PuzzleStats {
  if (cache) return cache;
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY_STATS, ...(JSON.parse(raw) as Partial<PuzzleStats>) } : EMPTY_STATS;
  } catch {
    cache = EMPTY_STATS;
  }
  return cache;
}

function write(next: PuzzleStats) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or full storage: keep the in-memory copy for this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) { cache = null; listener(); }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

/** Pure local update, exported for tests. */
export function applyLocalAttempt(stats: PuzzleStats, puzzleId: string, solved: boolean): { stats: PuzzleStats; rated: boolean; delta: number } {
  const puzzle = findPuzzle(puzzleId);
  const seen = [...stats.seen.filter((id) => id !== puzzleId), puzzleId].slice(-MAX_SEEN);
  if (!puzzle || stats.rated.includes(puzzleId)) return { stats: { ...stats, seen }, rated: false, delta: 0 };
  const next = ratePuzzle(stats, puzzle, solved);
  const streak = solved ? stats.streak + 1 : 0;
  return {
    rated: true,
    delta: next.rating - stats.rating,
    stats: {
      ...stats,
      ...next,
      attempts: stats.attempts + 1,
      solved: stats.solved + (solved ? 1 : 0),
      streak,
      bestStreak: Math.max(stats.bestStreak, streak),
      seen,
      rated: [...stats.rated, puzzleId].slice(-MAX_RATED),
      history: [...stats.history, next.rating].slice(-MAX_HISTORY),
    },
  };
}

const RUSH_KEY: Record<RushMode, "rush3" | "rush5" | "survival"> = { "3min": "rush3", "5min": "rush5", survival: "survival" };

export function usePuzzleStats() {
  const local = useSyncExternalStore(subscribe, read, () => EMPTY_STATS);
  const { isAuthenticated } = useConvexAuth();
  const remote = useQuery(api.puzzles.mine, isAuthenticated ? {} : "skip");
  const recent = useQuery(api.puzzles.recent, isAuthenticated ? {} : "skip");
  const recordAttempt = useMutation(api.puzzles.recordAttempt);
  const recordRush = useMutation(api.puzzles.recordRush);

  const stats: PuzzleStats = remote
    ? { ...local, ...remote, volatility: local.volatility, history: recent ? recent.map((r) => r.ratingAfter).reverse() : local.history }
    : local;

  /** Records the first attempt at a puzzle and returns the rating change. */
  const record = useCallback(
    async (puzzleId: string, solved: boolean): Promise<{ rated: boolean; delta: number; rating: number }> => {
      const result = applyLocalAttempt(read(), puzzleId, solved);
      if (isAuthenticated) {
        // Remember it as seen locally, but let the server own the rating.
        write({ ...read(), seen: result.stats.seen });
        try {
          return await recordAttempt({ puzzleId, solved });
        } catch {
          return { rated: false, delta: 0, rating: remote?.rating ?? read().rating };
        }
      }
      write(result.stats);
      return { rated: result.rated, delta: result.delta, rating: result.stats.rating };
    },
    [isAuthenticated, recordAttempt, remote?.rating],
  );

  /** Saves a rush score; returns whether it's a new personal best. */
  const saveRush = useCallback(
    async (mode: RushMode, score: number): Promise<boolean> => {
      const key = RUSH_KEY[mode];
      const best = read()[key];
      if (score > best) write({ ...read(), [key]: score });
      if (isAuthenticated) {
        try {
          return (await recordRush({ mode, score })).isBest;
        } catch {
          return score > best;
        }
      }
      return score > best;
    },
    [isAuthenticated, recordRush],
  );

  /** Marks a puzzle seen without rating it (rush, daily replays). */
  const markSeen = useCallback((puzzleId: string) => {
    const current = read();
    write({ ...current, seen: [...current.seen.filter((id) => id !== puzzleId), puzzleId].slice(-MAX_SEEN) });
  }, []);

  return { stats, record, saveRush, markSeen, synced: !!remote };
}

export function rushBest(stats: PuzzleStats, mode: RushMode): number {
  return stats[RUSH_KEY[mode]];
}
