import { afterEach, describe, expect, it, vi } from "vitest";
import { minimumBotTurnMs, readBotPace, saveBotPace } from "./botPace";

afterEach(() => vi.unstubAllGlobals());

describe("bot pacing", () => {
  it("keeps the natural default and ignores corrupt storage", () => {
    vi.stubGlobal("localStorage", { getItem: () => "broken" });
    expect(readBotPace()).toBe("natural");
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    expect(readBotPace()).toBe("natural");
  });

  it("persists an explicit preference without changing bot strength", () => {
    let saved = "";
    vi.stubGlobal("localStorage", { getItem: () => saved, setItem: (_: string, value: string) => { saved = value; } });
    saveBotPace("relaxed");
    expect(readBotPace()).toBe("relaxed");
    saveBotPace("instant");
    expect(readBotPace()).toBe("instant");
  });

  it("keeps timed games responsive and counts engine time towards the minimum", () => {
    expect(minimumBotTurnMs("natural", false)).toBe(650);
    expect(minimumBotTurnMs("relaxed", false)).toBe(1150);
    expect(minimumBotTurnMs("natural", true)).toBe(240);
    expect(minimumBotTurnMs("relaxed", true)).toBe(600);
    expect(minimumBotTurnMs("instant", false)).toBe(0);
  });
});
