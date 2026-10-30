// Versioned opponent presets. Ratings here are *estimates* until a calibration
// run (scripts/calibrate.ts) records evidence; the UI must say so.
import type { EngineOptions } from "./controller";

export type ThinkPreset = "fast" | "standard" | "deep";

export const THINK_TIME_MS: Record<ThinkPreset, number> = {
  fast: 400,
  standard: 1200,
  deep: 3500,
};

export const FULL_POWER_LABEL = 3000;

/**
 * Who you're playing: Maya is the strongest bot (Stockfish at full strength,
 * Full Power and the top Climb level); Sherine plays every weaker level and
 * stays the app's companion.
 */
export type BotPersona = "maya" | "sherine";
export const PERSONA_NAMES: Record<BotPersona, string> = { maya: "Maya", sherine: "Sherine" };
export function botPersona(opponent?: { id: string } | null): BotPersona {
  return opponent && (opponent.id.startsWith("full-power-") || opponent.id === "climb-11") ? "maya" : "sherine";
}

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

export const OPPONENT_POOL_VERSION = "climb-v2";

/**
 * Original Climb presets, retained for existing games and report reproduction.
 * Relative bot strength can be benchmarked; nominal human ratings remain
 * provisional estimates (calibrated=false).
 */
const CLIMB_V1: Opponent[] = [
  { id: "climb-01", version: 1, name: "Wobbly Pawn", rating: 250, ratingDeviation: 300, calibrated: false, policy: { kind: "beginner", policy: "random", blunderRate: 1 } },
  { id: "climb-02", version: 1, name: "Snack Grabber", rating: 450, ratingDeviation: 300, calibrated: false, policy: { kind: "beginner", policy: "greedy", blunderRate: 0.35 } },
  { id: "climb-03", version: 1, name: "Nervous Knight", rating: 650, ratingDeviation: 300, calibrated: false, policy: { kind: "beginner", policy: "careful", blunderRate: 0.25 } },
  { id: "climb-04", version: 1, name: "Tidy Bishop", rating: 850, ratingDeviation: 300, calibrated: false, policy: { kind: "beginner", policy: "careful", blunderRate: 0.08 } },
  { id: "climb-05", version: 1, name: "Sherine (sleepy)", rating: 1050, ratingDeviation: 300, calibrated: false, policy: { kind: "stockfish", options: { "Skill Level": 0 }, movetimeMs: 60, depth: 2 } },
  { id: "climb-06", version: 1, name: "Sherine (distracted)", rating: 1250, ratingDeviation: 300, calibrated: false, policy: { kind: "stockfish", options: { "Skill Level": 3 }, movetimeMs: 120, depth: 4 } },
  { id: "climb-07", version: 1, name: "Sherine (warming up)", rating: 1450, ratingDeviation: 300, calibrated: false, policy: { kind: "stockfish", options: { UCI_LimitStrength: true, UCI_Elo: 1450 }, movetimeMs: 400 } },
  { id: "climb-08", version: 1, name: "Sherine (focused)", rating: 1750, ratingDeviation: 300, calibrated: false, policy: { kind: "stockfish", options: { UCI_LimitStrength: true, UCI_Elo: 1750 }, movetimeMs: 600 } },
  { id: "climb-09", version: 1, name: "Sherine (serious)", rating: 2050, ratingDeviation: 300, calibrated: false, policy: { kind: "stockfish", options: { UCI_LimitStrength: true, UCI_Elo: 2050 }, movetimeMs: 800 } },
  { id: "climb-10", version: 1, name: "Sherine (ruthless)", rating: 2400, ratingDeviation: 300, calibrated: false, policy: { kind: "stockfish", options: { UCI_LimitStrength: true, UCI_Elo: 2400 }, movetimeMs: 1000 } },
  { id: "climb-11", version: 1, name: "Maya · Full Power", rating: FULL_POWER_LABEL, ratingDeviation: 350, calibrated: false, policy: { kind: "stockfish", options: {}, movetimeMs: THINK_TIME_MS.standard } },
];

// Keep historical policies available to games already started on v1. The v1
// report found an inverted middle step and inconclusive beginner separation.
// These changes are checked by the adjacent-matchup reports in docs/calibration.
export const CLIMB_OPPONENTS: Opponent[] = CLIMB_V1.map((opponent): Opponent => {
  if (opponent.id === "climb-04") return { ...opponent, version: 2, policy: { kind: "beginner", policy: "careful", blunderRate: 0 } };
  if (opponent.id === "climb-06") return { ...opponent, version: 2, policy: { kind: "stockfish", options: { "Skill Level": 1 }, movetimeMs: 90, depth: 3 } };
  if (opponent.id === "climb-07") return { ...opponent, version: 2, policy: { kind: "stockfish", options: { "Skill Level": 2 }, movetimeMs: 120, depth: 2 } };
  return opponent;
});

export function fullPowerOpponent(preset: ThinkPreset): Opponent {
  return {
    id: `full-power-${preset}`,
    version: 1,
    name: "Maya",
    rating: FULL_POWER_LABEL,
    ratingDeviation: 350,
    calibrated: false,
    // Full Power never sets Skill Level / UCI_LimitStrength: defaults are full strength.
    policy: { kind: "stockfish", options: {}, movetimeMs: THINK_TIME_MS[preset] },
  };
}

export function findOpponent(id: string, version?: number): Opponent | undefined {
  if (id.startsWith("full-power-")) {
    if (version !== undefined && version !== 1) return undefined;
    const preset = id.slice("full-power-".length) as ThinkPreset;
    if (preset in THINK_TIME_MS) return fullPowerOpponent(preset);
    return undefined;
  }
  const pool = version === 1 ? CLIMB_V1 : CLIMB_OPPONENTS;
  return pool.find((o) => o.id === id && (version === undefined || o.version === version));
}

export function ratingLabel(opponent: Opponent): string {
  if (opponent.rating === FULL_POWER_LABEL && opponent.id.startsWith("full-power")) {
    return `${FULL_POWER_LABEL}`;
  }
  return opponent.calibrated ? `${opponent.rating}` : `~${opponent.rating}`;
}
