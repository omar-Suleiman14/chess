// Glicko-2 (Mark Glickman, "Example of the Glicko-2 system", 2012).
// Used for The Climb and each Timed pool. Pure and deterministic.

export const GLICKO2_VERSION = "glicko2-v1";
const SCALE = 173.7178;
const TAU = 0.5;
const EPSILON = 0.000001;

export type Rating = { rating: number; rd: number; volatility: number };
export type GameResult = { opponent: Pick<Rating, "rating" | "rd">; score: 0 | 0.5 | 1 };

export const INITIAL_RATING: Rating = { rating: 1500, rd: 350, volatility: 0.06 };
/** RD at or above this is shown as provisional. */
export const PROVISIONAL_RD = 110;
export const MIN_RD = 45;
export const MAX_RD = 350;

export function isProvisional(r: Pick<Rating, "rd">): boolean {
  return r.rd >= PROVISIONAL_RD;
}

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** Expected score of `player` against `opponent` (0..1). */
export function expectedScore(player: Pick<Rating, "rating">, opponent: Pick<Rating, "rating" | "rd">): number {
  return E((player.rating - 1500) / SCALE, (opponent.rating - 1500) / SCALE, opponent.rd / SCALE);
}

/** One rating period update. With no games, only RD grows. */
export function updateRating(player: Rating, results: GameResult[]): Rating {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.volatility;

  if (results.length === 0) {
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return { ...player, rd: clampRd(phiStar * SCALE) };
  }

  let vInv = 0;
  let deltaSum = 0;
  for (const { opponent, score } of results) {
    const muJ = (opponent.rating - 1500) / SCALE;
    const phiJ = opponent.rd / SCALE;
    const e = E(mu, muJ, phiJ);
    const gj = g(phiJ);
    vInv += gj * gj * e * (1 - e);
    deltaSum += gj * (score - e);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;

  // Step 5: new volatility via the Illinois algorithm.
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * Math.pow(phi * phi + v + ex, 2);
    return num / den - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  let guard = 0;
  while (Math.abs(B - A) > EPSILON && guard++ < 100) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }
  const newSigma = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * deltaSum;
  return {
    rating: newMu * SCALE + 1500,
    rd: clampRd(newPhi * SCALE),
    volatility: newSigma,
  };
}

function clampRd(rd: number): number {
  return Math.min(MAX_RD, Math.max(MIN_RD, rd));
}

/** 95% interval for display, e.g. "1480 ± 210". */
export function interval(r: Pick<Rating, "rating" | "rd">): { low: number; high: number } {
  return { low: Math.round(r.rating - 1.96 * r.rd), high: Math.round(r.rating + 1.96 * r.rd) };
}
