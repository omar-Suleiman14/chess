"use client";

import { usePushNotifications } from "@/lib/client/push";

/** Opt in to challenge and friend-request notifications on this device. */
export function NotificationsCard() {
  const { state, enable, disable, error } = usePushNotifications();
  if (state === "unavailable" || state === "signed-out") return null;
  const text: Record<string, string> = {
    unsupported: "This browser can't show notifications. On iPhone, add Chess by Chaos to your Home Screen first.",
    denied: "Notifications are blocked for this site. Allow them in your browser's site settings.",
    off: "Get a notification when a friend challenges you or sends a request, even when Chess by Chaos is closed.",
    on: "You'll be notified about challenges and friend requests on this device.",
    working: "Setting up notifications…",
  };
  return (
    <section className="flex items-center gap-3 rounded-3xl bg-surface p-4 shadow-[var(--shadow)]" aria-label="Notifications">
      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-xl">🔔</span>
      <p className="min-w-0 flex-1 text-sm">
        <span className="block font-semibold">Challenge notifications</span>
        <span className="block text-muted">{error ?? text[state]}</span>
      </p>
      {state === "off" && <button onClick={() => void enable()} className="min-h-10 shrink-0 rounded-full bg-accent px-4 text-sm font-semibold text-accent-text">Turn on</button>}
      {state === "on" && <button onClick={() => void disable()} className="min-h-10 shrink-0 rounded-full bg-surface-2 px-4 text-sm font-semibold">Turn off</button>}
    </section>
  );
}
