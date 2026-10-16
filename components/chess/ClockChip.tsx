import { formatClock } from "@/lib/chess/clock";

/**
 * A player's clock, the same everywhere a board has clocks: compact enough to
 * sit beside a name without crowding the board, highlighted while it runs and
 * red in the last 20 seconds.
 */
export function ClockChip({ ms, running }: { ms: number | null; running: boolean }) {
  if (ms === null) return null;
  const low = ms < 20_000;
  return (
    <span
      className={`inline-flex h-9 min-w-[4.5rem] shrink-0 items-center justify-center rounded-lg px-2.5 font-mono text-base font-semibold tabular-nums ${
        running ? (low ? "bg-danger text-white" : "bg-accent text-accent-text") : "bg-surface text-muted shadow-[var(--shadow)]"
      }`}
      role="timer"
      aria-label={`${formatClock(ms)} remaining${running ? ", running" : ""}`}
    >
      {formatClock(ms)}
    </span>
  );
}
