import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const sync = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("You must be signed in to sync your account.");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    const profile = {
      tokenIdentifier: identity.tokenIdentifier,
      clerkId: identity.subject,
      name: identity.name ?? null,
      email: identity.email ?? null,
    };

    if (existing) {
      if (existing.name !== profile.name || existing.email !== profile.email) {
        await ctx.db.patch("users", existing._id, profile);
      }
      return existing._id;
    }
    return await ctx.db.insert("users", profile);
  },
});

export const current = query({
  args: {},
  returns: v.object({
    clerkId: v.string(),
    name: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("You must be signed in to view your account.");
    }
    return {
      clerkId: identity.subject,
      name: identity.name ?? null,
      email: identity.email ?? null,
    };
  },
});
