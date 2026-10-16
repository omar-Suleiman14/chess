import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { cardTitle } from "../lib/chess/cardTitle";
import { fail, optionalOwner, requireOwner } from "./model/auth";
import { areFriends } from "./friends";

export const CARD_THEMES = ["sky", "sunset", "mint", "rose", "ink"] as const;
export const BOARD_PALETTES = ["ivory", "sage", "slate", "blue"] as const;

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const owner = await optionalOwner(ctx);
    if (!owner) return null;
    return await ctx.db.query("chessProfiles").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
  },
});

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    const existing = await ctx.db.query("chessProfiles").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
    if (existing) {
      // Older profiles get a card number the first time they're opened.
      if (existing.memberNumber === undefined) await ctx.db.patch("chessProfiles", existing._id, { memberNumber: await nextMemberNumber(ctx) });
      return existing._id;
    }
    const seed = Math.random().toString(36).slice(2, 10);
    return await ctx.db.insert("chessProfiles", {
      owner,
      alias: `player-${seed.slice(0, 5)}`,
      avatarSeed: seed,
      hue: Math.floor(Math.random() * 360),
      cardTheme: "sky",
      memberNumber: await nextMemberNumber(ctx),
      boardPalette: "ivory",
      visibility: "private",
      showRatings: true,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    alias: v.optional(v.string()),
    avatarSeed: v.optional(v.string()),
    hue: v.optional(v.number()),
    cardTheme: v.optional(v.string()),
    boardPalette: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("private"), v.literal("public"))),
    showRatings: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const profile = await ctx.db.query("chessProfiles").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
    if (!profile) fail("not_found", "Profile missing.");
    if (args.alias !== undefined) {
      if (!/^[a-z0-9_-]{3,20}$/.test(args.alias)) fail("bad_request", "Alias: 3-20 lowercase letters, digits, - or _.");
      const taken = await ctx.db.query("chessProfiles").withIndex("by_alias", (q) => q.eq("alias", args.alias!)).first();
      if (taken && taken._id !== profile._id) fail("taken", "That alias is taken.");
    }
    if (args.avatarSeed !== undefined && !/^[A-Za-z0-9_-]{1,32}$/.test(args.avatarSeed)) fail("bad_request", "Bad avatar seed.");
    if (args.hue !== undefined && (args.hue < 0 || args.hue >= 360)) fail("bad_request", "Hue must be 0-359.");
    if (args.cardTheme !== undefined && !(CARD_THEMES as readonly string[]).includes(args.cardTheme)) fail("bad_request", "Unknown card theme.");
    if (args.boardPalette !== undefined && !(BOARD_PALETTES as readonly string[]).includes(args.boardPalette)) fail("bad_request", "Unknown palette.");
    const patch = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));
    await ctx.db.patch("chessProfiles", profile._id, { ...patch, updatedAt: Date.now() });
    return null;
  },
});

async function nextMemberNumber(ctx: MutationCtx): Promise<number> {
  const counter = await ctx.db.query("counters").withIndex("by_name", (q) => q.eq("name", "chessCard")).unique();
  const value = (counter?.value ?? 0) + 1;
  if (counter) await ctx.db.patch("counters", counter._id, { value });
  else await ctx.db.insert("counters", { name: "chessCard", value });
  return value;
}

/** Everything a Chess card shows. Stats only when the owner allows them. */
async function cardData(ctx: QueryCtx, profile: Doc<"chessProfiles">, includeStats: boolean) {
  const fatma = await ctx.db.query("fatmaStates").withIndex("by_owner", (q) => q.eq("owner", profile.owner)).unique();
  const climbProgress = await ctx.db.query("climbProgress").withIndex("by_owner", (q) => q.eq("owner", profile.owner)).unique();
  const stats = fatma?.stats ?? { wins: 0, losses: 0, draws: 0, undos: 0, lessons: 0 };
  let climb: { rating: number; rd: number; games: number; beaten: number } | null = null;
  if (includeStats) {
    const r = await ctx.db
      .query("ratingProfiles")
      .withIndex("by_owner_and_pool", (q) => q.eq("owner", profile.owner).eq("pool", "climb"))
      .unique();
    climb = { rating: r ? Math.round(r.rating) : 0, rd: r ? Math.round(r.rd) : 350, games: r?.games ?? 0, beaten: climbProgress?.beaten.length ?? 0 };
  }
  return {
    alias: profile.alias,
    avatarSeed: profile.avatarSeed,
    hue: profile.hue,
    cardTheme: profile.cardTheme,
    memberNumber: profile.memberNumber ?? null,
    memberSince: profile._creationTime,
    title: cardTitle({ ...stats, climbBeaten: climbProgress?.beaten.length ?? 0 }),
    climb,
    rivalry: includeStats ? { wins: stats.wins, losses: stats.losses, draws: stats.draws } : null,
  };
}

