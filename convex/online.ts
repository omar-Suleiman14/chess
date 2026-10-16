// Play a friend: rooms joined by a 6-digit PIN, link or QR code.
// No account needed: a seat is owned by a random client secret that is sent
// with every call and never returned by queries. The server is authoritative
// for legality, turn order, clocks and results.
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { fail } from "./model/auth";
import { colorValidator, onlineAvatarValidator } from "./schema";
import { applyUci, DEFAULT_POSITION, statusFromPath, timeoutOutcome, sideToMove, type Color, type Outcome } from "../lib/chess/rules";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  onlineCreate: { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
});

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
const CODE = /^\d{6}$/;
const MAX_PLIES = 1200;
const MAX_NAME = 24;
/** Waiting rooms expire so their PINs can be reused. */
const WAITING_TTL_MS = 24 * 60 * 60_000;

function checkToken(token: string) {
  if (!TOKEN.test(token)) fail("bad_request", "Invalid player token.");
}

function cleanName(name: string): string {
  const trimmed = name.replace(/[<>{}`\\]/g, "").trim().slice(0, MAX_NAME);
  return trimmed || "Guest";
}

/** Same rules as profile avatars; anything else is dropped rather than refused. */
function cleanAvatar(avatar: { seed: string; hue: number } | undefined) {
  if (!avatar || !/^[A-Za-z0-9_-]{1,32}$/.test(avatar.seed) || !Number.isInteger(avatar.hue) || avatar.hue < 0 || avatar.hue >= 360) return undefined;
  return { seed: avatar.seed, hue: avatar.hue };
}

function other(c: Color): Color {
  return c === "w" ? "b" : "w";
}

function seatOf(room: Doc<"onlineRooms">, token: string): Color | null {
  if (token === room.hostToken) return room.hostColor;
  if (room.guestToken && token === room.guestToken) return other(room.hostColor);
  return null;
}

async function openRoomByCode(ctx: QueryCtx, code: string): Promise<Doc<"onlineRooms"> | null> {
  for (const status of ["active", "waiting"] as const) {
    const room = await ctx.db
      .query("onlineRooms")
      .withIndex("by_code_and_status", (q) => q.eq("code", code).eq("status", status))
      .order("desc")
      .first();
    if (room) return room;
  }
  return null;
}

async function latestRoomByCode(ctx: QueryCtx, code: string): Promise<Doc<"onlineRooms"> | null> {
  const open = await openRoomByCode(ctx, code);
  if (open) return open;
  let latest: Doc<"onlineRooms"> | null = null;
  for (const status of ["finished", "cancelled"] as const) {
    const room = await ctx.db
      .query("onlineRooms")
      .withIndex("by_code_and_status", (q) => q.eq("code", code).eq("status", status))
      .order("desc")
      .first();
    if (room && (!latest || room._creationTime > latest._creationTime)) latest = room;
  }
  return latest;
}

async function freshCode(ctx: MutationCtx): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!(await openRoomByCode(ctx, code))) return code;
  }
  fail("unavailable", "Could not allocate a game PIN. Try again.");
}

async function requireRoom(ctx: QueryCtx, roomId: Id<"onlineRooms">): Promise<Doc<"onlineRooms">> {
  const room = await ctx.db.get("onlineRooms", roomId);
  if (!room) fail("not_found", "Game not found.");
  return room;
}

function requireSeat(room: Doc<"onlineRooms">, token: string): Color {
  checkToken(token);
  const seat = seatOf(room, token);
  if (!seat) fail("forbidden", "You are not playing in this game.");
  return seat;
}

/** Clocks as of `now`, charging the side to move for its current think. */
function liveClocks(room: Doc<"onlineRooms">, now: number): Record<Color, number> | null {
  if (room.clockW === undefined || room.clockB === undefined) return null;
  const clocks = { w: room.clockW, b: room.clockB };
  if (room.status === "active" && room.turnStartedAt !== null) {
    const toMove = sideToMove(room.fen);
    clocks[toMove] = Math.max(0, clocks[toMove] - (now - room.turnStartedAt));
  }
  return clocks;
}

async function finish(ctx: MutationCtx, room: Doc<"onlineRooms">, result: Outcome | undefined, reason: string, clocks: Record<Color, number> | null) {
  await ctx.db.patch("onlineRooms", room._id, {
    status: "finished",
    result,
    resultReason: reason,
    turnStartedAt: null,
    drawOfferBy: undefined,
    ...(clocks ? { clockW: clocks.w, clockB: clocks.b } : {}),
    updatedAt: Date.now(),
  });
}

const timeControlArgs = {
  initialMs: v.optional(v.number()),
  incrementMs: v.optional(v.number()),
};

function checkTimeControl(initialMs: number | undefined, incrementMs: number | undefined) {
  if (initialMs === undefined) return;
  if (!Number.isFinite(initialMs) || initialMs < 30_000 || initialMs > 3 * 60 * 60_000) fail("bad_request", "Time must be between 30 seconds and 3 hours.");
  if (incrementMs !== undefined && (!Number.isFinite(incrementMs) || incrementMs < 0 || incrementMs > 60_000)) fail("bad_request", "Increment must be 0-60 seconds.");
}

// ---------------------------------------------------------------------------

/** Server clock, so clients can correct for their own clock drift. */
export const now = mutation({
  args: {},
  handler: async () => Date.now(),
});

export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    avatar: v.optional(onlineAvatarValidator),
    color: v.union(colorValidator, v.literal("random")),
    ...timeControlArgs,
  },
  handler: async (ctx, args) => {
    checkToken(args.token);
    checkTimeControl(args.initialMs, args.incrementMs);
    const limit = await rateLimiter.limit(ctx, "onlineCreate", { key: args.token });
    if (!limit.ok) fail("rate_limited", "Too many new games. Try again in a few minutes.");
    const code = await freshCode(ctx);
    const now = Date.now();
    const timed = args.initialMs !== undefined;
    const roomId = await ctx.db.insert("onlineRooms", {
      code,
      status: "waiting",
      hostToken: args.token,
      hostName: cleanName(args.name),
      hostAvatar: cleanAvatar(args.avatar),
      hostColor: args.color === "random" ? (Math.random() < 0.5 ? "w" : "b") : args.color,
      initialMs: args.initialMs,
      incrementMs: timed ? (args.incrementMs ?? 0) : undefined,
      fen: DEFAULT_POSITION,
      ply: 0,
      clockW: args.initialMs,
      clockB: args.initialMs,
      turnStartedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    return { roomId, code };
  },
});

export const join = mutation({
  args: { code: v.string(), token: v.string(), name: v.string(), avatar: v.optional(onlineAvatarValidator) },
  handler: async (ctx, args) => {
    checkToken(args.token);
    if (!CODE.test(args.code)) fail("bad_request", "The PIN is 6 digits.");
    const room = await openRoomByCode(ctx, args.code);
    if (!room) fail("not_found", "No open game with that PIN. Check the number or ask for a new one.");
    const seat = seatOf(room, args.token);
    if (seat) return { roomId: room._id, color: seat };
    if (room.status !== "waiting") fail("full", "That game already has two players.");
    if (Date.now() - room.createdAt > WAITING_TTL_MS) fail("expired", "That invite has expired. Ask for a new one.");
    await ctx.db.patch("onlineRooms", room._id, { guestToken: args.token, guestName: cleanName(args.name), guestAvatar: cleanAvatar(args.avatar), status: "active", updatedAt: Date.now() });
    return { roomId: room._id, color: other(room.hostColor) };
  },
});

export const cancel = mutation({
  args: { roomId: v.id("onlineRooms"), token: v.string() },
  handler: async (ctx, args) => {
    const room = await requireRoom(ctx, args.roomId);
    checkToken(args.token);
    if (room.hostToken !== args.token) fail("forbidden", "Only the host can cancel the invite.");
    if (room.status !== "waiting") return null;
    await ctx.db.patch("onlineRooms", room._id, { status: "cancelled", updatedAt: Date.now() });
    return null;
  },
});

export const move = mutation({
  args: { roomId: v.id("onlineRooms"), token: v.string(), uci: v.string(), ply: v.number() },
  handler: async (ctx, args) => {
    const room = await requireRoom(ctx, args.roomId);
    const seat = requireSeat(room, args.token);
    if (room.status !== "active") fail("not_active", "This game is over.");
    if (args.ply !== room.ply) fail("stale", "The position changed. Try again.");
    if (sideToMove(room.fen) !== seat) fail("not_your_turn", "It's not your turn.");
    if (room.ply >= MAX_PLIES) fail("too_long", "This game has reached the move limit.");
    const applied = applyUci(room.fen, args.uci);
    if (!applied) fail("illegal", "Illegal move.");

    const now = Date.now();
    let clocks = liveClocks(room, now);
    if (clocks && room.turnStartedAt !== null && clocks[seat] <= 0) {
      await finish(ctx, room, timeoutOutcome(room.fen, seat), "timeout", clocks);
      return { ok: false as const, reason: "flag" };
    }
    if (clocks) clocks = { ...clocks, [seat]: clocks[seat] + (room.ply > 0 ? (room.incrementMs ?? 0) : 0) };

    await ctx.db.insert("onlineMoves", { roomId: room._id, ply: room.ply + 1, uci: applied.uci, san: applied.san, fen: applied.fen, createdAt: now });
    const history = await ctx.db
      .query("onlineMoves")
      .withIndex("by_roomId_and_ply", (q) => q.eq("roomId", room._id))
      .take(MAX_PLIES + 1);
    const status = statusFromPath(DEFAULT_POSITION, history.map((m) => m.uci));

    await ctx.db.patch("onlineRooms", room._id, {
      fen: applied.fen,
      ply: room.ply + 1,
      lastUci: applied.uci,
      ...(clocks ? { clockW: clocks.w, clockB: clocks.b } : {}),
      turnStartedAt: now,
      drawOfferBy: undefined,
      updatedAt: now,
    });
    if (status?.over) {
      const latest = await requireRoom(ctx, room._id);
      await finish(ctx, latest, status.outcome, status.reason, clocks);
    } else if (clocks) {
      const next = other(seat);
      await ctx.scheduler.runAfter(clocks[next] + 50, internal.online.checkFlag, { roomId: room._id, ply: room.ply + 1 });
    }
    return { ok: true as const };
  },
});

/** Scheduled after every timed move: ends the game if the side to move ran out. */
export const checkFlag = internalMutation({
  args: { roomId: v.id("onlineRooms"), ply: v.number() },
  handler: async (ctx, args) => {
    const room = await ctx.db.get("onlineRooms", args.roomId);
    if (!room || room.status !== "active" || room.ply !== args.ply) return null;
    const clocks = liveClocks(room, Date.now());
    const toMove = sideToMove(room.fen);
    if (!clocks || clocks[toMove] > 0) return null;
    await finish(ctx, room, timeoutOutcome(room.fen, toMove), "timeout", clocks);
    return null;
  },
});

/** Either player may claim a flag the moment their client sees zero. */
export const claimTimeout = mutation({
  args: { roomId: v.id("onlineRooms"), token: v.string() },
  handler: async (ctx, args) => {
    const room = await requireRoom(ctx, args.roomId);
    requireSeat(room, args.token);
    if (room.status !== "active") return null;
    const clocks = liveClocks(room, Date.now());
    const toMove = sideToMove(room.fen);
    if (clocks && room.turnStartedAt !== null && clocks[toMove] <= 0) await finish(ctx, room, timeoutOutcome(room.fen, toMove), "timeout", clocks);
    return null;
  },
});

export const resign = mutation({
  args: { roomId: v.id("onlineRooms"), token: v.string() },
  handler: async (ctx, args) => {
    const room = await requireRoom(ctx, args.roomId);
    const seat = requireSeat(room, args.token);
    if (room.status !== "active") return null;
    // Before both sides have moved, leaving is an abort, not a loss.
    if (room.ply < 2) await finish(ctx, room, undefined, "aborted", liveClocks(room, Date.now()));
    else await finish(ctx, room, seat === "w" ? "0-1" : "1-0", "resign", liveClocks(room, Date.now()));
    return null;
  },
});

export const offerDraw = mutation({
  args: { roomId: v.id("onlineRooms"), token: v.string() },
  handler: async (ctx, args) => {
    const room = await requireRoom(ctx, args.roomId);
    const seat = requireSeat(room, args.token);
    if (room.status !== "active" || room.ply < 2) return null;
    if (room.drawOfferBy === other(seat)) {
      await finish(ctx, room, "1/2-1/2", "agreement", liveClocks(room, Date.now()));
      return null;
    }
    await ctx.db.patch("onlineRooms", room._id, { drawOfferBy: seat, updatedAt: Date.now() });
    return null;
  },
});

export const declineDraw = mutation({
  args: { roomId: v.id("onlineRooms"), token: v.string() },
  handler: async (ctx, args) => {
    const room = await requireRoom(ctx, args.roomId);
    const seat = requireSeat(room, args.token);
    if (room.status === "active" && room.drawOfferBy === other(seat)) await ctx.db.patch("onlineRooms", room._id, { drawOfferBy: undefined, updatedAt: Date.now() });
    return null;
  },
});

/** Both players ask for a rematch: a new room with colours swapped. */
export const rematch = mutation({
  args: { roomId: v.id("onlineRooms"), token: v.string() },
  handler: async (ctx, args) => {
    const room = await requireRoom(ctx, args.roomId);
    const seat = requireSeat(room, args.token);
    if (room.status !== "finished") fail("not_finished", "The game is still going.");
    if (room.rematchCode) return { code: room.rematchCode };
    if (room.rematchBy !== other(seat)) {
      await ctx.db.patch("onlineRooms", room._id, { rematchBy: seat, updatedAt: Date.now() });
      return { code: null };
    }
    const code = await freshCode(ctx);
    const now = Date.now();
    await ctx.db.insert("onlineRooms", {
      code,
      status: "active",
      hostToken: room.hostToken,
      guestToken: room.guestToken,
      hostName: room.hostName,
      guestName: room.guestName,
      hostAvatar: room.hostAvatar,
      guestAvatar: room.guestAvatar,
      hostColor: other(room.hostColor),
      initialMs: room.initialMs,
      incrementMs: room.incrementMs,
      fen: DEFAULT_POSITION,
      ply: 0,
      clockW: room.initialMs,
      clockB: room.initialMs,
      turnStartedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("onlineRooms", room._id, { rematchCode: code, updatedAt: now });
    return { code };
  },
});

// ---------------------------------------------------------------------------

const roomView = v.object({
  roomId: v.id("onlineRooms"),
  code: v.string(),
  status: v.union(v.literal("waiting"), v.literal("active"), v.literal("finished"), v.literal("cancelled")),
  you: v.union(colorValidator, v.null()),
  white: v.union(v.string(), v.null()),
  black: v.union(v.string(), v.null()),
  whiteAvatar: v.union(onlineAvatarValidator, v.null()),
  blackAvatar: v.union(onlineAvatarValidator, v.null()),
  initialMs: v.union(v.number(), v.null()),
  incrementMs: v.union(v.number(), v.null()),
  fen: v.string(),
  ply: v.number(),
  lastUci: v.union(v.string(), v.null()),
  clockW: v.union(v.number(), v.null()),
  clockB: v.union(v.number(), v.null()),
  turnStartedAt: v.union(v.number(), v.null()),
  result: v.union(v.string(), v.null()),
  resultReason: v.union(v.string(), v.null()),
  drawOfferBy: v.union(colorValidator, v.null()),
  rematchBy: v.union(colorValidator, v.null()),
  rematchCode: v.union(v.string(), v.null()),
  expired: v.boolean(),
  moves: v.array(v.object({ ply: v.number(), uci: v.string(), san: v.string() })),
});

/** The room behind a PIN, as seen by `token` (a player, or a spectator). */
export const byCode = query({
  args: { code: v.string(), token: v.string(), now: v.number() },
  returns: v.union(roomView, v.null()),
  handler: async (ctx, args) => {
    if (!CODE.test(args.code)) return null;
    const room = await latestRoomByCode(ctx, args.code);
    if (!room) return null;
    const moves = await ctx.db
      .query("onlineMoves")
      .withIndex("by_roomId_and_ply", (q) => q.eq("roomId", room._id))
      .take(MAX_PLIES);
    const hostIsWhite = room.hostColor === "w";
    return {
      roomId: room._id,
      code: room.code,
      status: room.status,
      you: TOKEN.test(args.token) ? seatOf(room, args.token) : null,
      white: (hostIsWhite ? room.hostName : room.guestName) ?? null,
      black: (hostIsWhite ? room.guestName : room.hostName) ?? null,
      whiteAvatar: (hostIsWhite ? room.hostAvatar : room.guestAvatar) ?? null,
      blackAvatar: (hostIsWhite ? room.guestAvatar : room.hostAvatar) ?? null,
      initialMs: room.initialMs ?? null,
      incrementMs: room.incrementMs ?? null,
      fen: room.fen,
      ply: room.ply,
      lastUci: room.lastUci ?? null,
      clockW: room.clockW ?? null,
      clockB: room.clockB ?? null,
      turnStartedAt: room.turnStartedAt,
      result: room.result ?? null,
      resultReason: room.resultReason ?? null,
      drawOfferBy: room.drawOfferBy ?? null,
      rematchBy: room.rematchBy ?? null,
      rematchCode: room.rematchCode ?? null,
      // `now` comes from the client (queries must not read the clock); it only gates the join button.
      expired: room.status === "waiting" && args.now - room.createdAt > WAITING_TTL_MS,
      moves: moves.map((m) => ({ ply: m.ply, uci: m.uci, san: m.san })),
    };
  },
});
