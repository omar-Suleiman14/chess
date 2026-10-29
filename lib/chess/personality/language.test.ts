import { describe, expect, it } from "vitest";
import { detectLanguage } from "./language";
import { linesFor } from "./lines";
import { initialMemory, pickLine } from "./fatma";

describe("Sherine languages and memory", () => {
  it("distinguishes Arabizi, English, Arabic and mixed text", () => {
    expect(detectLanguage("3amel eh ya Sherine")).toBe("franco");
    expect(detectLanguage("hello 2026, e4 is my move")).toBe("en");
    expect(detectLanguage("I play Nf3 then Nc6")).toBe("en");
    expect(detectLanguage("", ["en-US", "ar-EG"])).toBe("en");
    expect(detectLanguage("nice move بس استني")).toBe("egy");
    expect(detectLanguage("", ["ar-EG", "en"])).toBe("egy");
    expect(detectLanguage("hello", ["ar-EG"])).toBe("en");
  });

  it.each(["en", "egy", "franco"] as const)("has unique, complete dialogue and follow-ups in %s", (language) => {
    const lines = linesFor(language);
    expect(new Set(lines.map((line) => line.id)).size).toBe(lines.length);
    expect(lines.length).toBe(linesFor("en").length);
    for (const line of lines) {
      expect(line.text.trim()).not.toBe("");
      expect(line.text.length).toBeLessThan(160);
      if (language === "egy") expect(line.text).toMatch(/[\u0600-\u06ff]/);
    }
  });

  it("respects sanitized server-side dialogue timestamps", () => {
    const memory = { ...initialMemory(), seen: { "egy_open-1": 100_000 } };
    const only = linesFor("egy").filter((line) => line.id === "egy:open-1");
    expect(pickLine(memory, "opening", only, 101_000, 0)).toBeNull();
  });

  it("rotates direct replies without bypassing unlock or mood gates", () => {
    const memory = { ...initialMemory(), seen: { a: 500, b: 800 } };
    const lines = [
      { id: "a", event: "poke", text: "A", expression: "idle" },
      { id: "b", event: "poke", text: "B", expression: "idle" },
      { id: "locked", event: "poke", text: "Locked", expression: "idle", unlock: "secret" },
    ] as const;
    expect(pickLine(memory, "poke", [...lines], 1_000, 2)?.id).toBe("a");
  });
});
