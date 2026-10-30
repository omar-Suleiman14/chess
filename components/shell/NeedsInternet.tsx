"use client";

import { useOnline } from "@/lib/offline/client";

/** Shown on online-only screens while the device is offline. Local play keeps working. */
export function NeedsInternet({ what }: { what: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <p role="status" className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">
      <span className="font-semibold">{what} need internet.</span> <span className="text-muted">Bots, lessons, review and your saved games all work offline.</span>
    </p>
  );
}
