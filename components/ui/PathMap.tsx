"use client";

import { motion } from "motion/react";
import Link from "@/components/navigation/PrefetchLink";
import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type PathNode = {
  key: string;
  /** Short text or an icon shown on the tile. */
  face: ReactNode;
  state: "done" | "missed" | "current" | "todo";
  title: string;
  href?: string;
  /** Shown under the tile (e.g. the lesson name). */
  caption?: string;
  /** Starts a new section on the path. */
  header?: string;
  /** Decoration placed on the empty side of the path. */
  decor?: ReactNode;
};

// Zig-zag columns, in pixels from the centre (inline, so the first frame is already in place).
const OFFSETS = [0, 78, 0, -78];

const STYLE: Record<PathNode["state"], { tile: string; edge: string; text: string }> = {
  done: { tile: "#81b64c", edge: "#5d8a33", text: "#fff" },
  missed: { tile: "#e07a6c", edge: "#b8574a", text: "#fff" },
  current: { tile: "#95c95a", edge: "#5d8a33", text: "#fff" },
  todo: { tile: "var(--surface-2)", edge: "color-mix(in srgb, var(--ink) 16%, transparent)", text: "var(--muted)" },
};

/** A climbing path of tiles: finished, missed, where you are now, and what's next. */
export function PathMap({ nodes, marker, reducedMotion = false, label }: { nodes: PathNode[]; marker?: ReactNode; reducedMotion?: boolean; label: string }) {
  return (
    <ol aria-label={label} className="path-map relative grid gap-3 justify-self-center overflow-x-clip px-2 pb-6 pt-6" style={{ width: "100%", maxWidth: 448 }}>
      {nodes.map((node, index) => {
        const style = STYLE[node.state];
        const offset = OFFSETS[index % OFFSETS.length];
        const tile = (
          <motion.span
            className="path-tile relative grid h-[76px] w-[76px] place-items-center"
            // The entrance is CSS, so it plays from the server HTML before any JavaScript loads.
            style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
            whileHover={reducedMotion || !node.href ? undefined : { y: -3 }}
            whileTap={reducedMotion || !node.href ? undefined : { scale: 0.94, y: 2 }}
          >
            {node.state === "current" && !reducedMotion && <span aria-hidden="true" className="absolute inset-[4px] rotate-45 animate-ping rounded-[20px] bg-[#81b64c]/30 [animation-duration:1.8s]" />}
            <span
              aria-hidden="true"
              className="absolute inset-0 rotate-45 rounded-[22px]"
              style={{ background: style.tile, boxShadow: `0 7px 0 ${style.edge}, 0 10px 18px rgb(0 0 0 / .14)` }}
            />
            <span className="relative text-2xl font-black tabular-nums leading-none" style={{ color: style.text }}>
              {node.state === "done" ? "✓" : node.state === "missed" ? "✕" : node.face}
            </span>
            {node.state === "current" && marker && <span className={`absolute top-1/2 z-10 -translate-y-1/2 ${offset > 0 ? "-left-14" : "-right-14"}`}>{marker}</span>}
          </motion.span>
        );
        return (
          <li key={node.key} className="relative grid justify-items-center gap-3" aria-current={node.state === "current" ? "step" : undefined}>
            {node.header && <span className="path-header rounded-full bg-surface px-4 py-1.5 text-sm font-black uppercase tracking-wide shadow-[var(--shadow)]">{node.header}</span>}
            {node.decor && offset !== 0 && <span aria-hidden="true" className="pointer-events-none absolute bottom-6 opacity-45" style={{ transform: `translateX(${-offset * 1.25}px)` }}>{node.decor}</span>}
            <div className="grid justify-items-center gap-1.5" style={{ transform: `translateX(${offset}px)` }}>
            {node.href ? (
              <Link href={node.href} aria-label={`${node.title}${node.state === "done" ? ", completed" : node.state === "missed" ? ", missed" : node.state === "current" ? ", up next" : ""}`} className="block rounded-[26px] outline-offset-4">
                {tile}
              </Link>
            ) : (
              <span className="block" role="img" aria-label={`${node.title}${node.state === "done" ? ", solved" : node.state === "missed" ? ", missed" : ""}`}>{tile}</span>
            )}
            {node.caption && <span className={`max-w-[132px] text-center text-[13px] font-bold leading-tight ${node.state === "todo" ? "text-muted" : "text-ink"}`}>{node.caption}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** One clear main action pinned above the tab bar, with an optional secondary icon button. */
export function StickyAction({ href, label, secondary, onClick, disabled = false }: { href?: string; label: string; secondary?: { href: string; label: string; icon: ReactNode }; onClick?: () => void; disabled?: boolean }) {
  // Rendered at the page root: the page-transition wrapper is transformed, which would pin a fixed bar to the page instead of the screen.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const bar = (
    <div className="sticky-action pointer-events-none fixed inset-x-0 z-40 px-3 lg:ps-[calc(var(--sidebar-w)+12px)]">
      <div className="pointer-events-auto mx-auto flex max-w-xl gap-2 rounded-[22px] bg-bg/90 p-2 backdrop-blur-md">
        {secondary && (
          <Link href={secondary.href} aria-label={secondary.label} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-surface-2 text-ink shadow-[0_4px_0_color-mix(in_srgb,var(--ink)_14%,transparent)]">
            {secondary.icon}
          </Link>
        )}
        {href ? (
          <Link href={href} data-primary-action className={PRIMARY}>
            {label}
          </Link>
        ) : (
          <button type="button" onClick={onClick} disabled={disabled} data-primary-action className={`${PRIMARY} disabled:opacity-50 disabled:active:translate-y-0`}>
            {label}
          </button>
        )}
      </div>
    </div>
  );
  return mounted ? createPortal(bar, document.body) : bar;
}

const PRIMARY = "grid h-14 min-w-0 flex-1 place-items-center rounded-2xl bg-[#81b64c] px-3 text-xl font-black text-white shadow-[0_5px_0_#5d8a33] transition-transform active:translate-y-[3px] active:shadow-[0_2px_0_#5d8a33]";

export const ListIcon = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true"><circle cx="5" cy="6.5" r="1.6" fill="currentColor" /><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="5" cy="17.5" r="1.6" fill="currentColor" /><path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
);
