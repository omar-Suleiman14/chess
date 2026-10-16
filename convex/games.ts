import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { importPgn, PgnError } from "../lib/chess/history/pgn";
import { ROOT_KEY } from "../lib/chess/history/tree";
import { checkKey, fail, idempotent, optionalOwner, requireOwner } from "./model/auth";
import * as Games from "./model/games";
import { colorValidator, modeValidator, outcomeValidator, ratedValidator } from "./schema";

export const create = mutation({
  args: {
    opId: v.string(),
    gameKey: v.string(),
    mode: modeValidator,
    opponentId: v.string(),
    opponentVersion: v.optional(v.number()),
    humanColor: colorValidator,
    originFen: v.optional(v.string()),
    timeControlId: v.optional(v.string()),
    mainBranchKey: v.string(),
    parentGameKey: v.optional(v.string()),
    parentNodeKey: v.optional(v.string()),
    label: v.optional(v.string()),
    replaceActive: v.optional(v.boolean()),
    startedAt: v.optional(v.number()),
  },
  returns: v.object({ gameKey: v.string(), originFen: v.string(), rated: ratedValidator, revision: v.number(), status: v.union(v.literal("active"), v.literal("finished")), result: v.union(outcomeValidator, v.null()), resultReason: v.union(v.string(), v.null()) }),
  handler: async (ctx, { opId, replaceActive, ...args }) => {
    const owner = await requireOwner(ctx);
    return await idempotent(ctx, owner, opId, "games.create", async () => {
      if (args.mode === "import") fail("bad_request", "Use importPgn for imports.");
      const existing = await ctx.db.query("games").withIndex("by_owner_and_gameKey", q => q.eq("owner", owner).eq("gameKey", args.gameKey)).unique();
      let game = await Games.createGame(ctx, owner, { ...args, createdBy: "app" });
      if (replaceActive && !existing) {
        await Games.replaceActiveSessions(ctx, owner, game);
        game = await Games.getGame(ctx, owner, game.gameKey);
      }
      return { gameKey: game.gameKey, originFen: game.originFen, rated: game.rated, revision: game.revision, status: game.status, result: game.result ?? null, resultReason: game.resultReason ?? null };
    });
  },
});

export const closeOlderSessions = internalMutation({
  args: { owner: v.string(), mode: v.union(v.literal("full_power"), v.literal("climb"), v.literal("timed")), startedAt: v.number(), creationTime: v.number() },
  returns: v.null(),
  handler: async (ctx, { owner, ...args }) => { await Games.closeOlderSessions(ctx, owner, args); return null; },
});

export const appendMove = mutation({
  args: {
    opId: v.string(),
    gameKey: v.string(),
    branchKey: v.string(),
    parentKey: v.string(),
    nodeKey: v.string(),
    uci: v.string(),
    expectedRevision: v.optional(v.number()),
    clockAfterMs: v.optional(v.number()),
  },
  handler: async (ctx, { opId, expectedRevision, ...args }) => {
    const owner = await requireOwner(ctx);
    // A replayed opId returns its stored result first, so a retried write is
    // never mistaken for a stale one. Callers that omit expectedRevision (the
    // offline queue) still get conflict branches instead of a rejection.
    return await idempotent(ctx, owner, opId, "games.appendMove", async () => {
      if (expectedRevision !== undefined) {
        const game = await Games.getGame(ctx, owner, args.gameKey);
        if (game.revision !== expectedRevision) {
          fail("stale_revision", `The game changed (revision ${game.revision}, expected ${expectedRevision}). Reload it and try again.`);
        }
      }
      return await Games.appendMove(ctx, owner, args);
    });
  },
});

export const undo = mutation({
  args: { opId: v.string(), gameKey: v.string(), branchKey: v.string(), toNodeKey: v.string(), variationKey: v.string() },
  handler: async (ctx, { opId, ...args }) => {
    const owner = await requireOwner(ctx);
    return await idempotent(ctx, owner, opId, "games.undo", () => Games.rewind(ctx, owner, args));
  },
});

export const markAssisted = mutation({
  args: {
    gameKey: v.string(),
    reason: v.union(v.literal("eval_bar"), v.literal("hint"), v.literal("engine_lines"), v.literal("pause"), v.literal("offline_sync")),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    return await Games.markAssisted(ctx, owner, args.gameKey, args.reason);
  },
});

export const setActiveBranch = mutation({
  args: { gameKey: v.string(), branchKey: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const game = await Games.getGame(ctx, owner, args.gameKey);
    const branch = await Games.getBranch(ctx, game._id, args.branchKey);
    if (!branch) fail("not_found", "Branch not found.");
    await ctx.db.patch("games", game._id, { activeBranchKey: branch.branchKey, revision: game.revision + 1, updatedAt: Date.now() });
    return null;
  },
});

