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
import { useCoachingPreferences } from "./useCoachingPreferences";
import { detectLanguage } from "../chess/personality/language";
import { playSound } from "./sound";

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
 * Sherine's runtime: picks lines locally (no network per move), persists
 * memory in Convex when signed in, localStorage for guests.
 */
export function useFatma() {
  const { isAuthenticated } = useConvexAuth();
  const { settings } = useSettings();
  const { coaching } = useCoachingPreferences();
  const [conversationLanguage, setConversationLanguage] = useState(settings.fatmaLanguage);
  const language = coaching.autoLanguage ? conversationLanguage : settings.fatmaLanguage;
  const remote = useQuery(api.fatma.state, isAuthenticated ? {} : "skip");
  const ensure = useMutation(api.fatma.ensure);
  const setEnabledRemote = useMutation(api.fatma.setEnabled);
  const recordLine = useMutation(api.fatma.recordLine);
  const [local, setLocal] = useState<FatmaMemory>(initialMemory);
  const [line, setLine] = useState<DialogueLine | null>(null);
  const [utteranceId, setUtteranceId] = useState(0);
  const [expression, setExpression] = useState<Expression>("idle");
  const [enabledOverride, setEnabledOverride] = useState<boolean | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoryRef = useRef<FatmaMemory>(initialMemory());
  const clearTimers = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (followTimer.current) clearTimeout(followTimer.current);
    hideTimer.current = null;
    followTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(loadLocal());
  }, []);
  useEffect(() => {
    if (!coaching.autoLanguage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversationLanguage(detectLanguage("", navigator.languages));
  }, [coaching.autoLanguage]);
  useEffect(() => {
    if (isAuthenticated && remote && !remote.fatma) void ensure({});
  }, [isAuthenticated, remote, ensure]);

  const memory: FatmaMemory = useMemo(() => {
    const f = remote?.fatma;
    if (!f) return local;
    return {
      enabled: enabledOverride ?? f.enabled,
      mood: f.mood as Mood,
      disableCount: f.disableCount,
      reenableCount: f.reenableCount,
      seen: { ...f.seen, ...local.seen },
      lastSpokeAt: Math.max(f.lastSpokeAt, local.lastSpokeAt),
      softUntil: f.softUntil,
      unlocks: f.unlocks,
    };
  }, [remote, local, enabledOverride]);
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
    (event: FatmaEvent, opts: { force?: boolean; text?: string } = {}) => {
      const now = Date.now();
      // Priority changes may bypass cooldowns, never the player's off switch.
      if (!memoryRef.current.enabled) return;
      const direct = event === "poke" || event === "kept_on" || event === "reenabled" || event === "disable_plea";
      const important = direct || ["human_win", "human_loss", "draw", "upgrade_installed"].includes(event);
      if (!important && !opts.force && coaching.frequency === "quiet") return;
      if (!important && coaching.frequency === "balanced" && now - memoryRef.current.lastSpokeAt < 12_000 && !opts.force) return;
      const replyLanguage = opts.text && coaching.autoLanguage ? detectLanguage(opts.text, navigator.languages) : language;
      if (replyLanguage !== language) setConversationLanguage(replyLanguage);
      const candidates = replyLanguage === language ? lines : linesFor(replyLanguage);
      const toned = coaching.intensity === "spicy" ? candidates : candidates.filter((l) => !["start-3", "blunder-3", "blunder-4", "blunder-6"].includes(l.id.replace(/^(egy|franco):/, "")));
      const mem = opts.force ? { ...memoryRef.current, lastSpokeAt: 0 } : memoryRef.current;
      const familiarUndo = event === "undo" && Object.keys(mem.seen).filter((id) => /^(?:(?:egy|franco)[:_])?undo-/.test(id)).length >= 2;
      const picked = pickLine(coaching.intensity === "gentle" ? { ...mem, softUntil: now + 1 } : mem, familiarUndo ? "undo_repeat" : event, toned, now, now);
      if (!picked) return;
      setLine(picked);
      setUtteranceId((id) => id + 1);
      setExpression(picked.expression);
      if (settings.fatmaSound) playSound("select", settings.volume * 0.35);
      const next = rememberLine(memoryRef.current, picked, now);
      memoryRef.current = next;
      saveLocal(next);
      if (isAuthenticated) void recordLine({ lineId: picked.id }).catch(() => {});
      clearTimers();
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
          setUtteranceId((id) => id + 1);
          hideTimer.current = setTimeout(hide, readMs(followUp.text));
        }, firstMs);
      } else {
        hideTimer.current = setTimeout(hide, readMs(picked.text));
      }
    },
    [lines, saveLocal, isAuthenticated, recordLine, clearTimers, coaching, language, settings.fatmaSound, settings.volume],
  );

  // React to server-side events (achievements, installed upgrades).
  const pending = remote?.fatma?.pendingEvent;
  useEffect(() => {
    if (pending !== "upgrade_installed" && pending !== "achievement") return;
    const timer = setTimeout(() => say(pending, { force: pending === "upgrade_installed" }), 0);
    return () => clearTimeout(timer);
  }, [pending, say]);

  const dismiss = useCallback(() => {
    clearTimers();
    setLine(null);
    setExpression("idle");
  }, [clearTimers]);

  const setEnabled = useCallback(
    async (action: "disable" | "keep" | "enable") => {
      const now = Date.now();
      let next = memoryRef.current;
      if (action === "disable") next = { ...next, enabled: false, disableCount: next.disableCount + 1 };
      if (action === "keep") next = { ...next, softUntil: now + 4 * 60_000 };
      if (action === "enable" && !next.enabled) next = { ...next, enabled: true, reenableCount: next.reenableCount + 1, mood: "grudging" };
      memoryRef.current = next;
      saveLocal(next);
      setEnabledOverride(next.enabled);
      if (action === "disable") dismiss();
      if (action === "keep") say("kept_on", { force: true });
      if (action === "enable") say("reenabled", { force: true });
      if (isAuthenticated) {
        try {
          await setEnabledRemote({ action });
          setEnabledOverride(null);
        } catch { /* Keep the local preference when offline. */ }
      }
    },
    [isAuthenticated, setEnabledRemote, saveLocal, say, dismiss],
  );

  const plead = useCallback(() => {
    if (!memoryRef.current.enabled) return;
    const picked = lines.find((l) => l.event === "disable_plea");
    if (!picked) return;
    clearTimers();
    setLine(picked);
    setUtteranceId((id) => id + 1);
    setExpression("plea");
  }, [lines, clearTimers]);

  return { memory, line, utteranceId, expression, setExpression, say, dismiss, setEnabled, plead, enabled: memory.enabled };
}

export type FatmaApi = ReturnType<typeof useFatma>;
