/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const HOST = "host-token-0123456789abcdef";
const GUEST = "guest-token-0123456789abcdef";
const STRANGER = "stranger-token-0123456789ab";

function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  return t;
}

async function startGame(t: ReturnType<typeof setup>, extra: { initialMs?: number; incrementMs?: number } = {}) {
  const { roomId, code } = await t.mutation(api.online.create, { token: HOST, name: "Omar", color: "w", ...extra });
  const joined = await t.mutation(api.online.join, { code, token: GUEST, name: "Sherine's cousin" });
  return { roomId, code, joined };
}

const view = (t: ReturnType<typeof setup>, code: string, token: string) => t.query(api.online.byCode, { code, token, now: Date.now() });

describe("online rooms", () => {
  it("keeps duplicate requests idempotent, enforces cancel/decline ownership and preserves results", async () => {
    const t = setup();
    const { roomId, code } = await startGame(t);
    await t.mutation(api.online.resign, { roomId, token: HOST });
    await t.mutation(api.online.rematch, { roomId, token: HOST });
    const pending = await view(t, code, HOST);
    expect(pending).toMatchObject({ rematchState: "pending", rematchBy: "w", rematchV2: true });
    await t.mutation(api.online.rematch, { roomId, token: HOST });
    expect((await view(t, code, HOST))?.rematchExpiresAt).toBe(pending?.rematchExpiresAt);
    await expect(t.mutation(api.online.respondRematch, { roomId, token: GUEST, action: "cancel" })).rejects.toThrow();
    await expect(t.mutation(api.online.respondRematch, { roomId, token: HOST, action: "decline" })).rejects.toThrow();
    await expect(t.mutation(api.online.respondRematch, { roomId, token: STRANGER, action: "decline" })).rejects.toThrow();
    await t.mutation(api.online.respondRematch, { roomId, token: GUEST, action: "decline" });
    expect(await view(t, code, HOST)).toMatchObject({ rematchState: "declined", status: "finished", resultReason: "aborted" });
    await t.mutation(api.online.rematch, { roomId, token: HOST });
    await t.mutation(api.online.respondRematch, { roomId, token: HOST, action: "cancel" });
    expect((await view(t, code, HOST))?.rematchState).toBe("cancelled");
  });
  it("expires a request at its server deadline and never expires a later accepted rematch", async () => {
    const t = setup();
    const { roomId, code } = await startGame(t);
    await t.mutation(api.online.resign, { roomId, token: HOST });
    await t.mutation(api.online.rematch, { roomId, token: HOST });
    const row = await t.run((ctx) => ctx.db.get("onlineRooms", roomId));
    const now = vi.spyOn(Date, "now").mockReturnValue(row!.rematchExpiresAt! + 1);
    try {
      await t.mutation(internal.online.expireRematch, { roomId, requestedAt: row!.rematchRequestedAt! });
      expect((await view(t, code, HOST))?.rematchState).toBe("expired");
      await t.mutation(api.online.rematch, { roomId, token: HOST });
      const accepted = await t.mutation(api.online.rematch, { roomId, token: GUEST });
      expect(accepted.code).toMatch(/^\d{6}$/);
      await t.mutation(internal.online.expireRematch, { roomId, requestedAt: row!.rematchRequestedAt! });
      expect(await view(t, code, HOST)).toMatchObject({ rematchState: "accepted", rematchCode: accepted.code });
      expect(await t.mutation(api.online.rematch, { roomId, token: HOST })).toEqual(accepted);
    } finally { now.mockRestore(); }
  });
  it("creates a 6-digit PIN and seats the guest on the other colour", async () => {
    const t = setup();
    const { code, joined } = await startGame(t);
    expect(code).toMatch(/^\d{6}$/);
    expect(joined.color).toBe("b");
    const room = await view(t, code, HOST);
    expect(room).toMatchObject({ status: "active", you: "w", white: "Omar", black: "Sherine's cousin" });
    // Secrets never leave the server.
    expect(JSON.stringify(room)).not.toContain(HOST);
    expect(JSON.stringify(room)).not.toContain(GUEST);
  });

  it("enforces turns and legality, and rejects strangers", async () => {
    const t = setup();
    const { roomId, code } = await startGame(t);
    await expect(t.mutation(api.online.move, { roomId, token: GUEST, uci: "e7e5", ply: 0 })).rejects.toThrow(/not your turn/i);
    await expect(t.mutation(api.online.move, { roomId, token: HOST, uci: "e2e5", ply: 0 })).rejects.toThrow(/illegal/i);
    await expect(t.mutation(api.online.move, { roomId, token: STRANGER, uci: "e2e4", ply: 0 })).rejects.toThrow(/not playing/i);
    await t.mutation(api.online.move, { roomId, token: HOST, uci: "e2e4", ply: 0 });
    await expect(t.mutation(api.online.move, { roomId, token: HOST, uci: "d2d4", ply: 1 })).rejects.toThrow(/not your turn/i);
    await t.mutation(api.online.move, { roomId, token: GUEST, uci: "e7e5", ply: 1 });
    const room = await view(t, code, STRANGER);
    expect(room?.you).toBeNull();
    expect(room?.moves.map((m) => m.san)).toEqual(["e4", "e5"]);
  });

  it("keeps going well past the first move pair, timed", async () => {
    const t = setup();
    const { roomId, code } = await startGame(t, { initialMs: 600_000 });
    const line = ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6", "c1g5", "f8e7"];
    for (const [ply, uci] of line.entries()) {
      await t.mutation(api.online.move, { roomId, token: ply % 2 === 0 ? HOST : GUEST, uci, ply });
    }
    const room = await view(t, code, HOST);
    expect(room?.ply).toBe(8);
    expect(room?.moves.map((m) => m.san)).toEqual(["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7"]);
  });

  it("shows each player's avatar and drops malformed ones", async () => {
    const t = setup();
    const { code } = await t.mutation(api.online.create, { token: HOST, name: "Omar", color: "w", avatar: { seed: "omarSeed1", hue: 210 } });
    await t.mutation(api.online.join, { code, token: GUEST, name: "Guest", avatar: { seed: "<script>", hue: 999 } });
    const room = await view(t, code, GUEST);
    expect(room?.whiteAvatar).toEqual({ seed: "omarSeed1", hue: 210 });
    // Invalid input is not stored; the client falls back to a name-based avatar.
    expect(room?.blackAvatar).toBeNull();
  });

  it("refuses a third player", async () => {
    const t = setup();
    const { code } = await startGame(t);
    await expect(t.mutation(api.online.join, { code, token: STRANGER, name: "Late" })).rejects.toThrow(/two players/i);
    // A seated player can rejoin from the link.
    await expect(t.mutation(api.online.join, { code, token: GUEST, name: "x" })).resolves.toMatchObject({ color: "b" });
  });

  it("acknowledges repetition as terminal so the result cue can replace the move cue", async () => {
    const t = setup();
    const { roomId, code } = await startGame(t);
    const line = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"];
    for (const [ply, uci] of line.entries()) {
      expect(await t.mutation(api.online.move, { roomId, token: ply % 2 ? GUEST : HOST, uci, ply })).toEqual({ ok: true, terminal: ply === line.length - 1 });
    }
    expect(await view(t, code, HOST)).toMatchObject({ status: "finished", result: "1/2-1/2", resultReason: "threefold" });
  });

  it("ends on checkmate", async () => {
    const t = setup();
    const { roomId, code } = await startGame(t);
    const moves: Array<[string, string]> = [[HOST, "f2f3"], [GUEST, "e7e5"], [HOST, "g2g4"], [GUEST, "d8h4"]];
    for (const [i, [token, uci]] of moves.entries()) await t.mutation(api.online.move, { roomId, token, uci, ply: i });
    expect(await view(t, code, HOST)).toMatchObject({ status: "finished", result: "0-1", resultReason: "checkmate" });
  });

  it("aborts early resignations and scores later ones", async () => {
    const t = setup();
    const first = await startGame(t);
    await t.mutation(api.online.resign, { roomId: first.roomId, token: HOST });
    expect(await view(t, first.code, HOST)).toMatchObject({ status: "finished", result: null, resultReason: "aborted" });

    const second = await startGame(t);
    await t.mutation(api.online.move, { roomId: second.roomId, token: HOST, uci: "e2e4", ply: 0 });
    await t.mutation(api.online.move, { roomId: second.roomId, token: GUEST, uci: "e7e5", ply: 1 });
    await t.mutation(api.online.resign, { roomId: second.roomId, token: GUEST });
    expect(await view(t, second.code, HOST)).toMatchObject({ result: "1-0", resultReason: "resign" });
  });

  it("agrees draws and starts a colour-swapped rematch", async () => {
    const t = setup();
    const { roomId, code } = await startGame(t);
    await t.mutation(api.online.move, { roomId, token: HOST, uci: "e2e4", ply: 0 });
    await t.mutation(api.online.move, { roomId, token: GUEST, uci: "e7e5", ply: 1 });
    await t.mutation(api.online.offerDraw, { roomId, token: HOST });
    expect((await view(t, code, GUEST))?.drawOfferBy).toBe("w");
    await t.mutation(api.online.offerDraw, { roomId, token: GUEST });
    expect(await view(t, code, HOST)).toMatchObject({ result: "1/2-1/2", resultReason: "agreement" });

    expect(await t.mutation(api.online.rematch, { roomId, token: HOST })).toEqual({ code: null });
    const { code: next } = await t.mutation(api.online.rematch, { roomId, token: GUEST });
    expect(next).toMatch(/^\d{6}$/);
    expect(await view(t, next!, HOST)).toMatchObject({ status: "active", you: "b" });
  });

  it("runs clocks with increment and flags on timeout", async () => {
    const t = setup();
    const { roomId, code } = await startGame(t, { initialMs: 60_000, incrementMs: 2_000 });
    await t.mutation(api.online.move, { roomId, token: HOST, uci: "e2e4", ply: 0 });
    const room = await view(t, code, HOST);
    // White's first move is free; Black's clock is now running.
    expect(room).toMatchObject({ clockW: 60_000, clockB: 60_000 });
    expect(room?.turnStartedAt).not.toBeNull();
    await t.run(async (ctx) => ctx.db.patch("onlineRooms", roomId, { turnStartedAt: Date.now() - 61_000 }));
    await t.mutation(api.online.claimTimeout, { roomId, token: HOST });
    expect(await view(t, code, HOST)).toMatchObject({ status: "finished", result: "1-0", resultReason: "timeout", clockB: 0 });
  });
});
