import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { languagePairs } from "../site/config.mjs";
import { serveSite } from "./site-server.mjs";

const server = process.env.SITE_URL
  ? undefined
  : await serveSite({ base: process.env.SITE_BASE ?? "/Simpludify/", port: 0 });
const base = new URL(process.env.SITE_URL ?? server.url);
const report = {
  site: base.href,
  source: process.env.GITHUB_SHA ?? "manual",
  cases: [],
};
let browser;
try {
  for (const pair of languagePairs) {
    for (const [i, route] of pair.entries()) {
      const response = await fetch(new URL(route, base));
      assert.equal(response.status, 200, route);
      assert(
        (await response.text()).includes(
          `data-language-link href="${base.pathname}${pair[1 - i]}"`,
        ),
        route,
      );
    }
  }
  const manifest = await (
    await fetch(new URL("site-manifest.json", base))
  ).json();
  assert(manifest.examples.includes("unified-input"));
  browser = await chromium.launch({
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
  for (const width of [1440, 390]) {
    for (const fallback of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(60_000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript((fallback) => {
        if (fallback) {
          Object.defineProperty(navigator, "gpu", { get: () => undefined });
          for (const prototype of [
            HTMLCanvasElement.prototype,
            typeof OffscreenCanvas === "undefined"
              ? undefined
              : OffscreenCanvas.prototype,
          ]) {
            if (!prototype) continue;
            const get = prototype.getContext;
            prototype.getContext = function (kind, ...args) {
              return String(kind).includes("webgl")
                ? null
                : get.call(this, kind, ...args);
            };
          }
        }
        window.mockPads = [0, 1].map((index) => ({
          index,
          id: `Mock pad ${index}`,
          connected: true,
          mapping: "standard",
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({
            value: 0,
            pressed: false,
          })),
        }));
        Object.defineProperty(navigator, "getGamepads", {
          value: () => window.mockPads,
        });
      }, fallback);
      await page.goto(new URL("play/unified-input/index.html", base).href);
      await page
        .getByRole("heading", { name: "Unified input · 2 players" })
        .waitFor();
      await page.locator(".simpludify").focus();
      const result = await page.evaluate(() => {
        const { game, players, Actions } = window.inputLab;
        const [a, b] = players;
        game.engine.step(0);
        window.mockPads[0].axes[0] = 1;
        window.mockPads[1].axes[1] = -1;
        game.engine.step(0);
        const pads = players.map((p) => p.controls.value(Actions.Move));
        const actor = a.actor;
        a.setMode("Program");
        a.program.set(Actions.Move, { x: -0.5, y: 0 });
        game.engine.step(0);
        const handoff = {
          sameActor: a.actor === actor,
          move: a.controls.value(Actions.Move),
          other: b.controls.value(Actions.Move),
        };
        game.pause();
        game.engine.step(0);
        const reset = players.map((p) => p.controls.value(Actions.Move));
        return {
          pads,
          handoff,
          reset,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      assert.deepEqual(result.pads, [
        { x: 1, y: 0 },
        { x: 0, y: -1 },
      ]);
      assert.equal(result.handoff.sameActor, true);
      assert.deepEqual(result.handoff.move, { x: -0.5, y: 0 });
      assert.deepEqual(result.handoff.other, { x: 0, y: -1 });
      assert.deepEqual(result.reset, [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]);
      assert.equal(result.overflow, false);
      await page.evaluate(() => {
        window.retiredPlayers = window.inputLab.players.slice();
      });
      await page
        .getByRole("button", { name: "New Scene", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          window.inputLab.game.engine.scene.state === "active" &&
          window.retiredPlayers.every((p) => p.controls.disposed),
      );
      const cleanup = await page.evaluate(() => {
        const { game } = window.inputLab;
        game.dispose();
        game.dispose();
        return {
          disposed: game.engine.disposed,
          sources: game.engine.input.sourceCount,
          hosts: document.querySelectorAll(".simpludify").length,
        };
      });
      assert.deepEqual(cleanup, { disposed: true, sources: 0, hosts: 0 });
      assert.deepEqual(errors, []);
      report.cases.push({
        width,
        renderer: fallback ? "canvas2d" : "webgl",
        ...result,
        cleanup,
        errors,
      });
      await page.close();
    }
  }
  mkdirSync("test-results/site", { recursive: true });
  writeFileSync(
    "test-results/site/unified-input-live.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await server?.close();
}
