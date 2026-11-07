"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSyncExternalStore } from "react";
import { toastStore } from "@/lib/client/toast";

/** Confirmations for completed actions, at the bottom above the tab bar. */
export function Toaster() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.snapshot, toastStore.server);
  return (
    <div className="toaster pointer-events-none fixed inset-x-0 z-[120] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.p
            key={t.id}
            data-toast={t.tone}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            className={`flex max-w-sm items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,.25)] ${t.tone === "error" ? "bg-[#c4473a]" : t.tone === "info" ? "bg-[#2b2a27]" : "bg-[#5d8a33]"}`}
          >
            <span aria-hidden="true">{t.tone === "error" ? "!" : t.tone === "info" ? "i" : "✓"}</span>
            {t.text}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  );
}
