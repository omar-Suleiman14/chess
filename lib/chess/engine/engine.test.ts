import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION } from "../rules";
import { beginnerMove, hashSeed } from "./beginner";
import { EngineController, EngineFailure, SearchCancelled, type WorkerLike } from "./controller";
import { CLIMB_OPPONENTS, findOpponent, fullPowerOpponent } from "./opponents";
import { barFill, formatScore, parseBestMove, parseInfo, toWhiteScore } from "./uci";

describe("UCI parsing", () => {
  it("parses info lines with cp, mate and pv", () => {
    const info = parseInfo("info depth 18 seldepth 24 multipv 1 score cp -34 nodes 1000 nps 5000 time 200 pv e7e5 g1f3");
    expect(info).toMatchObject({ depth: 18, scoreCp: -34, multipv: 1, pv: ["e7e5", "g1f3"] });
    expect(parseInfo("info depth 5 score mate -3 pv a1a2")).toMatchObject({ scoreMate: -3 });
    expect(parseInfo("info depth 9 score cp 20 lowerbound")?.bound).toBe("lower");
    expect(parseInfo("info string NNUE evaluation enabled")).toBeNull();
    expect(parseInfo("readyok")).toBeNull();
  });

  it("parses bestmove including (none)", () => {
    expect(parseBestMove("bestmove e2e4 ponder e7e5")).toEqual({ bestmove: "e2e4", ponder: "e7e5" });
    expect(parseBestMove("bestmove (none)")).toEqual({ bestmove: null, ponder: undefined });
  });

  it("normalises scores to White", () => {
    expect(toWhiteScore({ scoreCp: 50 }, "b")).toEqual({ cp: -50 });
    expect(toWhiteScore({ scoreMate: 2 }, "b")).toEqual({ mate: -2 });
    expect(formatScore({ cp: 123 })).toBe("+1.2");
    expect(formatScore({ mate: -4 })).toBe("-M4");
    expect(barFill({ cp: 0 })).toBeCloseTo(0.5);
    expect(barFill({ mate: 3 })).toBe(1);
  });
});

