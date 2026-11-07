import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { fail, optionalOwner, requireOwner } from "./model/auth";
import { findPuzzle, INITIAL_PUZZLE_RATING, ratePuzzle } from "../lib/chess/puzzles";

const statsValidator = v.object({
  rating: v.number(),
  rd: v.number(),
  attempts: v.number(),
  solved: v.number(),
  streak: v.number(),
  bestStreak: v.number(),
  rush3: v.number(),
  rush5: v.number(),
  survival: v.number(),
});

const EMPTY = { rating: INITIAL_PUZZLE_RATING.rating, rd: INITIAL_PUZZLE_RATING.rd, volatility: INITIAL_PUZZLE_RATING.volatility, attempts: 0, solved: 0, streak: 0, bestStreak: 0, rush3: 0, rush5: 0, survival: 0 };

async function statsRow(ctx: MutationCtx, owner: string) {
  return await ctx.db.query("puzzleStats").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
}

/** The signed-in player's puzzle rating and records, or null when signed out. */
export const mine = query({
  args: {},
  returns: v.union(v.null(), statsValidator),
  handler: async (ctx) => {
    const owner = await optionalOwner(ctx);
    if (!owner) return null;
    const row = await ctx.db.query("puzzleStats").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
    const s = row ?? EMPTY;
    return { rating: s.rating, rd: s.rd, attempts: s.attempts, solved: s.solved, streak: s.streak, bestStreak: s.bestStreak, rush3: s.rush3, rush5: s.rush5, survival: s.survival };
  },
});

/** Recent rated attempts, newest first, for the rating history chart. */
export const recent = query({
  args: {},
  returns: v.array(v.object({ puzzleId: v.string(), solved: v.boolean(), ratingAfter: v.number(), at: v.number() })),
  handler: async (ctx) => {
    const owner = await optionalOwner(ctx);
    if (!owner) return [];
    const rows = await ctx.db.query("puzzleAttempts").withIndex("by_owner_and_at", (q) => q.eq("owner", owner)).order("desc").take(50);
    return rows.map((r) => ({ puzzleId: r.puzzleId, solved: r.solved, ratingAfter: r.ratingAfter, at: r.at }));
  },
});

/**
 * Records a rated attempt. The server looks up the puzzle's rating itself,
 * and a puzzle already attempted never changes the rating again.
 */
export const recordAttempt = mutation({
  args: { puzzleId: v.string(), solved: v.boolean() },
  returns: v.object({ rated: v.boolean(), rating: v.number(), delta: v.number() }),
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const puzzle = findPuzzle(args.puzzleId);
    if (!puzzle) fail("not_found", "Puzzle not found.");
    const row = await statsRow(ctx, owner);
    const current = row ?? { ...EMPTY, owner, updatedAt: 0 };
    const seen = await ctx.db.query("puzzleAttempts").withIndex("by_owner_and_puzzleId", (q) => q.eq("owner", owner).eq("puzzleId", args.puzzleId)).first();
    if (seen) return { rated: false, rating: current.rating, delta: 0 };

    const now = Date.now();
    const next = ratePuzzle({ rating: current.rating, rd: current.rd, volatility: current.volatility }, puzzle, args.solved);
    const streak = args.solved ? current.streak + 1 : 0;
    const fields = {
      rating: next.rating,
      rd: next.rd,
      volatility: next.volatility,
      attempts: current.attempts + 1,
      solved: current.solved + (args.solved ? 1 : 0),
      streak,
      bestStreak: Math.max(current.bestStreak, streak),
      updatedAt: now,
    };
    if (row) await ctx.db.patch("puzzleStats", row._id, fields);
    else await ctx.db.insert("puzzleStats", { ...EMPTY, owner, ...fields });
    await ctx.db.insert("puzzleAttempts", { owner, puzzleId: args.puzzleId, solved: args.solved, ratingBefore: current.rating, ratingAfter: next.rating, at: now });
    return { rated: true, rating: next.rating, delta: next.rating - current.rating };
  },
});

/** Saves a Puzzle Rush score if it beats the player's best for that mode. */
export const recordRush = mutation({
  args: { mode: v.union(v.literal("3min"), v.literal("5min"), v.literal("survival")), score: v.number() },
  returns: v.object({ best: v.number(), isBest: v.boolean() }),
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    if (!Number.isInteger(args.score) || args.score < 0 || args.score > 500) fail("bad_request", "Invalid score.");
    const key = args.mode === "3min" ? "rush3" : args.mode === "5min" ? "rush5" : "survival";
    const row = await statsRow(ctx, owner);
    const best = row?.[key] ?? 0;
    if (args.score <= best) return { best, isBest: false };
    if (row) await ctx.db.patch("puzzleStats", row._id, { [key]: args.score, updatedAt: Date.now() });
    else await ctx.db.insert("puzzleStats", { ...EMPTY, owner, [key]: args.score, updatedAt: Date.now() });
    return { best: args.score, isBest: true };
  },
});
