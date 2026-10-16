import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION, applyUci } from "./rules";
import { premoveMoves, resolvePremove, type PremovePosition, type QueuedPremove } from "./premove";

const queued: QueuedPremove = { uci: "g8f6", context: "room-one", fen: DEFAULT_POSITION, ply: 0, player: "b" };
const waiting: PremovePosition = { context: "room-one", fen: DEFAULT_POSITION, ply: 0, player: "b", active: true, ready: false };
const afterE4 = applyUci(DEFAULT_POSITION, "e2e4")!.fen;
const ready: PremovePosition = { ...waiting, fen: afterE4, ply: 1, ready: true };

describe("premove resolution", () => {
  it("waits for the opponent and then validates against the resulting position", () => {
    expect(resolvePremove(queued, waiting)).toBe("wait");
    expect(resolvePremove(queued, ready)).toBe("play");
    expect(applyUci(ready.fen, queued.uci)?.san).toBe("Nf6");
  });

  it("waits for a pending acknowledgement instead of submitting early", () => {
    expect(resolvePremove(queued, { ...ready, ready: false })).toBe("wait");
  });

  it("supports a conditional pawn capture onto a currently empty square", () => {
    const before = afterE4;
    const after = applyUci(before, "d7d5")!.fen;
    const capture: QueuedPremove = { uci: "e4d5", context: "solo:main", fen: before, ply: 1, player: "w" };
    expect(premoveMoves(before, "w").some(m => m.from === "e4" && m.to === "d5")).toBe(true);
    expect(resolvePremove(capture, { context: capture.context, fen: after, ply: 2, player: "w", active: true, ready: true })).toBe("play");
    const otherReply = applyUci(before, "g8f6")!.fen;
    expect(resolvePremove(capture, { context: capture.context, fen: otherReply, ply: 2, player: "w", active: true, ready: true })).toBe("clear");
  });

  it("discards a queue when the opponent captures its piece", () => {
    const before = "4k3/8/8/8/8/8/4r3/4K3 w - - 0 1";
    const after = applyUci(before, "e1e2")!.fen;
    const captured: QueuedPremove = { ...queued, fen: before, uci: "e2a2" };
    expect(resolvePremove(captured, { ...ready, fen: after })).toBe("clear");
  });

  it.each([
    { active: false }, { context: "different-room" }, { player: "w" as const },
    { player: null }, { ply: 3 }, { ply: -1 },
    { ply: 0, fen: afterE4 },
  ])("discards finished, reviewed, switched or stale positions: %j", (patch) => {
    expect(resolvePremove(queued, { ...ready, ...patch })).toBe("clear");
  });

  it("supports underpromotion and checks it after the opponent's move", () => {
    const before = "7k/P7/8/8/8/8/8/7K b - - 0 1";
    const after = applyUci(before, "h8g8")!.fen;
    const promotion: QueuedPremove = { ...queued, fen: before, uci: "a7a8n", player: "w" };
    expect(premoveMoves(before, "w").find(m => m.from === "a7" && m.to === "a8")?.promotion).toBe("q");
    expect(resolvePremove(promotion, { ...ready, fen: after, player: "w" })).toBe("play");
    expect(applyUci(after, promotion.uci)?.promotion).toBe("n");
  });

  it("requires castling rights and rejects castling through a new attack", () => {
    const before = "k4r2/8/8/8/8/8/8/4K2R b K - 0 1";
    expect(premoveMoves(before, "w").some(m => m.from === "e1" && m.to === "g1")).toBe(true);
    expect(premoveMoves(before.replace(" b K ", " b - "), "w").some(m => m.from === "e1" && m.to === "g1")).toBe(false);
    const after = applyUci(before, "a8a7")!.fen;
    expect(resolvePremove({ ...queued, fen: before, player: "w", uci: "e1g1" }, { ...ready, fen: after, player: "w" })).toBe("clear");
  });

  it("offers piece geometry, including blocked paths, without calling it legal", () => {
    expect(premoveMoves(DEFAULT_POSITION, "b").some(m => m.from === "c8" && m.to === "g4")).toBe(true);
    expect(premoveMoves(DEFAULT_POSITION, "b").some(m => m.from === "g8" && m.to === "g6")).toBe(false);
    expect(premoveMoves(DEFAULT_POSITION, "b").some(m => m.from === "e7" && m.to === "e4")).toBe(false);
  });
});