export const renameBranch = mutation({
  args: { gameKey: v.string(), branchKey: v.string(), label: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const label = args.label.trim();
    if (!label || label.length > 60 || /[<>{}`\\]/.test(label)) fail("bad_request", "Use a short plain label.");
    const game = await Games.getGame(ctx, owner, args.gameKey);
    const branch = await Games.getBranch(ctx, game._id, args.branchKey);
    if (!branch) fail("not_found", "Branch not found.");
    await ctx.db.patch("gameBranches", branch._id, { label, updatedAt: Date.now() });
    return null;
  },
});

export const finish = mutation({
  args: { opId: v.string(), gameKey: v.string(), claim: v.union(v.literal("resign"), v.literal("timeout"), v.literal("abort"), v.literal("replace")) },
  returns: v.object({ status: v.literal("finished"), result: v.union(outcomeValidator, v.null()), reason: v.string(), rated: ratedValidator }),
  handler: async (ctx, { opId, ...args }) => {
    const owner = await requireOwner(ctx);
    return await idempotent(ctx, owner, opId, "games.finish", () => Games.finish(ctx, owner, args));
  },
});

export const importGame = mutation({
  args: { opId: v.string(), gameKey: v.string(), pgn: v.string(), humanColor: colorValidator },
  handler: async (ctx, { opId, ...args }) => {
    const owner = await requireOwner(ctx);
    return await idempotent(ctx, owner, opId, "games.import", async () => {
      checkKey(args.gameKey, "gameKey");
      let counter = 0;
      let parsed;
      try {
        parsed = importPgn(args.pgn, () => `${args.gameKey.slice(0, 40)}-n${++counter}`, Date.now());
      } catch (error) {
        fail("bad_pgn", error instanceof PgnError ? error.message : "Could not read that PGN.");
      }
      const mainBranchKey = Object.keys(parsed.tree.branches)[0];
      const game = await Games.createGame(ctx, owner, {
        gameKey: args.gameKey,
        mode: "practice",
        opponentId: "full-power-standard",
        humanColor: args.humanColor,
        originFen: parsed.tree.originFen,
        mainBranchKey,
        label: (parsed.headers.Event ?? "Imported game").slice(0, 60),
        createdBy: "import",
      });
      const now = Date.now();
      const nodes = Object.values(parsed.tree.nodes).filter((n) => n.key !== ROOT_KEY).sort((a, b) => a.ply - b.ply);
      for (const n of nodes) {
        await ctx.db.insert("gameNodes", {
          owner,
          gameId: game._id,
          nodeKey: n.key,
          parentKey: n.parentKey,
          ply: n.ply,
          uci: n.uci,
          san: n.san,
          fen: n.fen,
          createdAt: now,
        });
      }
      const branch = await Games.getBranch(ctx, game._id, mainBranchKey);
      if (branch) await ctx.db.patch("gameBranches", branch._id, { headKey: parsed.mainHeadKey, label: "Imported", kind: "import" });
      const result = /^(1-0|0-1|1\/2-1\/2)$/.test(parsed.result) ? (parsed.result as "1-0" | "0-1" | "1/2-1/2") : undefined;
      await ctx.db.patch("games", game._id, {
        mode: "import",
        moveCount: nodes.length,
        status: result ? "finished" : "active",
        result,
        resultReason: result ? "imported" : undefined,
        endedAt: result ? now : undefined,
      });
      return { gameKey: game.gameKey, nodes: nodes.length };
    });
  },
});

export const get = query({
  args: { gameKey: v.string() },
  handler: async (ctx, args) => {
    const owner = await optionalOwner(ctx);
    if (!owner) return null;
    try {
      const snap = await Games.snapshot(ctx, owner, args.gameKey);
      return {
        game: snap.game,
        branches: snap.branches,
        nodes: snap.nodes.map((n) => ({ key: n.nodeKey, parentKey: n.parentKey, ply: n.ply, uci: n.uci, san: n.san, fen: n.fen, createdAt: n.createdAt, clockAfterMs: n.clockAfterMs })),
        truncated: snap.truncated,
      };
    } catch {
      return null;
    }
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    return await ctx.db
      .query("games")
      .withIndex("by_owner_and_updatedAt", (q) => q.eq("owner", owner))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/** Most recent active game, used for "Resume". */
export const latestActive = query({
  args: {},
  handler: async (ctx) => {
    const owner = await optionalOwner(ctx);
    if (!owner) return null;
    const recent = await ctx.db
      .query("games")
      .withIndex("by_owner_and_updatedAt", (q) => q.eq("owner", owner))
      .order("desc")
      .take(20);
    return recent.find((g) => g.status === "active" && g.mode !== "import") ?? null;
  },
});

export const children = query({
  args: { gameKey: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    return await ctx.db
      .query("games")
      .withIndex("by_owner_and_parentGameKey", (q) => q.eq("owner", owner).eq("parentGameKey", args.gameKey))
      .take(100);
  },
});
