"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import { ChallengeBanner } from "@/components/online/ChallengeBanner";
import { useConvexAuth } from "convex/react";
import Link from "@/components/navigation/PrefetchLink";
import { usePathname } from "next/navigation";
import { useAppRouter as useRouter } from "@/components/navigation/useAppRouter";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSettings } from "@/lib/client/settings";
import { haptic } from "@/lib/client/haptics";
import { clearTabNavigation, markTabNavigation, TAB_RESELECT_EVENT } from "@/lib/client/navIntent";
import { TabBar, tabFor, showsTabs, TABS, type Tab, type TabId } from "./TabBar";
import { useSync } from "@/lib/client/sync";
import { SocialPrefetch } from "@/lib/client/socialCache";
import { Button } from "@/components/ui/Button";
import { Sidebar } from "./Sidebar";

type ShellCtx = {
  /** Opens More (the page that lists everything else). */
  openMenu: () => void;
  closeMenu: () => void;
  /** A game screen swaps the phone tab bar for its own toolbar. */
  setGameFocus: (focused: boolean) => void;
  /** Go to a top-level destination the way its tab would (its remembered page). */
  goToTab: (id: TabId) => void;
};
const Ctx = createContext<ShellCtx | null>(null);
export const useShell = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShell outside AppShell");
  return c;
};

/** While mounted and `focused`, the phone tab bar steps aside for game controls. */
export function useGameFocus(focused: boolean | null): void {
  const shell = useContext(Ctx);
  const setGameFocus = shell?.setGameFocus;
  useEffect(() => {
    // null = not known yet (still loading): keep whatever is showing, no flicker.
    if (!setGameFocus || focused === null) return;
    setGameFocus(focused);
  }, [setGameFocus, focused]);
  useEffect(() => () => setGameFocus?.(false), [setGameFocus]);
}

const TAB_MEMORY_KEY = "cbc.tabs.v1";

function readTabMemory(): Partial<Record<TabId, string>> {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(TAB_MEMORY_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const memory: Partial<Record<TabId, string>> = {};
    for (const tab of TABS) {
      const value = (parsed as Record<string, unknown>)[tab.id];
      // Only same-site paths: never a full URL.
      if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) memory[tab.id] = value;
    }
    return memory;
  } catch {
    return {};
  }
}

/** In-app page visits this session, so Back knows whether there is somewhere to go back to. */
let visits = 0;

