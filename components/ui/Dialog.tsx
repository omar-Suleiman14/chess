"use client";

import { motion } from "motion/react";
import { useEffect, useId, useRef } from "react";
import { useSettings } from "@/lib/client/settings";
import { IOS_SPRING } from "./Switch";
import { GlassLayer } from "./Glass";

export function Dialog({ title, children, onClose, size = "default", description, focusTitle = false, dir, lang }: { dir?: "ltr" | "rtl"; lang?: string; title: string; children: React.ReactNode; onClose: () => void; size?: "default" | "result"; description?: string; focusTitle?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { glassOn, reducedMotion } = useSettings();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    // Focus moves in, Tab stays inside, Escape closes, and focus returns to where it was.
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-dialog-initial],button,input,select,a[href]")?.focus();
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
      if (e.shiftKey && (document.activeElement === first || !items.includes(document.activeElement as HTMLElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !ref.current.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (previous?.isConnected && !previous.matches(":disabled")) previous.focus();
      else document.querySelector<HTMLElement>('[role="grid"] [tabindex="0"]')?.focus();
    };
  }, []);
  return (
    <motion.div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <motion.div
        ref={ref}
        role="dialog"
        dir={dir}
        lang={lang}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`relative ${glassOn ? "glass-panel" : "bg-surface shadow-[var(--shadow)]"} w-full ${size === "result" ? "max-w-[520px] p-5 sm:p-8" : "max-w-sm p-5"} max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-3xl`}
        onClick={(e) => e.stopPropagation()}
        // Glass skips the fade: a translucent parent would cut the lens off from the page.
        initial={reducedMotion ? false : glassOn ? { y: 48, scale: 0.96 } : { opacity: 0, y: 48, scale: 0.96 }}
        animate={glassOn ? { y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : IOS_SPRING}
      >
        <GlassLayer radius={24} tier="sheet" />
        <h2 id={titleId} style={focusTitle ? { outline: "none" } : undefined} tabIndex={focusTitle ? -1 : undefined} data-dialog-initial={focusTitle ? "true" : undefined} className={size === "result" ? "text-center text-3xl font-bold tracking-tight sm:text-4xl" : "mb-4 text-lg font-semibold"}>{title}</h2>
        {description && <p id={descriptionId} className="mb-5 mt-2 text-center text-sm text-muted">{description}</p>}
        <div className="grid gap-2">{children}</div>
      </motion.div>
    </motion.div>
  );
}
