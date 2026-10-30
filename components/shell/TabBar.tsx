"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "@/components/navigation/PrefetchLink";
import type { ReactNode } from "react";
import { haptic } from "@/lib/client/haptics";
import { markTabNavigation } from "@/lib/client/navIntent";

export type TabId = "play" | "bots" | "learn" | "review" | "more";

export type Tab = { id: TabId; label: string; href: string };

/** The five top-level destinations on phones. Friends lives in its popup and in More; no chat. */
export const TABS: Tab[] = [
  { id: "play", label: "Play", href: "/" },
  { id: "bots", label: "Bots", href: "/climb" },
  { id: "learn", label: "Learn", href: "/learn" },
  { id: "review", label: "Review", href: "/time-machine" },
  { id: "more", label: "More", href: "/settings" },
];

/** Which tab a route belongs to. Anything that isn't a game, bot, lesson or review lives under More. */
export function tabFor(pathname: string): TabId {
  const first = pathname.split("/")[1] ?? "";
  if (first === "" || first === "game" || first === "play" || first === "timed") return "play";
  if (first === "climb") return "bots";
  if (first === "learn") return "learn";
  if (first === "time-machine" || first === "progress") return "review";
  return "more";
}

/**
 * Top-level pages show the tab bar; deeper pages (an online room, a lesson,
 * a reviewed game, a player card) are full-screen with their own controls.
 */
export function showsTabs(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length <= 1 && parts[0] !== "bench" && parts[0] !== "licenses";
}

const SPRING = { type: "spring" as const, stiffness: 520, damping: 40, mass: 0.8 };

function Icon({ id, active }: { id: TabId; active: boolean }) {
  const fill = active ? 0.16 : 0;
  const common = { fill: "none", stroke: "currentColor", strokeWidth: active ? 2 : 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const shapes: Record<TabId, ReactNode> = {
    // A board corner: four squares, two of them filled.
    play: <>
      <rect x="4" y="4" width="16" height="16" rx="3" {...common} fill="currentColor" fillOpacity={fill} />
      <path d="M4 12h16M12 4v16" {...common} />
      <path d="M5.5 5.5h5v5h-5zM13.5 13.5h5v5h-5z" fill="currentColor" stroke="none" opacity={active ? 0.9 : 0.55} />
    </>,
    // A friendly machine face.
    bots: <>
      <rect x="4.5" y="7.5" width="15" height="12" rx="4" {...common} fill="currentColor" fillOpacity={fill} />
      <path d="M12 7.5V4.5" {...common} />
      <circle cx="12" cy="3.8" r="1.1" fill="currentColor" />
      <circle cx="9.3" cy="13" r="1.35" fill="currentColor" />
      <circle cx="14.7" cy="13" r="1.35" fill="currentColor" />
      <path d="M10 16.4h4" {...common} />
    </>,
    // An open book.
    learn: <>
      <path d="M12 6.5C10 5 7 4.6 4 5v13c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5z" {...common} fill="currentColor" fillOpacity={fill} />
      <path d="M12 6.5v13" {...common} />
    </>,
    // A clock turning back: Time Machine.
    review: <>
      <path d="M4.8 9A8 8 0 1 1 4 12" {...common} />
      <path d="M4 5v4h4" {...common} />
      <circle cx="12" cy="12" r="5.2" fill="currentColor" opacity={fill} />
      <path d="M12 8v4l2.6 1.6" {...common} />
    </>,
    more: <>
      <circle cx="12" cy="12" r="8.5" {...common} fill="currentColor" fillOpacity={fill} />
      <circle cx="8.2" cy="12" r="1.15" fill="currentColor" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" />
      <circle cx="15.8" cy="12" r="1.15" fill="currentColor" />
    </>,
  };
  return <svg viewBox="0 0 24 24" className="h-[25px] w-[25px]" aria-hidden="true">{shapes[id]}</svg>;
}

type Props = {
  visible: boolean;
  active: TabId;
  reducedMotion: boolean;
  /** Where each tab goes back to (its last-visited page). */
  hrefFor: (tab: Tab) => string;
  onSelect: (tab: Tab, event: React.MouseEvent) => void;
};

/** Native-style bottom tabs for phones. Desktop keeps the header menu. */
export function TabBar({ visible, active, reducedMotion, hrefFor, onSelect }: Props) {
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.nav
          key="tabbar"
          aria-label="Main"
          className="tabbar fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface lg:hidden"
          initial={reducedMotion ? { opacity: 0 } : { y: "100%" }}
          animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { y: "100%" }}
          transition={reducedMotion ? { duration: 0.12 } : SPRING}
        >
          <ul className="mx-auto grid h-14 max-w-xl grid-cols-5">
            {TABS.map((tab) => {
              const current = tab.id === active;
              const content = (
                <>
                  <span className="relative grid h-8 w-14 place-items-center">
                    {current && (
                      <motion.span
                        layoutId={reducedMotion ? undefined : "tab-pill"}
                        className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--brand)_16%,transparent)]"
                        transition={SPRING}
                      />
                    )}
                    <motion.span
                      className="relative"
                      animate={current && !reducedMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                      transition={{ duration: 0.28, ease: [0.3, 0.7, 0.2, 1] }}
                    >
                      <Icon id={tab.id} active={current} />
                    </motion.span>
                  </span>
                  <span className={`text-[11px] leading-none tracking-[0.01em] ${current ? "font-semibold text-ink" : "font-medium"}`}>{tab.label}</span>
                </>
              );
              const className = `flex h-full w-full touch-manipulation select-none flex-col items-center justify-center gap-[3px] transition-colors active:opacity-70 ${current ? "text-ink" : "text-muted"}`;
              return (
                <li key={tab.id} className="min-w-0">
                  {tab.id === "more" ? (
                    <button type="button" onClick={(e) => onSelect(tab, e)} className={className} aria-haspopup="dialog" aria-current={current ? "page" : undefined}>
                      {content}
                    </button>
                  ) : (
                    <Link
                      href={hrefFor(tab)}
                      onClick={(e) => {
                        haptic("select");
                        markTabNavigation();
                        onSelect(tab, e);
                      }}
                      className={className}
                      aria-current={current ? "page" : undefined}
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
