// Friends: requests by alias (typed, or from a scanned card QR), accepting,
// and "play me" challenges that hand a friend an online room PIN.
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { fail, optionalOwner, requireOwner, type Owner } from "./model/auth";

const MAX_FRIENDS = 200;
const CHALLENGE_TTL_MS = 24 * 60 * 60_000;

async function profileByAlias(ctx: QueryCtx, alias: string): Promise<Doc<"chessProfiles"> | null> {
  return await ctx.db.query("chessProfiles").withIndex("by_alias", (q) => q.eq("alias", alias)).first();
}

async function profileByOwner(ctx: QueryCtx, owner: Owner): Promise<Doc<"chessProfiles"> | null> {
  return await ctx.db.query("chessProfiles").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
}

async function requireMyProfile(ctx: QueryCtx, owner: Owner): Promise<Doc<"chessProfiles">> {
  const mine = await profileByOwner(ctx, owner);
  if (!mine) fail("no_profile", "Open Profile once to create your card, then add friends.");
  return mine;
}

/** The row between two players, whichever of them asked. */
export async function pairRow(ctx: QueryCtx, a: Owner, b: Owner): Promise<Doc<"friendships"> | null> {
  const ab = await ctx.db.query("friendships").withIndex("by_requester_and_addressee", (q) => q.eq("requester", a).eq("addressee", b)).unique();
  if (ab) return ab;
  return await ctx.db.query("friendships").withIndex("by_requester_and_addressee", (q) => q.eq("requester", b).eq("addressee", a)).unique();
}

export async function areFriends(ctx: QueryCtx, a: Owner, b: Owner): Promise<boolean> {
  return (await pairRow(ctx, a, b))?.status === "accepted";
}

async function requireTarget(ctx: MutationCtx, owner: Owner, alias: string): Promise<Doc<"chessProfiles">> {
  const target = await profileByAlias(ctx, alias.trim().toLowerCase());
  if (!target) fail("not_found", "No player with that username.");
  if (target.owner === owner) fail("bad_request", "That's you.");
  return target;
}

const publicPerson = (p: Doc<"chessProfiles">) => ({ alias: p.alias, avatarSeed: p.avatarSeed, hue: p.hue });

// ---------------------------------------------------------------------------

/** How the caller relates to `alias`: drives the button on /u/[alias]. */
export const relation = query({
  args: { alias: v.string() },
  returns: v.object({
    state: v.union(v.literal("signed_out"), v.literal("missing"), v.literal("self"), v.literal("none"), v.literal("outgoing"), v.literal("incoming"), v.literal("friends")),
  }),
  handler: async (ctx, args) => {
    const target = await profileByAlias(ctx, args.alias);
    if (!target) return { state: "missing" as const };
    const owner = await optionalOwner(ctx);
    if (!owner) return { state: "signed_out" as const };
    if (owner === target.owner) return { state: "self" as const };
    const row = await pairRow(ctx, owner, target.owner);
    if (!row) return { state: "none" as const };
    if (row.status === "accepted") return { state: "friends" as const };
    return { state: row.requester === owner ? ("outgoing" as const) : ("incoming" as const) };
  },
});

/** Send a request; if they already asked you, this accepts it. */
export const request = mutation({
  args: { alias: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    await requireMyProfile(ctx, owner);
    const target = await requireTarget(ctx, owner, args.alias);
    const row = await pairRow(ctx, owner, target.owner);
    const now = Date.now();
    if (row) {
      if (row.status === "pending" && row.addressee === owner) await ctx.db.patch("friendships", row._id, { status: "accepted", updatedAt: now });
      return null;
    }
    const mine = await ctx.db.query("friendships").withIndex("by_requester_and_status", (q) => q.eq("requester", owner)).take(MAX_FRIENDS);
    if (mine.length >= MAX_FRIENDS) fail("limit", "You have too many pending or accepted friends.");
    await ctx.db.insert("friendships", { requester: owner, addressee: target.owner, status: "pending", createdAt: now, updatedAt: now });
    return null;
  },
});

export const respond = mutation({
  args: { alias: v.string(), accept: v.boolean() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const target = await requireTarget(ctx, owner, args.alias);
    const row = await pairRow(ctx, owner, target.owner);
    if (!row || row.status !== "pending" || row.addressee !== owner) return null;
    if (args.accept) await ctx.db.patch("friendships", row._id, { status: "accepted", updatedAt: Date.now() });
    else await ctx.db.delete("friendships", row._id);
    return null;
  },
});

