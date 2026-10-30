"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "@/components/navigation/PrefetchLink";
import { haptic } from "@/lib/client/haptics";
import { markTabNavigation } from "@/lib/client/navIntent";
import { NavIcon } from "./NavIcon";

export type TabId = "play" | "bots" | "learn" | "review" | "more";

export type Tab = { id: TabId; label: string; href: string };

/** The five top-level destinations on phones. Friends lives in its popup and in More; no chat. */
export const TABS: Tab[] = [
  { id: "play", label: "Play", href: "/" },
  { id: "bots", label: "Bots", href: "/climb" },
  { id: "learn", label: "Learn", href: "/learn" },
  { id: "review", label: "Review", href: "/time-machine" },
  { id: "more", label: "More", href: "/more" },
];

/** Which tab a route belongs to. Anything that isn't a game, bot, lesson or review lives under More (/more). */
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
  // "/" is the instant board: a full-screen game screen, like a native chess app.
  return parts.length === 1 && parts[0] !== "bench" && parts[0] !== "licenses";
}

const SPRING = { type: "spring" as const, stiffness: 520, damping: 40, mass: 0.8 };

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
                      <NavIcon name={tab.id} active={current} />
                    </motion.span>
                  </span>
                  <span className={`text-[11px] leading-none tracking-[0.01em] ${current ? "font-semibold text-ink" : "font-medium"}`}>{tab.label}</span>
                </>
              );
              const className = `flex h-full w-full touch-manipulation select-none flex-col items-center justify-center gap-[3px] transition-colors active:opacity-70 ${current ? "text-ink" : "text-muted"}`;
              return (
                <li key={tab.id} className="min-w-0">
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