/**
 * One navigation system, mobile first:
 * - Phones: five bottom tabs (Play, Bots, Learn, Review, More). More is a real
 *   page listing everything else. Game screens swap the tabs for their own bar.
 * - Desktop: a left sidebar with the same destinations (chess.com style).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { reducedMotion } = useSettings();
  const pathname = usePathname();
  const router = useRouter();
  const [gameFocus, setGameFocus] = useState(false);
  const tabsVisible = showsTabs(pathname) && !gameFocus;
  const activeTab: TabId = tabFor(pathname);

  useEffect(() => { visits++; }, [pathname]);

  // Each tab remembers the last page you had open in it, like a native tab stack.
  useEffect(() => {
    const tab = tabFor(pathname);
    try {
      sessionStorage.setItem(TAB_MEMORY_KEY, JSON.stringify({ ...readTabMemory(), [tab]: pathname }));
    } catch {
      // Storage unavailable: tabs open their start page.
    }
  }, [pathname]);
  const hrefFor = useCallback((tab: Tab) => {
    if (tab.id === tabFor(pathname)) return tab.href;
    return readTabMemory()[tab.id] ?? tab.href;
  }, [pathname]);

  const selectTab = useCallback((tab: Tab, event?: React.MouseEvent) => {
    if (tab.id !== tabFor(pathname) || pathname !== tab.href) return;
    // Re-tapping the current tab on its start page: back to the top (and its first view).
    event?.preventDefault();
    clearTabNavigation();
    window.dispatchEvent(new CustomEvent(TAB_RESELECT_EVENT, { detail: tab.href }));
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }, [pathname, reducedMotion]);

  const goToTab = useCallback((id: TabId) => {
    const tab = TABS.find((t) => t.id === id)!;
    haptic("select");
    const href = hrefFor(tab);
    if (href === pathname) window.dispatchEvent(new CustomEvent(TAB_RESELECT_EVENT, { detail: tab.href }));
    else {
      markTabNavigation();
      router.push(href);
    }
  }, [hrefFor, pathname, router]);

  const openMenu = useCallback(() => goToTab("more"), [goToTab]);
  const closeMenu = useCallback(() => {}, []);
  const value = useMemo(() => ({ openMenu, closeMenu, setGameFocus, goToTab }), [openMenu, closeMenu, goToTab]);

  return (
    <Ctx.Provider value={value}>
      <SocialPrefetch enabled={pathname === "/more"} />
      <Sidebar pathname={pathname} />
      <div className="app-content isolate min-h-dvh bg-bg" data-tabbar={tabsVisible ? "on" : "off"}>
        {children}
      </div>
      <ChallengeBanner />
      <TabBar visible={tabsVisible} active={activeTab} reducedMotion={reducedMotion} hrefFor={hrefFor} onSelect={selectTab} />
    </Ctx.Provider>
  );
}

/** Account and sync state, shown on More and in the desktop sidebar. */
export function AccountCard({ compact = false }: { compact?: boolean }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { status } = useSync();
  const text = isLoading ? "Checking account…" : isAuthenticated
    ? status.pending > 0 ? `${status.pending} change${status.pending === 1 ? "" : "s"} waiting to sync` : status.online ? "Synced" : "Offline · saved on this device"
    : "Games are saved on this device.";
  return (
    <div className={`flex items-center justify-between gap-3 ${compact ? "" : "rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow)]"}`}>
      <span className={`min-w-0 text-sm text-muted ${compact ? "max-xl:sr-only" : ""}`}>{text}</span>
      {!isLoading && (isAuthenticated ? <UserButton /> : (
        <SignInButton mode="modal">
          <button className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-text">{compact ? "Sign in" : "Sign in to sync"}</button>
        </SignInButton>
      ))}
    </div>
  );
}

/** Opens More. Phones use the More tab, desktop the sidebar; kept for deep full-screen pages. */
export function MenuButton() {
  return (
    <Link href="/more" aria-label="More" className="press-overlay grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface text-ink ring-1 ring-inset ring-line/70 lg:hidden">
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <circle cx="6" cy="12" r="1.8" fill="currentColor" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
        <circle cx="18" cy="12" r="1.8" fill="currentColor" />
      </svg>
    </Link>
  );
}

/** Simple page header for secondary pages. */
export function PageToolbar() {
  return <div className="safe-top sticky top-0 z-30 flex items-center justify-between bg-bg/95 px-4 pb-2"><BackButton /></div>;
}

export function PageHeader({ title, back = true }: { title: string; back?: boolean }) {
  return (
    <header className="safe-top sticky top-0 z-30 flex min-h-[60px] items-center gap-2 bg-bg/95 px-4 pb-2 lg:pt-6">
      {back && <BackButton />}
      <h1 className="truncate text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-3xl">{title}</h1>
    </header>
  );
}

/** Parent of a path ("/learn/abc" → "/learn"); top-level pages have none. */
function parentOf(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";
  if (parts[0] === "game") return "/time-machine";
  return `/${parts.slice(0, -1).join("/")}`;
}

/** Back on deeper pages: the previous in-app page, else the page above this one. Top-level pages have tabs/sidebar instead. */
function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  if (showsTabs(pathname)) return null;
  return (
    <Button
      onClick={() => {
        if (visits > 1 && window.history.length > 1) router.back();
        else router.push(parentOf(pathname));
      }}
      aria-label="Back"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:rotate-180" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Button>
  );
}
