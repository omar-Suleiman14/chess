import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { fail, optionalOwner, requireOwner } from "./model/auth";
import { ACHIEVEMENTS, ensureFatma, readFatma, seenKey, trimSeen } from "./model/fatma";

export const state = query({
  args: {},
  handler: async (ctx) => {
    const owner = await optionalOwner(ctx);
    if (!owner) return null;
    const fatma = await readFatma(ctx, owner);
    const installed = await ctx.db
      .query("fatmaPacks")
      .withIndex("by_owner_and_status", (q) => q.eq("owner", owner).eq("status", "installed"))
      .take(20);
    return { fatma, packs: installed.map((p) => p.pack) };
  },
});

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    await ensureFatma(ctx, owner);
    return null;
  },
});

/**
 * The disable flow. "disable" and "keep" come from the plea dialog; "enable"
 * brings her back (and she remembers).
 */
export const setEnabled = mutation({
  args: { action: v.union(v.literal("disable"), v.literal("keep"), v.literal("enable")) },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const state = await ensureFatma(ctx, owner);
    const now = Date.now();
    if (args.action === "disable") {
      if (!state.enabled) return { enabled: false, reenableCount: state.reenableCount };
      await ctx.db.patch("fatmaStates", state._id, { enabled: false, disableCount: state.disableCount + 1, updatedAt: now });
      return { enabled: false, reenableCount: state.reenableCount };
    }
    if (args.action === "keep") {
      await ctx.db.patch("fatmaStates", state._id, { softUntil: now + 4 * 60_000, updatedAt: now });
      return { enabled: true, reenableCount: state.reenableCount };
    }
    if (state.enabled) return { enabled: true, reenableCount: state.reenableCount };
    await ctx.db.patch("fatmaStates", state._id, {
      enabled: true,
      reenableCount: state.reenableCount + 1,
      mood: "grudging",
      updatedAt: now,
    });
    return { enabled: true, reenableCount: state.reenableCount + 1 };
  },
});

/** Remembers which lines were shown (bounded) so she doesn't repeat herself. */
export const recordLine = mutation({
  args: { lineId: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    if (args.lineId.length > 90) fail("bad_request", "Bad line id.");
    const state = await ensureFatma(ctx, owner);
    const now = Date.now();
    await ctx.db.patch("fatmaStates", state._id, {
      seen: trimSeen({ ...state.seen, [seenKey(args.lineId)]: now }),
      lastSpokeAt: now,
      pendingEvent: undefined,
      updatedAt: now,
    });
    return null;
  },
});

export const achievements = query({
  args: {},
  handler: async () => ACHIEVEMENTS.map(({ id, label }) => ({ id, label })),
});

export const packs = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    const pending = await ctx.db
      .query("fatmaPacks")
      .withIndex("by_owner_and_status", (q) => q.eq("owner", owner).eq("status", "pending_approval"))
      .take(20);
    const drafts = await ctx.db
      .query("fatmaPacks")
      .withIndex("by_owner_and_status", (q) => q.eq("owner", owner).eq("status", "draft"))
      .take(20);
    const installed = await ctx.db
      .query("fatmaPacks")
      .withIndex("by_owner_and_status", (q) => q.eq("owner", owner).eq("status", "installed"))
      .take(20);
    return { pending, drafts, installed };
  },
});

export const decidePack = mutation({
  args: {
    packId: v.string(),
    version: v.number(),
    decision: v.union(v.literal("install"), v.literal("reject"), v.literal("uninstall")),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const pack = await ctx.db
      .query("fatmaPacks")
      .withIndex("by_owner_and_packId_and_version", (q) => q.eq("owner", owner).eq("packId", args.packId).eq("version", args.version))
      .unique();
    if (!pack) fail("not_found", "Upgrade not found.");
    const now = Date.now();
    if (args.decision === "install") {
      if (pack.status === "installed") return { status: "installed" };
      // One installed version per pack id.
      const installed = await ctx.db
        .query("fatmaPacks")
        .withIndex("by_owner_and_status", (q) => q.eq("owner", owner).eq("status", "installed"))
        .take(50);
      for (const other of installed) {
        if (other.packId === pack.packId) await ctx.db.patch("fatmaPacks", other._id, { status: "uninstalled", updatedAt: now });
      }
      if (installed.length >= 10) fail("quota", "Uninstall an upgrade first (max 10).");
      await ctx.db.patch("fatmaPacks", pack._id, { status: "installed", updatedAt: now });
      const state = await ensureFatma(ctx, owner);
      await ctx.db.patch("fatmaStates", state._id, { pendingEvent: "upgrade_installed", updatedAt: now });
      return { status: "installed" };
    }
    const status = args.decision === "reject" ? "rejected" : "uninstalled";
    await ctx.db.patch("fatmaPacks", pack._id, { status, updatedAt: now });
    return { status };
  },
});
