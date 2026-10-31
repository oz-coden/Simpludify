import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { testTween } from "./site-tween-test.mjs";

const base = new URL(
  process.env.SITE_URL ?? "https://github.oz-coden.com/Simpludify/",
);
const address = (route) => {
  const url = new URL(route, base);
  url.searchParams.set("ci", process.env.GITHUB_SHA ?? "manual");
  return url.href;
};
const report = {
  site: base.href,
  source: process.env.GITHUB_SHA ?? "manual",
  documents: [],
  viewports: [],
};
let browser;
try {
  const manifestResponse = await fetch(address("site-manifest.json"));
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.ok(manifest.examples.includes("tween"));
  for (const [route, title] of [
    ["en/tween.html", "Tween and animation"],
    ["guides/tween.html", "Tweenとアニメーション"],
  ]) {
    const response = await fetch(address(route));
    assert.equal(response.status, 200, route);
    assert.ok((await response.text()).includes(title), route);
    report.documents.push(route);
  }
  browser = await chromium.launch({
    headless: true,
    args: [
      "--enable-webgl",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  report.browser = browser.version();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(address("play/tween/index.html"));
    assert.equal(response.status(), 200);
    await testTween(page, page);
    const cleanup = await page.evaluate(() => {
      const d = window.tweenDemo;
      const start = performance.now();
      d.game.dispose();
      return {
        disposed: d.game.engine.disposed,
        sources: d.game.engine.input.sourceCount,
        simulation: d.lab.simulation.diagnostics.active,
        display: d.lab.display.diagnostics.active,
        handles: d.lab.handles.size,
        hosts: document.querySelectorAll(".simpludify").length,
        milliseconds: performance.now() - start,
      };
    });
    assert.equal(cleanup.disposed, true);
    for (const key of ["sources", "simulation", "display", "handles", "hosts"])
      assert.equal(cleanup[key], 0);
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
    "test-results/site/tween-live.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
  await browser?.close();
}
