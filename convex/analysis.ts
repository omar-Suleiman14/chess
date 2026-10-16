import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { applyUci } from "../lib/chess/rules";
import { fail, requireOwner } from "./model/auth";
import { getGame, getNode, positionKey } from "./model/games";

const MAX_PV = 24;

/**
 * Stores a browser-computed engine evaluation for a saved node. Analyses are
 * derived data: they never change results or ratings. Deeper analyses replace
 * shallower ones for the same node and engine build.
 */
export const save = mutation({
  args: {
    gameKey: v.string(),
    nodeKey: v.string(),
    engineBuild: v.string(),
    settingsHash: v.string(),
    depth: v.number(),
    scoreCp: v.optional(v.number()),
    scoreMate: v.optional(v.number()),
    bestmove: v.optional(v.string()),
    pv: v.array(v.string()),
    computeMs: v.number(),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    if (args.depth < 1 || args.depth > 99 || !Number.isInteger(args.depth)) fail("bad_request", "Bad depth.");
    if (args.pv.length > MAX_PV) fail("bad_request", "PV too long.");
    if (args.settingsHash.length > 80 || args.engineBuild.length > 80) fail("bad_request", "Bad metadata.");
    if (args.scoreCp === undefined && args.scoreMate === undefined) fail("bad_request", "Missing score.");
    const game = await getGame(ctx, owner, args.gameKey);
    const node = await getNode(ctx, game._id, args.nodeKey);
    if (!node) fail("stale_node", "Unknown node.");
    if (args.bestmove && !applyUci(node.fen, args.bestmove)) fail("illegal_move", "Best move is illegal for that position.");
    const existing = await ctx.db
      .query("engineAnalyses")
      .withIndex("by_gameId_and_nodeKey", (q) => q.eq("gameId", game._id).eq("nodeKey", args.nodeKey))
      .take(8);
    const same = existing.find((a) => a.engineBuild === args.engineBuild && a.settingsHash === args.settingsHash);
    const doc = {
      owner,
      gameId: game._id,
      nodeKey: args.nodeKey,
      positionKey: positionKey(node.fen),
      engineBuild: args.engineBuild,
      settingsHash: args.settingsHash,
      depth: args.depth,
      scoreCp: args.scoreMate !== undefined ? undefined : args.scoreCp,
      scoreMate: args.scoreMate,
      bestmove: args.bestmove,
      pv: args.pv,
      computeMs: Math.max(0, Math.min(args.computeMs, 600_000)),
      source: "browser" as const,
      updatedAt: Date.now(),
    };
    if (same) {
      if (same.depth >= args.depth) return { stored: false };
      await ctx.db.replace("engineAnalyses", same._id, doc);
    } else {
      if (existing.length >= 8) fail("quota", "Too many analyses for this position.");
      await ctx.db.insert("engineAnalyses", doc);
    }
    return { stored: true };
  },
});

export const forGame = query({
  args: { gameKey: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const game = await getGame(ctx, owner, args.gameKey);
    const rows = await ctx.db
      .query("engineAnalyses")
      .withIndex("by_gameId_and_nodeKey", (q) => q.eq("gameId", game._id))
      .take(4000);
    return rows.map((r) => ({ nodeKey: r.nodeKey, depth: r.depth, scoreCp: r.scoreCp, scoreMate: r.scoreMate, bestmove: r.bestmove, engineBuild: r.engineBuild }));
  },
});
