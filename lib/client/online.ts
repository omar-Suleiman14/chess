"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

// Play-a-friend identity for this browser. The token is a seat secret, not an
// account: anyone holding it can move for that seat, so it never leaves this
// device except in calls to our own backend.
const TOKEN_KEY = "cbc.online.token";
const NAME_KEY = "cbc.online.name";
const AVATAR_KEY = "cbc.online.avatar";

export type OnlineAvatar = { seed: string; hue: number };

let memoryToken: string | null = null;

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 40);
}

export function playerToken(): string {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored && /^[A-Za-z0-9_-]{16,64}$/.test(stored)) return stored;
    const fresh = randomToken();
    localStorage.setItem(TOKEN_KEY, fresh);
    return fresh;
  } catch {
    // Private mode: keep one token for this visit.
    memoryToken ??= randomToken();
    return memoryToken;
  }
}

export function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name.trim().slice(0, 24));
  } catch {
    // ignore
  }
}

/** A guest's avatar: random once, then remembered on this device. */
function guestAvatar(): OnlineAvatar {
  try {
    const stored = JSON.parse(localStorage.getItem(AVATAR_KEY) ?? "null") as OnlineAvatar | null;
    if (stored && /^[A-Za-z0-9_-]{1,32}$/.test(stored.seed) && Number.isInteger(stored.hue) && stored.hue >= 0 && stored.hue < 360) return stored;
  } catch {
    // Fall through to a fresh one.
  }
  const fresh = { seed: randomToken().slice(0, 16), hue: Math.floor(Math.random() * 360) };
  try {
    localStorage.setItem(AVATAR_KEY, JSON.stringify(fresh));
  } catch {
    // Private mode: it lasts for this visit.
  }
  return fresh;
}

/** The avatar this player shows in online games: their card's when signed in, else a guest one. */
export function useOnlineAvatar(): OnlineAvatar | undefined {
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  const [guest, setGuest] = useState<OnlineAvatar | undefined>(undefined);
  useEffect(() => {
    // Read after mount so server and client renders match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGuest(guestAvatar());
  }, []);
  if (profile?.avatarSeed && profile.hue !== undefined) return { seed: profile.avatarSeed, hue: profile.hue };
  return guest;
}

/**
 * Runs a create/join call with the avatar, retrying once without it if the
 * backend is older and rejects the field, so a website deployed before its
 * Convex functions can still start games.
 */
export async function withAvatarFallback<T>(call: (avatar: OnlineAvatar | undefined) => Promise<T>, avatar: OnlineAvatar | undefined): Promise<T> {
  try {
    return await call(avatar);
  } catch (error) {
    if (avatar && error instanceof Error && /avatar|extra field|ArgumentValidationError/i.test(error.message)) return await call(undefined);
    throw error;
  }
}

/** Stable stand-in for rooms made before avatars existed. */
export function avatarFromName(name: string): OnlineAvatar {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { seed: `n${h.toString(36)}`, hue: h % 360 };
}

/** Token, read after mount so server and client renders match. */
export function usePlayerToken(): string | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(playerToken());
  }, []);
  return token;
}

/** Milliseconds to add to Date.now() to get server time (round-trip corrected). */
export function useServerOffset(): number {
  const ping = useMutation(api.online.now);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const sent = Date.now();
    void ping({})
      .then((server) => {
        const received = Date.now();
        if (!cancelled) setOffset(server - (sent + received) / 2);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ping]);
  return offset;
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/play/${code}`;
}

export type OnlineTimeControl = { id: string; label: string; initialMs?: number; incrementMs?: number };

export const ONLINE_TIME_CONTROLS: OnlineTimeControl[] = [
  { id: "none", label: "No clock" },
  { id: "1+0", label: "1 min", initialMs: 60_000, incrementMs: 0 },
  { id: "3+2", label: "3 + 2", initialMs: 3 * 60_000, incrementMs: 2_000 },
  { id: "5+0", label: "5 min", initialMs: 5 * 60_000, incrementMs: 0 },
  { id: "10+0", label: "10 min", initialMs: 10 * 60_000, incrementMs: 0 },
  { id: "15+10", label: "15 + 10", initialMs: 15 * 60_000, incrementMs: 10_000 },
  { id: "30+0", label: "30 min", initialMs: 30 * 60_000, incrementMs: 0 },
];

export function timeControlLabel(initialMs: number | null, incrementMs: number | null): string {
  if (initialMs === null) return "No clock";
  const known = ONLINE_TIME_CONTROLS.find((t) => t.initialMs === initialMs && (t.incrementMs ?? 0) === (incrementMs ?? 0));
  if (known) return known.label;
  const min = Math.round(initialMs / 60_000);
  const inc = Math.round((incrementMs ?? 0) / 1000);
  return inc ? `${min} + ${inc}` : `${min} min`;
}
