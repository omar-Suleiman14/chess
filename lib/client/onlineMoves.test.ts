import { describe, expect, it } from "vitest";
import { applyUci, DEFAULT_POSITION } from "../chess/rules";
import { canSubmitMove, livePendingMove, type PendingMove } from "./onlineMoves";

describe("online move gate", () => {
  it("lets each player keep moving after their first move is confirmed", () => {
    // White plays d4 and the server confirms it (ply 0 -> 1); the old pending move stays in state.
    const afterD4 = applyUci(DEFAULT_POSITION, "d2d4")!.fen;
    const whitePending: PendingMove = { ply: 0, fen: afterD4, uci: "d2d4" };
    const afterD5 = applyUci(afterD4, "d7d5")!.fen;
    // Black has replied (ply 2). White must be allowed to play move 2.
    expect(canSubmitMove({ you: "w", active: true, fen: afterD5, serverPly: 2, pending: whitePending })).toBe(true);
    // And Black, whose d5 was confirmed, may move again after White's next move.
    const blackPending: PendingMove = { ply: 1, fen: afterD5, uci: "d7d5" };
    const afterC4 = applyUci(afterD5, "c2c4")!.fen;
    expect(canSubmitMove({ you: "b", active: true, fen: afterC4, serverPly: 3, pending: blackPending })).toBe(true);
  });

  it("blocks a second move while the first is still unconfirmed", () => {
    const afterE4 = applyUci(DEFAULT_POSITION, "e2e4")!.fen;
    const pending: PendingMove = { ply: 0, fen: afterE4, uci: "e2e4" };
    expect(livePendingMove(pending, 0)).toBe(pending);
    expect(canSubmitMove({ you: "w", active: true, fen: DEFAULT_POSITION, serverPly: 0, pending })).toBe(false);
  });

  it("refuses moves out of turn, when spectating, or after the game", () => {
    expect(canSubmitMove({ you: "b", active: true, fen: DEFAULT_POSITION, serverPly: 0, pending: null })).toBe(false);
    expect(canSubmitMove({ you: null, active: true, fen: DEFAULT_POSITION, serverPly: 0, pending: null })).toBe(false);
    expect(canSubmitMove({ you: "w", active: false, fen: DEFAULT_POSITION, serverPly: 0, pending: null })).toBe(false);
  });
});
