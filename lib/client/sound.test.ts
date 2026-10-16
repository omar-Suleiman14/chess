import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
