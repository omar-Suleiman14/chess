// Offline acceptance against the local production build: visit once online,
// wait for "Offline ready", cut the network, then cold-load and play.
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.env.QA_URL ?? "http://127.0.0.1:3100";
await mkdir(".cache/experience-qa", { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(`${base}/settings`);
  await expect(page.getByText("Offline ready")).toBeVisible({ timeout: 120_000 });
  console.log("Offline ready reached online");

  await context.setOffline(true);
  // Cold load the board with no network at all.
  await page.goto(base);
  const grid = page.getByRole("grid");
  await expect(grid).toBeVisible();
  await expect(page.locator("#sq-e2")).toHaveAttribute("aria-label", /white pawn/);
  await expect(async () => {
    await page.locator("#sq-e2").click();
    await page.locator("#sq-e4").click();
    await expect(page.locator("#sq-e4")).toHaveAttribute("aria-label", /white pawn/, { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  // Stockfish (cached WASM) answers with no network.
  await expect(page.getByRole("navigation", { name: "Moves" }).getByRole("button")).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByText("Offline · games save on this device")).toBeVisible();
  await page.screenshot({ path: ".cache/experience-qa/offline-game.png" });
  console.log("Offline game: move played and engine replied");

  // Reload keeps the game (IndexedDB) offline.
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Moves" }).getByRole("button")).toHaveCount(2, { timeout: 15_000 });
  console.log("Offline reload restored the game");

  for (const [path, check] of [["/learn", page.getByRole("heading", { level: 1 })], ["/time-machine", page.getByRole("heading", { level: 1 })], ["/settings/theme", page.getByRole("radiogroup", { name: "Board theme" })], ["/play", page.getByText("Online games need internet.")]]) {
    await page.goto(`${base}${path}`);
    await expect(check).toBeVisible();
    console.log(`Offline route opened: ${path}`);
  }
  // A tab tap offline (route data unavailable) still lands on the page.
  await page.goto(`${base}/learn`);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Bots" }).click();
  await expect(page).toHaveURL(/\/climb$/);
  await expect(page.getByRole("heading", { name: "The Climb" })).toBeVisible();
  console.log("Offline tab navigation works");
  await context.close();
} finally {
  await browser.close();
}
