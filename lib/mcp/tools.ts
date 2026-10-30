// MCP tool catalog. Each tool is a thin, typed wrapper over a Convex service
// function in convex/mcp.ts, which enforces consent scopes, ownership,
// validation, rate limits and auditing. This file never touches the database.
import type { McpServer } from "@modelcontextprotocol/server";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { botPersona, CLIMB_OPPONENTS, FULL_POWER_LABEL, THINK_TIME_MS } from "@/lib/chess/engine/opponents";

type Base = { secret: string; clerkUserId: string; clientId: string };
type ServiceResult = { ok: true; data: unknown } | { ok: false; code: string; message: string };
type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export type ToolContext = { origin: string };

function convex(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set.");
  return new ConvexHttpClient(url);
}

function baseFrom(extra: { http?: { authInfo?: { clientId?: string; extra?: Record<string, unknown> } } }): Base {
  const auth = extra.http?.authInfo;
  const clerkUserId = auth?.extra?.userId;
  const secret = process.env.MCP_SERVICE_SECRET;
  if (typeof clerkUserId !== "string" || !clerkUserId) throw new Error("Not authenticated.");
  if (!secret) throw new Error("Server misconfigured: MCP_SERVICE_SECRET missing.");
  return { secret, clerkUserId, clientId: auth?.clientId ?? "unknown" };
}

async function run(
  fn: FunctionReference<"mutation", "public">,
  extra: Parameters<typeof baseFrom>[0],
  args: Record<string, unknown>,
  decorate?: (data: Record<string, unknown>) => Record<string, unknown>,
): Promise<ToolResult> {
  let result: ServiceResult;
  try {
    result = (await convex().mutation(fn, { ...baseFrom(extra), ...args })) as ServiceResult;
  } catch (error) {
    return { isError: true, content: [{ type: "text", text: `error: ${error instanceof Error ? error.message : "request failed"}` }] };
  }
  if (!result.ok) {
    return { isError: true, content: [{ type: "text", text: `${result.code}: ${result.message}` }] };
  }
  const data = decorate ? decorate(result.data as Record<string, unknown>) : (result.data as Record<string, unknown>);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 1) }], structuredContent: data };
}

const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const opId = z.string().min(8).max(64).describe("Unique idempotency key for this action; reuse it when retrying.");
const key = z.string().min(4).max(64);

const lessonStep = z.object({
  id: z.string().min(1).max(20),
  fen: z.string().min(10).max(100).describe("Legal starting position (FEN)."),
  prompt: z.string().min(1).max(140).describe("One short instruction, no prose."),
  lines: z.array(z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)).min(1).max(9)).max(8)
    .describe("Accepted UCI lines. Learner moves at even indexes, scripted replies at odd indexes; each line ends with a learner move."),
  goal: z.enum(["move", "mate"]).optional().describe("'mate' accepts any mate in one and ignores lines."),
  hints: z.array(z.string().min(1).max(100)).max(3),
  wrong: z.record(z.string(), z.string().max(140)).optional().describe("Optional feedback for specific wrong UCI moves."),
});

const packLine = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  event: z.enum(["game_start", "human_blunder", "human_good_move", "fatma_capture", "human_capture", "check_given", "check_received", "human_win", "human_loss", "draw", "undo", "idle", "lesson_complete", "achievement"]),
  text: z.string().min(1).max(120).describe("One short sarcastic-but-not-crude sentence. No links or markup."),
  expression: z.enum(["idle", "thinking", "smug", "amused", "annoyed", "impressed", "victory", "defeat", "grateful"]),
});

