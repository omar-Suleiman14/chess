import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type Owner = string;

/** The caller's canonical identity. Never accept identity from arguments. */
export async function requireOwner(ctx: QueryCtx | MutationCtx): Promise<Owner> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "unauthenticated", message: "Sign in to save and sync." });
  return identity.tokenIdentifier;
}

export async function optionalOwner(ctx: QueryCtx | MutationCtx): Promise<Owner | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.tokenIdentifier ?? null;
}

export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

/** Runs `work` once per (owner, opId); replays return the stored result. */
export async function idempotent<T>(
  ctx: MutationCtx,
  owner: Owner,
  opId: string,
  kind: string,
  work: () => Promise<T>,
): Promise<T> {
  if (opId.length < 8 || opId.length > 80) fail("bad_request", "Operation id must be 8-80 characters.");
  const existing = await ctx.db
    .query("operations")
    .withIndex("by_owner_and_opId", (q) => q.eq("owner", owner).eq("opId", opId))
    .unique();
  if (existing) {
    if (existing.kind !== kind) fail("bad_request", "Operation id reused for a different action.");
    return JSON.parse(existing.result) as T;
  }
  const result = await work();
  await ctx.db.insert("operations", {
    owner,
    opId,
    kind,
    result: JSON.stringify(result ?? null),
    createdAt: Date.now(),
  });
  return result;
}

export const KEY_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

export function checkKey(value: string, name: string): void {
  if (!KEY_PATTERN.test(value)) fail("bad_request", `${name} must be 4-64 URL-safe characters.`);
}
