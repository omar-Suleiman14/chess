import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { findOpponent } from "../../lib/chess/engine/opponents";
import { expectedScore, GLICKO2_VERSION, INITIAL_RATING, updateRating } from "../../lib/chess/ratings/glicko2";
import type { Owner } from "./auth";

export function poolFor(game: Pick<Doc<"games">, "mode" | "timeControlId">): string | null {
  if (game.mode === "climb") return "climb";
  if (game.mode === "timed" && game.timeControlId) return `timed:${game.timeControlId}`;
  return null;
}

/**
 * Applies exactly one Glicko-2 update per eligible finished game. The ledger
 * entry keyed by gameId makes a second application a no-op.
 */
export async function applyRating(ctx: MutationCtx, owner: Owner, game: Doc<"games">, score: 0 | 0.5 | 1): Promise<void> {
  const pool = poolFor(game);
  if (!pool || game.rated !== "eligible") return;
  const already = await ctx.db.query("ratingLedger").withIndex("by_gameId", (q) => q.eq("gameId", game._id)).first();
  if (already) return;
  const opponent = findOpponent(game.opponentId, game.opponentVersion);
  if (!opponent) return;
  const profile = await ctx.db
    .query("ratingProfiles")
    .withIndex("by_owner_and_pool", (q) => q.eq("owner", owner).eq("pool", pool))
    .unique();
  const before = profile ? { rating: profile.rating, rd: profile.rd, volatility: profile.volatility } : INITIAL_RATING;
  const opp = { rating: opponent.rating, rd: opponent.ratingDeviation };
  const after = updateRating(before, [{ opponent: opp, score }]);
  const now = Date.now();
  await ctx.db.insert("ratingLedger", {
    owner,
    pool,
    gameId: game._id,
    before,
    after,
    expected: expectedScore(before, opp),
    score,
    opponentId: opponent.id,
    opponentVersion: opponent.version,
    opponentRating: opponent.rating,
    opponentRd: opponent.ratingDeviation,
    algorithmVersion: GLICKO2_VERSION,
    createdAt: now,
  });
  if (profile) {
    await ctx.db.patch("ratingProfiles", profile._id, { ...after, games: profile.games + 1, updatedAt: now });
  } else {
    await ctx.db.insert("ratingProfiles", { owner, pool, ...after, games: 1, algorithmVersion: GLICKO2_VERSION, updatedAt: now });
  }
}