export type CardData = Awaited<ReturnType<typeof cardData>>;

/** Card by alias: public cards for everyone, private ones for the owner and friends. */
export const publicCard = query({
  args: { alias: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db.query("chessProfiles").withIndex("by_alias", (q) => q.eq("alias", args.alias)).first();
    if (!profile) return null;
    if (profile.visibility !== "public") {
      // Private cards are still visible to their owner and to accepted friends.
      const viewer = await optionalOwner(ctx);
      if (!viewer || (viewer !== profile.owner && !(await areFriends(ctx, viewer, profile.owner)))) return null;
    }
    return await cardData(ctx, profile, profile.showRatings);
  },
});

/** Every public card (newest first, bounded) for the /u deck. */
export const publicCards = query({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db
      .query("chessProfiles")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .order("desc")
      .take(60);
    return await Promise.all(profiles.map((p) => cardData(ctx, p, false)));
  },
});

/** The signed-in player's own card (always with stats). */
export const myCard = query({
  args: {},
  handler: async (ctx) => {
    const owner = await optionalOwner(ctx);
    if (!owner) return null;
    const profile = await ctx.db.query("chessProfiles").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
    return profile ? await cardData(ctx, profile, true) : null;
  },
});

const TABLES = [
  "games",
  "operations",
  "engineAnalyses",
  "ratingProfiles",
  "ratingLedger",
  "climbProgress",
  "lessonProgress",
  "customLessons",
  "practiceItems",
  "chessProfiles",
  "fatmaStates",
  "fatmaPacks",
  "mcpGrants",
  "mcpAudits",
  "friendships",
  "friendChallenges",
] as const;

/** Deletes every chess record the caller owns (in batches). */
export const deleteMyData = mutation({
  args: { confirm: v.literal("DELETE") },
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    await ctx.scheduler.runAfter(0, internal.profiles.deleteBatch, { owner, table: 0 });
    return null;
  },
});

export const deleteBatch = internalMutation({
  args: { owner: v.string(), table: v.number() },
  handler: async (ctx, args) => {
    if (args.table >= TABLES.length) return null;
    const name = TABLES[args.table];
    let removed = 0;
    if (name === "games") {
      // Delete nodes and branches of one game at a time, then the game.
      const game = await ctx.db.query("games").withIndex("by_owner_and_updatedAt", (q) => q.eq("owner", args.owner)).first();
      if (game) {
        const nodes = await ctx.db.query("gameNodes").withIndex("by_gameId_and_ply", (q) => q.eq("gameId", game._id)).take(400);
        for (const n of nodes) await ctx.db.delete("gameNodes", n._id);
        const branches = await ctx.db.query("gameBranches").withIndex("by_gameId_and_branchKey", (q) => q.eq("gameId", game._id)).take(200);
        for (const b of branches) await ctx.db.delete("gameBranches", b._id);
        const analyses = await ctx.db.query("engineAnalyses").withIndex("by_gameId_and_nodeKey", (q) => q.eq("gameId", game._id)).take(400);
        for (const a of analyses) await ctx.db.delete("engineAnalyses", a._id);
        removed = nodes.length + branches.length + analyses.length;
        if (removed === 0) {
          await ctx.db.delete("games", game._id);
          removed = 1;
        }
      }
    } else {
      const rows = await queryOwned(ctx, name, args.owner);
      for (const row of rows) await ctx.db.delete(name, row._id);
      removed = rows.length;
    }
    await ctx.scheduler.runAfter(0, internal.profiles.deleteBatch, { owner: args.owner, table: removed > 0 ? args.table : args.table + 1 });
    return null;
  },
});

