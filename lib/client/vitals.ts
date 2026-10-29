"use client";

export type VitalReading = {
  id: string; name: "LCP" | "INP" | "CLS"; value: number; at: number;
  appearance: string; glassQuality?: string; background?: string; colorMode: string; evaluation: boolean; device: "mobile" | "desktop";
};
const KEY = "cbc.vitals.v1";
export const VITAL_EVENT = "cbc:vitals";
export function readVitals(): VitalReading[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((entry): entry is VitalReading => entry && typeof entry === "object" && typeof entry.id === "string" && ["LCP", "INP", "CLS"].includes(entry.name) && Number.isFinite(entry.value) && Number.isFinite(entry.at) && typeof entry.appearance === "string" && typeof entry.colorMode === "string" && typeof entry.evaluation === "boolean" && ["mobile", "desktop"].includes(entry.device)).slice(-120);
  } catch { return []; }
}
export function recordVital(reading: VitalReading) {
  try {
    const rows = readVitals().filter((row) => row.id !== reading.id);
    rows.push(reading);
    localStorage.setItem(KEY, JSON.stringify(rows.slice(-120)));
    window.dispatchEvent(new Event(VITAL_EVENT));
  } catch { /* Metrics are optional and never block gameplay or storage. */ }
}
export function clearVitals() { try { localStorage.removeItem(KEY); window.dispatchEvent(new Event(VITAL_EVENT)); } catch { /* Storage denied. */ } }
