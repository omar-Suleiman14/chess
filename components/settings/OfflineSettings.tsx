"use client";

import { useOfflineStatus, useOnline } from "@/lib/offline/client";

/** Offline readiness, told plainly: only "ready" once every file is stored. */
export function OfflineSettings() {
  const { status, applyUpdate } = useOfflineStatus();
  const online = useOnline();
  return (
    <section aria-labelledby="offline-heading" className="grid gap-2">
      <h2 id="offline-heading" className="text-lg font-semibold">Offline</h2>
      <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow)]" aria-live="polite">
        {status.state === "ready" ? (
          <>
            <p className="flex items-center gap-2 font-semibold">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-ok" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Offline ready
            </p>
            <p className="mt-1 text-sm text-muted">You can play without internet, even in Airplane Mode. Add it to your Home Screen for an app icon.</p>
            {status.updateReady && (
              <button onClick={applyUpdate} className="mt-3 min-h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-accent-text">Update ready · Restart now</button>
            )}
          </>
        ) : status.state === "preparing" ? (
          <>
            <p className="font-semibold">Preparing offline play</p>
            <p className="mt-1 text-sm text-muted">{status.total > 0 ? `${status.done} of ${status.total} files` : "Starting…"}{online ? "" : " · paused until you're back online"}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={status.total || 1} aria-valuenow={status.done}>
              <div className="h-full rounded-full bg-[var(--switch-on)] transition-[width]" style={{ width: `${status.total ? Math.round((status.done / status.total) * 100) : 4}%` }} />
            </div>
          </>
        ) : status.state === "error" ? (
          <>
            <p className="font-semibold">Not ready for offline yet</p>
            <p className="mt-1 text-sm text-muted">{status.message}</p>
            {online && <button onClick={() => window.location.reload()} className="mt-3 min-h-11 rounded-xl bg-surface-2 px-4 text-sm font-medium">Try again</button>}
          </>
        ) : (
          <p className="text-sm text-muted">Offline play isn&apos;t available in this browser.</p>
        )}
        <dl className="mt-4 grid gap-1 border-t border-line pt-3 text-xs">
          <div><dt className="inline font-semibold">Works offline: </dt><dd className="inline text-muted">Sherine and every bot, hints, evaluation, Time Machine, lessons, themes, Chess.com sounds and your saved games.</dd></div>
          <div><dt className="inline font-semibold">Needs internet: </dt><dd className="inline text-muted">online games, friends and challenges, and account sync.</dd></div>
        </dl>
      </div>
    </section>
  );
}
