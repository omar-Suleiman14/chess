import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const vibrate = vi.fn();
let now = 1000;

async function load() {
  vi.resetModules();
  return await import("./haptics");
}

beforeEach(() => {
  vibrate.mockReset();
  now = 1000;
  vi.useFakeTimers();
  vi.stubGlobal("window", {});
  vi.stubGlobal("performance", { now: () => now });
  vi.stubGlobal("navigator", { vibrate, userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130", maxTouchPoints: 5 });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("haptics", () => {
  it("vibrates a distinct pattern per chess event on Android", async () => {
    const { haptic, hapticSupport } = await load();
    expect(hapticSupport()).toBe("vibrate");
    haptic("move");
    now += 100;
    haptic("capture");
    now += 100;
    haptic("check");
    const patterns = vibrate.mock.calls.map(([pattern]) => JSON.stringify(pattern));
    expect(new Set(patterns).size).toBe(3);
  });

  it("does nothing when Off, and Subtle is shorter and skips minor events", async () => {
    const { haptic, configureHaptics } = await load();
    configureHaptics("off");
    vibrate.mockClear();
    haptic("capture");
    expect(vibrate).not.toHaveBeenCalled();

    configureHaptics("standard");
    haptic("move");
    const standard = vibrate.mock.calls.at(-1)![0] as number;
    configureHaptics("subtle");
    now += 100;
    haptic("move");
    const subtle = vibrate.mock.calls.at(-1)![0] as number;
    expect(subtle).toBeLessThan(standard);
    vibrate.mockClear();
    now += 100;
    haptic("opponent");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("fires one event per committed action and collapses rapid selection taps", async () => {
    const { haptic } = await load();
    haptic("capture", { key: "move:abc" });
    now += 500;
    haptic("capture", { key: "move:abc" });
    expect(vibrate).toHaveBeenCalledTimes(1);
    now += 500;
    haptic("select");
    now += 10;
    haptic("select");
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it("keeps pauses but shortens pulses when scaling", async () => {
    const { scalePattern } = await load();
    expect(scalePattern([20, 40, 20], 0.5)).toEqual([10, 40, 10]);
    expect(scalePattern(2, 0.5)).toBe(4);
  });

  it("reports no support instead of pretending on iPhones without the switch control", async () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", maxTouchPoints: 5 });
    vi.stubGlobal("HTMLInputElement", class {});
    const { haptic, hapticSupport, hapticSupportText } = await load();
    expect(hapticSupport()).toBe("none");
    expect(() => haptic("capture")).not.toThrow();
    expect(hapticSupportText("none")).toMatch(/doesn't allow/);
  });

  it("uses the native bridge when the app runs inside a native shell", async () => {
    const postMessage = vi.fn();
    vi.stubGlobal("window", { webkit: { messageHandlers: { cbcHaptics: { postMessage } } } });
    const { haptic } = await load();
    haptic("check");
    expect(postMessage).toHaveBeenCalledWith({ type: "impact-rigid", intensity: 1 });
    expect(vibrate).not.toHaveBeenCalled();
  });
});
