"use client";

import { motion } from "motion/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { IOS_SPRING } from "./Switch";

export type SelectOption<T extends string> = { value: T; label: string; hint?: string };

/** iOS-style pop-up menu replacing the native <select>. */
export function Select<T extends string>({ value, options, onChange, label }: { value: T; options: SelectOption<T>[]; onChange: (v: T) => void; label: string }) {
  const [open, setOpen] = useState(false);
  // Keep the menu mounted briefly after closing so it can fade out.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), 140);
    return () => clearTimeout(t);
  }, [open]);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const choose = (v: T) => {
    onChange(v);
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
      setOpen(true);
    } else if (open) {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown") setActive((a) => Math.min(options.length - 1, a + 1));
      if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose(options[active].value);
      }
      if (e.key.startsWith("Arrow")) e.preventDefault();
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${current.label}`}
        onClick={() => {
          setActive(Math.max(0, options.findIndex((o) => o.value === value)));
          setOpen((o) => !o);
        }}
        onKeyDown={onKey}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-surface px-4 text-left shadow-[var(--shadow)] active:scale-[0.99]"
      >
        <span className="truncate">{current.label}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" aria-hidden="true">
          <path d="M7 10l5-5 5 5M7 14l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {mounted && (
          <motion.ul
            id={listId}
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={IOS_SPRING}
            style={{ opacity: open ? undefined : 0, transition: "opacity 120ms ease-out", pointerEvents: open ? "auto" : "none" }}
            className="no-scrollbar absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-72 origin-top overflow-y-auto rounded-2xl bg-surface p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] ring-1 ring-line"
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(o.value)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 ${i === active ? "bg-surface-2" : ""}`}
              >
                <span>
                  <span className="block">{o.label}</span>
                  {o.hint && <span className="block text-xs text-muted">{o.hint}</span>}
                </span>
                {o.value === value && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            ))}
          </motion.ul>
      )}
    </div>
  );
}
