"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { savedName } from "@/lib/client/online";

/** A specific, actionable message for a failed request. */
export function errorText(e: unknown): string {
  if (e instanceof ConvexError && typeof e.data === "object" && e.data && "message" in e.data) return String((e.data as { message: unknown }).message);
  if (typeof navigator !== "undefined" && !navigator.onLine) return "You're offline. Reconnect to the internet, then try again.";
  const message = e instanceof Error ? e.message : String(e ?? "");
  if (/Could not find public function|not found.*function/i.test(message)) return "This needs the latest server update. Try again after the app is redeployed.";
  if (/unauthenticated|sign in/i.test(message)) return "Sign in to do this, then try again.";
  if (/rate|too many/i.test(message)) return "Too many tries in a short time. Wait a minute, then try again.";
  if (/timeout|timed out|network|fetch/i.test(message)) return "The server didn't answer in time. Check your connection, then try again.";
  return "The server couldn't complete this. Try again in a moment; if it keeps failing, reload the page.";
}

/** Remembered name, else the signed-in profile alias. */
export function useDefaultName(): [string, (n: string) => void] {
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  const [name, setName] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName((current) => current || savedName() || profile?.alias || "");
  }, [profile?.alias]);
  return [name, setName];
}

/** The name opponents see. Once known (saved or from your profile), it isn't asked again. */
export function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  // Collapse only for a name that was already known, never while it's being typed.
  if (value && !editing) {
    return (
      <p className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm shadow-[var(--shadow)]">
        <span>Playing as <b className="break-words">{value}</b></span>
        <button onClick={() => setEditing(true)} className="shrink-0 rounded-full bg-surface-2 px-3 py-1 font-semibold">Change name</button>
      </p>
    );
  }
  return (
    <label className="grid gap-1 text-sm">
      <span className="px-1 text-muted">Your name</span>
      <input
        value={value}
        onChange={(e) => { setEditing(true); onChange(e.target.value.slice(0, 24)); }}
        placeholder="Guest"
        autoComplete="nickname"
        className="min-h-12 rounded-xl bg-surface px-3 text-base shadow-[var(--shadow)] outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      <span className="px-1 text-xs text-muted">Shown to your opponent during the game. Saved on this device so you won&apos;t be asked again.</span>
    </label>
  );
}