async function queryOwned(ctx: MutationCtx, name: Exclude<(typeof TABLES)[number], "games">, owner: string) {
  switch (name) {
    case "operations": return await ctx.db.query("operations").withIndex("by_owner_and_opId", (q) => q.eq("owner", owner)).take(200);
    case "engineAnalyses": return await ctx.db.query("engineAnalyses").withIndex("by_owner_and_positionKey", (q) => q.eq("owner", owner)).take(200);
    case "ratingProfiles": return await ctx.db.query("ratingProfiles").withIndex("by_owner_and_pool", (q) => q.eq("owner", owner)).take(200);
    case "ratingLedger": return await ctx.db.query("ratingLedger").withIndex("by_owner_and_pool", (q) => q.eq("owner", owner)).take(200);
    case "climbProgress": return await ctx.db.query("climbProgress").withIndex("by_owner", (q) => q.eq("owner", owner)).take(200);
    case "lessonProgress": return await ctx.db.query("lessonProgress").withIndex("by_owner_and_lessonId", (q) => q.eq("owner", owner)).take(200);
    case "customLessons": return await ctx.db.query("customLessons").withIndex("by_owner_and_createdAt", (q) => q.eq("owner", owner)).take(200);
    case "practiceItems": return await ctx.db.query("practiceItems").withIndex("by_owner_and_dueAt", (q) => q.eq("owner", owner)).take(200);
    case "chessProfiles": return await ctx.db.query("chessProfiles").withIndex("by_owner", (q) => q.eq("owner", owner)).take(200);
    case "fatmaStates": return await ctx.db.query("fatmaStates").withIndex("by_owner", (q) => q.eq("owner", owner)).take(200);
    case "fatmaPacks": return await ctx.db.query("fatmaPacks").withIndex("by_owner_and_status", (q) => q.eq("owner", owner)).take(200);
    case "mcpGrants": return await ctx.db.query("mcpGrants").withIndex("by_owner", (q) => q.eq("owner", owner)).take(200);
    case "mcpAudits": return await ctx.db.query("mcpAudits").withIndex("by_owner_and_createdAt", (q) => q.eq("owner", owner)).take(200);
    case "friendships": return [
      ...(await ctx.db.query("friendships").withIndex("by_requester_and_addressee", (q) => q.eq("requester", owner)).take(100)),
      ...(await ctx.db.query("friendships").withIndex("by_addressee_and_status", (q) => q.eq("addressee", owner)).take(100)),
    ];
    case "friendChallenges": return [
      ...(await ctx.db.query("friendChallenges").withIndex("by_from_and_to", (q) => q.eq("from", owner)).take(100)),
      ...(await ctx.db.query("friendChallenges").withIndex("by_to_and_createdAt", (q) => q.eq("to", owner)).take(100)),
    ];
  }
}

/** Bounded export of the caller's data (games are exported as PGN client-side). */
export const exportMyData = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    const [profile, ratings, ledger, lessons, practice, fatma, packs, games] = await Promise.all([
      ctx.db.query("chessProfiles").withIndex("by_owner", (q) => q.eq("owner", owner)).unique(),
      ctx.db.query("ratingProfiles").withIndex("by_owner_and_pool", (q) => q.eq("owner", owner)).take(50),
      ctx.db.query("ratingLedger").withIndex("by_owner_and_pool", (q) => q.eq("owner", owner)).take(1000),
      ctx.db.query("lessonProgress").withIndex("by_owner_and_lessonId", (q) => q.eq("owner", owner)).take(500),
      ctx.db.query("practiceItems").withIndex("by_owner_and_dueAt", (q) => q.eq("owner", owner)).take(1000),
      ctx.db.query("fatmaStates").withIndex("by_owner", (q) => q.eq("owner", owner)).unique(),
      ctx.db.query("fatmaPacks").withIndex("by_owner_and_status", (q) => q.eq("owner", owner)).take(100),
      ctx.db.query("games").withIndex("by_owner_and_updatedAt", (q) => q.eq("owner", owner)).order("desc").take(500),
    ]);
    return { exportedFor: "chess-by-chaos", version: 1, profile, ratings, ledger, lessons, practice, fatma, packs, gameKeys: games.map((g) => g.gameKey) };
  },
});
