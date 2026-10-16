import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { fail, optionalOwner, requireOwner } from "./model/auth";
import { settingsValidator } from "./schema";

/** The signed-in player's saved preferences, or null (signed out, or never saved). */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const owner = await optionalOwner(ctx);
    if (!owner) return null;
    const row = await ctx.db.query("userSettings").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
    return row ? { settings: row.settings, changedAt: row.changedAt } : null;
  },
});

/**
 * Saves preferences. `changedAt` is when the player made the change on their
 * device; an older write (a device that was offline) never overwrites a newer one.
 */
export const save = mutation({
  args: { settings: settingsValidator, changedAt: v.number() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const { volume } = args.settings;
    if (volume !== undefined && (!Number.isFinite(volume) || volume < 0 || volume > 1)) fail("bad_request", "Volume must be between 0 and 1.");
    if (!Number.isFinite(args.changedAt)) fail("bad_request", "Bad timestamp.");
    const now = Date.now();
    // A clock far in the future would pin these settings forever; clamp it.
    const changedAt = Math.min(args.changedAt, now + 60_000);
    const row = await ctx.db.query("userSettings").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
    if (!row) {
      await ctx.db.insert("userSettings", { owner, settings: args.settings, changedAt, updatedAt: now });
      return { applied: true };
    }
    if (changedAt < row.changedAt) return { applied: false };
    await ctx.db.patch("userSettings", row._id, { settings: { ...row.settings, ...args.settings }, changedAt, updatedAt: now });
    return { applied: true };
  },
});
