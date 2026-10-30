"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/client/settings";
import { inViewTransition } from "@/lib/client/viewTransition";
import { clearTabNavigation, isTabNavigation } from "@/lib/client/navIntent";

// A template re-mounts on every navigation, so each page gets an entrance
// that says where you went: deeper slides in from the right, back slides
// in from the left, and sideways moves (menu to menu) rise and fade.

let previousPath: string | null = null;
let wentBack = false;

function depth(path: string): number {
  return path.split("/").filter(Boolean).length;
}

type Entrance = { x: number; y: number; fade?: boolean };

function entranceFor(path: string): Entrance {
  const from = previousPath;
  const back = wentBack;
  // Tabs swap in place, like a native tab bar: a quick cross-fade, no slide.
  if (isTabNavigation()) return { x: 0, y: 0, fade: from !== null && from !== path };
  if (from === null || from === path) return { x: 0, y: 0 };
  if (back || depth(path) < depth(from)) return { x: -28, y: 0 };
  if (depth(path) > depth(from)) return { x: 28, y: 0 };
  return { x: 0, y: 14 };
}

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { reducedMotion } = useSettings();
  // Decided once per mount (per navigation).
  const [entrance] = useState(() => (typeof window === "undefined" ? { x: 0, y: 0 } : entranceFor(pathname)));
  // A view transition (e.g. a card opening) already animates the change; don't add a second one.
  const [viaViewTransition] = useState(() => typeof window !== "undefined" && inViewTransition());
  useEffect(() => {
    // Commit history after render: prefetch/render retries must not change it.
    previousPath = pathname;
    wentBack = false;
    clearTabNavigation();
    const onBack = () => { wentBack = true; };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [pathname]);
  const still = reducedMotion || viaViewTransition || (entrance.x === 0 && entrance.y === 0 && !entrance.fade);
  return (
    <motion.div
      initial={still ? false : { opacity: entrance.fade ? 0.4 : 0, x: entrance.x, y: entrance.y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: entrance.fade ? 0.12 : 0.18, ease: [0.32, 0.72, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}
