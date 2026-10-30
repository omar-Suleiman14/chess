"use client";

import { useEffect, useState } from "react";
import { reviewMove, type ReviewedMove } from "../chess/review";
import { positionStatus } from "../chess/rules";
import { MIN_ANALYSIS_DEPTH } from "../chess/lessons/adaptive";
import { SearchCancelled } from "../chess/engine/controller";
import { getEngine, supportsEngine } from "./engine";
import { joinAnalysis, readAnalysis, shareAnalysis, writeAnalysis } from "./analysisCache";
import { EVAL_MOVETIME_MS, EVAL_MULTIPV, EVAL_SETTINGS_HASH } from "./useEvaluation";
import type { TreeNode } from "../chess/history/tree";

type CoachState = { key: string; kind: "ready"; review: ReviewedMove } | { key: string; kind: "unavailable" };
// Same search as the eval bar, so a position the bar already analysed costs nothing here.
const COACH_HASH = EVAL_SETTINGS_HASH;

/** Reviews one move while the player thinks. Gameplay preempts this shared worker. */
export function useMoveCoach(node: TreeNode | undefined, fenBefore: string | undefined, enabled: boolean) {
  const [state, setState] = useState<CoachState | null>(null);
  useEffect(() => {
    if (!enabled || !node || !fenBefore || !supportsEngine()) return;
    let cancelled = false;
    const engine = getEngine();
    const analyse = async (fen: string) => {
      const cached = await readAnalysis(fen, COACH_HASH);
      if (cancelled) throw new SearchCancelled();
      if (cached && (cached.depth ?? 0) >= MIN_ANALYSIS_DEPTH) return cached;
      const joined = await joinAnalysis(fen, COACH_HASH);
      if (cancelled) throw new SearchCancelled();
      if (joined && (joined.depth ?? 0) >= MIN_ANALYSIS_DEPTH) return joined;
      const result = await shareAnalysis(fen, COACH_HASH, engine.search({ kind: "review", fen, movetimeMs: EVAL_MOVETIME_MS, multiPv: EVAL_MULTIPV }));
      if (cancelled) throw new SearchCancelled();
      await writeAnalysis(fen, COACH_HASH, result);
      return result;
    };
    const timer = setTimeout(() => {
      void (async () => {
        const before = await analyse(fenBefore);
        const after = positionStatus(node.fen).over ? undefined : await analyse(node.fen);
        if (cancelled) return;
        const review = reviewMove({ fenBefore, uci: node.uci, san: node.san, ply: node.ply,
          before: { score: before.score, depth: before.depth, bestmove: before.bestmove ?? undefined, candidates: before.candidates }, after });
        setState(review ? { key: node.key, kind: "ready", review } : { key: node.key, kind: "unavailable" });
      })().catch((error: unknown) => {
        if (!cancelled && !(error instanceof SearchCancelled)) setState({ key: node.key, kind: "unavailable" });
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      engine.cancel("review");
    };
  }, [node, fenBefore, enabled]);
  if (enabled && node && !supportsEngine()) return { key: node.key, kind: "unavailable" as const };
  return enabled && node && state?.key === node.key ? state : null;
}
