import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serveSite } from "./site-server.mjs";

const server = process.env.SITE_URL
  ? undefined
  : await serveSite({ base: process.env.SITE_BASE ?? "/Simpludify/", port: 0 });
const base = new URL(process.env.SITE_URL ?? server.url);
const report = {
  site: base.href,
  source: process.env.GITHUB_SHA ?? "manual",
  documents: [],
  viewports: [],
};
let browser;
try {
  for (const path of ["guides/tile-geometry.html", "en/tile-geometry.html"]) {
    const r = await fetch(new URL(path, base));
    assert.equal(r.status, 200);
    assert.ok((await r.text()).includes("GeometryTilemap"));
    report.documents.push(path);
  }
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
    const page = await browser.newPage({ viewport, hasTouch: true });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(new URL("play/tile-geometry/index.html", base).href);
    await page.waitForFunction(
      () => window.geometryDemo?.game.engine.scene.state === "active",
    );
    const shapes = [];
    for (const kind of ["square", "triangle", "pointy", "flat"]) {
      await page.locator("#geometry").selectOption(kind);
      await page.waitForFunction((kind) => {
        const g = window.geometryDemo.terrain.geometry;
        return kind === "square" || kind === "triangle"
          ? g.kind === kind
          : g.kind === "hex" && g.orientation === kind;
      }, kind);
      await page.locator("#reset").click();
      await page.locator('[data-pan="60,0"]').click();
      await page.locator("#zoom-in").click();
      const target = await page.evaluate(() => {
        const { game, terrain } = window.geometryDemo;
        game.setViewport();
        const p = game.worldToScreen(
            terrain.tileToWorld(4, 4, { center: true }),
          ),
          b = game.element.getBoundingClientRect();
        return { x: b.x + p.x, y: b.y + p.y, before: terrain.get(4, 4) };
      });
      if (viewport.width < 500) await page.touchscreen.tap(target.x, target.y);
      else await page.mouse.click(target.x, target.y);
      await page.waitForFunction(
        () =>
          window.geometryDemo.selected?.x === 4 &&
          window.geometryDemo.selected?.y === 4,
      );
      const painted = await page.evaluate(() =>
        window.geometryDemo.terrain.get(4, 4),
      );
      assert.notEqual(painted, target.before);
      // Read actual production Canvas pixels at the selected center after render.
      const pixel = await page.evaluate(() => {
        const { game, terrain } = window.geometryDemo;
        game.setViewport();
        const canvas = game.element.querySelector("canvas"),
          copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        const ctx = copy.getContext("2d");
        ctx.drawImage(canvas, 0, 0);
        const p = game.worldToScreen(
          terrain.tileToWorld(4, 4, { center: true }),
        );
        return [
          ...ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data,
        ].slice(0, 3);
      });
      assert.deepEqual(pixel, [0xea, 0x73, 0x9e]);
      await page.locator("#hide").click();
      assert.equal(
        await page.evaluate(() => window.geometryDemo.terrain.get(4, 4)),
        null,
      );
      await page.locator("#hide").click();
      assert.equal(
        await page.evaluate(() => window.geometryDemo.terrain.get(4, 4)),
        0x55d9d1,
      );
      shapes.push({ kind, painted, pixel });
    }
    await page.locator("#rebuild").click();
    await page.waitForFunction(() => !window.geometryDemo.selected);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.evaluate(() => window.geometryDemo.game.dispose());
    assert.equal(await page.locator("canvas").count(), 0);
    assert.deepEqual(errors, []);
    report.viewports.push({ viewport, shapes, disposed: true, errors });
    await page.close();
  }
  mkdirSync("test-results/site", { recursive: true });
  writeFileSync(
    "test-results/site/tile-geometry-live.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await server?.close();
}
