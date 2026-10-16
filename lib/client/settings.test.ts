import { afterEach, describe, expect, it, vi } from "vitest";
import { isWeakDevice } from "./settings";

describe("isWeakDevice", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (nav: object) => vi.stubGlobal("navigator", nav);

  it("treats a capable or unknown device as strong", () => {
    stub({ hardwareConcurrency: 8, deviceMemory: 8 });
    expect(isWeakDevice()).toBe(false);
    stub({ hardwareConcurrency: 4 });
    expect(isWeakDevice()).toBe(false);
  });

  it("flags few cores, little memory or Data Saver", () => {
    stub({ hardwareConcurrency: 2 });
    expect(isWeakDevice()).toBe(true);
    stub({ hardwareConcurrency: 8, deviceMemory: 2 });
    expect(isWeakDevice()).toBe(true);
    stub({ hardwareConcurrency: 8, connection: { saveData: true } });
    expect(isWeakDevice()).toBe(true);
  });
});
