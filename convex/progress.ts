import { v } from "convex/values";
import { query } from "./_generated/server";
import { CLIMB_OPPONENTS } from "../lib/chess/engine/opponents";
import { INITIAL_RATING, interval, isProvisional } from "../lib/chess/ratings/glicko2";
import { optionalOwner, requireOwner } from "./model/auth";
import { poolFor } from "./model/ratings";

/** Small authoritative read for the current game's exact rating pool. */
export const nameplate = query({
  args: { gameKey: v.string() },
  returns: v.union(v.null(), v.object({ pool: v.string(), rating: v.number(), rd: v.number(), volatility: v.number(), games: v.number(), provisional: v.boolean(), delta: v.union(v.number(), v.null()) })),
  handler: async (ctx, { gameKey }) => {
    const owner = await optionalOwner(ctx);
    if (!owner) return null;
    const game = await ctx.db.query("games").withIndex("by_owner_and_gameKey", (q) => q.eq("owner", owner).eq("gameKey", gameKey)).unique();
    if (!game) return null;
    const pool = poolFor(game);
    if (!pool) return null;
    const profile = await ctx.db.query("ratingProfiles").withIndex("by_owner_and_pool", (q) => q.eq("owner", owner).eq("pool", pool)).unique();
    const ledger = game.status === "finished" ? await ctx.db.query("ratingLedger").withIndex("by_gameId", (q) => q.eq("gameId", game._id)).unique() : null;
    const rating = profile ?? { ...INITIAL_RATING, games: 0 };
    return { pool, rating: Math.round(rating.rating), rd: Math.round(rating.rd), volatility: rating.volatility, games: rating.games, provisional: isProvisional(rating), delta: ledger ? Math.round(ledger.after.rating) - Math.round(ledger.before.rating) : null };
  },
});

/**
 * Separate, honest metrics: ratings per pool with uncertainty, Climb ladder
 * progress, and Full Power outcome trends. No cross-mode "Elo" is invented.
 */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    const pools = await ctx.db.query("ratingProfiles").withIndex("by_owner_and_pool", (q) => q.eq("owner", owner)).take(20);
    const climb = await ctx.db.query("climbProgress").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
    const recent = await ctx.db
      .query("games")
      .withIndex("by_owner_and_updatedAt", (q) => q.eq("owner", owner))
      .order("desc")
      .take(60);
    const finished = recent.filter((g) => g.status === "finished" && g.result);
    const score = (g: (typeof finished)[number]) =>
      g.result === "1/2-1/2" ? 0.5 : (g.result === "1-0") === (g.humanColor === "w") ? 1 : 0;
    const byMode = (mode: string) => {
      const games = finished.filter((g) => g.mode === mode);
      return {
        games: games.length,
        wins: games.filter((g) => score(g) === 1).length,
        draws: games.filter((g) => score(g) === 0.5).length,
        losses: games.filter((g) => score(g) === 0).length,
        averageLength: games.length ? Math.round(games.reduce((s, g) => s + g.moveCount, 0) / games.length) : 0,
      };
    };
    return {
      ratings: pools.map((p) => ({
        pool: p.pool,
        rating: Math.round(p.rating),
        rd: Math.round(p.rd),
        provisional: isProvisional(p),
        interval: interval(p),
        games: p.games,
        algorithm: p.algorithmVersion,
      })),
      climb: {
        unlockedLevel: climb?.unlockedLevel ?? 0,
        beaten: climb?.beaten ?? [],
        ladder: CLIMB_OPPONENTS.map((o) => ({ id: o.id, name: o.name, rating: o.rating, calibrated: o.calibrated })),
      },
      fullPower: byMode("full_power"),
      climbGames: byMode("climb"),
      timedGames: byMode("timed"),
      sampleWindow: recent.length,
    };
  },
});

export const ledger = query({
  args: { pool: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    return await ctx.db
      .query("ratingLedger")
      .withIndex("by_owner_and_pool", (q) => q.eq("owner", owner).eq("pool", args.pool))
      .order("desc")
      .take(50);
  },
});

export const climb = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    const progress = await ctx.db.query("climbProgress").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
    const rating = await ctx.db
      .query("ratingProfiles")
      .withIndex("by_owner_and_pool", (q) => q.eq("owner", owner).eq("pool", "climb"))
      .unique();
    return {
      unlockedLevel: progress?.unlockedLevel ?? 0,
      beaten: progress?.beaten ?? [],
      rating: rating ? { rating: Math.round(rating.rating), rd: Math.round(rating.rd), provisional: isProvisional(rating), games: rating.games } : null,
    };
  },
});
