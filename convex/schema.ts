import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Every chess table is owned by `owner` = Clerk identity tokenIdentifier,
// derived server-side, never accepted from clients.

export const colorValidator = v.union(v.literal("w"), v.literal("b"));
export const modeValidator = v.union(
  v.literal("full_power"),
  v.literal("climb"),
  v.literal("timed"),
  v.literal("practice"),
  v.literal("import"),
);
export const outcomeValidator = v.union(v.literal("1-0"), v.literal("0-1"), v.literal("1/2-1/2"));
export const ratedValidator = v.union(v.literal("eligible"), v.literal("ineligible"), v.literal("unrated"));
export const branchKindValidator = v.union(
  v.literal("main"),
  v.literal("variation"),
  v.literal("conflict"),
  v.literal("import"),
);
export const ratingSnapshot = v.object({ rating: v.number(), rd: v.number(), volatility: v.number() });
export const lessonStepValidator = v.object({
  id: v.string(),
  fen: v.string(),
  prompt: v.string(),
  lines: v.array(v.array(v.string())),
  goal: v.optional(v.union(v.literal("move"), v.literal("mate"))),
  hints: v.array(v.string()),
  wrong: v.optional(v.record(v.string(), v.string())),
});
export const packLineValidator = v.object({
  id: v.string(),
  event: v.string(),
  text: v.string(),
  expression: v.string(),
});
export const packValidator = v.object({
  schemaVersion: v.number(),
  packId: v.string(),
  version: v.number(),
  name: v.string(),
  description: v.string(),
  lines: v.array(packLineValidator),
  unlockExpressions: v.optional(v.array(v.string())),
});
export const mcpScopeValidator = v.union(
  v.literal("chess.read"),
  v.literal("chess.write"),
  v.literal("lessons.write"),
  v.literal("fatma.write"),
);

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    clerkId: v.string(),
    name: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_clerkId", ["clerkId"]),

  games: defineTable({
    owner: v.string(),
    gameKey: v.string(),
    mode: modeValidator,
    modeVersion: v.number(),
    opponentId: v.string(),
    opponentVersion: v.number(),
    engineBuild: v.string(),
    humanColor: colorValidator,
    originFen: v.string(),
    timeControlId: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("finished")),
    result: v.optional(outcomeValidator),
    resultReason: v.optional(v.string()),
    rated: ratedValidator,
    ineligibleReasons: v.array(v.string()),
    activeBranchKey: v.string(),
    revision: v.number(),
    moveCount: v.number(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    updatedAt: v.number(),
    parentGameKey: v.optional(v.string()),
    parentNodeKey: v.optional(v.string()),
    label: v.optional(v.string()),
    createdBy: v.union(v.literal("app"), v.literal("mcp"), v.literal("import")),
  })
    .index("by_owner_and_gameKey", ["owner", "gameKey"])
    .index("by_owner_and_updatedAt", ["owner", "updatedAt"])
    .index("by_owner_and_parentGameKey", ["owner", "parentGameKey"]),

  gameNodes: defineTable({
    owner: v.string(),
    gameId: v.id("games"),
    nodeKey: v.string(),
    parentKey: v.union(v.string(), v.null()),
    ply: v.number(),
    uci: v.string(),
    san: v.string(),
    fen: v.string(),
    createdAt: v.number(),
    clockAfterMs: v.optional(v.number()),
  })
    .index("by_gameId_and_nodeKey", ["gameId", "nodeKey"])
    .index("by_gameId_and_parentKey", ["gameId", "parentKey"])
    .index("by_gameId_and_ply", ["gameId", "ply"]),

  gameBranches: defineTable({
    owner: v.string(),
    gameId: v.id("games"),
    branchKey: v.string(),
    label: v.string(),
    headKey: v.string(),
    kind: branchKindValidator,
    forkedFromBranchKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_gameId_and_branchKey", ["gameId", "branchKey"]),

  /** Idempotency log: replaying an operation id returns the original result. */
  operations: defineTable({
    owner: v.string(),
    opId: v.string(),
    kind: v.string(),
    result: v.string(),
    createdAt: v.number(),
  }).index("by_owner_and_opId", ["owner", "opId"]),

  engineAnalyses: defineTable({
    owner: v.string(),
    gameId: v.id("games"),
    nodeKey: v.string(),
    positionKey: v.string(),
    engineBuild: v.string(),
    settingsHash: v.string(),
    depth: v.number(),
    scoreCp: v.optional(v.number()),
    scoreMate: v.optional(v.number()),
    bestmove: v.optional(v.string()),
    pv: v.array(v.string()),
    computeMs: v.number(),
    source: v.literal("browser"),
    updatedAt: v.number(),
  })
    .index("by_gameId_and_nodeKey", ["gameId", "nodeKey"])
    .index("by_owner_and_positionKey", ["owner", "positionKey"]),

  ratingProfiles: defineTable({
    owner: v.string(),
    pool: v.string(),
    rating: v.number(),
    rd: v.number(),
    volatility: v.number(),
    games: v.number(),
    algorithmVersion: v.string(),
    updatedAt: v.number(),
  }).index("by_owner_and_pool", ["owner", "pool"]),

  ratingLedger: defineTable({
    owner: v.string(),
    pool: v.string(),
    gameId: v.id("games"),
    before: ratingSnapshot,
    after: ratingSnapshot,
    expected: v.number(),
    score: v.number(),
    opponentId: v.string(),
    opponentVersion: v.number(),
    opponentRating: v.number(),
    opponentRd: v.number(),
    algorithmVersion: v.string(),
    createdAt: v.number(),
  })
    .index("by_gameId", ["gameId"])
    .index("by_owner_and_pool", ["owner", "pool"]),

  climbProgress: defineTable({
    owner: v.string(),
    unlockedLevel: v.number(),
    beaten: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_owner", ["owner"]),

  lessonProgress: defineTable({
    owner: v.string(),
    lessonId: v.string(),
    lessonVersion: v.number(),
    stepsDone: v.number(),
    completed: v.boolean(),
    hintsUsed: v.number(),
    mistakes: v.number(),
    box: v.number(),
    dueAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_and_lessonId", ["owner", "lessonId"])
    .index("by_owner_and_dueAt", ["owner", "dueAt"]),

  customLessons: defineTable({
    owner: v.string(),
    lessonId: v.string(),
    version: v.number(),
    title: v.string(),
    topic: v.string(),
    summary: v.string(),
    source: v.union(v.literal("mcp"), v.literal("user"), v.literal("adaptive")),
    steps: v.array(lessonStepValidator),
    provenance: v.object({
      createdBy: v.string(),
      clientId: v.optional(v.string()),
      sourceGameKey: v.optional(v.string()),
    }),
    validationStatus: v.literal("valid"),
    createdAt: v.number(),
  })
    .index("by_owner_and_lessonId", ["owner", "lessonId"])
    .index("by_owner_and_createdAt", ["owner", "createdAt"]),

  practiceItems: defineTable({
    owner: v.string(),
    itemKey: v.string(),
    fen: v.string(),
    accepted: v.array(v.string()),
    played: v.optional(v.string()),
    theme: v.string(),
    kind: v.string(),
    note: v.optional(v.string()),
    origin: v.union(v.literal("adaptive"), v.literal("mcp")),
    sourceGameKey: v.optional(v.string()),
    sourceNodeKey: v.optional(v.string()),
    box: v.number(),
    dueAt: v.number(),
    streak: v.number(),
    lapses: v.number(),
    createdAt: v.number(),
  })
    .index("by_owner_and_dueAt", ["owner", "dueAt"])
    .index("by_owner_and_itemKey", ["owner", "itemKey"])
    .index("by_owner_and_fen", ["owner", "fen"]),

  chessProfiles: defineTable({
    owner: v.string(),
    alias: v.string(),
    avatarSeed: v.string(),
    hue: v.number(),
    cardTheme: v.string(),
    boardPalette: v.string(),
    visibility: v.union(v.literal("private"), v.literal("public")),
    showRatings: v.boolean(),
    /** Sequential card number, assigned once (shown as "No. 0042"). */
    memberNumber: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_owner", ["owner"])
    .index("by_alias", ["alias"])
    .index("by_visibility", ["visibility"]),

  fatmaStates: defineTable({
    owner: v.string(),
    enabled: v.boolean(),
    mood: v.string(),
    disableCount: v.number(),
    reenableCount: v.number(),
    /** Bounded map of recently shown line ids -> timestamp (max 120). */
    seen: v.record(v.string(), v.number()),
    lastSpokeAt: v.number(),
    softUntil: v.number(),
    unlocks: v.array(v.string()),
    achievements: v.array(v.string()),
    stats: v.object({ wins: v.number(), losses: v.number(), draws: v.number(), undos: v.number(), lessons: v.number() }),
    pendingEvent: v.optional(v.string()),
    version: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["owner"]),

  fatmaPacks: defineTable({
    owner: v.string(),
    packId: v.string(),
    version: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("pending_approval"),
      v.literal("installed"),
      v.literal("uninstalled"),
      v.literal("rejected"),
    ),
    pack: packValidator,
    source: v.union(v.literal("mcp"), v.literal("user")),
    clientId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_and_packId_and_version", ["owner", "packId", "version"])
    .index("by_owner_and_status", ["owner", "status"]),

  counters: defineTable({ name: v.string(), value: v.number() }).index("by_name", ["name"]),

  mcpGrants: defineTable({
    owner: v.string(),
    scopes: v.array(mcpScopeValidator),
    allowAutoInstall: v.boolean(),
    revokedClients: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_owner", ["owner"]),

  mcpAudits: defineTable({
    owner: v.string(),
    clientId: v.string(),
    tool: v.string(),
    scope: v.string(),
    outcome: v.union(v.literal("ok"), v.literal("denied"), v.literal("error")),
    detail: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_owner_and_createdAt", ["owner", "createdAt"]),
});
