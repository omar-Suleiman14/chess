"use client";

import { useEffect, useState } from "react";
import { VITAL_EVENT, clearVitals, readVitals, type VitalReading } from "@/lib/client/vitals";

const cohort = (row: VitalReading) => `${row.device} / ${row.appearance}${row.glassQuality ? ` ${row.glassQuality}` : ""} / ${row.background ?? "unknown scene"} / eval ${row.evaluation ? "on" : "off"} / ${row.name}`;

export function PerformanceDashboard() {
  const [rows, setRows] = useState<VitalReading[]>([]);
  useEffect(() => {
    const refresh = () => setRows(readVitals());
    const timer = setTimeout(refresh, 0);
    window.addEventListener(VITAL_EVENT, refresh);
    return () => { clearTimeout(timer); window.removeEventListener(VITAL_EVENT, refresh); };
  }, []);
  return <section aria-labelledby="vitals-title" className="grid gap-3 rounded-2xl bg-surface p-4">
    <h2 id="vitals-title" className="text-lg font-semibold">Local Web Vitals</h2>
    <p className="text-xs text-muted">This browser only, up to 120 readings, without account identifiers. LCP/INP usually finalize when you leave or hide a page. These observations are not population field p75 data.</p>
    <div className="overflow-x-auto"><table className="w-full text-start text-xs"><thead><tr><th className="p-2 text-start">Cohort / metric</th><th className="p-2">Samples</th><th className="p-2">Local p75</th><th className="p-2">Target</th></tr></thead><tbody>
      {[...new Set(rows.map((row) => cohort(row)))].map((key) => {
        const matching = rows.filter((row) => cohort(row) === key);
        const sorted = matching.map((row) => row.value).sort((a, b) => a - b);
        const p75 = sorted[Math.max(0, Math.ceil(sorted.length * 0.75) - 1)];
        const metric = matching[0].name;
        const target = metric === "CLS" ? 0.05 : metric === "INP" ? 100 : 1250;
        return <tr key={key} className="border-t border-line"><th className="p-2 text-start font-medium">{key}</th><td className="p-2 text-center">{matching.length}</td><td className={`p-2 text-center ${p75 <= target ? "text-ok" : "text-danger"}`}>{metric === "CLS" ? p75.toFixed(3) : `${Math.round(p75)}ms`}</td><td className="p-2 text-center">≤{target}{metric === "CLS" ? "" : "ms"}</td></tr>;
      })}
    </tbody></table></div>
    {!rows.length && <p className="text-sm text-muted">No completed readings yet. Play, interact and return here after navigating away or hiding the tab.</p>}
    <div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-full bg-surface-2 px-4 text-sm" onClick={() => {
      const link = document.createElement("a"); const url = URL.createObjectURL(new Blob([JSON.stringify({ kind: "local-observations-not-field-p75", rows }, null, 2)], { type: "application/json" })); link.href = url; link.download = "chess-local-vitals.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>Export observations</button><button className="min-h-11 rounded-full bg-surface-2 px-4 text-sm" onClick={clearVitals}>Clear observations</button></div>
    <p className="text-xs text-muted">The reproducible lab matrix lives in scripts/benchmark-ui.mjs. It retains Chrome traces, screenshots, hardware metadata and five-run median/p95 summaries. rAF gaps are scheduling proxies, not a claim of presented GPU frames or battery measurements.</p>
  </section>;
}
