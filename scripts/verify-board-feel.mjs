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
  for (const file of ["move-self", "capture", "move-check", "premove"]) {
    const cue = await page.request.get(`${process.env.QA_URL ?? "http://127.0.0.1:3100"}/sounds/chesscom/${file}.mp3`);
    if (!cue.ok() || !/audio|mpeg|octet-stream/i.test(cue.headers()["content-type"] ?? "")) {
      throw new Error(`Chess.com recorded sound ${file} unavailable: ${cue.status()} ${cue.headers()["content-type"]}`);
    }
  }
  results.push("four streamed Chess.com sound cues resolve with audio content");
  // The grid is server-rendered. A visible square does not mean the React
  // pointer handlers have hydrated yet; prove that they respond to a pickup
  // before measuring the compositor drag path.
  await page.locator("#sq-e2").click();
  await expect(page.locator("#sq-e2")).toHaveAttribute("aria-label", /selected/);
  await page.locator("#sq-e2").click();
  await expect(page.locator("#sq-e2")).not.toHaveAttribute("aria-label", /selected/);
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
  await page.getByRole("radiogroup", { name: "Piece style" }).getByRole("radio", { name: /Studio/ }).click();
  await expect(page.getByRole("radiogroup", { name: "Piece style" }).getByRole("radio", { name: /Studio/ })).toHaveAttribute("aria-checked", "true");
  await page.goto(process.env.QA_URL ?? "http://127.0.0.1:3100");
  // e2 is empty after the earlier e2→e4 drag; check every piece, not the
  // original square. This catches partial theme swaps as well.
  await page.screenshot({ path: `${output}/desktop-studio.png` });
  await expect(page.locator("svg.board-piece")).toHaveCount(32);
  results.push("Studio SVG set selects and persists across navigation");
  await page.goto(`${process.env.QA_URL ?? "http://127.0.0.1:3100"}/settings`);
  await page.getByRole("radiogroup", { name: "Piece style" }).getByRole("radio", { name: /Chess.com · Neo/ }).click();
  await page.goto(process.env.QA_URL ?? "http://127.0.0.1:3100");
  const chesscomPieces = page.locator("img[src^='/pieces/chesscom/']");
  await expect(chesscomPieces).toHaveCount(32);
  await expect.poll(async () => chesscomPieces.evaluateAll((images) => images.filter((img) => img.complete && img.naturalWidth > 0).length), { timeout: 15_000 }).toBe(32);
  await page.screenshot({ path: `${output}/desktop-chesscom-neo.png` });
  results.push("all 32 original Neo piece images load and persisted Chess.com artwork renders");
  await context.close();

  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await touch.addInitScript(() => localStorage.setItem("cbc.settings.v1", JSON.stringify({ sound: false, evalBar: false })));
  const phone = await touch.newPage();
  await phone.goto(process.env.QA_URL ?? "http://127.0.0.1:3100");
  await expect(phone.getByRole("grid")).toBeVisible();
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
  await phone.screenshot({ path: `${output}/phone-after.png` });
  results.push("390px emulated touch pickup, follow and drop; board in lower-middle reach zone");
  await touch.close();
  console.log(`Board feel QA passed: ${results.join("; ")}`);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
  await browser.close();
}
