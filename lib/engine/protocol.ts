// The cloud engine's wire format, shared by the browser client and the server.
// Everything a request can ask for is bounded here, so a client can never
// make the server think for longer than a bot or the eval bar would.
import { z } from "zod";
import { checkFen } from "../chess/rules";
import type { EngineOptions, SearchKind, SearchResult } from "../chess/engine/controller";

/** The longest single search anyone can ask for (Maya's Deep setting is 3.5s). */
export const MAX_MOVETIME_MS = 4_000;
export const MAX_DEPTH = 30;
export const MAX_MULTIPV = 3;

/** Only the strength settings the bots use. Nothing else (Threads, Hash…) is client-controlled. */
const OPTIONS = z
  .object({
    UCI_LimitStrength: z.boolean(),
    UCI_Elo: z.number().int().min(1320).max(3190),
    "Skill Level": z.number().int().min(0).max(20),
  })
  .partial()
  .strict();

export const engineRequestSchema = z
  .object({
    kind: z.enum(["move", "eval", "review"]),
    fen: z.string().min(1).max(100),
    movetimeMs: z.number().int().min(10).max(MAX_MOVETIME_MS).optional(),
    depth: z.number().int().min(1).max(MAX_DEPTH).optional(),
    multiPv: z.number().int().min(1).max(MAX_MULTIPV).optional(),
    options: OPTIONS.optional(),
    gameId: z.string().max(80).optional(),
  })
  .strict();

export type EngineRequest = {
  kind: SearchKind;
  fen: string;
  movetimeMs?: number;
  depth?: number;
  multiPv?: number;
  options?: EngineOptions;
  gameId?: string;
};

export type EngineResponse = Omit<SearchResult, "requestId"> & { cached: boolean };

export type ParsedRequest = { ok: true; request: EngineRequest } | { ok: false; error: string };

/** Validates a request body, normalises the FEN and always bounds the search time. */
export function parseEngineRequest(body: unknown): ParsedRequest {
  const parsed = engineRequestSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "Invalid engine request." };
  const fen = checkFen(parsed.data.fen);
  if (!fen.ok) return { ok: false, error: fen.error };
  const request: EngineRequest = { ...parsed.data, fen: fen.fen };
  // A depth-only search could run for minutes; cap it by time too.
  if (!request.movetimeMs) request.movetimeMs = request.depth ? MAX_MOVETIME_MS : 1_000;
  return { ok: true, request };
}

/** Cache key for searches whose answer depends only on the position and settings. */
export function resultCacheKey(request: EngineRequest): string | null {
  // Bot moves use randomness (Skill Level) and game history; never cache them.
  if (request.kind === "move") return null;
  return JSON.stringify([request.fen, request.movetimeMs ?? 0, request.depth ?? 0, request.multiPv ?? 1, request.options ?? {}]);
}
