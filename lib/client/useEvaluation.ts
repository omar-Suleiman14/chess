"use client";

import { useEffect, useRef, useState } from "react";
import { ENGINE_BUILD, SearchCancelled } from "../chess/engine/controller";
import type { WhiteScore } from "../chess/engine/uci";
import { getEngine, supportsEngine } from "./engine";
import { joinAnalysis, readAnalysis, shareAnalysis, writeAnalysis } from "./analysisCache";

export const EVAL_MOVETIME_MS = 1500;
/** Two lines per position: the eval bar shows the first, move feedback reuses both. */
export const EVAL_MULTIPV = 2;
export const EVAL_SETTINGS_HASH = `eval:mt${EVAL_MOVETIME_MS}:mpv${EVAL_MULTIPV}`;
const UPDATE_INTERVAL_MS = 250; // <= 4 repaints per second: smooth enough, light on phones

export type Evaluation = { nodeKey: string; fen: string; score: WhiteScore; depth?: number; bestmove?: string | null; final: boolean };

/**
 * Bounded, lower-priority evaluation of the current position. Never runs
 * when disabled, never blocks Sherine's move search (the controller preempts).
 */
export function useEvaluation(fen: string, nodeKey: string, enabled: boolean, onFinal?: (e: Evaluation) => void, minimumDepth = 0) {
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
      if (cached && (cached.depth ?? 0) >= minimumDepth) {
        const final: Evaluation = { nodeKey, fen, score: cached.score, depth: cached.depth, bestmove: cached.bestmove, final: true };
        setEvaluation(final);
        finalRef.current?.(final);
        return;
      }
      // Move feedback may already be analysing this exact position.
      const joined = await joinAnalysis(fen, EVAL_SETTINGS_HASH);
      if (cancelled) return;
      if (joined && (joined.depth ?? 0) >= minimumDepth) {
        const final: Evaluation = { nodeKey, fen, score: joined.score, depth: joined.depth, bestmove: joined.bestmove, final: true };
        setEvaluation(final);
        finalRef.current?.(final);
        return;
      }
      searching = true;
      const result = await shareAnalysis(fen, EVAL_SETTINGS_HASH, engine.search({
        kind: "eval",
        fen,
        movetimeMs: EVAL_MOVETIME_MS,
        multiPv: EVAL_MULTIPV,
        onInfo: (info) => {
          if (info.multipv !== 1) return;
          const now = performance.now();
          if (cancelled || now - lastPaint < UPDATE_INTERVAL_MS) return;
          lastPaint = now;
          setEvaluation({ nodeKey, fen, score: info.score, depth: info.depth, final: false });
        },
      }));
      if (cancelled) return;
      if (result.score.cp === undefined && result.score.mate === undefined) {
        setEvaluation(null);
        return;
      }
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
  }, [fen, nodeKey, enabled, minimumDepth]);

  // Only show scores that belong to the position on the board (no stale jumps).
  const current = enabled && evaluation && evaluation.fen === fen && evaluation.nodeKey === nodeKey ? evaluation : null;
  return current;
}

/**
 * The eval bar's view: the current position's score, or, while that is still
 * being computed (or the engine is busy with the bot's move), the last score
 * shown, marked stale, instead of flashing "Analyzing".
 */
export function useDisplayedEvaluation(current: Evaluation | null, enabled: boolean): { evaluation: Evaluation | null; stale: boolean } {
  const [last, setLast] = useState<Evaluation | null>(null);
  if (current && current !== last) setLast(current);
  if (!enabled) return { evaluation: null, stale: false };
  if (current) return { evaluation: current, stale: false };
  return { evaluation: last, stale: last !== null };
}

export { ENGINE_BUILD };
