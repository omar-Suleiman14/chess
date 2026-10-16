"use client";

import { useMutation } from "convex/react";
import { useAppRouter as useRouter } from "@/components/navigation/useAppRouter";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Segmented } from "@/components/chess/GameScreen";
import { PageHeader } from "@/components/shell/AppShell";
import { errorText, NameField, useDefaultName } from "@/components/online/OnlineShared";
import { ONLINE_TIME_CONTROLS, playerToken, saveName, useOnlineAvatar } from "@/lib/client/online";

export default function PlayPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"invite" | "join">("invite");
  const [name, setName] = useDefaultName();
  const [tc, setTc] = useState("10+0");
  const [color, setColor] = useState<"w" | "random" | "b">("random");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation(api.online.create);
  const join = useMutation(api.online.join);
  const avatar = useOnlineAvatar();

  const onCreate = async () => {
    setBusy(true);
    setError(null);
    saveName(name);
    const control = ONLINE_TIME_CONTROLS.find((t) => t.id === tc)!;
    try {
      const { code } = await create({ token: playerToken(), name, avatar, color, initialMs: control.initialMs, incrementMs: control.incrementMs });
      router.push(`/play/${code}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  const onJoin = async () => {
    setBusy(true);
    setError(null);
    saveName(name);
    try {
      await join({ code: pin, token: playerToken(), name, avatar });
      router.push(`/play/${pin}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-dvh max-w-xl pb-10">
      <PageHeader title="Play a friend" />
      <div className="grid gap-5 px-4">
        <p className="text-sm text-muted">Play someone on another phone or computer. Share a link, a QR code or a 6-digit PIN. No account needed.</p>
        <Segmented label="Mode" value={tab} onChange={(t) => { setTab(t); setError(null); }} options={[["invite", "Invite someone"], ["join", "Join with PIN"]]} />

        {tab === "invite" ? (
          <>
            <NameField value={name} onChange={setName} />
            <div className="grid gap-1 text-sm">
              <span className="px-1 text-muted">Clock</span>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Clock">
                {ONLINE_TIME_CONTROLS.map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={tc === t.id}
                    onClick={() => setTc(t.id)}
                    className={`min-h-14 rounded-2xl px-2 text-base font-semibold tabular-nums ${tc === t.id ? "bg-accent text-accent-text" : "bg-surface shadow-[var(--shadow)]"} ${t.id === "none" ? "col-span-3 sm:col-span-1" : ""}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <span className="px-1 text-xs text-muted">{tc === "none" ? "Take as long as you like." : "Clocks start after White's first move. A + B adds B seconds per move."}</span>
            </div>
            <Segmented label="You play" value={color} onChange={setColor} options={[["w", "White"], ["random", "Random"], ["b", "Black"]]} />
            <button onClick={() => void onCreate()} disabled={busy} className="min-h-14 rounded-2xl bg-accent font-semibold text-accent-text disabled:opacity-60">
              {busy ? "Creating…" : "Create invite"}
            </button>
          </>
        ) : (
          <>
            <label className="grid gap-1 text-sm">
              <span className="px-1 text-muted">Game PIN</span>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && pin.length === 6 && void onJoin()}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                aria-label="6-digit game PIN"
                className="min-h-16 rounded-2xl bg-surface px-3 text-center font-mono text-3xl tracking-[0.4em] shadow-[var(--shadow)] outline-none placeholder:text-line focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
            <NameField value={name} onChange={setName} />
            <button onClick={() => void onJoin()} disabled={busy || pin.length !== 6} className="min-h-14 rounded-2xl bg-accent font-semibold text-accent-text disabled:opacity-40">
              {busy ? "Joining…" : "Join game"}
            </button>
            <p className="text-xs text-muted">Got a QR code or link instead? Just open it with your camera or browser.</p>
          </>
        )}
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      </div>
    </main>
  );
}
