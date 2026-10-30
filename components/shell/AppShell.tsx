"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import { ChallengeBanner } from "@/components/online/ChallengeBanner";
import { useConvexAuth } from "convex/react";
import { animate, motion, useDragControls, useMotionValue, useTransform } from "motion/react";
import Link from "@/components/navigation/PrefetchLink";
import { usePathname } from "next/navigation";
import { useAppRouter as useRouter } from "@/components/navigation/useAppRouter";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSettings } from "@/lib/client/settings";
import { playSound } from "@/lib/client/sound";
import { haptic } from "@/lib/client/haptics";
import { consumeTabNavigation, markTabNavigation, TAB_RESELECT_EVENT } from "@/lib/client/navIntent";
import { TabBar, tabFor, showsTabs, TABS, type Tab, type TabId } from "./TabBar";
import { useSync } from "@/lib/client/sync";
import { SocialPrefetch } from "@/lib/client/socialCache";
import { Button } from "@/components/ui/Button";

type ShellCtx = {
  openMenu: () => void;
  closeMenu: () => void;
  /** A game in progress hides the phone tab bar in favour of its own toolbar. */
  setGameFocus: (focused: boolean) => void;
  /** Go to a top-level destination the way its tab would (remembered page, or More's sheet). */
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

const SECTIONS: Array<{ title: string; items: Array<{ href: string; label: string; hint?: string }> }> = [
  {
    title: "Play",
    items: [
      { href: "/", label: "Full Power", hint: "Sherine · 3000" },
      { href: "/climb", label: "The Climb", hint: "Rated ladder" },
      { href: "/timed", label: "Timed", hint: "Clock presets" },
      { href: "/play", label: "Play a friend", hint: "Link · QR · PIN" },
    ],
  },
  {
    title: "Improve",
    items: [
      { href: "/learn", label: "Learn" },
      { href: "/time-machine", label: "Time Machine" },
      { href: "/progress", label: "Progress" },
    ],
  },
  {
    title: "You",
    items: [
      { href: "/profile", label: "Profile & Sherine" },
      { href: "/friends", label: "Friends", hint: "Requests · invites" },
      { href: "/u", label: "Players" },
      { href: "/settings", label: "Settings" },
    ],
  },
  { title: "Explore & support", items: [
  { href: "/search", label: "Search lessons & help" },
  { href: "/about", label: "About Chess by Chaos" },
  { href: "/help", label: "Help & FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/cookies", label: "Cookies & storage" },
  { href: "/accessibility", label: "Accessibility" },
  ] },
];

const SHEET_SPRING = { type: "spring" as const, stiffness: 400, damping: 38, mass: 1 };

export function AppShell({ children }: { children: ReactNode }) {
  const { reducedMotion, settings } = useSettings();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [gameFocus, setGameFocus] = useState(false);
  const tabsVisible = showsTabs(pathname) && !gameFocus;
  const activeTab: TabId = open ? "more" : tabFor(pathname);
  const [height, setHeight] = useState(800);
  // Single source of truth: sheet translateY. Everything else derives from it.
  const sheetY = useMotionValue(800);
  const progress = useTransform(sheetY, [height, 0], [0, 1], { clamp: true });
  const scale = useTransform(progress, [0, 1], [1, 0.955]);
  const radius = useTransform(progress, [0, 1], [0, 18]);
  const backY = useTransform(progress, [0, 1], [0, 10]);
  const dim = useTransform(progress, [0, 1], [0, 0.32]);
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const measure = () => {
      const h = Math.min(window.innerHeight * 0.88, 720);
      setHeight(h);
      if (!open) sheetY.set(h);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, sheetY]);

  const openMenu = useCallback(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
    if (settings.sound) playSound("sheet", settings.volume * 0.6);
    haptic("select");
    if (reducedMotion) sheetY.set(0);
    else animate(sheetY, 0, SHEET_SPRING);
  }, [reducedMotion, sheetY, settings.sound, settings.volume]);

  const closeMenu = useCallback(() => {
    const done = () => {
      setOpen(false);
      triggerRef.current?.focus?.();
    };
    if (reducedMotion) {
      sheetY.set(height);
      done();
    } else {
      void animate(sheetY, height, SHEET_SPRING).then(done);
    }
  }, [reducedMotion, sheetY, height]);

  // Going back to the page the menu was opened from re-opens the menu.
  // (Opened after the router has settled, so the close-on-navigate below can't undo it.)
  const openRef = useRef(openMenu);
  useEffect(() => {
    openRef.current = openMenu;
  });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onPop = () => {
      if (readMenuReturn() !== window.location.pathname) return;
      writeMenuReturn(null);
      timer = setTimeout(() => openRef.current(), 150);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Close on navigation.
  useEffect(() => {
    if (open) closeMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Focus trap + Escape.
  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    sheet?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
      } else if (e.key === "Tab" && sheet) {
        const focusables = [...sheet.querySelectorAll<HTMLElement>("a,button,[tabindex]:not([tabindex='-1'])")];
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeMenu]);

  // Each tab remembers the last page you had open in it, like a native tab stack.
  useEffect(() => {
    const tab = tabFor(pathname);
    if (tab === "more") return;
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
    if (tab.id === "more") {
      if (open) closeMenu();
      else openMenu();
      return;
    }
    if (tab.id === tabFor(pathname)) {
      // Re-tapping the current tab: back to its start page, or to the top.
      if (pathname === tab.href) {
        event?.preventDefault();
        consumeTabNavigation();
        window.dispatchEvent(new CustomEvent(TAB_RESELECT_EVENT, { detail: tab.href }));
        window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
      }
    }
  }, [open, openMenu, closeMenu, pathname, reducedMotion]);

  const goToTab = useCallback((id: TabId) => {
    const tab = TABS.find((t) => t.id === id)!;
    haptic("select");
    if (id === "more") return openMenu();
    const href = hrefFor(tab);
    if (href === pathname) window.dispatchEvent(new CustomEvent(TAB_RESELECT_EVENT, { detail: tab.href }));
    else {
      markTabNavigation();
      router.push(href);
    }
  }, [hrefFor, openMenu, pathname, router]);

  const value = useMemo(() => ({ openMenu, closeMenu, setGameFocus, goToTab }), [openMenu, closeMenu, goToTab]);

  return (
    <Ctx.Provider value={value}>
      <SocialPrefetch enabled={open} />
      <div className="fixed inset-0 -z-10 bg-black" aria-hidden="true" />
      <motion.div
        className="isolate min-h-dvh origin-top overflow-hidden bg-bg"
        data-tabbar={tabsVisible ? "on" : "off"}
        style={{ scale, borderRadius: radius, y: backY }}
        aria-hidden={open}
        inert={open}
      >
        {children}
      </motion.div>
      <ChallengeBanner />
      <TabBar visible={tabsVisible} active={activeTab} reducedMotion={reducedMotion} hrefFor={hrefFor} onSelect={selectTab} />
      {open && (
        <motion.div className="fixed inset-0 z-[60] bg-black" style={{ opacity: dim }} onClick={closeMenu} aria-hidden="true" />
      )}
      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-w-xl flex-col overflow-hidden rounded-t-[22px] bg-surface shadow-[0_-8px_40px_rgba(0,0,0,0.18)]"
        style={{ y: sheetY, height, visibility: open ? "visible" : "hidden" }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: height }}
        dragElastic={{ top: 0.04, bottom: 0.3 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > height * 0.25 || info.velocity.y > 600) closeMenu();
          else animate(sheetY, 0, SHEET_SPRING);
        }}
      >
        {/* No visible close: swipe down, tap outside or Escape. Screen readers still get a button. */}
        <div
          className="bg-surface cursor-grab touch-none px-5 pb-2 pt-3 active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
          <div className="mt-3 flex min-h-11 items-center">
            <span className="text-lg font-semibold">Chess by Chaos</span>
            <button onClick={closeMenu} className="sr-only focus-visible:not-sr-only focus-visible:ms-auto focus-visible:rounded-full focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm" aria-label="Close menu">
              Close
            </button>
          </div>
        </div>
        <nav className="no-scrollbar flex-1 overflow-y-auto overscroll-contain bg-surface px-4 pb-4">
          {SECTIONS.map((section) => (
            <div key={section.title} className="mt-3">
              <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted">{section.title}</p>
              <ul className="overflow-hidden rounded-2xl bg-surface-2">
                {section.items.map((item) => (
                  <li key={item.href} className="border-b border-line last:border-b-0">
                    <Link
                      href={item.href}
                      prefetch={open}
                      onClick={() => item.href !== pathname && writeMenuReturn(pathname)}
                      aria-current={pathname === item.href ? "page" : undefined}
                      className="flex min-h-12 items-center justify-between px-4 py-3 transition-colors active:bg-line/60"
                    >
                      <span className="font-medium">{item.label}</span>
                      {item.hint && <span className="text-sm text-muted">{item.hint}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <AccountRow />
          <p className="mt-6 px-2 text-xs text-muted">
            Open source (GPL-3.0). <Link href="/licenses" prefetch={false} className="underline">Licences & engine source</Link>
          </p>
        </nav>
        <div className="safe-bottom bg-surface" />
      </motion.div>
    </Ctx.Provider>
  );
}

function AccountRow() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { status } = useSync();
  return (
    <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
      {isLoading ? (
        <span className="text-sm text-muted">Checking account…</span>
      ) : isAuthenticated ? (
        <>
          <span className="text-sm text-muted">
            {status.pending > 0 ? `${status.pending} change${status.pending === 1 ? "" : "s"} waiting to sync` : status.online ? "Synced" : "Offline · saved on this device"}
          </span>
          <UserButton />
        </>
      ) : (
        <>
          <span className="text-sm text-muted">Games are saved on this device.</span>
          <SignInButton mode="modal">
            <button className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-text">Sign in to sync</button>
          </SignInButton>
        </>
      )}
    </div>
  );
}

/** Circular horizontal-ellipsis menu button. */
export function MenuButton() {
  const { openMenu } = useShell();
  return (
    <Button onClick={openMenu} aria-label="Open menu" aria-haspopup="dialog" className="grid h-11 w-11 shrink-0 place-items-center rounded-full">
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <circle cx="6" cy="12" r="1.8" fill="currentColor" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
        <circle cx="18" cy="12" r="1.8" fill="currentColor" />
      </svg>
    </Button>
  );
}

/** Simple page header for secondary pages. */
export function PageToolbar() {
  return <div className="safe-top sticky top-0 z-30 flex items-center justify-between bg-bg/95 px-4 pb-2"><BackButton /><MenuButton /></div>;
}

export function PageHeader({ title, back = true }: { title: string; back?: boolean }) {
  const topLevel = showsTabs(usePathname());
  return (
    <header className="safe-top sticky top-0 z-30 flex min-h-[60px] items-center justify-between gap-3 bg-bg/95 px-4 pb-2">
      <div className="flex min-w-0 items-center gap-2">
        {back && <BackButton />}
        <h1 className="truncate text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-3xl">{title}</h1>
      </div>
      {/* Phones reach the menu from the More tab on top-level pages. */}
      <div className={topLevel ? "max-lg:hidden" : undefined}><MenuButton /></div>
    </header>
  );
}

const MENU_RETURN_KEY = "cbc.menuReturn";

function readMenuReturn(): string | null {
  try {
    return sessionStorage.getItem(MENU_RETURN_KEY);
  } catch {
    return null;
  }
}

function writeMenuReturn(path: string | null): void {
  try {
    if (path) sessionStorage.setItem(MENU_RETURN_KEY, path);
    else sessionStorage.removeItem(MENU_RETURN_KEY);
  } catch {
    // Storage unavailable: back simply goes to the board.
  }
}

/** Back: returns to where the menu was opened (with the menu open), else to the board. */
function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  // Top-level pages on phones navigate with the tab bar; Back is for deeper pages and desktop.
  const topLevel = showsTabs(pathname);
  return (
    <Button
      onClick={() => {
        if (readMenuReturn() !== null && window.history.length > 1) router.back();
        else router.push("/");
      }}
      aria-label="Back"
      className={`${topLevel ? "max-lg:hidden" : ""} grid h-11 w-11 place-items-center rounded-full`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:rotate-180" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Button>
  );
}
