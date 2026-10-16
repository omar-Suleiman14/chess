"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { savedName } from "@/lib/client/online";

export function errorText(e: unknown): string {
  if (e instanceof ConvexError && typeof e.data === "object" && e.data && "message" in e.data) return String((e.data as { message: unknown }).message);
  return "Something went wrong. Check your connection and try again.";
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

export function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="px-1 text-muted">Your name</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 24))}
        placeholder="Guest"
        autoComplete="nickname"
        className="min-h-12 rounded-xl bg-surface px-3 text-base shadow-[var(--shadow)] outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </label>
  );
}

