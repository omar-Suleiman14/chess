// Real Chromium checks against the local guest build. No account credentials.
import { chromium, firefox, webkit, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.QA_URL ?? "http://127.0.0.1:3100";
const browserName = process.env.QA_BROWSER ?? "chromium";
const directory =
  browserName === "chromium"
    ? ".cache/experience-qa"
    : `.cache/experience-qa/${browserName}`;
await mkdir(directory, { recursive: true });
const browser = await { chromium, firefox, webkit }[browserName].launch({
  ...(browserName === "chromium"
    ? { executablePath: process.env.CHROME_PATH ?? "/usr/bin/chromium" }
    : {}),
  args: browserName === "chromium" ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
  proxy: process.env.HTTPS_PROXY
    ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" }
    : undefined,
});
const results = [];
try {
  // Stored retired designs must open as Classic.
  for (const appearance of ["classic", "expressive", "glass"])
    for (const colorMode of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
      });
      await context.addInitScript(
        ({ appearance, colorMode }) => {
          if (!localStorage.getItem("cbc.settings.v1"))
            localStorage.setItem(
              "cbc.settings.v1",
              JSON.stringify({
                sound: false,
                evalBar: false,
                experience: { appearance, colorMode },
              }),
            );
        },
        { appearance, colorMode },
      );
      const page = await context.newPage();
      const errors = [];
      const externalDiagnostics = [];
      page.on("pageerror", (error) => {
        if (/\.client\.protect\.clerk\.com.*\/probe due to access control checks\.$/.test(error.message)) externalDiagnostics.push(error.message);
        else errors.push(error.message);
      });
      await page.goto(base);
      await expect(page.getByRole("grid")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute(
        "data-appearance",
        "classic",
      );
      await expect(page.locator("html")).toHaveAttribute(
        "data-tone",
        colorMode,
      );
      await page.locator("#sq-e2").click();
      await page.locator("#sq-e4").click();
      await expect(page.locator("#sq-e4")).toHaveAttribute(
        "aria-label",
        /white pawn/,
      );
      await page.getByRole("button", { name: "Friends", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Friends", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      if (!await page.getByRole("button", { name: "Resign", exact: true }).isVisible()) await page.getByRole("button", { name: "Game options", exact: true }).click();
      await page.getByRole("button", { name: "Resign", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Resign", exact: true })
        .click();
      const result = page.getByRole("dialog");
      await expect(result).toBeVisible();
      await expect(
        result.getByRole("button", { name: "Play again", exact: true }),
      ).toBeVisible();
      await expect(result.getByRole("heading")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(result).toBeVisible();
      await page.keyboard.press("Shift+Tab");
      await expect(result.getByRole("button", { name: "Back to board", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(result.getByRole("button", { name: "Close result", exact: true })).toBeFocused();
      await expect(result.locator("..")).toHaveCSS("opacity", "1");
      await page.screenshot({
        path: `${directory}/${appearance}-${colorMode}-result.png`,
      });
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Show game result" }).click();
      await expect(result).toBeVisible();
      await result
        .getByRole("button", { name: "Play again", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator("#sq-e2")).toHaveAttribute(
        "aria-label",
        /white pawn/,
      );
      for (const width of [320, 390, 768, 1920]) {
        await page.setViewportSize({ width, height: width < 768 ? 740 : 900 });
        await expect(page.getByRole("grid")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
      }
      await page.goto(`${base}/settings`);
      await expect(
        page.getByRole("heading", { name: "Appearance" }),
      ).toBeVisible();
      await expect(page.locator("[data-ambient-renderer]")).toHaveCount(0);
      // Only Classic exists: no design picker remains.
      await expect(page.getByRole("radio", { name: /Material 3 Expressive|Liquid Glass/ })).toHaveCount(0);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute(
        "data-appearance",
        "classic",
      );

      // One switch turns the live background on; it renders only behind games.
      await page.getByRole("switch", { name: "Live background" }).click();
      await expect(page.locator("[data-ambient-renderer]")).toHaveCount(0);
      await page.goto(base);
      await expect(page.locator("[data-ambient-renderer] canvas")).toHaveCount(1);
      await expect.poll(() => page.locator("[data-ambient-renderer] canvas").evaluate((canvas) => canvas.width > 0)).toBe(true);
      await page.goto(`${base}/settings`);
      await expect(page.locator("[data-ambient-renderer]")).toHaveCount(0);
      if (errors.length) process.exitCode = 1;
      results.push({
        appearance,
        colorMode,
        passed: true,
        externalDiagnostics,
        appErrors: errors,
        widths: [320, 390, 768, 1920],
      });
      await context.close();
      console.log(`Passed ${appearance} / ${colorMode}`);
    }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.addInitScript(() => {
    if (!localStorage.getItem("cbc.settings.v1"))
      localStorage.setItem(
        "cbc.settings.v1",
        JSON.stringify({ sound: false, evalBar: false }),
      );
  });
  const page = await context.newPage();
  await page.goto(`${base}/time-machine`);
  await page.getByText("Import PGN", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "PGN text" })
    .fill('[White "Ada"]\n[Black "Omar"]\n\n1. e4 e5 (1... c5) 2. Nf3 Nc6 *');
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Game explorer" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(Play|Pause|Playback speed)/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("table", { name: "Moves", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Ada", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "First position", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Previous move", exact: true }),
  ).toBeDisabled();
  await page.getByRole("region", { name: "Game explorer" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: "Move 1 · White played e4" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore from this position", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: "Move 1 · White played e4" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${directory}/time-machine-mobile.png` });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${directory}/time-machine-desktop.png` });
  await page.getByRole("button", { name: "c5", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Move 1 · White played e4" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Move 1 · Black played c5" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Move 1 · Black played c5" }),
  ).toBeVisible();
  results.push({
    feature: "time-machine",
    passed: true,
    checks: [
      "manual navigation",
      "row table",
      "PGN names",
      "no autoplay controls",
      "scoped keyboard",
      "branch confirmation",
    ],
  });
  await context.close();
} finally {
  await writeFile(
    `${directory}/results.json`,
    JSON.stringify(
      { date: new Date().toISOString(), browser: browser.version(), results },
      null,
      2,
    ),
  );
  await browser.close();
}
