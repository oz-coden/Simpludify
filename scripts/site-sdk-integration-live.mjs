import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { testSDKIntegration } from "./site-sdk-integration-test.mjs";
import { serveSite } from "./site-server.mjs";

const server = process.env.SITE_URL
  ? undefined
  : await serveSite({ base: process.env.SITE_BASE ?? "/Simpludify/", port: 0 });
const base = new URL(process.env.SITE_URL ?? server.url);
const report = {
  site: base.href,
  source: process.env.GITHUB_SHA ?? "manual",
  viewports: [],
};
let browser;
try {
  for (const path of [
    "guides/sdk-integration.html",
    "en/sdk-consumer-patterns.html",
  ]) {
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200);
    assert((await response.text()).includes("bindViewport"));
  }
  const response = await fetch(new URL("site-manifest.json", base));
  assert.equal(response.status, 200);
  assert((await response.json()).examples.includes("sdk-integration"));
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
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL("play/sdk-integration/index.html", base).href);
    await testSDKIntegration(page);
    mkdirSync("test-results/site", { recursive: true });
    await page.screenshot({
      path: `test-results/site/sdk-integration-${viewport.width}.png`,
    });
    const cleanup = await page.evaluate(() => {
      const f = window.integration,
        old = f.current,
        clock = old.scene.presentationTweens;
      f.dispose();
      f.dispose();
      return {
        disposed: f.game.engine.disposed,
        ui: old.ui.disposed,
        active: clock.diagnostics.active,
        hosts: document.querySelectorAll(".simpludify").length,
      };
    });
    assert.deepEqual(cleanup, {
      disposed: true,
      ui: true,
      active: 0,
      hosts: 0,
    });
    assert.deepEqual(errors, []);
    report.viewports.push({ viewport, cleanup, errors });
    await page.close();
  }
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  mkdirSync("test-results/site", { recursive: true });
  writeFileSync(
    "test-results/site/sdk-integration-live.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
  await browser?.close();
  await server?.close();
}
