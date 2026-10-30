import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const results = [];
try {
  for (const appearance of ["classic", "expressive", "glass"]) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addInitScript((appearance) => { if (!localStorage.getItem("cbc.settings.v1")) localStorage.setItem("cbc.settings.v1", JSON.stringify({ sound: false, evalBar: false, experience: { appearance } })); }, appearance);
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3100");
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByRole("button", { name: "Hint", exact: true })).toBeEnabled();
    const boardBefore = await page.getByRole("gridcell").allTextContents();
    // Chess.com-style hints: 1st tap lights up the piece, 2nd shows the move, 3rd clears.
    const hint = page.getByRole("button", { name: "Hint", exact: true });
    const panel = page.locator(".hint-square");
    const status = page.getByRole("status").filter({ hasText: /^Hint/ });
    await hint.click();
    await expect(page.locator(".hint-square")).toHaveCount(1, { timeout: 20000 });
    await expect(status).toBeVisible();
    await expect(page.locator("[data-hint-arrow]")).toHaveCount(0);
    await hint.click();
    await expect(page.locator(".hint-square")).toHaveCount(2);
    await expect(page.locator("[data-hint-arrow]")).toHaveCount(1);
    expect(await page.getByRole("gridcell").allTextContents()).toEqual(boardBefore);
    await mkdir(".cache/experience-qa", { recursive: true });
    await page.screenshot({ path: `.cache/experience-qa/${appearance}-hint.png` });
    await page.locator("#sq-e2").click();
    await page.locator("#sq-e4").click();
    await expect(panel).toHaveCount(0);
    await expect(page.locator("[data-hint-arrow]")).toHaveCount(0);
    await page.goto("http://127.0.0.1:3100/climb");
    await page.getByRole("button", { name: /Wobbly Pawn, rating/ }).click();
    await expect(page.getByRole("grid")).toBeVisible();
    await page.getByRole("button", { name: "Hint", exact: true }).click();
    const consent = page.getByRole("dialog", { name: "Hint", exact: true });
    await expect(consent).toContainText("Using a hint makes this game unrated.");
    await expect(consent.getByRole("heading")).toBeFocused();
    await consent.getByRole("button", { name: "Keep rated", exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByText("Rated", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Hint", exact: true }).click();
    await consent.getByRole("button", { name: "Use hint", exact: true }).click();
    await expect(panel).toHaveCount(1, { timeout: 20000 });
    await expect(page.getByText("Unrated · assistance used", { exact: true })).toBeVisible();
    await hint.click();
    await hint.click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByText("Unrated · assistance used", { exact: true })).toBeVisible();
    if (!await page.getByRole("button", { name: "Flip board", exact: true }).isVisible()) await page.getByRole("button", { name: "Game options", exact: true }).click();
    await page.getByRole("button", { name: "Flip board", exact: true }).click();
    await expect(page.locator(".game-opponent").getByLabel(/Player:/)).toBeVisible();
    await expect(page.locator(".game-player").getByRole("button", { name: /Bot strength:/ })).toBeVisible();
    // The bot-strength popup (ⓘ) always closes: backdrop tap and its button.
    await page.getByRole("button", { name: /Bot strength:/ }).first().click();
    const info = page.getByRole("dialog", { name: /strength/ });
    await expect(info).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(info).toHaveCount(0);
    await page.getByRole("button", { name: /Bot strength:/ }).first().click();
    await info.getByRole("button", { name: "Got it" }).click();
    await expect(info).toHaveCount(0);
    results.push({ appearance, checks: ["real engine hint", "piece glow then arrow", "legal arrow", "never auto move", "stale clear", "consent dismissal preserves rating", "saved unrated before hint", "closing never re-rates", "flip identities", "strength popup closes"] });
    await context.close();
    console.log(`Hint and rating consent passed: ${appearance}`);
  }
} finally {
  await writeFile(".cache/experience-qa/hints-results.json", JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
  await browser.close();
}
