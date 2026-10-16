"use client";

import { SignInButton } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useCardScope, useLocalCardQuery } from "@/lib/client/localCardCache";
import Link from "@/components/navigation/PrefetchLink";
import { useAppRouter as useRouter } from "@/components/navigation/useAppRouter";
import { use, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "@/convex/_generated/api";
import { ChallengeDialog } from "@/components/online/ChallengeDialog";
import { ChessCard, themeOf } from "@/components/profile/ChessCard";
import { useShyTilt } from "@/components/profile/useShyTilt";
import { MenuButton } from "@/components/shell/AppShell";
import { useSettings } from "@/lib/client/settings";
import { useOrigin } from "@/lib/client/useOrigin";
import { cardTransitionName } from "@/lib/client/viewTransition";

type Relation = "signed_out" | "self" | "none" | "outgoing" | "incoming" | "friends";

/** The backdrop glows in the card's own colours, whatever the app theme. */
function glow(cardTheme: string): CSSProperties {
  const [a = "#a9cbff", b = "#72a9ff", c = "#33d4f2"] = themeOf(cardTheme).art.match(/#[0-9a-f]{6}/gi) ?? [];
  return { ["--a" as string]: a, ["--b" as string]: b, ["--c" as string]: c };
}

const Arrow = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** A player's card: what their QR code opens. Add them, challenge them, share or download it. */
export default function PlayerCardPage({ params }: { params: Promise<{ alias: string }> }) {
  const { alias } = use(params);
  const router = useRouter();
  const scope = useCardScope();
  const card = useLocalCardQuery(api.profiles.publicCard, { alias }, scope);
  const relation = useQuery(api.friends.relation, { alias });
  const { reducedMotion } = useSettings();
  const origin = useOrigin();
  const url = `${origin}/u/${alias}`;
  const [flipped, setFlipped] = useState(false);
  const [challenging, setChallenging] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  // The card leans and drifts away from the mouse, with a glare following it.
  const tiltTargets = useCallback(() => (tiltRef.current ? [tiltRef.current] : []), []);
  useShyTilt(tiltRef, tiltTargets);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator.share === "function");
  }, []);

  const share = async () => {
    try {
      if (canShare) await navigator.share({ title: `@${alias} on Chess by Chaos`, url });
      else {
        await navigator.clipboard.writeText(url);
        setNote("Link copied");
      }
    } catch {
      // Dismissed.
    }
  };

  const download = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    setFlipped(false);
    try {
      const { toPng } = await import("html-to-image");
      // The QR side is skipped: the image is the card's front.
      const png = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true, filter: (node) => !(node instanceof HTMLElement && (node.dataset.cardBack || node.classList.contains("card-public__glare"))) });
      const a = document.createElement("a");
      a.href = png;
      a.download = `${alias}-chess-card.png`;
      a.click();
    } catch {
      setNote("Couldn't make the image. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  const state = relation?.state;
  const loading = card === undefined;

  return (
    <main className="card-public" style={card ? glow(card.cardTheme) : undefined}>
      <div className="safe-top fixed inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-2">
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/u"))}
          className="card-public__btn !min-h-11 !w-11 !p-0"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <MenuButton />
      </div>

      <div className="grid w-full max-w-4xl justify-items-center gap-6 pt-12 text-center">
        <h1 className="sr-only">@{alias}</h1>
        {loading && <LoadingSpinner label="Loading card" />}

        {!loading && state === "missing" && (
          <div className="grid justify-items-center gap-4">
            <p className="text-[clamp(26px,5vw,40px)] font-bold tracking-tight">No player called @{alias}</p>
            <Link className="card-public__cta" href="/u">See all players <Arrow /></Link>
          </div>
        )}

        {!loading && card && (
          <div ref={tiltRef} className="card-public__card card-public__tilt" data-vt-ready style={{ viewTransitionName: cardTransitionName(alias) }}>
            <div ref={cardRef} className="relative">
              <ChessCard face="identity" data={card} url={url} flipped={flipped} onFlip={() => setFlipped((f) => !f)} reducedMotion={reducedMotion} />
              {!flipped && <span className="card-public__glare" aria-hidden="true" />}
            </div>
          </div>
        )}

        {!loading && card === null && state && state !== "missing" && (
          <div className="grid max-w-sm justify-items-center gap-2 rounded-3xl bg-surface p-8" data-vt-ready>
            <p className="text-2xl font-bold">@{alias}</p>
            <p className="text-sm text-[#6e6e73]">This card is private. Become friends to see it.</p>
          </div>
        )}

        {!loading && state && state !== "missing" && (
          <>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {card && (
                <button className="card-public__btn" onClick={() => void download()} disabled={downloading}>
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {downloading ? "Preparing…" : "Download card"}
                </button>
              )}
              {card && (
                <button className="card-public__btn" onClick={() => void share()}>
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                  {canShare ? "Share card" : "Copy link"}
                </button>
              )}
              <FriendButton alias={alias} state={state} />
              {state === "friends" && (
                <button className="card-public__btn" onClick={() => setChallenging(true)}>
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M7 3l10 9-10 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Challenge
                </button>
              )}
              {state === "self" ? (
                <Link className="card-public__cta" href="/profile">Edit your card <Arrow /></Link>
              ) : (
                <Link className="card-public__cta" href="/profile">Get your own card <Arrow /></Link>
              )}
            </div>
            {card && <p className="text-xs text-[#86868b]">Tap the card to flip it to its QR code.</p>}
          </>
        )}
        <p className="text-sm text-[#86868b]" role="status" aria-live="polite">{note}</p>
        <Link href="/" className="text-[13px] text-[#86868b]">Chess by Chaos</Link>
      </div>
      {challenging && <ChallengeDialog alias={alias} myName="" onClose={() => setChallenging(false)} />}
    </main>
  );
}

function FriendButton({ alias, state }: { alias: string; state: Relation }) {
  const request = useMutation(api.friends.request);
  const respond = useMutation(api.friends.respond);
  const remove = useMutation(api.friends.remove);
  const [busy, setBusy] = useState(false);
  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    void work().finally(() => setBusy(false));
  };
  switch (state) {
    case "signed_out":
      return (
        <SignInButton mode="modal">
          <button className="card-public__btn">Sign in to add friend</button>
        </SignInButton>
      );
    case "self":
      return null;
    case "none":
      return (
        <button className="card-public__btn" disabled={busy} onClick={() => run(() => request({ alias }))}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          Add friend
        </button>
      );
    case "outgoing":
      return (
        <button className="card-public__btn" disabled={busy} onClick={() => run(() => remove({ alias }))} title="Cancel request">
          Request sent · Cancel
        </button>
      );
    case "incoming":
      return (
        <>
          <button className="card-public__btn" disabled={busy} onClick={() => run(() => respond({ alias, accept: true }))}>Accept friend request</button>
          <button className="card-public__btn" disabled={busy} onClick={() => run(() => respond({ alias, accept: false }))}>Decline</button>
        </>
      );
    case "friends":
      return (
        <button className="card-public__btn" disabled={busy} onClick={() => confirm(`Remove @${alias} from your friends?`) && run(() => remove({ alias }))} title="Remove friend">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-[#15803d]" aria-hidden="true"><path d="m5 12 5 5 9-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Friends
        </button>
      );
  }
}
