"use client";

import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/client/settings";
import { recordVital } from "@/lib/client/vitals";

/** Local diagnostics only. No analytics network requests or account identifiers. */
export function WebVitalsReporter() {
  const { settings } = useSettings();
  const current = useRef(settings);
  useEffect(() => { current.current = settings; }, [settings]);
  useEffect(() => {
    let cancelled = false;
    const start = () => {
      void import("web-vitals").then(({ onLCP, onINP, onCLS }) => {
        if (cancelled) return;
        const record = (metric: { id: string; name: "LCP" | "INP" | "CLS"; value: number }) => {
          if (cancelled) return;
          const s = current.current;
          recordVital({ id: metric.id, name: metric.name, value: metric.value, at: Date.now(), appearance: s.experience.appearance, glassQuality: s.experience.appearance === "glass" ? s.experience.glassQuality : undefined, background: s.experience.ambient.mode, colorMode: s.experience.colorMode, evaluation: s.evalBar, device: innerWidth < 768 ? "mobile" : "desktop" });
        };
        onLCP(record); onINP(record); onCLS(record);
      }).catch(() => {});
    };
    const timer = setTimeout(start, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);
  return null;
}
