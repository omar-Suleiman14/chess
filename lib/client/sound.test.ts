import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const start = vi.fn();
const vibrate = vi.fn();

beforeEach(() => {
  vi.resetModules();
  start.mockReset();
  vibrate.mockReset();
  class AudioMock {
    state = "running";
    destination = {};
    resume = vi.fn(async () => {});
    decodeAudioData = vi.fn(async () => ({}));
    createBufferSource() {
      return { buffer: null, connect: () => ({ connect: vi.fn() }), start };
    }
    createGain() { return { gain: { value: 0 } }; }
  }
  vi.stubGlobal("window", { AudioContext: AudioMock });
  vi.stubGlobal("navigator", { vibrate });
  vi.stubGlobal("fetch", vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(0) })));
});

afterEach(() => vi.unstubAllGlobals());

describe("navigation sound and haptics", () => {
  it.each([
    ["1-0", "w", "victory"], ["1-0", "b", "defeat"],
    ["0-1", "w", "defeat"], ["0-1", "b", "victory"],
    ["1/2-1/2", "w", "draw"], ["1/2-1/2", "b", "draw"],
    ["1/2-1/2", null, "draw"], ["1-0", null, "end"],
    [null, "w", "end"], [undefined, "b", "end"],
  ] as const)("plays %s from seat %s as %s", async (result, seat, expected) => {
    const { resultSound } = await import("./sound");
    expect(resultSound(result, seat)).toBe(expected);
  });

  it("ships MP3 data for every requested recording", async () => {
    const { unlockAudio } = await import("./sound");
    unlockAudio();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(10));
    for (const [url] of vi.mocked(fetch).mock.calls) {
      const data = readFileSync(resolve("public", String(url).slice(1)));
      // Reject missing files, HTML error responses and upstream symlink text.
      const isMp3 = data.subarray(0, 3).toString() === "ID3" || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0);
      expect(isMp3, String(url)).toBe(true);
      expect(data.length).toBeGreaterThan(1000);
    }
  });

  it("plays the first gesture after cold audio buffers finish loading", async () => {
    const { unlockAudio, playSound } = await import("./sound");
    unlockAudio();
    playSound("move");
    await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
  });

  it("keeps zero-volume playback silent", async () => {
    const { playSound } = await import("./sound");
    playSound("move", 0);
    expect(fetch).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("handles unavailable recordings without playing or throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const { playSound } = await import("./sound");
    playSound("move");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(start).not.toHaveBeenCalled();
  });

  it("vibrates where supported and tolerates unsupported browsers", async () => {
    const { haptic } = await import("./sound");
    haptic(8);
    expect(vibrate).toHaveBeenCalledWith(8);
    vi.stubGlobal("navigator", {});
    expect(() => haptic(8)).not.toThrow();
  });
});