/** Unfriend, or cancel a request you sent. */
export const remove = mutation({
  args: { alias: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const target = await requireTarget(ctx, owner, args.alias);
    const row = await pairRow(ctx, owner, target.owner);
    if (row) await ctx.db.delete("friendships", row._id);
    return null;
  },
});

/** Send a friend the PIN of a waiting online room you created. */
export const challenge = mutation({
  args: { alias: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const target = await requireTarget(ctx, owner, args.alias);
    if (!(await areFriends(ctx, owner, target.owner))) fail("forbidden", "You can only challenge friends.");
    const room = await ctx.db.query("onlineRooms").withIndex("by_code_and_status", (q) => q.eq("code", args.code).eq("status", "waiting")).first();
    if (!room) fail("not_found", "That game is no longer waiting for a player.");
    const previous = await ctx.db.query("friendChallenges").withIndex("by_from_and_to", (q) => q.eq("from", owner).eq("to", target.owner)).take(10);
    for (const p of previous) await ctx.db.delete("friendChallenges", p._id);
    await ctx.db.insert("friendChallenges", { from: owner, to: target.owner, code: args.code, createdAt: Date.now() });
    return null;
  },
});

export const dismissChallenge = mutation({
  args: { id: v.id("friendChallenges") },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const row = await ctx.db.get("friendChallenges", args.id);
    if (row && (row.to === owner || row.from === owner)) await ctx.db.delete("friendChallenges", row._id);
    return null;
  },
});

const person = v.object({ alias: v.string(), avatarSeed: v.string(), hue: v.number() });

/** Everything the Friends page and the challenge banner need. */
export const overview = query({
  args: { now: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      me: v.union(person, v.null()),
      friends: v.array(person),
      incoming: v.array(person),
      outgoing: v.array(person),
      challenges: v.array(v.object({ id: v.id("friendChallenges"), from: person, code: v.string(), createdAt: v.number() })),
    }),
  ),
  handler: async (ctx, args) => {
    const owner = await optionalOwner(ctx);
    if (!owner) return null;
    const me = await profileByOwner(ctx, owner);
    const [sentAccepted, sentPending, gotAccepted, gotPending] = await Promise.all([
      ctx.db.query("friendships").withIndex("by_requester_and_status", (q) => q.eq("requester", owner).eq("status", "accepted")).take(MAX_FRIENDS),
      ctx.db.query("friendships").withIndex("by_requester_and_status", (q) => q.eq("requester", owner).eq("status", "pending")).take(MAX_FRIENDS),
      ctx.db.query("friendships").withIndex("by_addressee_and_status", (q) => q.eq("addressee", owner).eq("status", "accepted")).take(MAX_FRIENDS),
      ctx.db.query("friendships").withIndex("by_addressee_and_status", (q) => q.eq("addressee", owner).eq("status", "pending")).take(MAX_FRIENDS),
    ]);
    const people = async (owners: Owner[]) =>
      (await Promise.all(owners.map((o) => profileByOwner(ctx, o)))).filter((p): p is Doc<"chessProfiles"> => p !== null).map(publicPerson);

    const raw = await ctx.db.query("friendChallenges").withIndex("by_to_and_createdAt", (q) => q.eq("to", owner).gt("createdAt", args.now - CHALLENGE_TTL_MS)).order("desc").take(20);
    const challenges = [];
    for (const c of raw) {
      // Only invites whose room is still open.
      const room = await ctx.db.query("onlineRooms").withIndex("by_code_and_status", (q) => q.eq("code", c.code).eq("status", "waiting")).first();
      const from = await profileByOwner(ctx, c.from);
      if (room && from) challenges.push({ id: c._id, from: publicPerson(from), code: c.code, createdAt: c.createdAt });
    }

    return {
      me: me ? publicPerson(me) : null,
      friends: (await people([...sentAccepted.map((r) => r.addressee), ...gotAccepted.map((r) => r.requester)])).sort((a, b) => a.alias.localeCompare(b.alias)),
      incoming: await people(gotPending.map((r) => r.requester)),
      outgoing: await people(sentPending.map((r) => r.addressee)),
      challenges,
    };
  },
});
