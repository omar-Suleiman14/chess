/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { PUZZLES } from "../lib/chess/puzzles";

const modules = import.meta.glob("./**/*.ts");
const alice = { issuer: "https://test.clerk.accounts.dev", subject: "user_alice", tokenIdentifier: "https://test.clerk.accounts.dev|user_alice" };

function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  return t;
}

describe("puzzles", () => {
  it("rates only the first attempt and tracks streaks", async () => {
    const t = setup();
    const user = t.withIdentity(alice);
    const [a, b] = PUZZLES;
    const first = await user.mutation(api.puzzles.recordAttempt, { puzzleId: a.id, solved: true });
    expect(first.rated).toBe(true);
    expect(first.delta).toBeGreaterThan(0);
    const again = await user.mutation(api.puzzles.recordAttempt, { puzzleId: a.id, solved: false });
    expect(again).toEqual({ rated: false, rating: first.rating, delta: 0 });
    await user.mutation(api.puzzles.recordAttempt, { puzzleId: b.id, solved: false });
    const stats = await user.query(api.puzzles.mine, {});
    expect(stats).toMatchObject({ attempts: 2, solved: 1, streak: 0, bestStreak: 1 });
    expect((await user.query(api.puzzles.recent, {})).length).toBe(2);
  });

  it("keeps the best rush score, validates input and needs sign-in", async () => {
    const t = setup();
    const user = t.withIdentity(alice);
    expect(await user.mutation(api.puzzles.recordRush, { mode: "3min", score: 12 })).toEqual({ best: 12, isBest: true });
    expect(await user.mutation(api.puzzles.recordRush, { mode: "3min", score: 9 })).toEqual({ best: 12, isBest: false });
    await expect(user.mutation(api.puzzles.recordRush, { mode: "3min", score: -1 })).rejects.toThrow();
    await expect(user.mutation(api.puzzles.recordAttempt, { puzzleId: "nope", solved: true })).rejects.toThrow();
    await expect(t.mutation(api.puzzles.recordAttempt, { puzzleId: PUZZLES[0].id, solved: true })).rejects.toThrow();
    expect(await t.query(api.puzzles.mine, {})).toBeNull();
  });
});
