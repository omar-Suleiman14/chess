"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import {
  initialMemory,
  pickLine,
  rememberLine,
  type DialogueLine,
  type Expression,
  type FatmaEvent,
  type FatmaMemory,
  type Mood,
} from "../chess/personality/fatma";
import { linesFor } from "../chess/personality/lines";
import { packLines, validatePack } from "../chess/personality/packs";
import { useSettings } from "./settings";

const LOCAL_KEY = "cbc.fatma.v1";
const BUBBLE_MS = 2600;

function loadLocal(): FatmaMemory {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? { ...initialMemory(), ...(JSON.parse(raw) as Partial<FatmaMemory>) } : initialMemory();
  } catch {
    return initialMemory();
  }
}

/**
 * Fatma's runtime: picks lines locally (no network per move), persists
 * memory in Convex when signed in, localStorage for guests.
 */
export function useFatma() {
  const { isAuthenticated } = useConvexAuth();
  const { settings } = useSettings();
  const language = settings.fatmaLanguage;
  const remote = useQuery(api.fatma.state, isAuthenticated ? {} : "skip");
  const ensure = useMutation(api.fatma.ensure);
  const setEnabledRemote = useMutation(api.fatma.setEnabled);
  const recordLine = useMutation(api.fatma.recordLine);
  const [local, setLocal] = useState<FatmaMemory>(initialMemory);
  const [line, setLine] = useState<DialogueLine | null>(null);
  const [expression, setExpression] = useState<Expression>("idle");
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoryRef = useRef<FatmaMemory>(initialMemory());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(loadLocal());
  }, []);
  useEffect(() => {
    if (isAuthenticated && remote && !remote.fatma) void ensure({});
  }, [isAuthenticated, remote, ensure]);

  const memory: FatmaMemory = useMemo(() => {
    const f = remote?.fatma;
    if (!f) return local;
    return {
      enabled: f.enabled,
      mood: f.mood as Mood,
      disableCount: f.disableCount,
      reenableCount: f.reenableCount,
      seen: f.seen,
      lastSpokeAt: Math.max(f.lastSpokeAt, local.lastSpokeAt),
      softUntil: f.softUntil,
      unlocks: f.unlocks,
    };
  }, [remote, local]);
  useEffect(() => {
    memoryRef.current = memory;
  }, [memory]);

  // Re-validate installed packs on the client too (defence in depth).
  const lines = useMemo(
    () => [
      ...linesFor(language),
      ...(remote?.packs ?? []).flatMap((p) => {
        const checked = validatePack(p);
        return checked.ok ? (packLines(checked.pack) as DialogueLine[]) : [];
      }),
    ],
    [remote?.packs, language],
  );

  const saveLocal = useCallback((next: FatmaMemory) => {
    setLocal(next);
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const say = useCallback(
    (event: FatmaEvent, opts: { force?: boolean } = {}) => {
      const now = Date.now();
      const mem = opts.force ? { ...memoryRef.current, enabled: true, lastSpokeAt: 0 } : memoryRef.current;
      const picked = pickLine(mem, event, lines, now, Math.floor(now / 1000));
      if (!picked) return;
      setLine(picked);
      setExpression(picked.expression);
      const next = rememberLine(memoryRef.current, picked, now);
      memoryRef.current = next;
      saveLocal(next);
      if (isAuthenticated) void recordLine({ lineId: picked.id }).catch(() => {});
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (followTimer.current) clearTimeout(followTimer.current);
      const readMs = (text: string) => BUBBLE_MS + text.length * 25;
      const hide = () => {
        setLine(null);
        setExpression("idle");
      };
      if (picked.then) {
        // The follow-up appears once the first bubble has finished typing and been read.
        const followUp: DialogueLine = { ...picked, id: `${picked.id}:then`, text: picked.then, then: undefined };
        const firstMs = 900 + picked.text.length * 45;
        followTimer.current = setTimeout(() => {
          setLine(followUp);
          hideTimer.current = setTimeout(hide, readMs(followUp.text));
        }, firstMs);
      } else {
        hideTimer.current = setTimeout(hide, readMs(picked.text));
      }
    },
    [lines, saveLocal, isAuthenticated, recordLine],
  );

  // React to server-side events (achievements, installed upgrades).
  const pending = remote?.fatma?.pendingEvent;
  useEffect(() => {
    if (pending === "upgrade_installed" || pending === "achievement") say(pending, { force: pending === "upgrade_installed" });
  }, [pending, say]);

  const dismiss = useCallback(() => {
    if (followTimer.current) clearTimeout(followTimer.current);
    setLine(null);
    setExpression("idle");
  }, []);

  const setEnabled = useCallback(
    async (action: "disable" | "keep" | "enable") => {
      const now = Date.now();
      let next = memoryRef.current;
      if (action === "disable") next = { ...next, enabled: false, disableCount: next.disableCount + 1 };
      if (action === "keep") next = { ...next, softUntil: now + 4 * 60_000 };
      if (action === "enable" && !next.enabled) next = { ...next, enabled: true, reenableCount: next.reenableCount + 1, mood: "grudging" };
      memoryRef.current = next;
      saveLocal(next);
      if (isAuthenticated) await setEnabledRemote({ action }).catch(() => {});
      if (action === "disable") dismiss();
      if (action === "keep") say("kept_on", { force: true });
      if (action === "enable") say("reenabled", { force: true });
    },
    [isAuthenticated, setEnabledRemote, saveLocal, say, dismiss],
  );

  const plead = useCallback(() => {
    const picked = lines.find((l) => l.event === "disable_plea");
    if (!picked) return;
    setLine(picked);
    setExpression("plea");
  }, [lines]);

  return { memory, line, expression, setExpression, say, dismiss, setEnabled, plead, enabled: memory.enabled };
}

export type FatmaApi = ReturnType<typeof useFatma>;
