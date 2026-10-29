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
