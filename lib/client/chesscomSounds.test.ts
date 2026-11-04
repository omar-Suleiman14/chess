import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHESSCOM_FILES } from "./sound";

describe("recorded Standard sound pack", () => {
  it("maps illegal move to illegal.mp3, never the puzzle incorrect.mp3", () => {
    expect(CHESSCOM_FILES.illegal).toBe("illegal");
    expect(CHESSCOM_FILES.victory).toBe("game-win");
    expect(CHESSCOM_FILES.defeat).toBe("game-lose");
    expect(CHESSCOM_FILES.draw).toBe("game-draw");
  });

  it.each([
    ["illegal", "d344fd3aa7b850217bee4a98e85d303ffd43ea2f047b9d772a26b6d0cc01fa4c"],
    ["move-self", "935c69a3a8b0638389b7213f24d63100ec7034176390525f3314c50c9c408e7d"],
    ["capture", "a643e9f6ee5c9ed7efccba0ca863857e8cb8b01b4d0b0e21e699d5b90e6f9920"],
  ])("keeps %s byte-identical to the supplied archive", (file, digest) => {
    const contents = readFileSync(join(process.cwd(), "public", "sounds", "chesscom", `${file}.mp3`));
    expect(createHash("sha256").update(contents).digest("hex")).toBe(digest);
  });
});
