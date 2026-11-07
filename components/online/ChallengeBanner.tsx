"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useSocialTime } from "@/lib/client/socialCache";
import { AnimatePresence, motion } from "motion/react";
import Link from "@/components/navigation/PrefetchLink";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { Avatar } from "@/components/profile/ChessCard";
import { IOS_SPRING } from "@/components/ui/Switch";
import { playSound } from "@/lib/client/sound";
import { useSettings } from "@/lib/client/settings";

/** Shows a notification through the service worker (works in background tabs), if allowed. */
async function showSystemNotification(title: string, url: string, tag: string) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    // With push on, the server's notification is already on its way; don't double up.
    if (await registration?.pushManager?.getSubscription()) return;
    await registration?.showNotification(title, { body: "Tap to play", tag, icon: "/icon-192.png", data: { url } });
  } catch {
    // Notifications are a nicety; the banner is still shown.
  }
}

/** "@sara challenged you": shown on every page while a friend's invite is open. */
export function ChallengeBanner() {
  const { isAuthenticated } = useConvexAuth();
  const pathname = usePathname();
  const { settings } = useSettings();
  const mountedAt = useSocialTime();
  const data = useQuery(api.friends.overview, isAuthenticated ? { now: mountedAt } : "skip");
  const dismiss = useMutation(api.friends.dismissChallenge);
  const challenge = data?.challenges.find((c) => !pathname.startsWith(`/play/${c.code}`));
  const hidden = pathname === "/friends";

  // Every signed-in player gets a username straight away, so friends can find them.
  const ensure = useMutation(api.profiles.ensure);
  const needsProfile = isAuthenticated && data !== undefined && data !== null && data.me === null;
  useEffect(() => { if (needsProfile) void ensure({}).catch(() => {}); }, [needsProfile, ensure]);

  // A soft ping when a new invite arrives; a system notification if this tab is in the background.
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (!challenge || announced.current === challenge.id) return;
    announced.current = challenge.id;
    if (settings.sound) playSound("challenge", settings.volume);
    if (document.visibilityState === "hidden") void showSystemNotification(`@${challenge.from.alias} challenged you`, `/play/${challenge.code}`, `challenge-${challenge.code}`);
  }, [challenge, settings.sound, settings.volume]);

  // "(2) Chess by Chaos" while challenges or requests wait.
  const waiting = (data?.challenges.length ?? 0) + (data?.incoming.length ?? 0);
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = waiting > 0 ? `(${waiting}) ${base}` : base;
  }, [waiting, pathname]);

  return (
    <AnimatePresence>
      {challenge && !hidden && (
        <motion.div
          key={challenge.id}
          role="status"
          className="safe-top pointer-events-none fixed inset-x-0 top-0 z-[75] flex justify-center px-3"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={IOS_SPRING}
        >
          <div className="pointer-events-auto mt-1 flex w-full max-w-md items-center gap-3 rounded-2xl bg-surface p-2.5 pl-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <span className="shrink-0 overflow-hidden rounded-xl"><Avatar seed={challenge.from.avatarSeed} hue={challenge.from.hue} size={36} /></span>
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">@{challenge.from.alias}</span> challenged you
            </p>
            <Link href={`/play/${challenge.code}`} className="grid min-h-10 shrink-0 place-items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-text">
              Play
            </Link>
            <button onClick={() => void dismiss({ id: challenge.id })} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted" aria-label="Dismiss invite">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
