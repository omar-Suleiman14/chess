"use client";

import { useEffect, useRef, useState } from "react";
import { ENGINE_BUILD, SearchCancelled } from "../chess/engine/controller";
import type { WhiteScore } from "../chess/engine/uci";
import { getEngine, supportsEngine } from "./engine";
import { readAnalysis, writeAnalysis } from "./analysisCache";

export const EVAL_MOVETIME_MS = 1500;
export const EVAL_SETTINGS_HASH = `eval:mt${EVAL_MOVETIME_MS}:mpv1`;
const UPDATE_INTERVAL_MS = 125; // <= 8 updates per second

export type Evaluation = { nodeKey: string; fen: string; score: WhiteScore; depth?: number; bestmove?: string | null; final: boolean };

/**
 * Bounded, lower-priority evaluation of the current position. Never runs
 * when disabled, never blocks Sherine's move search (the controller preempts).
 */
export function useEvaluation(fen: string, nodeKey: string, enabled: boolean, onFinal?: (e: Evaluation) => void) {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const finalRef = useRef(onFinal);
  useEffect(() => {
    finalRef.current = onFinal;
  });

  useEffect(() => {
    if (!enabled || !supportsEngine()) return;
    let cancelled = false;
    let lastPaint = 0;
    const engine = getEngine();
    let searching = false;
    void (async () => {
      const cached = await readAnalysis(fen, EVAL_SETTINGS_HASH);
      if (cancelled) return;
      if (cached) {
        const final: Evaluation = { nodeKey, fen, score: cached.score, depth: cached.depth, bestmove: cached.bestmove, final: true };
        setEvaluation(final);
        finalRef.current?.(final);
        return;
      }
      searching = true;
      const result = await engine.search({
        kind: "eval",
        fen,
        movetimeMs: EVAL_MOVETIME_MS,
        onInfo: (info) => {
          const now = performance.now();
          if (cancelled || now - lastPaint < UPDATE_INTERVAL_MS) return;
          lastPaint = now;
          setEvaluation({ nodeKey, fen, score: info.score, depth: info.depth, final: false });
        },
      });
      if (cancelled) return;
      void writeAnalysis(fen, EVAL_SETTINGS_HASH, result);
      const final: Evaluation = { nodeKey, fen, score: result.score, depth: result.depth, bestmove: result.bestmove, final: true };
      setEvaluation(final);
      finalRef.current?.(final);
    })().catch((error: unknown) => {
      if (!cancelled && !(error instanceof SearchCancelled)) setEvaluation(null);
    });
    return () => {
      cancelled = true;
      if (searching) engine.cancel("eval");
    };
  }, [fen, nodeKey, enabled]);

  // Only show scores that belong to the position on the board (no stale jumps).
  const current = enabled && evaluation && evaluation.fen === fen && evaluation.nodeKey === nodeKey ? evaluation : null;
  return current;
}

export { ENGINE_BUILD };
