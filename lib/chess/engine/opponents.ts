// Versioned opponent presets. Ratings here are *estimates* until a calibration
// run (scripts/calibrate.mjs) records evidence; the UI must say so.
import type { EngineOptions } from "./controller";

export type ThinkPreset = "fast" | "standard" | "deep";

export const THINK_TIME_MS: Record<ThinkPreset, number> = {
  fast: 400,
  standard: 1200,
  deep: 3500,
};

export const FULL_POWER_LABEL = 3000;

export type OpponentPolicy =
  | { kind: "beginner"; policy: "random" | "greedy" | "careful"; blunderRate: number }
  | { kind: "stockfish"; options: EngineOptions; movetimeMs: number; depth?: number };

export type Opponent = {
  id: string;
  version: number;
  name: string;
  /** Displayed rating; for Full Power this is a nominal label, never a measurement. */
  rating: number;
  /** Glicko RD for the opponent's rating; large = uncalibrated guess. */
  ratingDeviation: number;
  calibrated: boolean;
  policy: OpponentPolicy;
};

export const OPPONENT_POOL_VERSION = "climb-v1";

/**
 * The Climb ladder. Ratings below Stockfish's UCI_Elo floor (1320) come from
 * the deterministic beginner policies. All values are provisional guesses
 * (calibrated=false) until benchmarked.
 */
export const CLIMB_OPPONENTS: Opponent[] = [
  { id: "climb-01", version: 1, name: "Wobbly Pawn", rating: 250, ratingDeviation: 300, calibrated: false, policy: { kind: "beginner", policy: "random", blunderRate: 1 } },
  { id: "climb-02", version: 1, name: "Snack Grabber", rating: 450, ratingDeviation: 300, calibrated: false, policy: { kind: "beginner", policy: "greedy", blunderRate: 0.35 } },
  { id: "climb-03", version: 1, name: "Nervous Knight", rating: 650, ratingDeviation: 300, calibrated: false, policy: { kind: "beginner", policy: "careful", blunderRate: 0.25 } },
  { id: "climb-04", version: 1, name: "Tidy Bishop", rating: 850, ratingDeviation: 300, calibrated: false, policy: { kind: "beginner", policy: "careful", blunderRate: 0.08 } },
  { id: "climb-05", version: 1, name: "Fatma (sleepy)", rating: 1050, ratingDeviation: 300, calibrated: false, policy: { kind: "stockfish", options: { "Skill Level": 0 }, movetimeMs: 60, depth: 2 } },
  { id: "climb-06", version: 1, name: "Fatma (distracted)", rating: 1250, ratingDeviation: 300, calibrated: false, policy: { kind: "stockfish", options: { "Skill Level": 3 }, movetimeMs: 120, depth: 4 } },
  { id: "climb-07", version: 1, name: "Fatma (warming up)", rating: 1450, ratingDeviation: 300, calibrated: false, policy: { kind: "stockfish", options: { UCI_LimitStrength: true, UCI_Elo: 1450 }, movetimeMs: 400 } },
  { id: "climb-08", version: 1, name: "Fatma (focused)", rating: 1750, ratingDeviation: 300, calibrated: false, policy: { kind: "stockfish", options: { UCI_LimitStrength: true, UCI_Elo: 1750 }, movetimeMs: 600 } },
  { id: "climb-09", version: 1, name: "Fatma (serious)", rating: 2050, ratingDeviation: 300, calibrated: false, policy: { kind: "stockfish", options: { UCI_LimitStrength: true, UCI_Elo: 2050 }, movetimeMs: 800 } },
  { id: "climb-10", version: 1, name: "Fatma (ruthless)", rating: 2400, ratingDeviation: 300, calibrated: false, policy: { kind: "stockfish", options: { UCI_LimitStrength: true, UCI_Elo: 2400 }, movetimeMs: 1000 } },
  { id: "climb-11", version: 1, name: "Fatma · Full Power", rating: FULL_POWER_LABEL, ratingDeviation: 350, calibrated: false, policy: { kind: "stockfish", options: {}, movetimeMs: THINK_TIME_MS.standard } },
];

export function fullPowerOpponent(preset: ThinkPreset): Opponent {
  return {
    id: `full-power-${preset}`,
    version: 1,
    name: "Fatma",
    rating: FULL_POWER_LABEL,
    ratingDeviation: 350,
    calibrated: false,
    // Full Power never sets Skill Level / UCI_LimitStrength: defaults are full strength.
    policy: { kind: "stockfish", options: {}, movetimeMs: THINK_TIME_MS[preset] },
  };
}

export function findOpponent(id: string): Opponent | undefined {
  if (id.startsWith("full-power-")) {
    const preset = id.slice("full-power-".length) as ThinkPreset;
    if (preset in THINK_TIME_MS) return fullPowerOpponent(preset);
    return undefined;
  }
  return CLIMB_OPPONENTS.find((o) => o.id === id);
}

export function ratingLabel(opponent: Opponent): string {
  if (opponent.rating === FULL_POWER_LABEL && opponent.id.startsWith("full-power")) {
    return `${FULL_POWER_LABEL}`;
  }
  return opponent.calibrated ? `${opponent.rating}` : `~${opponent.rating}`;
}
