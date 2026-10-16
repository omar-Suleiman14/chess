// Fischer-increment chess clock driven by a monotonic time source.
import type { Color } from "./rules";

export type TimeControl = { id: string; label: string; initialMs: number; incrementMs: number };

export const TIME_CONTROLS: TimeControl[] = [
  { id: "3+2", label: "3 + 2", initialMs: 3 * 60_000, incrementMs: 2_000 },
  { id: "5+3", label: "5 + 3", initialMs: 5 * 60_000, incrementMs: 3_000 },
  { id: "10+5", label: "10 + 5", initialMs: 10 * 60_000, incrementMs: 5_000 },
  { id: "15+10", label: "15 + 10", initialMs: 15 * 60_000, incrementMs: 10_000 },
];

export function findTimeControl(id: string): TimeControl | undefined {
  return TIME_CONTROLS.find((t) => t.id === id);
}

export type ClockState = {
  remainingMs: Record<Color, number>;
  running: Color | null;
  /** Monotonic timestamp when `running` started its current turn. */
  turnStartedAt: number | null;
  flagged: Color | null;
};

export function initialClock(tc: TimeControl): ClockState {
  return { remainingMs: { w: tc.initialMs, b: tc.initialMs }, running: null, turnStartedAt: null, flagged: null };
}

export function remaining(clock: ClockState, color: Color, now: number): number {
  const base = clock.remainingMs[color];
  if (clock.running !== color || clock.turnStartedAt === null) return base;
  return Math.max(0, base - (now - clock.turnStartedAt));
}

export function startTurn(clock: ClockState, color: Color, now: number): ClockState {
  if (clock.flagged) return clock;
  return { ...clock, running: color, turnStartedAt: now };
}

/** Ends the mover's turn: deducts elapsed time, adds increment, starts the opponent. */
export function pressClock(clock: ClockState, mover: Color, tc: TimeControl, now: number): ClockState {
  if (clock.flagged) return clock;
  const left = remaining(clock, mover, now);
  if (left <= 0) return { ...clock, remainingMs: { ...clock.remainingMs, [mover]: 0 }, running: null, turnStartedAt: null, flagged: mover };
  const other: Color = mover === "w" ? "b" : "w";
  return {
    remainingMs: { ...clock.remainingMs, [mover]: left + tc.incrementMs },
    running: other,
    turnStartedAt: now,
    flagged: null,
  };
}

export function checkFlag(clock: ClockState, now: number): ClockState {
  if (!clock.running || clock.flagged) return clock;
  if (remaining(clock, clock.running, now) > 0) return clock;
  return {
    ...clock,
    remainingMs: { ...clock.remainingMs, [clock.running]: 0 },
    running: null,
    turnStartedAt: null,
    flagged: clock.running,
  };
}

/** Freezes the running side (e.g. game over or explicit unrated pause). */
export function pause(clock: ClockState, now: number): ClockState {
  if (!clock.running) return clock;
  return {
    ...clock,
    remainingMs: { ...clock.remainingMs, [clock.running]: remaining(clock, clock.running, now) },
    running: null,
    turnStartedAt: null,
  };
}

export function formatClock(ms: number): string {
  const total = Math.max(0, ms);
  if (total < 10_000) return (total / 1000).toFixed(1);
  const seconds = Math.ceil(total / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
