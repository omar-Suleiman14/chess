"use client";

import { useEffect, type RefObject } from "react";

type Pose = { rx: number; ry: number; tx: number; ty: number };
const REST: Pose = { rx: 0, ry: 0, tx: 0, ty: 0 };

/**
 * Cards lean and drift away from a nearby mouse, the closest one most, and
 * settle back when it leaves. Writes --rx/--ry/--tx/--ty (and --gx/--gy for glare) on each element
 * returned by `targets` (looked up per frame, so they may change). Eased per
 * frame in JS: CSS transitions on 3D layers blur text while they run.
 */
export function useShyTilt(root: RefObject<HTMLElement | null>, targets: () => HTMLElement[], enabled = true) {
  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const state = new Map<HTMLElement, { now: Pose; goal: Pose }>();
    let frame = 0;

    const tick = () => {
      let moving = false;
      state.forEach(({ now, goal }, el) => {
        if (!el.isConnected) {
          state.delete(el);
          return;
        }
        for (const key of ["rx", "ry", "tx", "ty"] as const) {
          now[key] += (goal[key] - now[key]) * 0.12;
          if (Math.abs(goal[key] - now[key]) < 0.01) now[key] = goal[key];
          else moving = true;
        }
        el.style.setProperty("--rx", `${now.rx.toFixed(2)}deg`);
        el.style.setProperty("--ry", `${now.ry.toFixed(2)}deg`);
        el.style.setProperty("--tx", `${Math.round(now.tx)}px`);
        el.style.setProperty("--ty", `${Math.round(now.ty)}px`);
      });
      frame = moving ? requestAnimationFrame(tick) : 0;
    };
    const aim = (el: HTMLElement, goal: Pose) => {
      const entry = state.get(el) ?? { now: { ...REST }, goal: { ...REST } };
      entry.goal = goal;
      state.set(el, entry);
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      for (const el of targets()) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        const reach = Math.hypot(r.width, r.height) / 2 + 140;
        const closeness = Math.max(0, 1 - Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / reach);
        if (!closeness) {
          aim(el, REST);
          continue;
        }
        const x = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
        const y = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
        // Where the light catches the card (for an optional glare layer).
        el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
        el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
        aim(el, { rx: -y * 14 * closeness, ry: x * 20 * closeness, tx: -x * 40 * closeness, ty: -y * 34 * closeness });
      }
    };
    const onLeave = (e: PointerEvent) => {
      if (!e.relatedTarget) targets().forEach((el) => aim(el, REST));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, [root, targets, enabled]);
}
