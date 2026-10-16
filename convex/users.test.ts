/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = {
  issuer: "https://test.clerk.accounts.dev",
  subject: "user_test",
  name: "Test Player",
  email: "player@example.com",
};

describe("Clerk user sync", () => {
  it("rejects signed-out reads and writes", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.users.current, {})).rejects.toThrow(
      "You must be signed in",
    );
    await expect(t.mutation(api.users.sync, {})).rejects.toThrow(
      "You must be signed in",
    );
    expect(await t.run((ctx) => ctx.db.query("users").take(10))).toEqual([]);
  });

  it("creates one user and updates the same record on subsequent sign-ins", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity(identity);
    const id = await user.mutation(api.users.sync, {});
    expect(await user.mutation(api.users.sync, {})).toBe(id);
    const updated = t.withIdentity({ ...identity, name: "Updated Player" });
    expect(await updated.mutation(api.users.sync, {})).toBe(id);
    const records = await t.run((ctx) => ctx.db.query("users").take(10));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      clerkId: identity.subject,
      name: "Updated Player",
      email: identity.email,
    });
    expect(await updated.query(api.users.current, {})).toMatchObject({
      name: "Updated Player",
    });
  });

  it("keeps identities from different issuers separate", async () => {
    const t = convexTest(schema, modules);
    const first = await t.withIdentity(identity).mutation(api.users.sync, {});
    const second = await t
      .withIdentity({ ...identity, issuer: "https://other.clerk.accounts.dev" })
      .mutation(api.users.sync, {});
    expect(first).not.toBe(second);
    expect(await t.run((ctx) => ctx.db.query("users").take(10))).toHaveLength(
      2,
    );
  });
});
