"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "@/components/navigation/PrefetchLink";
import { useAppRouter as useRouter } from "@/components/navigation/useAppRouter";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { PageHeader } from "@/components/shell/AppShell";
import { CopyField } from "@/components/ui/CopyField";
import { inviteUrl, playerToken, saveName, timeControlLabel, useOnlineAvatar, usePlayerToken, withAvatarFallback } from "@/lib/client/online";
import { PLAY_STAGE, runViewTransition } from "@/lib/client/viewTransition";
import { errorText, NameField, useDefaultName } from "./OnlineShared";
import { OnlineGame } from "./OnlineGame";

export type RoomView = NonNullable<FunctionReturnType<typeof api.online.byCode>>;

/** Everything behind /play/[code]: invite, join, the game and its rematches. */
export function OnlineRoom({ code }: { code: string }) {
  const token = usePlayerToken();
  // Queries can't read the clock; a value fixed at mount only gates "expired".
  const [mountedAt] = useState(() => Date.now());
  const room = useQuery(api.online.byCode, token ? { code, token, now: mountedAt } : "skip");
  // When a friend joins, the invite morphs into the board: hold the invite on
  // screen until the transition has snapshotted it, then show the game.
  const live = room ? room.status : null;
  const [shown, setShown] = useState(live);
  useEffect(() => {
    if (live === shown) return;
    if (shown === "waiting" && live === "active") runViewTransition(() => setShown(live));
    // Any other change (first load, finishing, cancelling) just shows the new state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setShown(live);
  }, [live, shown]);

  if (room === undefined) {
    return (
      <main className="grid min-h-dvh place-items-center text-sm text-muted" aria-busy="true">
        Connecting…
      </main>
    );
  }
  if (room === null) {
    return (
      <Shell>
        <Notice title="No game with that PIN" body={`We couldn't find game ${code}. Check the PIN, or ask your friend for a new invite.`} />
      </Shell>
    );
  }
  if (room.status === "cancelled") {
    return (
      <Shell>
        <Notice title="Invite cancelled" body="The host cancelled this game." />
      </Shell>
    );
  }
  if (room.status === "waiting" || shown === "waiting") {
    return <Shell>{room.you ? <Waiting room={room} /> : <JoinCard room={room} />}</Shell>;
  }
  return <OnlineGame key={room.roomId} room={room} token={token!} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-10">
      <PageHeader title="Play a friend" />
      <div className="grid gap-5 px-4">{children}</div>
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section className="grid gap-3 rounded-3xl bg-surface p-5 text-center shadow-[var(--shadow)]">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted">{body}</p>
      <Link href="/play" className="mt-2 grid min-h-12 place-items-center rounded-2xl bg-accent font-semibold text-accent-text">
        New game
      </Link>
    </section>
  );
}

function colorWord(c: "w" | "b") {
  return c === "w" ? "White" : "Black";
}

/** Play online: a matchmaking room waits in the pool instead of showing an invite. */
function Seeking({ room }: { room: RoomView }) {
  const router = useRouter();
  const keep = useMutation(api.online.keepSeeking);
  const stop = useMutation(api.online.stopSeeking);
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const beat = setInterval(() => void keep({ token: playerToken(), code: room.code }).catch(() => {}), 15_000);
    return () => { clearInterval(tick); clearInterval(beat); };
  }, [keep, room.code]);
  const seconds = Math.floor((now - started) / 1000);
  return (
    <section className="grid place-items-center gap-6 py-10 text-center" aria-labelledby="seek-title" aria-live="polite">
      <div className="relative grid h-32 w-32 place-items-center" aria-hidden="true">
        <span className="absolute inset-0 animate-ping rounded-full bg-[#81b64c]/25" />
        <span className="absolute inset-3 animate-pulse rounded-full bg-[#81b64c]/30" />
        <span className="relative grid h-20 w-20 place-items-center rounded-full bg-[#81b64c] text-4xl text-white shadow-[0_6px_0_#5d8a33]">♟</span>
      </div>
      <div>
        <h2 id="seek-title" className="text-2xl font-bold">Searching for an opponent…</h2>
        <p className="mt-1 text-sm text-muted">{timeControlLabel(room.initialMs, room.incrementMs)} · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p>
      </div>
      <p className="max-w-xs text-sm text-muted">The game starts as soon as another player looking for the same clock is found.</p>
      <button
        onClick={() => { void stop({ token: playerToken() }).then(() => router.push("/play")); }}
        className="min-h-12 w-full max-w-xs rounded-2xl bg-surface-2 font-semibold"
      >
        Cancel
      </button>
    </section>
  );
}

