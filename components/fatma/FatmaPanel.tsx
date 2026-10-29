"use client";

import { CapturedPieces } from "@/components/chess/CapturedPieces";
import type { CapturedPiece } from "@/lib/chess/captures";
import type { Color } from "@/lib/chess/rules";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "@/lib/client/settings";
import { unlockAudio } from "@/lib/client/sound";
import { Dialog } from "@/components/ui/Dialog";
import type { FatmaApi } from "@/lib/client/useFatma";
import { FatmaSprite } from "./FatmaSprite";

/**
 * Sherine's corner: a fixed-size space (sprite + bubble) so her lines never
 * move the board or controls. The bubble floats inside it, max two lines.
 * With `showName` it is a player row: sprite, name/captures, then her bubble
 * right beside her.
 */
export function FatmaPanel({ fatma, thinking, reducedMotion, showName = false, captures, capturedColor, advantage }: { fatma: FatmaApi; thinking: boolean; reducedMotion: boolean; showName?: boolean; captures?: CapturedPiece[]; capturedColor?: Color; advantage?: number }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [greeting, setGreeting] = useState("");
  const expression = fatma.line ? fatma.expression : thinking ? "thinking" : "idle";
  const text = fatma.enabled ? fatma.line?.text ?? "" : "";
  const progress = useSpeechProgress(text, reducedMotion, fatma.utteranceId);
  const bubble = fatma.enabled && fatma.line && (
    <button
      onClick={fatma.dismiss}
      className="bubble-in pointer-events-auto max-w-[min(100%,280px)] rounded-2xl rounded-es-sm bg-surface px-3 py-1.5 text-start text-sm leading-snug shadow-[var(--shadow)]"
      aria-label={`Sherine says: ${fatma.line.text}. Tap to dismiss.`}
    >
      <StreamedText text={text} visible={progress.visible} />
    </button>
  );

  if (showName) {
    return (
      <div className="pointer-events-none relative flex h-14 w-full min-w-0 items-center gap-2">
        {fatma.enabled && (
          <button onClick={() => { unlockAudio(); fatma.say("poke"); setChatOpen((open) => !open); }} className="pointer-events-auto shrink-0 rounded-xl transition-transform active:scale-90" aria-label="Talk to Sherine" aria-expanded={chatOpen} title="Talk to Sherine">
            <FatmaSprite expression={expression} speaking={progress.speaking} size={48} reducedMotion={reducedMotion} />
          </button>
        )}
        <div className="min-w-0 max-w-[50%] shrink-0">
          <span className="block text-sm font-semibold">Sherine</span>
          <CapturedPieces pieces={captures} color={capturedColor} advantage={advantage} />
        </div>
        <div aria-live="polite" className="flex min-w-0 flex-1 items-center">
          {bubble}
        </div>
        {chatOpen && fatma.enabled && <form className="pointer-events-auto absolute inset-x-0 top-full z-40 grid gap-2 rounded-2xl bg-surface p-3 shadow-[var(--shadow)]" onSubmit={(event) => { event.preventDefault(); fatma.say("poke", { text: greeting }); setGreeting(""); setChatOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setChatOpen(false); } }}>
          <label className="text-xs text-muted" htmlFor="sherine-greeting">Say hi in English, مصري or Franco. She replies with banter.</label>
          <div className="flex gap-2"><input id="sherine-greeting" dir="auto" autoFocus maxLength={120} value={greeting} onChange={(event) => setGreeting(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface-2 px-3" /><button disabled={!greeting.trim()} className="rounded-xl bg-accent px-3 text-accent-text disabled:opacity-40">Send</button><button type="button" onClick={() => setChatOpen(false)} className="px-2" aria-label="Close conversation">×</button></div>
        </form>}
      </div>
    );
  }

  return (
    <div className="pointer-events-none relative h-16 w-full">
      {fatma.enabled && (
        <>
          <div className="absolute bottom-0 start-0">
            <FatmaSprite expression={expression} speaking={progress.speaking} size={56} reducedMotion={reducedMotion} />
          </div>
          <div aria-live="polite" className="absolute bottom-3 start-14 end-0 flex items-end">
            {bubble}
          </div>
        </>
      )}
    </div>
  );
}

/** Types a line out like chat. The full text reserves the space so the bubble never resizes. */
function useSpeechProgress(text: string, instant: boolean, utteranceId: number) {
  const characters = useMemo(() => Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (part) => part.segment), [text]);
  const [progress, setProgress] = useState({ utteranceId: -1, shown: 0 });
  const shown = instant ? characters.length : progress.utteranceId === utteranceId ? progress.shown : 0;
  useEffect(() => {
    if (instant || !text) return;
    const started = performance.now();
    const id = setInterval(() => {
      const next = Math.min(characters.length, Math.floor((performance.now() - started) / 28));
      setProgress({ utteranceId, shown: next });
      if (next >= characters.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [text, instant, characters.length, utteranceId]);
  return { visible: characters.slice(0, shown).join(""), speaking: !instant && shown < characters.length };
}

function StreamedText({ text, visible }: { text: string; visible: string }) {
  return (
    <span className="grid" dir="auto" aria-hidden="true">
      <span className="invisible col-start-1 row-start-1 line-clamp-2">{text}</span>
      <span className="col-start-1 row-start-1 line-clamp-2">{visible}</span>
    </span>
  );
}

/**
 * The disable flow: Sherine pleads, but "Turn off" is always immediate and
 * clearly labelled. Keeping her on softens her briefly.
 */
export function FatmaToggle({ fatma }: { fatma: FatmaApi }) {
  const { reducedMotion } = useSettings();
  const [asking, setAsking] = useState(false);
  const offButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asking) offButton.current?.focus();
  }, [asking]);

  if (!fatma.enabled) {
    return (
      <button onClick={() => void fatma.setEnabled("enable")} className="rounded-full bg-surface-2 px-4 py-2 text-sm">
        Bring Sherine back
      </button>
    );
  }
  return (
    <>
      <button
        onClick={() => {
          setAsking(true);
          fatma.plead();
        }}
        className="rounded-full bg-surface-2 px-4 py-2 text-sm"
      >
        Turn Sherine off
      </button>
      {asking && (
        <Dialog title="Turn Sherine off?" onClose={() => { setAsking(false); fatma.dismiss(); }}>
            <div className="flex items-center gap-3">
              <FatmaSprite expression="plea" size={64} reducedMotion={reducedMotion} />
              <p  className="text-base font-medium">
                Wait! Don&apos;t. I&apos;ll be cool. Promise.
              </p>
            </div>
            <div className="mt-5 grid gap-2">
              <button
                ref={offButton}
                onClick={() => {
                  setAsking(false);
                  void fatma.setEnabled("disable");
                }}
                className="w-full rounded-2xl bg-accent py-3 font-medium text-accent-text"
              >
                Turn off Sherine
              </button>
              <button
                onClick={() => {
                  setAsking(false);
                  void fatma.setEnabled("keep");
                }}
                className="w-full rounded-2xl bg-surface-2 py-3"
              >
                Keep her
              </button>
            </div>
        </Dialog>
      )}
    </>
  );
}
