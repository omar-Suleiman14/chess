import { describe, expect, it, vi } from "vitest";
import { avatarFromName, withAvatarFallback } from "./online";

describe("online avatars", () => {
  it("retries without the avatar when an older backend rejects the field", async () => {
    const call = vi.fn(async (a: unknown) => {
      if (a) throw new Error("ArgumentValidationError: Object contains extra field `avatar` that is not in the validator.");
      return "ok";
    });
    await expect(withAvatarFallback(call, { seed: "abc", hue: 10 })).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("does not hide unrelated errors", async () => {
    const call = vi.fn(async () => {
      throw new Error("No open game with that PIN.");
    });
    await expect(withAvatarFallback(call, { seed: "abc", hue: 10 })).rejects.toThrow(/PIN/);
    expect(call).toHaveBeenCalledOnce();
  });

  it("derives the same fallback avatar for the same name on every screen", () => {
    expect(avatarFromName("Guest")).toEqual(avatarFromName("Guest"));
    expect(avatarFromName("Guest")).not.toEqual(avatarFromName("omar"));
    expect(avatarFromName("Guest").seed).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
  });
});