function Waiting({ room }: { room: RoomView }) {
  const router = useRouter();
  const [seeking] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("seek") === "1");
  const cancel = useMutation(api.online.cancel);
  const [url, setUrl] = useState("");
  const [svg, setSvg] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [invited, setInvited] = useState<string | null>(null);
  useEffect(() => {
    // Set by "Challenge" on a friend: their inbox already has this PIN.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInvited(new URLSearchParams(window.location.search).get("invited"));
    const link = inviteUrl(room.code);
    setUrl(link);
    setCanShare(typeof navigator.share === "function");
    void QRCode.toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#14161fff", light: "#00000000" } }).then(setSvg);
  }, [room.code]);

  if (seeking) return <Seeking room={room} />;

  const share = async () => {
    try {
      await navigator.share({ title: "Play chess with me", text: `Join my chess game. PIN ${room.code}`, url });
    } catch {
      // Dismissed share sheet.
    }
  };

  return (
    <section className="grid gap-5" aria-labelledby="invite-title">
      <div className="text-center">
        <h2 id="invite-title" className="text-xl font-semibold">Invite your opponent</h2>
        <p className="mt-1 text-sm text-muted">
          {timeControlLabel(room.initialMs, room.incrementMs)} · you play {colorWord(room.you!)}
        </p>
        {invited && <p className="mt-2 inline-block rounded-full bg-ok/15 px-3 py-1 text-sm font-medium text-ok">Invite sent to @{invited}</p>}
      </div>

      <div className="grid gap-4 rounded-3xl bg-surface p-5 shadow-[var(--shadow)] sm:grid-cols-[auto_1fr] sm:items-center" data-vt-ready style={{ viewTransitionName: PLAY_STAGE }}>
        <div className="mx-auto w-44 rounded-2xl bg-white p-3 sm:w-40">
          {svg ? <span className="block [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="QR code for the invite link" /> : <div className="aspect-square" />}
        </div>
        <div className="grid gap-3 text-center sm:text-start">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Game PIN</p>
            <p className="font-mono text-4xl font-bold tabular-nums tracking-[0.18em]" aria-label={`PIN ${room.code.split("").join(" ")}`}>
              {room.code}
            </p>
          </div>
          <p className="text-xs text-muted">Scan the code, open the link, or enter the PIN under Play a friend → Join.</p>
        </div>
      </div>

      {url && <CopyField value={url} label="Invite link" />}
      {canShare && (
        <button onClick={() => void share()} className="min-h-12 rounded-2xl bg-accent font-semibold text-accent-text">
          Share invite
        </button>
      )}

      <p className="flex items-center justify-center gap-2 text-sm text-muted" aria-live="polite">
        <span className="h-2 w-2 animate-pulse rounded-full bg-ok" aria-hidden="true" />
        Waiting for someone to join… the game starts by itself.
      </p>
      <button
        onClick={() => {
          void cancel({ roomId: room.roomId, token: playerToken() }).then(() => router.push("/play"));
        }}
        className="min-h-12 rounded-2xl bg-surface-2 text-sm"
      >
        Cancel invite
      </button>
    </section>
  );
}

function JoinCard({ room }: { room: RoomView }) {
  const join = useMutation(api.online.join);
  const avatar = useOnlineAvatar();
  const [name, setName] = useDefaultName();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const host = room.white ?? room.black ?? "Someone";
  const yourColor = room.white ? "b" : "w";

  const onJoin = async () => {
    setBusy(true);
    setError(null);
    saveName(name);
    try {
      await withAvatarFallback((a) => join({ code: room.code, token: playerToken(), name, avatar: a }), avatar);
      // The room query updates to "active" and the game appears.
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  if (room.expired) return <Notice title="Invite expired" body="Ask your friend to send a new one." />;

  return (
    <section className="grid gap-4 rounded-3xl bg-surface p-5 shadow-[var(--shadow)]" aria-labelledby="join-title">
      <div className="text-center">
        <h2 id="join-title" className="text-xl font-semibold">{host} invited you to play</h2>
        <p className="mt-1 text-sm text-muted">
          {timeControlLabel(room.initialMs, room.incrementMs)} · you play {colorWord(yourColor)}
        </p>
      </div>
      <NameField value={name} onChange={setName} />
      <button onClick={() => void onJoin()} disabled={busy} className="min-h-14 rounded-2xl bg-accent font-semibold text-accent-text disabled:opacity-60">
        {busy ? "Joining…" : "Join game"}
      </button>
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
