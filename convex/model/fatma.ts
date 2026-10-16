import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { BASE_PACK_VERSION } from "../../lib/chess/personality/fatma";
import type { Owner } from "./auth";

export const FATMA_STATE_VERSION = BASE_PACK_VERSION;
const MAX_SEEN = 120;

export function defaultFatmaState(owner: Owner): Omit<Doc<"fatmaStates">, "_id" | "_creationTime"> {
  return {
    owner,
    enabled: true,
    mood: "smug",
    disableCount: 0,
    reenableCount: 0,
    seen: {},
    lastSpokeAt: 0,
    softUntil: 0,
    unlocks: [],
    achievements: [],
    stats: { wins: 0, losses: 0, draws: 0, undos: 0, lessons: 0 },
    version: FATMA_STATE_VERSION,
    updatedAt: Date.now(),
  };
}

export async function readFatma(ctx: QueryCtx, owner: Owner): Promise<Doc<"fatmaStates"> | null> {
  return await ctx.db.query("fatmaStates").withIndex("by_owner", (q) => q.eq("owner", owner)).unique();
}

export async function ensureFatma(ctx: MutationCtx, owner: Owner): Promise<Doc<"fatmaStates">> {
  const existing = await readFatma(ctx, owner);
  if (existing) return existing;
  const id = await ctx.db.insert("fatmaStates", defaultFatmaState(owner));
  return (await ctx.db.get("fatmaStates", id))!;
}

/** Achievements earned from real play; deterministic, no LLM involved. */
export const ACHIEVEMENTS: Array<{ id: string; label: string; test: (s: Doc<"fatmaStates">["stats"]) => boolean; unlock?: string }> = [
  { id: "first-win", label: "First win against Sherine", test: (s) => s.wins >= 1, unlock: "respect-1" },
  { id: "five-wins", label: "Five wins", test: (s) => s.wins >= 5, unlock: "respect-2" },
  { id: "stubborn", label: "Ten games played", test: (s) => s.wins + s.losses + s.draws >= 10 },
  { id: "student", label: "Five lessons finished", test: (s) => s.lessons >= 5 },
  { id: "time-traveller", label: "Used Undo 25 times", test: (s) => s.undos >= 25 },
];

export async function updateStats(
  ctx: MutationCtx,
  owner: Owner,
  change: Partial<Doc<"fatmaStates">["stats"]>,
): Promise<string[]> {
  const state = await ensureFatma(ctx, owner);
  const stats = { ...state.stats };
  for (const [k, v] of Object.entries(change) as Array<[keyof typeof stats, number]>) stats[k] += v;
  const earned = ACHIEVEMENTS.filter((a) => !state.achievements.includes(a.id) && a.test(stats));
  const unlocks = [...state.unlocks];
  for (const a of earned) if (a.unlock && !unlocks.includes(a.unlock)) unlocks.push(a.unlock);
  await ctx.db.patch("fatmaStates", state._id, {
    stats,
    achievements: [...state.achievements, ...earned.map((a) => a.id)],
    unlocks,
    pendingEvent: earned.length > 0 ? "achievement" : state.pendingEvent,
    updatedAt: Date.now(),
  });
  return earned.map((a) => a.id);
}

export async function recordGameForFatma(ctx: MutationCtx, owner: Owner, humanScore: number): Promise<void> {
  await updateStats(ctx, owner, humanScore === 1 ? { wins: 1 } : humanScore === 0 ? { losses: 1 } : { draws: 1 });
}

export function trimSeen(seen: Record<string, number>): Record<string, number> {
  const entries = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, MAX_SEEN);
  return Object.fromEntries(entries);
}

/** Convex record keys cannot contain some characters; pack lines use "pack:line". */
export function seenKey(lineId: string): string {
  return lineId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
}
