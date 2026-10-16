"use client";

import { useEffect, useRef } from "react";
import type { TreeNode } from "@/lib/chess/history/tree";

/**
 * Chess.com-style move list: one scrollable row of SAN moves. The move on the
 * board is highlighted and kept in view, so stepping back and forth walks
 * through this bar. Tap any move to jump to it.
 */
export function MoveStrip({ line, cursor, onSelect }: { line: Pick<TreeNode, "key" | "ply" | "san">[]; cursor: number; onSelect: (ply: number) => void }) {
  const ref = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = ref.current;
    const active = el?.querySelector<HTMLElement>("[aria-current=true]");
    if (!el) return;
    if (!active) {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    // Scroll only the strip (scrollIntoView would also scroll the page).
    const left = active.offsetLeft - el.clientWidth / 2 + active.offsetWidth / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [cursor, line.length]);

  return (
    <nav aria-label="Moves" dir="ltr" className="mb-2 h-10 w-full overflow-hidden rounded-xl bg-surface shadow-[var(--shadow)]">
      {line.length === 0 ? (
        <p className="flex h-full items-center px-3 text-sm text-muted">Moves will appear here</p>
      ) : (
        <ol ref={ref} className="no-scrollbar flex h-full items-center gap-0.5 overflow-x-auto px-2 text-sm">
          {line.map((node) => {
            const white = node.ply % 2 === 1;
            const current = node.ply === cursor;
            return (
              <li key={node.key} className="flex shrink-0 items-center">
                {white && <span className="ml-1.5 mr-0.5 tabular-nums text-muted">{(node.ply + 1) / 2}.</span>}
                <button
                  onClick={() => onSelect(node.ply)}
                  aria-current={current}
                  aria-label={`${white ? "White" : "Black"} move ${Math.ceil(node.ply / 2)}: ${node.san}`}
                  className={`rounded-md px-1.5 py-1 font-semibold ${current ? "bg-accent text-accent-text" : "text-ink"}`}
                >
                  {node.san}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}

/** Desktop side-panel version: numbered rows, White and Black side by side. */
export function MoveList({ line, cursor, onSelect, className = "" }: { line: Pick<TreeNode, "key" | "ply" | "san">[]; cursor: number; onSelect: (ply: number) => void; className?: string }) {
  const ref = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = ref.current;
    const active = el?.querySelector<HTMLElement>("[aria-current=true]");
    if (!el) return;
    const top = active ? active.offsetTop - el.clientHeight / 2 + active.offsetHeight / 2 : el.scrollHeight;
    el.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [cursor, line.length]);

  const rows: Pick<TreeNode, "key" | "ply" | "san">[][] = [];
  for (const node of line) {
    if (node.ply % 2 === 1 || rows.length === 0) rows.push([]);
    rows[rows.length - 1].push(node);
  }

  const cell = (node: Pick<TreeNode, "key" | "ply" | "san"> | undefined) =>
    node ? (
      <button
        onClick={() => onSelect(node.ply)}
        aria-current={node.ply === cursor}
        aria-label={`${node.ply % 2 === 1 ? "White" : "Black"} move ${Math.ceil(node.ply / 2)}: ${node.san}`}
        className={`rounded-md px-2 py-1 text-left font-semibold ${node.ply === cursor ? "bg-accent text-accent-text" : "text-ink hover:bg-surface-2"}`}
      >
        {node.san}
      </button>
    ) : (
      <span />
    );

  return (
    <nav aria-label="Moves" dir="ltr" className={`min-h-0 flex-col overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow)] ${className}`}>
      {line.length === 0 ? (
        <p className="p-4 text-sm text-muted">Moves will appear here</p>
      ) : (
        <ol ref={ref} className="min-h-0 flex-1 overflow-y-auto p-2 text-sm">
          {rows.map((pair, i) => (
            <li key={pair[0].key} className={`grid grid-cols-[2.5rem_1fr_1fr] items-center rounded-md ${i % 2 ? "bg-surface-2/50" : ""}`}>
              <span className="pl-2 tabular-nums text-muted">{Math.ceil(pair[0].ply / 2)}.</span>
              {pair[0].ply % 2 === 0 ? <><span className="px-2 text-muted">…</span>{cell(pair[0])}</> : <>{cell(pair[0])}{cell(pair[1])}</>}
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
