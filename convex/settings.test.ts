/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { DEFAULT_EXPERIENCE } from "../lib/experience/config";

const modules = import.meta.glob("./**/*.ts");
const alice = { issuer: "https://test.clerk.accounts.dev", subject: "user_alice", tokenIdentifier: "https://test.clerk.accounts.dev|user_alice" };
const bob = { issuer: "https://test.clerk.accounts.dev", subject: "user_bob", tokenIdentifier: "https://test.clerk.accounts.dev|user_bob" };

function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  return t;
}

describe("settings", () => {
  it("syncs complete independent experience preferences and validates their bounds", async () => {
    const t = setup(); const user = t.withIdentity(alice);
    expect(await user.query(api.settings.capabilities, {})).toEqual({ experienceVersion: 1 });
    const experience = { ...DEFAULT_EXPERIENCE, appearance: "expressive" as const, ambient: { ...DEFAULT_EXPERIENCE.ambient, mode: "ambient" as const }, audio: { ...DEFAULT_EXPERIENCE.audio, pack: "kalimba" as const } };
    await user.mutation(api.settings.save, { settings: { experience }, changedAt: 300 });
    expect((await user.query(api.settings.mine, {}))?.settings.experience).toEqual(experience);
    await expect(user.mutation(api.settings.save, { settings: { experience: { ...experience, ambient: { ...experience.ambient, density: 99 } } }, changedAt: 301 })).rejects.toThrow();
  });
  it("saves per player and needs sign-in", async () => {
    const t = setup();
    await expect(t.mutation(api.settings.save, { settings: { palette: "sage" }, changedAt: 1 })).rejects.toThrow();
    expect(await t.query(api.settings.mine, {})).toBeNull();
    await t.withIdentity(alice).mutation(api.settings.save, { settings: { palette: "sage", pieceSet: "merida", think: "deep", fatmaLanguage: "franco", motion: "full" }, changedAt: 100 });
    expect(await t.withIdentity(alice).query(api.settings.mine, {})).toEqual({
      settings: { palette: "sage", pieceSet: "merida", think: "deep", fatmaLanguage: "franco", motion: "full" },
      changedAt: 100,
    });
    expect(await t.withIdentity(bob).query(api.settings.mine, {})).toBeNull();
  });

  it("keeps the newest change when an offline device syncs late", async () => {
    const t = setup();
    const user = t.withIdentity(alice);
    await user.mutation(api.settings.save, { settings: { palette: "blue" }, changedAt: 200 });
    expect(await user.mutation(api.settings.save, { settings: { palette: "slate" }, changedAt: 150 })).toEqual({ applied: false });
    expect((await user.query(api.settings.mine, {}))?.settings.palette).toBe("blue");
    await user.mutation(api.settings.save, { settings: { sound: false }, changedAt: 300 });
    // Partial saves merge with what is stored.
    expect((await user.query(api.settings.mine, {}))?.settings).toMatchObject({ palette: "blue", sound: false });
  });

  it("rejects bad values", async () => {
    const t = setup();
    const user = t.withIdentity(alice);
    await expect(user.mutation(api.settings.save, { settings: { volume: 4 }, changedAt: 1 })).rejects.toThrow(/volume/i);
    // @ts-expect-error unknown palette is refused by the validator
    await expect(user.mutation(api.settings.save, { settings: { palette: "neon" }, changedAt: 1 })).rejects.toThrow();
  });

  it("is part of the data export and is deleted with the account data", async () => {
    const t = setup();
    const user = t.withIdentity(alice);
    await user.mutation(api.settings.save, { settings: { palette: "sage" }, changedAt: 5 });
    expect((await user.query(api.profiles.exportMyData, {})).settings).toEqual({ palette: "sage" });
    await user.mutation(api.profiles.deleteMyData, { confirm: "DELETE" });
    await t.finishAllScheduledFunctions(() => {});
    expect(await user.query(api.settings.mine, {})).toBeNull();
  });
});
