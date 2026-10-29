"use client";

import { useEffect, useState } from "react";
import { reviewMove, type ReviewedMove } from "../chess/review";
import { positionStatus } from "../chess/rules";
import { MIN_ANALYSIS_DEPTH } from "../chess/lessons/adaptive";
import { SearchCancelled } from "../chess/engine/controller";
import { getEngine, supportsEngine } from "./engine";
import { readAnalysis, writeAnalysis } from "./analysisCache";
import type { TreeNode } from "../chess/history/tree";

type CoachState = { key: string; kind: "ready"; review: ReviewedMove } | { key: string; kind: "unavailable" };
const COACH_HASH = "coach:mt1500:mpv2:v1";

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
      const result = await engine.search({ kind: "review", fen, movetimeMs: 1500, multiPv: 2 });
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
