"use client";

import { ENGINE_BUILD } from "../chess/engine/controller";
import { store, type CachedAnalysis } from "./store";

// Include the complete FEN (turn, castling, en-passant and rule counters),
// engine version and analysis settings. Scores from incompatible runs never mix.
export const analysisCacheKey = (fen: string, settingsHash: string, engineBuild = ENGINE_BUILD) => JSON.stringify([engineBuild, settingsHash, fen]);

export async function readAnalysis(fen: string, settingsHash: string): Promise<CachedAnalysis | undefined> {
  const entry = await store.getAnalysis(analysisCacheKey(fen, settingsHash));
  if (!entry || entry.fen !== fen || entry.engineBuild !== ENGINE_BUILD || entry.settingsHash !== settingsHash) return;
  // Only completed, usable evaluations enter the cache.
  if (!entry.depth || entry.depth < 1 || (!Number.isFinite(entry.score.cp) && !Number.isFinite(entry.score.mate))) return;
  return entry;
}

export async function writeAnalysis(fen: string, settingsHash: string, result: { score: CachedAnalysis["score"]; depth?: number; bestmove: string | null; pv?: string[]; elapsedMs?: number; candidates?: CachedAnalysis["candidates"] }): Promise<void> {
  if (!result.depth || result.depth < 1 || (!Number.isFinite(result.score.cp) && !Number.isFinite(result.score.mate))) return;
  await store.saveAnalysis({ key: analysisCacheKey(fen, settingsHash), fen, engineBuild: ENGINE_BUILD, settingsHash, score: result.score, depth: result.depth, bestmove: result.bestmove, candidates: result.candidates, pv: (result.pv ?? []).slice(0, 24), computeMs: result.elapsedMs ?? 0, updatedAt: Date.now() });
}

// Searches running right now, by cache key, so the eval bar and the move
// coach never search the same position twice at the same time.
const inflight = new Map<string, Promise<{ score: CachedAnalysis["score"]; depth?: number; bestmove: string | null; pv?: string[]; candidates?: CachedAnalysis["candidates"] }>>();

/** Registers a running search so others can wait for it instead of starting their own. */
export function shareAnalysis<T extends { score: CachedAnalysis["score"]; depth?: number; bestmove: string | null }>(fen: string, settingsHash: string, search: Promise<T>): Promise<T> {
  const key = analysisCacheKey(fen, settingsHash);
  inflight.set(key, search);
  const clear = () => { if (inflight.get(key) === search) inflight.delete(key); };
  search.then(clear, clear);
  return search;
}

/** The result of a search someone else is already running for this position, or undefined. */
export async function joinAnalysis(fen: string, settingsHash: string) {
  const running = inflight.get(analysisCacheKey(fen, settingsHash));
  if (!running) return undefined;
  try {
    return await running;
  } catch {
    return undefined; // It was cancelled; the caller searches itself.
  }
}
