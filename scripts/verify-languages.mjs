import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/chromium", args: ["--no-sandbox"] });
const results = [];
try {
  for (const appearance of ["classic", "expressive", "glass"]) for (const [language, title, again] of [["en", "You lost", "Play again"], ["egy", "إنت خسرت", "العب تاني"], ["franco", "Enta khesert", "El3ab tany"]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(({ appearance, language }) => localStorage.setItem("cbc.settings.v1", JSON.stringify({ sound: false, evalBar: false, fatmaLanguage: language, motion: "reduced", experience: { appearance, colorMode: "dark" } })), { appearance, language });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3100");
    await expect(page.getByRole("grid")).toBeVisible();
    // Phones show the tab bar on a fresh board; the game toolbar appears once a move is played.
    await expect(page.locator("#sq-e2")).toHaveAttribute("aria-label", /white pawn/);
    await expect(async () => {
      await page.locator("#sq-e2").click();
      await page.locator("#sq-e4").click();
      await expect(page.locator("#sq-e4")).toHaveAttribute("aria-label", /white pawn/, { timeout: 1000 });
    }).toPass();
    await page.getByRole("button", { name: "Game options", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Resign", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Resign", exact: true }).click();
    const result = page.getByRole("dialog", { name: title, exact: true });
    await expect(result).toBeVisible();
    await expect(result.getByRole("button", { name: again, exact: true })).toBeVisible();
    await expect(result).toHaveAttribute("dir", language === "egy" ? "rtl" : "ltr");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await result.getByRole("button", { name: again, exact: true }).scrollIntoViewIfNeeded();
    await expect(result.getByRole("button", { name: again, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await mkdir(".cache/experience-qa", { recursive: true });
    await page.screenshot({ path: `.cache/experience-qa/${appearance}-${language}-phone-text-200.png` });
    await context.close();
    results.push({ appearance, language, width: 390, textScale: 2, reducedMotion: true, passed: true });
    console.log(`Phone result language passed: ${appearance} / ${language}`);
  }
} finally {
  await writeFile(".cache/experience-qa/language-results.json", JSON.stringify({ date: new Date().toISOString(), note: "CSS text scaling, not a physical browser zoom or screen-reader run.", results }, null, 2));
  await browser.close();
}