export function registerTools(server: McpServer, { origin }: ToolContext): void {
  const link = (path: string) => `${origin}${path}`;

  server.registerTool(
    "get_chess_profile",
    { title: "Chess profile", description: "The player's chess identity, per-pool ratings with uncertainty, and Sherine status. Maya's '3000' (Full Power) is a nominal label, not a measured Elo.", inputSchema: z.object({}), annotations: READ },
    async (_args, extra) => run(api.mcp.getChessProfile, extra, {}),
  );

  server.registerTool(
    "list_games",
    {
      title: "List games",
      description: "Recent games, newest first. Paginate with nextBefore.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(25).default(10),
        before: z.number().optional().describe("nextBefore value from a previous page."),
        mode: z.enum(["full_power", "climb", "timed", "practice", "import"]).optional(),
      }),
      annotations: READ,
    },
    async ({ limit, before, mode }, extra) =>
      run(api.mcp.listGames, extra, { limit, before, mode }, (d) => ({
        ...d,
        games: (d.games as Array<Record<string, unknown>>).map((g) => ({ ...g, url: link(`/time-machine/${g.gameKey}`) })),
      })),
  );

  server.registerTool(
    "get_game",
    {
      title: "Get game",
      description: "One game: PGN of the active line, start FEN, branches and move nodes (nodeKey for create_branch / queue_practice). Bounded to maxNodes.",
      inputSchema: z.object({ gameKey: key, maxNodes: z.number().int().min(1).max(600).default(300) }),
      annotations: READ,
    },
    async ({ gameKey, maxNodes }, extra) => run(api.mcp.getGame, extra, { gameKey, maxNodes }, (d) => ({ ...d, url: link(`/time-machine/${gameKey}`) })),
  );

  server.registerTool(
    "get_game_analysis",
    {
      title: "Game analysis",
      description: "Saved Stockfish evaluations (computed in the player's browser) and detected mistakes. If coverage is zero, say analysis is unavailable; never invent engine scores.",
      inputSchema: z.object({ gameKey: key }),
      annotations: READ,
    },
    async ({ gameKey }, extra) => run(api.mcp.getGameAnalysis, extra, { gameKey }, (d) => ({ ...d, analyseUrl: link(`/time-machine/${gameKey}`) })),
  );

  server.registerTool(
    "get_progress",
    { title: "Progress", description: "Ratings per pool with 95% intervals, Climb ladder, lessons and practice stats. Report uncertainty honestly.", inputSchema: z.object({}), annotations: READ },
    async (_args, extra) => run(api.mcp.getProgress, extra, {}),
  );

  server.registerTool(
    "list_lessons",
    { title: "List lessons", description: "Fixed curriculum, curated topic lessons and the player's custom lessons, with completion.", inputSchema: z.object({}), annotations: READ },
    async (_args, extra) =>
      run(api.mcp.listLessons, extra, {}, (d) => {
        const withUrl = (items: Array<Record<string, unknown>>, prefix: string) => items.map((l) => ({ ...l, url: link(`${prefix}${l.lessonId}`) }));
        return {
          fixed: withUrl(d.fixed as Array<Record<string, unknown>>, "/learn/"),
          topics: withUrl(d.topics as Array<Record<string, unknown>>, "/learn/"),
          custom: withUrl(d.custom as Array<Record<string, unknown>>, "/learn/custom/"),
        };
      }),
  );

  server.registerTool(
    "get_bots",
    { title: "Bots", description: "Every bot the player can face: Maya (strongest, full-strength Stockfish), Sherine's Climb levels and the scripted beginner bots, with engine settings and honest rating labels.", inputSchema: z.object({}), annotations: READ },
    async () => {
      const bots = [
        { name: "Maya", persona: "maya", character: "The strongest bot. Calm, exact, quietly confident; respects good moves and says little.", where: "Full Power and Climb level 11", engine: "Stockfish 19 Lite, full strength (no skill limit)", thinkTimeMs: THINK_TIME_MS, rating: `${FULL_POWER_LABEL} (nominal label, not measured)` },
        ...CLIMB_OPPONENTS.filter((o) => o.id !== "climb-11").map((o) => ({ name: o.name, persona: botPersona(o), where: `Climb level ${Number(o.id.slice(-2))}`, engine: o.policy.kind === "stockfish" ? `Stockfish 19 Lite, ${JSON.stringify(o.policy.options)} · ${o.policy.movetimeMs} ms` : `Scripted ${o.policy.policy} beginner bot`, rating: `~${o.rating} (estimate${o.calibrated ? "" : ", uncalibrated"})` })),
      ];
      return { content: [{ type: "text" as const, text: JSON.stringify({ bots, sherine: "Sherine is also the app's companion: playful, teasing, speaks English, Egyptian Arabic and Franco. Use get_fatma_profile for her state." }, null, 2) }] };
    },
  );

  server.registerTool(
    "get_fatma_profile",
    { title: "Sherine profile", description: "Sherine's on/off state, mood, memory counters, achievements and installed/pending upgrades.", inputSchema: z.object({}), annotations: READ },
    async (_args, extra) => run(api.mcp.getFatmaProfile, extra, {}),
  );

  server.registerTool(
    "create_branch",
    {
      title: "Create practice branch",
      description:
        "Start a NEW unrated game from a move in a saved game (e.g. 'go back to move 17'). The original game is never modified. Returns a link that opens the board at that position.",
      inputSchema: z.object({
        sourceGameKey: key,
        sourceNodeKey: z.string().min(1).max(64).describe("nodeKey from get_game; the new game starts from the position AFTER this move ('root' = initial position)."),
        enginePreset: z.enum(["fast", "standard", "deep"]).default("standard").describe("Maya's thinking time at full strength."),
        label: z.string().max(60).default(""),
        expectedRevision: z.number().int().optional().describe("Game revision from get_game; rejects if the game changed since."),
        clientOperationId: opId,
      }),
      annotations: WRITE,
    },
    async (args, extra) =>
      run(api.mcp.createBranch, extra, args, (d) => ({ ...d, url: link(`/game/${d.sessionGameKey}`) })),
  );

  server.registerTool(
    "queue_practice",
    {
      title: "Queue practice",
      description:
        "Add positions to the player's spaced-repetition practice. Use gameKey+nodeKey (best move from saved analysis) or a FEN with acceptedUci. All moves are validated.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              gameKey: key.optional(),
              nodeKey: z.string().max(64).optional(),
              fen: z.string().max(100).optional(),
              acceptedUci: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)).max(6).optional(),
              note: z.string().max(140).optional().describe("Short prompt shown to the player."),
            }),
          )
          .min(1)
          .max(10),
        clientOperationId: opId,
      }),
      annotations: WRITE,
    },
    async (args, extra) => run(api.mcp.queuePractice, extra, args, (d) => ({ ...d, url: link("/learn/practice") })),
  );

  server.registerTool(
    "create_lesson",
    {
      title: "Create lesson",
      description:
        "Create a short playable lesson (1-12 steps, each 1-3 learner moves). Every FEN and move is validated with chess rules before saving. Keep text minimal; the board teaches.",
      inputSchema: z.object({
        title: z.string().min(1).max(60),
        topic: z.string().regex(/^[a-z0-9-]{1,40}$/).describe("kebab-case, e.g. sicilian-defense"),
        summary: z.string().min(1).max(120),
        steps: z.array(lessonStep).min(1).max(12),
        sourceGameKey: key.optional(),
        clientOperationId: opId,
      }),
      annotations: WRITE,
    },
    async (args, extra) => run(api.mcp.createLesson, extra, args, (d) => ({ ...d, url: link(`/learn/custom/${d.lessonId}`) })),
  );

  server.registerTool(
    "propose_fatma_upgrade",
    {
      title: "Propose Sherine upgrade",
      description: "Draft a data-only dialogue pack for Sherine (no code, links or assets). It is validated and stored as a draft; nothing changes until installed.",
      inputSchema: z.object({
        pack: z.object({
          schemaVersion: z.literal(1),
          packId: z.string().regex(/^[a-z0-9-]{3,40}$/),
          version: z.number().int().min(1).max(1000),
          name: z.string().min(1).max(40),
          description: z.string().min(1).max(160),
          lines: z.array(packLine).min(1).max(40),
          unlockExpressions: z.array(packLine.shape.expression).max(9).optional(),
        }),
      }),
      annotations: { ...WRITE, idempotentHint: true },
    },
    async (args, extra) => run(api.mcp.proposeFatmaUpgrade, extra, args),
  );

  server.registerTool(
    "install_fatma_upgrade",
    {
      title: "Install Sherine upgrade",
      description:
        "Install a proposed pack (exact packId + version). Unless the player allowed auto-install, this only requests approval and returns status 'pending_approval' with a link where they decide. Reversible.",
      inputSchema: z.object({ packId: z.string().regex(/^[a-z0-9-]{3,40}$/), version: z.number().int().min(1), clientOperationId: opId }),
      annotations: WRITE,
    },
    async (args, extra) => run(api.mcp.installFatmaUpgrade, extra, args, (d) => ({ ...d, url: link("/profile") })),
  );
}
