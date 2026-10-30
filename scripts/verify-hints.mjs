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
    await page.getByRole("button", { name: "Hint", exact: true }).click();
    const panel = page.getByRole("region", { name: "Hint", exact: true });
    await expect(panel).toContainText("1/3");
    await expect(page.locator("[data-hint-arrow]")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Next hint", exact: true })).toBeEnabled({ timeout: 20000 });
    await panel.getByRole("button", { name: "Next hint", exact: true }).click();
    await expect(panel).toContainText("2/3");
    await expect(page.locator("[data-hint-arrow]")).toHaveCount(0);
    await panel.getByRole("button", { name: "Next hint", exact: true }).click();
    await expect(panel).toContainText("3/3");
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
    await expect(panel).toBeVisible();
    await expect(page.getByText("Unrated · assistance used", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Close hint", exact: true }).click();
    await expect(page.getByText("Unrated · assistance used", { exact: true })).toBeVisible();
    if (!await page.getByRole("button", { name: "Flip board", exact: true }).isVisible()) await page.getByRole("button", { name: "Game options", exact: true }).click();
    await page.getByRole("button", { name: "Flip board", exact: true }).click();
    await expect(page.locator(".game-opponent").getByLabel(/Player:/)).toBeVisible();
    await expect(page.locator(".game-player").getByRole("button", { name: /Bot strength:/ })).toBeVisible();
    results.push({ appearance, checks: ["real engine hint", "three stages", "legal arrow", "never auto move", "stale clear", "consent dismissal preserves rating", "saved unrated before hint", "closing never re-rates", "flip identities"] });
    await context.close();
    console.log(`Hint and rating consent passed: ${appearance}`);
  }
} finally {
  await writeFile(".cache/experience-qa/hints-results.json", JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
  await browser.close();
}
