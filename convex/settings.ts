import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { fail, optionalOwner, requireOwner } from "./model/auth";
import { settingsValidator } from "./schema";
import { experienceSchema } from "../lib/experience/config";
import { findBoardTheme } from "../lib/experience/boardThemes";

/** What this backend can store. Clients only send newer fields once it says so. */
export const capabilities = query({
  args: {},
  returns: v.object({ experienceVersion: v.literal(1), boardTheme: v.optional(v.literal(true)) }),
  handler: async () => ({ experienceVersion: 1 as const, boardTheme: true as const }),
});

/** The signed-in player's saved preferences, or null (signed out, or never saved). */
export const mine = query({
  args: {},
  returns: v.union(v.null(), v.object({ settings: settingsValidator, changedAt: v.number() })),
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
  returns: v.object({ applied: v.boolean() }),
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const { volume } = args.settings;
    if (args.settings.experience && !experienceSchema.safeParse(args.settings.experience).success) fail("bad_request", "Invalid experience preferences.");
    const { boardTheme } = args.settings;
    if (boardTheme !== undefined && boardTheme !== "" && !findBoardTheme(boardTheme)) fail("bad_request", "Unknown board theme.");
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
