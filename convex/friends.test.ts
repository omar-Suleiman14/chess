/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const id = (name: string) => ({ issuer: "https://test.clerk.accounts.dev", subject: `user_${name}`, tokenIdentifier: `https://test.clerk.accounts.dev|user_${name}` });

async function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const omar = t.withIdentity(id("omar"));
  const sara = t.withIdentity(id("sara"));
  const nour = t.withIdentity(id("nour"));
  for (const [user, alias] of [[omar, "omar"], [sara, "sara"], [nour, "nour"]] as const) {
    await user.mutation(api.profiles.ensure, {});
    await user.mutation(api.profiles.update, { alias });
  }
  return { t, omar, sara, nour };
}

describe("friends", () => {
  it("requests, accepts and lists both sides", async () => {
    const { omar, sara } = await setup();
    expect(await omar.query(api.friends.relation, { alias: "sara" })).toEqual({ state: "none" });
    await omar.mutation(api.friends.request, { alias: "sara" });
    expect(await omar.query(api.friends.relation, { alias: "sara" })).toEqual({ state: "outgoing" });
    expect(await sara.query(api.friends.relation, { alias: "omar" })).toEqual({ state: "incoming" });
    expect((await sara.query(api.friends.overview, { now: Date.now() }))?.incoming.map((p) => p.alias)).toEqual(["omar"]);

    await sara.mutation(api.friends.respond, { alias: "omar", accept: true });
    expect(await omar.query(api.friends.relation, { alias: "sara" })).toEqual({ state: "friends" });
    expect((await omar.query(api.friends.overview, { now: Date.now() }))?.friends.map((p) => p.alias)).toEqual(["sara"]);
    expect((await sara.query(api.friends.overview, { now: Date.now() }))?.friends.map((p) => p.alias)).toEqual(["omar"]);
  });

  it("treats a crossed request as acceptance, and supports unfriending", async () => {
    const { omar, sara } = await setup();
    await omar.mutation(api.friends.request, { alias: "sara" });
    await sara.mutation(api.friends.request, { alias: "omar" });
    expect(await omar.query(api.friends.relation, { alias: "sara" })).toEqual({ state: "friends" });
    await sara.mutation(api.friends.remove, { alias: "omar" });
    expect(await omar.query(api.friends.relation, { alias: "sara" })).toEqual({ state: "none" });
  });

  it("shows private cards only to friends", async () => {
    const { t, omar, sara, nour } = await setup();
    expect(await t.query(api.profiles.publicCard, { alias: "sara" })).toBeNull();
    await omar.mutation(api.friends.request, { alias: "sara" });
    await sara.mutation(api.friends.respond, { alias: "omar", accept: true });
    expect(await omar.query(api.profiles.publicCard, { alias: "sara" })).toMatchObject({ alias: "sara" });
    expect(await nour.query(api.profiles.publicCard, { alias: "sara" })).toBeNull();
  });

  it("lets friends (only) send a game PIN", async () => {
    const { t, omar, sara, nour } = await setup();
    await omar.mutation(api.friends.request, { alias: "sara" });
    await sara.mutation(api.friends.respond, { alias: "omar", accept: true });
    const { code } = await t.mutation(api.online.create, { token: "omar-device-token-0123456789", name: "Omar", color: "w" });

    await expect(nour.mutation(api.friends.challenge, { alias: "sara", code })).rejects.toThrow(/only challenge friends/i);
    await omar.mutation(api.friends.challenge, { alias: "sara", code });
    const inbox = await sara.query(api.friends.overview, { now: Date.now() });
    expect(inbox?.challenges).toMatchObject([{ from: { alias: "omar" }, code }]);

    // Once someone joins, the invite disappears.
    await t.mutation(api.online.join, { code, token: "sara-device-token-0123456789", name: "Sara" });
    expect((await sara.query(api.friends.overview, { now: Date.now() }))?.challenges).toEqual([]);
  });

  it("refuses requests to yourself or unknown players", async () => {
    const { omar } = await setup();
    await expect(omar.mutation(api.friends.request, { alias: "omar" })).rejects.toThrow(/that's you/i);
    await expect(omar.mutation(api.friends.request, { alias: "nobody" })).rejects.toThrow(/no player/i);
  });
});
