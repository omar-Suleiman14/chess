"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { preloadEngine } from "@/lib/client/engine";

const MAX_WAIT_MS = 5000;
const FADE_MS = 380;
let shownThisVisit = false;

type Phase = "loading" | "leaving" | "gone";

/**
 * Boot screen shown once per visit while Sherine's engine downloads and wakes up.
 * The bar tracks real progress (WASM bytes, then the UCI handshake) and never
 * blocks for more than a few seconds.
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
    let settle: ReturnType<typeof setTimeout> | undefined;
    void preloadEngine((p) => !cancelled && setProgress((prev) => Math.max(prev, 0.05 + p * 0.95))).then(() => {
      if (cancelled) return;
      setProgress(1);
      settle = setTimeout(leave, 250);
    });
    return () => {
      cancelled = true;
      clearTimeout(cap);
      if (settle) clearTimeout(settle);
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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity ease-out"
      style={{ opacity: phase === "leaving" ? 0 : 1, transitionDuration: `${FADE_MS}ms`, pointerEvents: phase === "leaving" ? "none" : "auto" }}
      role="progressbar"
      aria-label="Loading Chess by Chaos"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
        <g fill="#fff">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <rect x="32" y="8" width="12" height="12" rx="2" />
          <rect x="20" y="20" width="12" height="12" rx="2" />
          <rect x="44" y="20" width="12" height="12" rx="2" />
          <rect x="8" y="32" width="12" height="12" rx="2" />
          <rect x="32" y="32" width="12" height="12" rx="2" />
          <rect x="20" y="44" width="12" height="12" rx="2" />
          <rect x="44" y="44" width="12" height="12" rx="2" />
        </g>
      </svg>
      <div className="mt-14 h-[5px] w-40 overflow-hidden rounded-full bg-white/20">
        <motion.div
          className="h-full rounded-full bg-white"
          initial={{ width: "5%" }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 24 }}
        />
      </div>
    </div>
  );
}
