"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Avatar } from "@/components/profile/ChessCard";
import { IOS_SPRING } from "@/components/ui/Switch";
import { playSound } from "@/lib/client/sound";
import { useSettings } from "@/lib/client/settings";

/** "@sara challenged you": shown on every page while a friend's invite is open. */
export function ChallengeBanner() {
  const { isAuthenticated } = useConvexAuth();
  const pathname = usePathname();
  const { settings } = useSettings();
  const [mountedAt] = useState(() => Date.now());
  const data = useQuery(api.friends.overview, isAuthenticated ? { now: mountedAt } : "skip");
  const dismiss = useMutation(api.friends.dismissChallenge);
  const challenge = data?.challenges.find((c) => !pathname.startsWith(`/play/${c.code}`));
  const hidden = pathname === "/friends";

  // A soft ping when a new invite arrives.
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (!challenge || announced.current === challenge.id) return;
    announced.current = challenge.id;
    if (settings.sound) playSound("end", settings.volume * 0.7);
  }, [challenge, settings.sound, settings.volume]);

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
