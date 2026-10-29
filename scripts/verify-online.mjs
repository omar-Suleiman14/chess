import { ConvexHttpClient } from "convex/browser";
import { chromium, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const env = await readFile(".env.local", "utf8");
const target = env.match(/^NEXT_PUBLIC_CONVEX_URL=["']?([^\s"']+)/m)?.[1];
if (!target || !["127.0.0.1", "localhost"].includes(new URL(target).hostname))
  throw new Error("Online QA only permits an explicitly local backend");
console.log(`Disposable online QA target: ${target}`);
const client = new ConvexHttpClient(target);
const tokens = [
  randomBytes(18).toString("hex"),
  randomBytes(18).toString("hex"),
];
const room = await client.mutation("online:create", {
  token: tokens[0],
  name: "QA White",
  color: "w",
});
await client.mutation("online:join", {
  token: tokens[1],
  name: "QA Black",
  code: room.code,
});
// A real legal opening, so resignation has an actual win/loss result.
await client.mutation("online:move", {
  roomId: room.roomId,
  token: tokens[0],
  uci: "e2e4",
  ply: 0,
});
await client.mutation("online:move", {
  roomId: room.roomId,
  token: tokens[1],
  uci: "e7e5",
  ply: 1,
});
await client.mutation("online:resign", {
  roomId: room.roomId,
  token: tokens[1],
});
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const contexts = await Promise.all(
    tokens.map(async (token) => {
      const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
      });
      await context.addInitScript((token) => {
        localStorage.setItem("cbc.online.token", token);
        localStorage.setItem(
          "cbc.settings.v1",
          JSON.stringify({ sound: false, evalBar: false }),
        );
      }, token);
      return context;
    }),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  for (const page of pages)
    await page.goto(`http://127.0.0.1:3100/play/${room.code}`);
  await expect(
    pages[0].getByRole("dialog", { name: "You won", exact: true }),
  ).toBeVisible();
  await expect(
    pages[1].getByRole("dialog", { name: "You lost", exact: true }),
  ).toBeVisible();
  const request = () =>
    pages[0]
      .getByRole("button", { name: "Request rematch", exact: true })
      .click();
  await request();
  await expect(
    pages[0].getByRole("button", { name: "Rematch requested", exact: true }),
  ).toBeDisabled();
  await pages[1]
    .getByRole("button", { name: "Decline rematch", exact: true })
    .click();
  await expect(
    pages[0].getByRole("status").filter({ hasText: "declined" }),
  ).toBeVisible();
  await request();
  await pages[0]
    .getByRole("button", { name: "Cancel request", exact: true })
    .click();
  await expect(
    pages[1].getByRole("status").filter({ hasText: "cancelled" }),
  ).toBeVisible();
  await request();
  await pages[1]
    .getByRole("button", { name: "Accept rematch", exact: true })
    .click();
  for (const page of pages) {
    await expect(page).not.toHaveURL(new RegExp(`${room.code}$`));
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  expect(new URL(pages[0].url()).pathname).toBe(
    new URL(pages[1].url()).pathname,
  );
  const original = await client.query("online:byCode", {
    code: room.code,
    token: tokens[0],
    now: Date.now(),
  });
  expect(original.status).toBe("finished");
  expect(original.rematchState).toBe("accepted");
  await mkdir(".cache/experience-qa", { recursive: true });
  await pages[0].screenshot({
    path: ".cache/experience-qa/rematch-accepted.png",
  });
  await writeFile(
    ".cache/experience-qa/online-results.json",
    JSON.stringify(
      {
        target,
        date: new Date().toISOString(),
        passed: [
          "real legal move",
          "resignation result",
          "request",
          "duplicate disabled",
          "decline",
          "cancel",
          "accept",
          "both clients follow same new room",
          "original history preserved",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Real local two-browser rematch lifecycle passed.");
} finally {
  await browser.close();
}
