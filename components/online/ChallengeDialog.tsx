"use client";

import { useMutation } from "convex/react";
import { useAppRouter as useRouter } from "@/components/navigation/useAppRouter";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Dialog, Segmented } from "@/components/chess/GameScreen";
import { ONLINE_TIME_CONTROLS, playerToken, savedName, useOnlineAvatar } from "@/lib/client/online";
import { errorText } from "./OnlineShared";

/** Pick a clock and colour, open a room, and drop its PIN in the friend's inbox. */
export function ChallengeDialog({ alias, myName, onClose }: { alias: string; myName: string; onClose: () => void }) {
  const router = useRouter();
  const create = useMutation(api.online.create);
  const avatar = useOnlineAvatar();
  const challenge = useMutation(api.friends.challenge);
  const [tc, setTc] = useState("10+0");
  const [color, setColor] = useState<"w" | "random" | "b">("random");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    const control = ONLINE_TIME_CONTROLS.find((t) => t.id === tc)!;
    try {
      const { code } = await create({ token: playerToken(), name: savedName() || myName, avatar, color, initialMs: control.initialMs, incrementMs: control.incrementMs });
      await challenge({ alias, code });
      router.push(`/play/${code}?invited=${encodeURIComponent(alias)}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Dialog title={`Challenge @${alias}`} onClose={onClose}>
      <div className="grid gap-1 text-sm">
        <span className="px-1 text-muted">Clock</span>
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Clock">
          {ONLINE_TIME_CONTROLS.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={tc === t.id}
              onClick={() => setTc(t.id)}
              className={`min-h-11 rounded-xl px-1 text-sm font-semibold tabular-nums ${tc === t.id ? "bg-accent text-accent-text" : "bg-surface-2"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <Segmented label="You play" value={color} onChange={setColor} options={[["w", "White"], ["random", "Random"], ["b", "Black"]]} />
      <button onClick={() => void send()} disabled={busy} className="mt-1 w-full rounded-2xl bg-accent py-3 font-medium text-accent-text disabled:opacity-60">
        {busy ? "Sending…" : "Send challenge"}
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </Dialog>
  );
}
