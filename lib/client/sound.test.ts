import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_EXPERIENCE } from "../experience/config";

const start = vi.fn();
const stop = vi.fn();
const vibrate = vi.fn();
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); start.mockReset(); stop.mockReset(); vibrate.mockReset();
  class AudioMock {
    state = "running"; destination = {};
    resume = vi.fn(async () => {});
    createBuffer(_channels: number, length: number) { const values = new Float32Array(length); return { getChannelData: () => values }; }
    createBufferSource() { return { buffer: null, connect: (node: unknown) => node, start, stop, disconnect: vi.fn(), onended: null }; }
    createGain() { return { gain: { value: 0 }, connect: () => ({}), disconnect: vi.fn() }; }
  }
  vi.stubGlobal("window", { AudioContext: AudioMock });
  vi.stubGlobal("document", { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("navigator", { vibrate });
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("gameplay sound dispatch", () => {
  it.each([
    ["1-0", "w", "victory"], ["1-0", "b", "defeat"], ["0-1", "w", "defeat"], ["0-1", "b", "victory"],
    ["1/2-1/2", "w", "draw"], ["1/2-1/2", "b", "draw"], ["1/2-1/2", null, "draw"], ["1-0", null, "end"], [null, "w", "end"], [undefined, "b", "end"],
  ] as const)("uses the player's seat for %s/%s", async (result, seat, expected) => {
    const { resultSound } = await import("./sound"); expect(resultSound(result, seat)).toBe(expected);
  });
  it("gives terminal causes precedence over generic result sounds", async () => {
    const { resultSound } = await import("./sound");
    expect(resultSound("1-0", "b", "checkmate")).toBe("checkmate");
    expect(resultSound("1/2-1/2", "w", "stalemate")).toBe("stalemate");
    expect(resultSound("1/2-1/2", "w", "threefold")).toBe("repetition");
    expect(resultSound("1/2-1/2", "w", "insufficient")).toBe("insufficient");
  });
  it("plays a cold cue synchronously without fetching or decoding recordings", async () => {
    const { unlockAudio, playSound } = await import("./sound"); unlockAudio(); playSound("move");
    expect(start).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
  });
  it("honors mute, silent overrides, categories and zero volume", async () => {
    const { configureAudio, playSound } = await import("./sound");
    playSound("move", 0); expect(start).not.toHaveBeenCalled();
    configureAudio(true, 0.7, { ...DEFAULT_EXPERIENCE.audio, overrides: { move: "silent" }, captures: false });
    playSound("move"); playSound("capture"); expect(start).not.toHaveBeenCalled();
    playSound("check"); expect(start).toHaveBeenCalledOnce();
    configureAudio(false, 0.7, DEFAULT_EXPERIENCE.audio); playSound("check"); expect(start).toHaveBeenCalledOnce(); expect(stop).toHaveBeenCalled();
  });
  it("keeps Silent silent even with an earlier per-event override", async () => {
    const { configureAudio, playSound } = await import("./sound");
    configureAudio(true, 1, { ...DEFAULT_EXPERIENCE.audio, pack: "silent", overrides: { capture: "piano" } });
    playSound("capture");
    expect(start).not.toHaveBeenCalled();
    playSound("capture", 1, { preview: true, pack: "piano" });
    expect(start).toHaveBeenCalledOnce();
  });
  it("deduplicates committed events without suppressing a different move", async () => {
    const { playSound } = await import("./sound");
    playSound("move", 0.7, { key: "game-a:ply1" }); playSound("move", 0.7, { key: "game-a:ply1" });
    playSound("opponent_move", 0.7, { key: "game-a:ply2" }); expect(start).toHaveBeenCalledTimes(2);
  });
  it("stops a different oldest voice on each burst above the six-voice cap", async () => {
    const stopped: number[] = [];
    let id = 0;
    class BoundedAudio {
      state = "running"; destination = {};
      createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
      createGain() { return { gain: { value: 0 }, connect: () => ({}), disconnect() {} }; }
      createBufferSource() { const current = id++; return { buffer: null, connect: (node: unknown) => node, start() {}, stop: () => stopped.push(current), disconnect() {}, onended: null }; }
    }
    vi.stubGlobal("window", { AudioContext: BoundedAudio });
    const { playSound } = await import("./sound");
    for (let i = 0; i < 9; i++) playSound("move");
    expect(stopped).toEqual([0, 1, 2]);
  });
  it("drops all sound in hidden tabs", async () => {
    vi.stubGlobal("document", { hidden: true }); const { playSound } = await import("./sound"); playSound("check"); expect(start).not.toHaveBeenCalled();
  });
  it("cleans up shared gesture listeners after the last consumer", async () => {
    const { installAudioUnlock } = await import("./sound"); const first = installAudioUnlock(); const second = installAudioUnlock();
    first(); expect(document.removeEventListener).not.toHaveBeenCalled(); second(); expect(document.removeEventListener).toHaveBeenCalledTimes(4);
  });
  it("vibrates where supported and tolerates unsupported browsers", async () => {
    const { haptic } = await import("./sound"); haptic(8); expect(vibrate).toHaveBeenCalledWith(8); vi.stubGlobal("navigator", {}); expect(() => haptic(8)).not.toThrow();
  });
});
