import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, fromSaved, isWeakDevice, isWebKit, resolveSettingsSync } from "./settings";

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

describe("isWebKit", () => {
  const UA = {
    iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1",
    iphoneEdge: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/130.0 Mobile/15E148 Safari/605.1.15",
    macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
    androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36",
    firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  };

  it("counts Safari and every iPhone browser as WebKit", () => {
    expect(isWebKit(UA.iphoneSafari)).toBe(true);
    expect(isWebKit(UA.iphoneChrome)).toBe(true);
    expect(isWebKit(UA.iphoneEdge)).toBe(true);
    expect(isWebKit(UA.macSafari)).toBe(true);
    // iPadOS reports a Mac user agent; touch points give it away.
    expect(isWebKit(UA.macSafari, 5)).toBe(true);
  });

  it("does not count Chromium or Firefox", () => {
    expect(isWebKit(UA.macChrome)).toBe(false);
    expect(isWebKit(UA.androidChrome)).toBe(false);
    expect(isWebKit(UA.firefox)).toBe(false);
  });
});

describe("settings sync", () => {
  it("defaults glass off, migrates legacy auto, and preserves an explicit opt-in", () => {
    expect(fromSaved(null).glass).toBe("off");
    expect(fromSaved({ glass: "auto" }).glass).toBe("off");
    expect(fromSaved({ glass: "on" }).glass).toBe("on");
    const pulled = resolveSettingsSync(0, { settings: { glass: "auto" }, changedAt: 10 });
    expect(pulled).toMatchObject({ action: "pull", settings: { glass: "off" } });
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
