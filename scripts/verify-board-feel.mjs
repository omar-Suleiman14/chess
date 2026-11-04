// Real-input QA for the board feel hill climb. Run against the guest QA server.
// Keeps screenshots in .cache (not in the production bundle).
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const output = ".cache/board-feel";
await mkdir(output, { recursive: true });
const results = [];

async function centre(page, square) {
  const bounds = await page.locator(`#sq-${square}`).boundingBox();
  if (!bounds) throw new Error(`Missing board square ${square}`);
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  // Seed preferences only once. addInitScript runs on EVERY navigation: an
  // unconditional write would undo a piece-set choice before verifying that
  // the setting survives a reload.
  await context.addInitScript(() => {
    if (!localStorage.getItem("cbc.settings.v1")) localStorage.setItem("cbc.settings.v1", JSON.stringify({ sound: false, evalBar: false }));
  });
  const page = await context.newPage();
  await page.goto(process.env.QA_URL ?? "http://127.0.0.1:3100");
  await expect(page.getByRole("grid")).toBeVisible();
  for (const file of ["move-self", "capture", "move-check", "premove", "illegal", "game-win", "game-lose", "game-draw"]) {
    const cue = await page.request.get(`${process.env.QA_URL ?? "http://127.0.0.1:3100"}/sounds/chesscom/${file}.mp3`);
    if (!cue.ok() || !/audio|mpeg|octet-stream/i.test(cue.headers()["content-type"] ?? "")) {
      throw new Error(`Chess.com recorded sound ${file} unavailable: ${cue.status()} ${cue.headers()["content-type"]}`);
    }
  }
  results.push("eight locally bundled recorded sounds resolve with audio content, including exact illegal cue");
  // The grid is server-rendered. A visible square does not mean the React
  // pointer handlers have hydrated yet; prove that they respond to a pickup
  // before measuring the compositor drag path.
  await page.locator("#sq-e2").click();
  await expect(page.locator("#sq-e2")).toHaveAttribute("aria-label", /selected/);
  await page.locator("#sq-e2").click();
  await expect(page.locator("#sq-e2")).not.toHaveAttribute("aria-label", /selected/);
  // A blocked bishop is selectable. It must not buzz merely because it has
  // zero legal moves. A destination attempt, however, should reject and flash.
  await page.locator("#sq-c1").click();
  await expect(page.locator("#sq-c1")).toHaveAttribute("aria-label", /selected/);
  await expect(page.locator(".illegal-flash")).toHaveCount(0);
  await page.locator("#sq-e3").click();
  await expect(page.locator(".illegal-flash")).toHaveCount(1);
  await expect(page.locator("#sq-c1")).toHaveAttribute("aria-label", /white bishop/);
  await expect(page.locator(".illegal-flash")).toHaveCount(0, { timeout: 1500 });
  results.push("blocked bishop selection stays silent; failed destination attempt raises illegal feedback");
  await page.screenshot({ path: `${output}/desktop-before.png` });

  const from = await centre(page, "e2");
  const to = await centre(page, "e4");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const ghost = page.locator("[data-drag-ghost]");
  const offsets = [];
  for (let i = 1; i <= 24; i++) {
    const x = from.x + (to.x - from.x) * i / 24;
    const y = from.y + (to.y - from.y) * i / 24;
    await page.mouse.move(x, y);
    if (i < 3) continue;
    await expect(ghost).toBeVisible();
    const box = await ghost.boundingBox();
    if (box) offsets.push(Math.hypot(box.x + box.width / 2 - x, box.y + box.height / 2 - y));
  }
  await expect(ghost).toBeVisible();
  await expect(page.locator("[data-drag-origin]")).toHaveCount(1);
  await expect(page.locator("[data-legal-target]")).toHaveCount(2);
  const ghostBox = await ghost.boundingBox();
  if (!ghostBox) throw new Error("Drag ghost has no dimensions");
  const p95 = offsets.sort((a, b) => a - b)[Math.ceil(offsets.length * 0.95) - 1];
  if (!Number.isFinite(p95) || p95 > 10) throw new Error(`Held piece offset p95 ${p95?.toFixed(1)}px exceeds 10px`);
  await expect(page.locator("[data-drop-target]")).toHaveCount(1);
  await page.screenshot({ path: `${output}/desktop-drag.png` });
  await page.mouse.up();
  await expect(ghost).toHaveCount(0);
  await expect(page.locator("#sq-e4")).toHaveAttribute("aria-label", /white pawn/);
  await page.screenshot({ path: `${output}/desktop-after.png` });
  results.push(`mouse pickup, compositor-follow (p95 offset ${p95.toFixed(1)}px), target highlight, legal commit`);

  const g1 = await centre(page, "g1");
  await page.mouse.move(g1.x, g1.y);
  await page.mouse.down();
  await page.mouse.move(g1.x + 18, g1.y - 18, { steps: 6 });
  await page.mouse.move(g1.x - 90, g1.y + 230, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator("#sq-g1")).toHaveAttribute("aria-label", /white knight/);
  await expect(ghost).toHaveCount(0);
  results.push("off-board drop returns piece without move");

  await page.getByRole("button", { name: "Game options", exact: true }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("radiogroup", { name: "Piece size" }).getByRole("radio", { name: "Bold" }).click();
  await expect(page.locator("html")).toHaveCSS("--board-piece-scale", "1.14");
  await page.getByRole("radiogroup", { name: "Bot move speed" }).getByRole("radio", { name: "Relaxed" }).click();
  expect(await page.evaluate(() => localStorage.getItem("cbc.bot.pace.v1"))).toBe("relaxed");
  results.push("piece-size and opponent pacing preferences");
  await page.goto(`${process.env.QA_URL ?? "http://127.0.0.1:3100"}/settings`);
  await expect(page.getByRole("radiogroup", { name: "Piece style" }).getByRole("radio", { name: /Studio/ })).toHaveCount(0);
  await page.getByRole("radiogroup", { name: "Piece style" }).getByRole("radio", { name: "Neo", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "Piece style" }).getByRole("radio", { name: "Neo", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.goto(process.env.QA_URL ?? "http://127.0.0.1:3100");
  const chesscomPieces = page.locator("img[src^='/pieces/chesscom/']");
  await expect(chesscomPieces).toHaveCount(32);
  await expect.poll(async () => chesscomPieces.evaluateAll((images) => images.filter((img) => img.complete && img.naturalWidth > 0).length), { timeout: 15_000 }).toBe(32);
  await page.screenshot({ path: `${output}/desktop-chesscom-neo.png` });
  results.push("all 32 original Neo piece images load and named Neo choice persists; Studio removed");
  await context.close();

  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await touch.addInitScript(() => localStorage.setItem("cbc.settings.v1", JSON.stringify({ sound: false, evalBar: true })));
  const phone = await touch.newPage();
  await phone.goto(process.env.QA_URL ?? "http://127.0.0.1:3100");
  await expect(phone.getByRole("grid")).toBeVisible();
  await expect(phone.locator(".game-main")).toHaveCSS("position", "fixed");
  await expect(phone.locator("[data-game-quality]")).toBeVisible();
  // Evaluations belong beside move feedback, not above the board. Rated
  // games may present a consent action instead of live engine numbers.
  const desktopMeter = phone.locator(".game-position [role=meter]");
  if (await desktopMeter.count()) await expect(desktopMeter).toBeHidden();
  if (await phone.locator("[data-game-quality] [role=meter], [data-game-quality] button").count() !== 1) {
    throw new Error("Mobile evaluation must live inside the move feedback strip");
  }
  const statusRow = phone.locator("[data-game-status]");
  await expect(statusRow).toBeVisible();
  if ((await statusRow.boundingBox())?.height !== 24) throw new Error("Game status must retain its height even while empty");
  const viewport = await phone.evaluate(() => ({ height: window.innerHeight, scrollHeight: document.scrollingElement?.scrollHeight ?? 0 }));
  if (viewport.scrollHeight > viewport.height + 2) throw new Error(`Phone document must not scroll: ${JSON.stringify(viewport)}`);
  await phone.evaluate(() => window.scrollTo(0, 400));
  const scrolled = await phone.evaluate(() => window.scrollY);
  if (scrolled !== 0) throw new Error(`Phone game scrolled by ${scrolled}px`);
  await phone.screenshot({ path: `${output}/phone-before.png` });
  const phoneBoard = await phone.getByRole("grid").boundingBox();
  if (!phoneBoard || phoneBoard.y < 150 || phoneBoard.y + phoneBoard.height > 740) {
    throw new Error(`Mobile board is outside finger-reachable lower-middle area: ${JSON.stringify(phoneBoard)}`);
  }
  await phone.locator("#sq-e2").tap();
  await expect(phone.locator("#sq-e2")).toHaveAttribute("aria-label", /selected/);
  await phone.locator("#sq-e2").tap();
  await expect(phone.locator("#sq-e2")).not.toHaveAttribute("aria-label", /selected/);
  const origin = await centre(phone, "e2");
  const target = await centre(phone, "e4");
  const session = await touch.newCDPSession(phone);
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...origin, id: 1 }] });
  for (let i = 1; i <= 12; i++) {
    const x = origin.x + (target.x - origin.x) * i / 12;
    const y = origin.y + (target.y - origin.y) * i / 12;
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y, id: 1 }] });
  }
  await expect(phone.locator("[data-drag-ghost]")).toBeVisible();
  await phone.screenshot({ path: `${output}/phone-drag.png` });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(phone.locator("#sq-e4")).toHaveAttribute("aria-label", /white pawn/);
  await expect(phone.locator("[data-drag-ghost]")).toHaveCount(0);
  if ((await statusRow.boundingBox())?.height !== 24) throw new Error("Thinking/status changes must never collapse their grid row");
  const turnChangeViewport = await phone.evaluate(() => ({ height: window.innerHeight, scrollHeight: document.scrollingElement?.scrollHeight ?? 0 }));
  if (turnChangeViewport.scrollHeight > turnChangeViewport.height + 2) {
    throw new Error(`Mobile document overflowed after turn changed: ${JSON.stringify(turnChangeViewport)}`);
  }
  await phone.evaluate(() => window.scrollTo(0, 400));
  if (await phone.evaluate(() => window.scrollY) !== 0) throw new Error("Mobile page scrolled on turn change");
  await phone.screenshot({ path: `${output}/phone-after.png` });
  // Two fingers must move together vertically. A finished gesture is never a
  // chess move, and a second swipe flips back to the original orientation.
  const boardBox = await phone.getByRole("grid").boundingBox();
  if (!boardBox) throw new Error("Board disappeared before gesture QA");
  const touchX1 = boardBox.x + boardBox.width * 0.33;
  const touchX2 = boardBox.x + boardBox.width * 0.67;
  const touchY = boardBox.y + boardBox.height * 0.38;
  const swipe = async (direction) => {
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [
      { x: touchX1, y: touchY, id: 2 }, { x: touchX2, y: touchY, id: 3 },
    ] });
    for (let i = 1; i <= 8; i++) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [
        { x: touchX1, y: touchY + direction * 68 * i / 8, id: 2 },
        { x: touchX2, y: touchY + direction * 68 * i / 8, id: 3 },
      ] });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await swipe(1);
  await expect(phone.locator('[role="grid"] [role="gridcell"]').first()).toHaveAttribute("id", "sq-h1");
  await expect(phone.locator("#sq-e4")).toHaveAttribute("aria-label", /white pawn/);
  await phone.waitForTimeout(120);
  await swipe(-1);
  await expect(phone.locator('[role="grid"] [role="gridcell"]').first()).toHaveAttribute("id", "sq-a8");
  await phone.screenshot({ path: `${output}/phone-flipped-back.png` });
  results.push("390px emulated touch pickup/drop, fixed status and evaluation strip; board remains viewport-locked through turn changes; two-finger swipe flips twice without moving a piece");
  await touch.close();
  console.log(`Board feel QA passed: ${results.join("; ")}`);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
  await browser.close();
}
