"use client";

import { motion } from "motion/react";
import { useEffect, useId, useRef } from "react";
import { useSettings } from "@/lib/client/settings";
import { IOS_SPRING } from "./Switch";
import { GlassLayer } from "./Glass";

export function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { glassOn, reducedMotion } = useSettings();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    // Focus moves in, Tab stays inside, Escape closes, and focus returns to where it was.
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button,input,select,a[href]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      const dialogs = [...document.querySelectorAll<HTMLElement>("[role=dialog]")].filter((dialog) => dialog.getAttribute("aria-hidden") !== "true" && !dialog.closest("[inert]") && getComputedStyle(dialog).visibility !== "hidden" && dialog.getClientRects().length > 0);
      if (dialogs.at(-1) !== ref.current) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>("button:not([disabled]),input,select,a[href],[tabindex]:not([tabindex='-1'])"));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, []);
  return (
    <motion.div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={glassOn ? "glass-panel w-full max-w-sm rounded-3xl p-5" : "w-full max-w-sm rounded-3xl bg-surface p-5 shadow-[var(--shadow)]"}
        onClick={(e) => e.stopPropagation()}
        // Glass skips the fade: a translucent parent would cut the lens off from the page.
        initial={reducedMotion ? false : glassOn ? { y: 48, scale: 0.96 } : { opacity: 0, y: 48, scale: 0.96 }}
        animate={glassOn ? { y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : IOS_SPRING}
      >
        <GlassLayer radius={24} blur={10} glassThickness={90} bezelWidth={24} specularOpacity={0.6} />
        <h2 id={titleId} className="mb-4 text-lg font-semibold">{title}</h2>
        <div className="grid gap-2">{children}</div>
      </motion.div>
    </motion.div>
  );
}
