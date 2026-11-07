import { v } from "convex/values";
import { env, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { fail, optionalOwner, requireOwner } from "./model/auth";

const MAX_DEVICES = 10;

/** The VAPID public key browsers subscribe with, or null when push isn't set up. */
export const publicKey = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async () => (env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY ? env.VAPID_PUBLIC_KEY : null),
});

/** Is this browser subscribed for the signed-in player? */
export const status = query({
  args: { endpoint: v.union(v.string(), v.null()) },
  returns: v.object({ subscribed: v.boolean(), devices: v.number() }),
  handler: async (ctx, args) => {
    const owner = await optionalOwner(ctx);
    if (!owner) return { subscribed: false, devices: 0 };
    const rows = await ctx.db.query("pushSubscriptions").withIndex("by_owner", (q) => q.eq("owner", owner)).take(MAX_DEVICES);
    return { subscribed: !!args.endpoint && rows.some((r) => r.endpoint === args.endpoint), devices: rows.length };
  },
});

/** Saves this browser's push endpoint for the signed-in player. */
export const subscribe = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    if (!/^https:\/\//.test(args.endpoint) || args.endpoint.length > 1000 || args.p256dh.length > 200 || args.auth.length > 100) fail("bad_request", "Invalid subscription.");
    // An endpoint belongs to one browser: move it if another account had it.
    const existing = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint)).take(5);
    for (const row of existing) await ctx.db.delete("pushSubscriptions", row._id);
    const mine = await ctx.db.query("pushSubscriptions").withIndex("by_owner", (q) => q.eq("owner", owner)).take(MAX_DEVICES + 1);
    // Keep the newest devices only.
    for (const old of mine.sort((a, b) => a.createdAt - b.createdAt).slice(0, Math.max(0, mine.length - (MAX_DEVICES - 1)))) await ctx.db.delete("pushSubscriptions", old._id);
    await ctx.db.insert("pushSubscriptions", { owner, endpoint: args.endpoint, p256dh: args.p256dh, auth: args.auth, createdAt: Date.now() });
    return null;
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const rows = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint)).take(5);
    for (const row of rows) if (row.owner === owner) await ctx.db.delete("pushSubscriptions", row._id);
    return null;
  },
});

export const devicesFor = internalQuery({
  args: { owner: v.string() },
  returns: v.array(v.object({ endpoint: v.string(), p256dh: v.string(), auth: v.string() })),
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("pushSubscriptions").withIndex("by_owner", (q) => q.eq("owner", args.owner)).take(MAX_DEVICES);
    return rows.map((r) => ({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }));
  },
});

/** Drops endpoints the push service says are gone. */
export const forget = internalMutation({
  args: { endpoints: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const endpoint of args.endpoints.slice(0, MAX_DEVICES)) {
      const rows = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint)).take(5);
      for (const row of rows) await ctx.db.delete("pushSubscriptions", row._id);
    }
    return null;
  },
});

/** Queues a notification to every device of `owner` (no-op without devices or keys). */
export async function notify(ctx: MutationCtx, owner: string, message: { title: string; body: string; url: string; tag: string }) {
  const any = await ctx.db.query("pushSubscriptions").withIndex("by_owner", (q) => q.eq("owner", owner)).first();
  if (!any) return;
  await ctx.scheduler.runAfter(0, internal.pushSend.send, { owner, ...message });
}
