"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { premoveMoves, resolvePremove, type PremovePosition, type QueuedPremove } from "../chess/premove";
import { sideToMove } from "../chess/rules";
import { playSound } from "./sound";

export function usePremove(position: PremovePosition, onMove: (uci: string) => void | boolean | Promise<boolean | void>, onExecution?: (active: boolean) => void) {
  const [queued, setQueued] = useState<QueuedPremove | null>(null);
  const pending = useRef<QueuedPremove | null>(null);
  const { context, fen, ply, active, player, ready } = position;
  const cancel = useCallback(() => {
    pending.current = null;
    setQueued(null);
  }, []);
  const queue = useCallback((uci: string | null) => {
    if (uci === null) { cancel(); return; }
    if (!active || !player || sideToMove(fen) === player) return;
    if (!premoveMoves(fen, player).some(m => `${m.from}${m.to}` === uci.slice(0, 4))) return;
    const next = { uci, context, fen, ply, player };
    pending.current = next;
    setQueued(next);
    playSound("premove_set");
  }, [active, player, fen, context, ply, cancel]);

  useEffect(() => {
    if (!queued || pending.current !== queued) return;
    const decision = resolvePremove(queued, { context, fen, ply, active, player, ready });
    if (decision === "wait") return;
    // Consume before sending so effects, rerenders or a slow acknowledgement
    // cannot submit the same queued move twice.
    pending.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueued(null);
    if (decision === "play") {
      onExecution?.(true);
      void Promise.resolve(onMove(queued.uci)).catch(() => {}).finally(() => onExecution?.(false));
    }
  }, [queued, context, fen, ply, active, player, ready, onMove, onExecution]);

  useEffect(() => {
    if (!queued) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queued, cancel]);

  return { uci: active && queued?.context === context ? queued.uci : null, queue, cancel };
}
