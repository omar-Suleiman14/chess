import { describe, expect, it } from "vitest";
import { checkFen, DEFAULT_POSITION, legalMoves, piecesOf } from "./rules";
import { randomBackRank, VARIANTS, variantFen } from "./variants";

describe("variants", () => {
  it("produces a legal, playable position for every variant and colour", () => {
    for (const { id } of VARIANTS) for (const human of ["w", "b"] as const) {
      const fen = variantFen(id, human, () => 0.37);
      expect(checkFen(fen).ok, `${id} ${human}`).toBe(true);
      expect(legalMoves(fen).length, `${id} ${human}`).toBeGreaterThan(0);
    }
    expect(variantFen("standard", "w")).toBe(DEFAULT_POSITION);
  });

  it("takes odds from the opponent, not the player", () => {
    const count = (fen: string, color: "w" | "b", type: string) => piecesOf(fen).filter((p) => p.color === color && p.type === type).length;
    expect(count(variantFen("odds-queen", "w"), "b", "q")).toBe(0);
    expect(count(variantFen("odds-queen", "w"), "w", "q")).toBe(1);
    expect(count(variantFen("odds-rook", "b"), "w", "r")).toBe(1);
  });

  it("shuffles a valid back rank", () => {
    for (let seed = 0; seed < 50; seed++) {
      let s = seed * 9301 + 49297;
      const rank = randomBackRank(() => ((s = (s * 9301 + 49297) % 233280) / 233280));
      expect(rank.split("").sort().join("")).toBe("BBKNNQRR");
      const b = [...rank].flatMap((c, i) => (c === "B" ? [i % 2] : []));
      expect(b[0]).not.toBe(b[1]);
      expect(rank.indexOf("R")).toBeLessThan(rank.indexOf("K"));
      expect(rank.lastIndexOf("R")).toBeGreaterThan(rank.indexOf("K"));
    }
  });
});
