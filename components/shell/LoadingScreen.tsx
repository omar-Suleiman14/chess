"use client";

import { useEffect, useState } from "react";
import { preloadEngine } from "@/lib/client/engine";
import { Spinner } from "@/components/ui/Spinner";

const MAX_WAIT_MS = 2500;
const FADE_MS = 100;
let shownThisVisit = false;

type Phase = "loading" | "leaving" | "gone";

/**
 * Boot screen shown once per visit while Sherine's engine downloads and wakes up.
 * The spinner disappears immediately after the engine is ready. The board
 * stays visible and interactive while the initial engine download completes.
 */
export function LoadingScreen() {
  const [phase, setPhase] = useState<Phase>(() => (shownThisVisit ? "gone" : "loading"));
  const [progress, setProgress] = useState(0.05);

  useEffect(() => {
    if (phase !== "loading") return;
    let cancelled = false;
    const leave = () => {
      if (cancelled) return;
      shownThisVisit = true;
      setPhase("leaving");
    };
    const cap = setTimeout(leave, MAX_WAIT_MS);
    void preloadEngine((p) => !cancelled && setProgress((prev) => Math.max(prev, 0.05 + p * 0.95))).then(() => {
      if (cancelled) return;
      setProgress(1);
      leave();
    }).catch(leave);
    return () => {
      cancelled = true;
      clearTimeout(cap);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const t = setTimeout(() => setPhase("gone"), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "gone") return null;
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-bg/40 transition-opacity ease-out"
      style={{ opacity: phase === "leaving" ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
      role="progressbar"
      aria-label="Loading Chess by Chaos"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <Spinner className="h-9 w-9 text-muted" />
    </div>
  );
}
