"use client";

import { useEffect, useRef } from "react";
import { isWeakDevice } from "@/lib/client/settings";

/**
 * The live glyph wind behind a game: a quiet field of characters that drifts,
 * wakes under the mouse and ripples where you tap empty space (every third
 * tap draws a heart). Renderer: MIT, Henry Fan's Claude Code Background Lab.
 * Pointer-transparent, paused when the tab is hidden, still under reduced motion.
 */
export function LiveBackground({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let renderer: { setRunning: (on: boolean) => void; destroy: () => void } | null = null;
    let cancelled = false;
    void import("@/lib/client/glyphWind").then(({ default: GlyphWind }) => {
      if (cancelled) return;
      // The renderer fills seed, look and field itself in the lab; here we pick a fresh pattern each game visit.
      const settings = GlyphWind.defaults() as unknown as { seed: number; look: string; field: unknown; power: { frameMs: number; rippleFrameMs: number }; grid: { maxDpr?: number } };
      // Phones: the faint glyphs don't need retina pixels or 25 fps; this cuts the GPU work about 8×.
      const phone = matchMedia("(pointer: coarse)").matches;
      if (phone) { settings.grid.maxDpr = 1.25; settings.power.frameMs = 66; settings.power.rippleFrameMs = 33; }
      // Few cores, little memory or Data Saver: draw half as often again.
      if (isWeakDevice()) settings.power.frameMs = phone ? 100 : 80;
      settings.seed = (Math.random() * 2 ** 32) >>> 0;
      settings.look = GlyphWind.chooseLook(settings.seed, []);
      settings.field = GlyphWind.pattern(settings.seed, settings.look);
      renderer = GlyphWind.create({
        element,
        settings: () => settings,
        timing: () => ({ fadeIn: reducedMotion ? 0 : 3000, fadeOut: 500 }),
        onReady: () => renderer?.setRunning(!reducedMotion),
        // No WebGL2: the plain page shows instead.
        onError: () => element.setAttribute("data-fallback", "static"),
      });
    });
    return () => {
      cancelled = true;
      renderer?.destroy();
    };
  }, [reducedMotion]);
  return (
    <div aria-hidden="true" data-ambient-renderer className="live-background pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div ref={ref} className="live-background__field absolute inset-0" />
    </div>
  );
}
