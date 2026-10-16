"use client";

import type { useRouter } from "next/navigation";
import { flushSync } from "react-dom";

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

function startFn(): StartViewTransition | undefined {
  return (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition?.bind(document);
}

function motionReduced(): boolean {
  const motion = document.documentElement.dataset.motion;
  return motion === "reduced" || (!motion && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

/**
 * Runs a React state change inside a view transition, so elements sharing a
 * `view-transition-name` morph between the old and new UI. Falls back to a
 * plain update without the API, under reduced motion, or mid-transition.
 */
export function runViewTransition(update: () => void): void {
  const start = startFn();
  if (!start || motionReduced() || active) {
    update();
    return;
  }
  active = true;
  const done = () => {
    active = false;
  };
  try {
    const transition = start(async () => flushSync(update));
    transition.ready.catch(() => {});
    transition.updateCallbackDone.catch(() => {});
    void transition.finished.then(done, done);
  } catch {
    done();
    update();
  }
}

/** Play a friend: the create button, the QR invite and the board morph into one another. */
export const PLAY_STAGE = "play-stage";

export async function navigateWithTransition(router: Router, href: string): Promise<void> {
  const start = startFn();
  if (!start || motionReduced() || active) {
    router.push(href);
    return;
  }
  const target = new URL(href, window.location.href).pathname;
  active = true;
  let transition: ViewTransition;
  try {
    transition = start(
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
  } catch {
    active = false;
    router.push(href);
    return;
  }
  const done = () => {
    active = false;
  };
  transition.ready.catch(() => {});
  transition.updateCallbackDone.catch(() => {});
  await transition.finished.then(done, done);
}

/** A stable, CSS-safe view-transition-name for a card. */
export function cardTransitionName(alias: string): string {
  return `card-${alias.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}
