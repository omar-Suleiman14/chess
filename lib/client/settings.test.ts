import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, fromSaved, isWeakDevice, resolveSettingsSync } from "./settings";

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

describe("settings sync", () => {
  it("keeps a known board theme, drops unknown ones, and pulls it from the account", () => {
    expect(fromSaved(null).boardTheme).toBe("");
    expect(fromSaved({ boardTheme: "walnut" }).boardTheme).toBe("walnut");
    expect(fromSaved({ boardTheme: "neon" }).boardTheme).toBe("");
    expect(fromSaved({ boardTheme: 4 }).boardTheme).toBe("");
    expect(resolveSettingsSync(0, { settings: { boardTheme: "cosmos" }, changedAt: 5 })).toMatchObject({ action: "pull", settings: { boardTheme: "cosmos" } });
  });

  it("resolves every retired Liquid Glass / Material choice to Classic", () => {
    expect(fromSaved(null).glass).toBe("off");
    expect(fromSaved({ glass: "auto" }).glass).toBe("off");
    expect(fromSaved({ glass: "on" }).glass).toBe("off");
    expect(fromSaved({ glass: "on", experience: { appearance: "glass" } }).experience.appearance).toBe("classic");
    expect(fromSaved({ experience: { appearance: "expressive", colorMode: "dark" } }).experience).toMatchObject({ appearance: "classic", colorMode: "dark" });
    const pulled = resolveSettingsSync(0, { settings: { glass: "on", experience: { appearance: "glass" } }, changedAt: 10 });
    expect(pulled).toMatchObject({ action: "pull", settings: { glass: "off", experience: { appearance: "classic" } } });
  });

  it("adopts the account's settings when they are newer", () => {
    const d = resolveSettingsSync(10, { settings: { palette: "sage", think: "deep" }, changedAt: 20 });
    expect(d.action).toBe("pull");
    if (d.action === "pull") expect(d.settings).toEqual({ ...DEFAULT_SETTINGS, palette: "sage", think: "deep" });
  });

  it("uploads this device's settings when they are newer, or the account has none", () => {
    expect(resolveSettingsSync(30, { settings: {}, changedAt: 20 })).toEqual({ action: "push" });
    expect(resolveSettingsSync(5, null)).toEqual({ action: "push" });
  });

  it("does nothing when in step, or when neither side ever changed anything", () => {
    expect(resolveSettingsSync(20, { settings: {}, changedAt: 20 })).toEqual({ action: "none" });
    expect(resolveSettingsSync(0, null)).toEqual({ action: "none" });
  });

  it("ignores unknown keys and keeps defaults for missing ones", () => {
    expect(fromSaved({ palette: "blue", nope: 1 })).toEqual({ ...DEFAULT_SETTINGS, palette: "blue" });
    expect(fromSaved(null)).toEqual(DEFAULT_SETTINGS);
  });
});
