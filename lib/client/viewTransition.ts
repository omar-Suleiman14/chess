"use client";

import type { useRouter } from "next/navigation";

// Same-document View Transitions around a Next.js navigation: the browser
// snapshots the old page, we navigate, and elements sharing a
// `view-transition-name` (e.g. a card) morph from the old spot to the new one.
// Browsers without the API (or with reduced motion) just navigate.

type Router = ReturnType<typeof useRouter>;
type ViewTransition = { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void> };
type StartViewTransition = (update: () => Promise<void>) => ViewTransition;

let active = false;

/** True while a view transition navigation runs (the page template skips its own entrance then). */
export function inViewTransition(): boolean {
  return active;
}

export function navigateWithTransition(router: Router, href: string): void {
  const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition?.bind(document);
  if (!start || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    router.push(href);
    return;
  }
  const target = new URL(href, window.location.href).pathname;
  active = true;
  const transition = start(
    () =>
      new Promise<void>((resolve) => {
        router.push(href);
        // Resolve once the new route shows its card, or after a short cap so a slow
        // load never freezes the page (timers, not rAF: rAF pauses in hidden tabs).
        const began = Date.now();
        const check = () => {
          if ((window.location.pathname === target && document.querySelector("[data-vt-ready]")) || Date.now() - began > 700) resolve();
          else setTimeout(check, 16);
        };
        check();
      }),
  );
  const done = () => {
    active = false;
  };
  transition.ready.catch(() => {});
  transition.updateCallbackDone.catch(() => {});
  transition.finished.then(done, done);
}

/** A stable, CSS-safe view-transition-name for a card. */
export function cardTransitionName(alias: string): string {
  return `card-${alias.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}
