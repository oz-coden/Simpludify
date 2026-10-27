import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { examples, pages } from "../site/config.mjs";
import { serveSite } from "./site-server.mjs";

const { base } = JSON.parse(
  readFileSync("site-dist/site-manifest.json", "utf8"),
);
const remote = process.env.SITE_URL;
const server = remote ? undefined : await serveSite({ base, port: 0 });
const site = (remote ?? server.url).replace(/\/?$/, "/");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: [
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const results = [];
mkdirSync("test-results/site", { recursive: true });
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport, hasTouch: true });
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400)
        failures.push(`${response.status()} ${response.url()}`);
    });
    page.on("requestfailed", (request) => {
      if (request.failure()?.errorText !== "net::ERR_ABORTED")
        failures.push(`${request.failure()?.errorText} ${request.url()}`);
    });
    for (const item of pages) {
      const response = await page.goto(site + item.route);
      assert.equal(response.status(), 200, item.route);
      await page.locator("article h1").waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        true,
        `overflow ${item.route} ${viewport.width}`,
      );
      if (item.route === "index.html")
        await page.screenshot({
          path: `test-results/site/home-${viewport.width}.png`,
          fullPage: true,
        });
    }
    await page.goto(site);
    if (viewport.width < 760) {
      await page.getByRole("button", { name: "目次", exact: true }).click();
      await page
        .locator("#sidebar")
        .getByRole("link", { name: "導入と最初のゲーム", exact: true })
        .click();
      await page.waitForURL("**/getting-started.html");
    }
    await page.getByRole("button", { name: "テーマを切り替える" }).click();
    const selected = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    await page.reload();
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.theme),
      selected,
    );
    await page.goto(site + "examples.html");
    for (const example of examples) {
      const launch = page.locator(`[data-launch="${example.id}"]`);
      await launch.click();
      const element = await page.locator("iframe").elementHandle();
      const frame = await element.contentFrame();
      await frame.waitForSelector("canvas");
      if (example.id === "signal-run") {
        await frame
          .getByRole("button", { name: "Start run", exact: true })
          .click();
        await frame.waitForFunction(() => !!window.signalRun?.round);
        const x = await frame.evaluate(() => window.signalRun.round.player.x);
        const right = frame.getByRole("button", { name: "Right", exact: true });
        const box = await right.boundingBox();
        assert(box);
        const touch = await context.newCDPSession(page);
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { x: box.x + box.width / 2, y: box.y + box.height / 2 },
          ],
        });
        await frame.waitForFunction(
          (before) => window.signalRun.round.player.x > before + 5,
          x,
        );
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await touch.detach();
        await frame.getByRole("button", { name: "Pause", exact: true }).click();
        assert.equal(
          await frame.evaluate(() => window.signalRun.game.paused),
          true,
        );
        await frame
          .getByRole("button", { name: "Resume", exact: true })
          .click();
        await frame
          .getByRole("button", { name: "Restart", exact: true })
          .click();
        await frame.waitForFunction(
          () => window.signalRun.round?.snapshot().score === 0,
        );
      } else {
        if (example.id === "ui-scenes") {
          await frame
            .getByRole("button", { name: "Visit the studio →" })
            .click();
          await frame.getByText("The studio", { exact: true }).waitFor();
        }
        if (example.id === "composition")
          await frame
            .getByRole("button", { name: "Add beacon", exact: true })
            .click();
        await frame.locator("canvas").click({ position: { x: 50, y: 450 } });
        const before = await frame.evaluate(() =>
          document.querySelector("canvas").toDataURL(),
        );
        await page.keyboard.down("KeyD");
        await frame.waitForFunction(
          (image) => document.querySelector("canvas").toDataURL() !== image,
          before,
        );
        await page.keyboard.up("KeyD");
      }
      assert.equal(await page.locator("iframe").count(), 1);
      // Retain the old Game through a closure and verify explicit disposal before detach.
      const disposal = await frame.evaluateHandle(() => {
        const game = window.signalRun?.game ?? window.demo;
        window.__sitePreviousGame = game;
        return game;
      });
      if (example.id === "signal-run")
        await page.screenshot({
          path: `test-results/site/gallery-${viewport.width}.png`,
          fullPage: true,
        });
      await page.locator("[data-restart]").click();
      await page.frameLocator("iframe").locator("canvas").waitFor();
      // Frame removal destroys its JS execution context. The in-document host cleanup is
      // separately asserted below before removing the live replacement frame.
      await disposal.dispose();
      const currentFrame = await (
        await page.locator("iframe").elementHandle()
      ).contentFrame();
      const cleaned = await currentFrame.evaluate(() => {
        const game = window.signalRun?.game ?? window.demo;
        window.dispatchEvent(new Event("simpludify:dispose"));
        return {
          hosts: document.querySelectorAll(".simpludify").length,
          disposed: game?.engine.disposed ?? true,
          sources: game?.engine.input.sourceCount ?? 0,
        };
      });
      assert.deepEqual(cleaned, { hosts: 0, disposed: true, sources: 0 });
      await page.locator("[data-stop]").click();
      assert.equal(await page.locator("iframe").count(), 0);
      assert.equal(
        await launch.evaluate((button) => button === document.activeElement),
        true,
      );
    }
    assert.deepEqual(failures, []);
    results.push({
      viewport,
      pages: pages.length,
      samples: examples.length,
      keyboard: true,
      syntheticTouch: true,
      theme: true,
      disposal: true,
      failures,
    });
    await context.close();
  }
  // Force renderer initialization failure to check the user-facing fallback.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (String(kind).startsWith("webgl")) return null;
      return get.call(this, kind, ...args);
    };
  });
  await page.goto(site + "play/character/index.html");
  await page
    .getByRole("heading", {
      name: "サンプルを起動できませんでした / Unable to start",
    })
    .waitFor();
  assert.equal(await page.locator(".simpludify").count(), 0);
  await context.close();
  const report = {
    site,
    served: remote ? "published" : "local",
    browser: browser.version(),
    results,
    startupFailureFallback: true,
  };
  writeFileSync(
    "test-results/site/result.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await server?.close();
}
