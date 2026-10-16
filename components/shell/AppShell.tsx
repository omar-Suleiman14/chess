"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { animate, motion, useDragControls, useMotionValue, useTransform } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSettings } from "@/lib/client/settings";
import { playSound } from "@/lib/client/sound";
import { useSync } from "@/lib/client/sync";

type ShellCtx = { openMenu: () => void; closeMenu: () => void };
const Ctx = createContext<ShellCtx | null>(null);
export const useShell = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShell outside AppShell");
  return c;
};

const SECTIONS: Array<{ title: string; items: Array<{ href: string; label: string; hint?: string }> }> = [
  {
    title: "Play",
    items: [
      { href: "/", label: "Full Power", hint: "Fatma · 3000" },
      { href: "/climb", label: "The Climb", hint: "Rated ladder" },
      { href: "/timed", label: "Timed", hint: "Clock presets" },
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
      { href: "/profile", label: "Profile & Fatma" },
      { href: "/u", label: "Players" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

const SHEET_SPRING = { type: "spring" as const, stiffness: 400, damping: 38, mass: 1 };

export function AppShell({ children }: { children: ReactNode }) {
  const { reducedMotion, settings } = useSettings();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
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

  const value = useMemo(() => ({ openMenu, closeMenu }), [openMenu, closeMenu]);

  return (
    <Ctx.Provider value={value}>
      <div className="fixed inset-0 -z-10 bg-black" aria-hidden="true" />
      <motion.div
        className="min-h-dvh origin-top overflow-hidden bg-bg"
        style={{ scale, borderRadius: radius, y: backY }}
        aria-hidden={open}
        inert={open}
      >
        {children}
      </motion.div>
      {open && (
        <motion.div className="fixed inset-0 z-[60] bg-black" style={{ opacity: dim }} onClick={closeMenu} aria-hidden="true" />
      )}
      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-w-xl flex-col rounded-t-[22px] bg-surface shadow-[0_-8px_40px_rgba(0,0,0,0.18)]"
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
        <div className="cursor-grab touch-none px-5 pb-2 pt-3 active:cursor-grabbing" onPointerDown={(e) => dragControls.start(e)}>
          <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-lg font-semibold">Chess by Chaos</span>
            <button onClick={closeMenu} className="grid h-11 w-11 place-items-center rounded-full bg-surface-2" aria-label="Close menu">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <nav className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {SECTIONS.map((section) => (
            <div key={section.title} className="mt-3">
              <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted">{section.title}</p>
              <ul className="overflow-hidden rounded-2xl bg-surface-2">
                {section.items.map((item) => (
                  <li key={item.href} className="border-b border-line last:border-b-0">
                    <Link
                      href={item.href}
                      prefetch={false}
                      onPointerEnter={() => router.prefetch(item.href)}
                      onFocus={() => router.prefetch(item.href)}
                      onTouchStart={() => router.prefetch(item.href)}
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
        <div className="safe-bottom" />
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
    <button onClick={openMenu} aria-label="Open menu" aria-haspopup="dialog" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface shadow-[var(--shadow)] active:scale-95">
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <circle cx="6" cy="12" r="1.8" fill="currentColor" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
        <circle cx="18" cy="12" r="1.8" fill="currentColor" />
      </svg>
    </button>
  );
}

/** Simple page header for secondary pages. */
export function PageHeader({ title, back = true }: { title: string; back?: boolean }) {
  return (
    <header className="safe-top sticky top-0 z-30 flex items-center justify-between gap-3 bg-bg/95 px-4 pb-2">
      <div className="flex items-center gap-2">
        {back && (
          <Link href="/" prefetch={false} aria-label="Back to the board" className="grid h-11 w-11 place-items-center rounded-full">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <MenuButton />
    </header>
  );
}
