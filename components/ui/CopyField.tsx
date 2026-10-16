"use client";

import { useEffect, useState } from "react";

/** A value that copies itself on click, with a clipboard icon that confirms with a check. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard blocked (e.g. insecure context): select the text so it can be copied by hand.
      const sel = window.getSelection();
      const node = document.getElementById(`copy-${label}`);
      if (sel && node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`${label}: ${value}. ${copied ? "Copied" : "Click to copy"}`}
      className="group flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-surface-2 py-2 pl-3 pr-2 text-left transition-colors active:bg-line/60"
    >
      <code id={`copy-${label}`} className="min-w-0 break-all text-sm">
        {value}
      </code>
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${copied ? "bg-[#0a84ff] text-white" : "bg-surface text-muted group-hover:text-ink"}`}
        aria-hidden="true"
      >
        {copied ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4"><rect x="8" y="8" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
        )}
      </span>
      <span className="sr-only" aria-live="polite">{copied ? "Copied to clipboard" : ""}</span>
    </button>
  );
}