class FakeEngine implements WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: string[] = [];
  searching = false;
  constructor(private readonly bestmove: (fen: string) => string = () => "e2e4") {}
  private fen = DEFAULT_POSITION;
  postMessage(message: string) {
    this.sent.push(message);
    const reply = (line: string) => queueMicrotask(() => this.onmessage?.({ data: line }));
    if (message === "uci") reply("uciok");
    else if (message === "isready") reply("readyok");
    else if (message.startsWith("position fen ")) this.fen = message.slice(13);
    else if (message.startsWith("go")) {
      this.searching = true;
      reply("info depth 12 score cp 31 pv e2e4 e7e5");
      // Real searches end asynchronously; tests finish them with `complete()`.
    } else if (message === "stop" && this.searching) {
      this.complete();
    }
  }
  complete() {
    if (!this.searching) return;
    this.searching = false;
    const move = this.bestmove(this.fen);
    queueMicrotask(() => this.onmessage?.({ data: `bestmove ${move}` }));
  }
  terminate() {}
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("EngineController", () => {
  it("applies the multiPv request field as the MultiPV option", async () => {
    const fake = new FakeEngine();
    const engine = new EngineController(() => fake);
    const pending = engine.search({ kind: "review", fen: DEFAULT_POSITION, movetimeMs: 100, multiPv: 2 });
    for (let i = 0; i < 4; i++) await tick();
    expect(fake.sent).toContain("setoption name MultiPV value 2");
    fake.complete();
    await pending;
    // The next plain search goes back to one line.
    const next = engine.search({ kind: "eval", fen: DEFAULT_POSITION, movetimeMs: 100 });
    for (let i = 0; i < 4; i++) await tick();
    expect(fake.sent).toContain("setoption name MultiPV value 1");
    fake.complete();
    await next;
    engine.terminate();
  });

  it("in shared mode, never lets one request cancel another, and an abort signal cancels only its own search", async () => {
    const fake = new FakeEngine();
    const engine = new EngineController(() => fake, { supersede: false });
    const first = engine.search({ kind: "eval", fen: DEFAULT_POSITION, movetimeMs: 100 });
    for (let i = 0; i < 4; i++) await tick();
    const controller = new AbortController();
    const second = engine.search({ kind: "eval", fen: DEFAULT_POSITION, movetimeMs: 100, signal: controller.signal });
    const third = engine.search({ kind: "move", fen: DEFAULT_POSITION, movetimeMs: 100 });
    controller.abort();
    await expect(second).rejects.toBeInstanceOf(SearchCancelled);
    fake.complete();
    expect((await first).bestmove).toBe("e2e4");
    for (let i = 0; i < 4; i++) await tick();
    fake.complete();
    expect((await third).bestmove).toBe("e2e4");
    engine.terminate();
  });

  it("keeps the scored principal line when depth-only and secondary messages follow", async () => {
    const fake = new FakeEngine();
    const engine = new EngineController(() => fake);
    const pending = engine.search({ kind: "eval", fen: DEFAULT_POSITION, movetimeMs: 100 });
    await tick();
    await tick();
    fake.onmessage?.({ data: "info depth 13 nodes 5000" });
    fake.onmessage?.({ data: "info depth 12 multipv 2 score cp -200 pv d2d4" });
    fake.complete();
    expect((await pending).score).toEqual({ cp: 31 });
    engine.terminate();
  });
  it("completes the handshake and returns a validated move", async () => {
    const fake = new FakeEngine();
    const engine = new EngineController(() => fake);
    const pending = engine.search({ kind: "move", fen: DEFAULT_POSITION, movetimeMs: 100 });
    await tick();
    await tick();
    fake.complete();
    const result = await pending;
    expect(result.bestmove).toBe("e2e4");
    expect(result.score).toEqual({ cp: 31 });
    expect(fake.sent.slice(0, 1)).toEqual(["uci"]);
    expect(fake.sent).toContain("setoption name Threads value 1");
  });

  it("lets a move search preempt an eval and discards the stale result", async () => {
    const fake = new FakeEngine();
    const engine = new EngineController(() => fake);
    const evalSearch = engine.search({ kind: "eval", fen: DEFAULT_POSITION, depth: 20 });
    await tick();
    await tick();
    const move = engine.search({ kind: "move", fen: DEFAULT_POSITION, movetimeMs: 50 });
    await expect(evalSearch).rejects.toBeInstanceOf(SearchCancelled);
    await tick();
    await tick();
    fake.complete();
    expect((await move).bestmove).toBe("e2e4");
  });

  it("rejects illegal engine moves", async () => {
    const fake = new FakeEngine(() => "e2e5");
    const engine = new EngineController(() => fake);
    const pending = engine.search({ kind: "move", fen: DEFAULT_POSITION, movetimeMs: 50 });
    await tick();
    await tick();
    fake.complete();
    await expect(pending).rejects.toBeInstanceOf(EngineFailure);
  });

  it("sends ucinewgame once per game, before the position, and not for eval", async () => {
    const fake = new FakeEngine();
    const engine = new EngineController(() => fake);
    const run = async (request: Parameters<EngineController["search"]>[0]) => {
      const pending = engine.search(request);
      await tick();
      await tick();
      fake.complete();
      await pending;
    };
    await run({ kind: "move", fen: DEFAULT_POSITION, movetimeMs: 50, gameId: "game-a" });
    await run({ kind: "move", fen: DEFAULT_POSITION, movetimeMs: 50, gameId: "game-a" });
    await run({ kind: "eval", fen: DEFAULT_POSITION, movetimeMs: 50 });
    await run({ kind: "move", fen: DEFAULT_POSITION, movetimeMs: 50, gameId: "game-b" });
    expect(fake.sent.filter((m) => m === "ucinewgame")).toHaveLength(2);
    // Each ucinewgame is followed by isready before the next position is set.
    const first = fake.sent.indexOf("ucinewgame");
    expect(fake.sent.indexOf("isready", first)).toBeLessThan(fake.sent.indexOf(`position fen ${DEFAULT_POSITION}`, first));
  });

  it("resets weakening options for full-power searches", async () => {
    const fake = new FakeEngine();
    const engine = new EngineController(() => fake);
    const weak = engine.search({ kind: "move", fen: DEFAULT_POSITION, movetimeMs: 50, options: { UCI_LimitStrength: true, UCI_Elo: 1450 } });
    await tick();
    await tick();
    fake.complete();
    await weak;
    const strong = engine.search({ kind: "move", fen: DEFAULT_POSITION, movetimeMs: 50 });
    await tick();
    await tick();
    fake.complete();
    await strong;
    expect(fake.sent).toContain("setoption name UCI_LimitStrength value true");
    expect(fake.sent.lastIndexOf("setoption name UCI_LimitStrength value false")).toBeGreaterThan(
      fake.sent.indexOf("setoption name UCI_LimitStrength value true"),
    );
  });
});

describe("opponents", () => {
  it("keeps an existing game's policy stable across ladder revisions", () => {
    const old = findOpponent("climb-07", 1)!;
    const current = findOpponent("climb-07")!;
    expect(old.version).toBe(1);
    expect(old.policy).toMatchObject({ options: { UCI_Elo: 1450 } });
    expect(current.version).toBe(2);
    expect(current.policy).toMatchObject({ depth: 2, options: { "Skill Level": 2 } });
    expect(findOpponent("climb-07", 99)).toBeUndefined();
    expect(findOpponent("climb-01", 2)).toBeUndefined();
    expect(findOpponent("full-power-fast", 2)).toBeUndefined();
  });

  it("never weakens Full Power", () => {
    const full = fullPowerOpponent("standard");
    expect(full.policy.kind).toBe("stockfish");
    if (full.policy.kind === "stockfish") expect(full.policy.options).toEqual({});
    expect(findOpponent("full-power-deep")?.rating).toBe(3000);
  });

  it("has a monotonic nominal ladder and honest calibration flags", () => {
    const ratings = CLIMB_OPPONENTS.map((o) => o.rating);
    expect([...ratings].sort((a, b) => a - b)).toEqual(ratings);
    expect(CLIMB_OPPONENTS.every((o) => o.calibrated === false)).toBe(true);
  });

  it("beginner policies only play legal, deterministic moves", () => {
    const a = beginnerMove(DEFAULT_POSITION, "careful", 0.1, hashSeed("x"));
    const b = beginnerMove(DEFAULT_POSITION, "careful", 0.1, hashSeed("x"));
    expect(a).toBe(b);
    // Greedy grabs a free queen.
    expect(beginnerMove("4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1", "greedy", 0, 1)).toBe("c3d5");
    // Takes mate in one.
    expect(beginnerMove("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "careful", 0, 3)).toBe("a1a8");
  });
});
