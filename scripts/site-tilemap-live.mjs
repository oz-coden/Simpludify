import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serveSite } from "./site-server.mjs";

const local = !process.env.SITE_URL;
const server = local
  ? await serveSite({ base: process.env.SITE_BASE ?? "/Simpludify/", port: 0 })
  : undefined;
const base = new URL(process.env.SITE_URL ?? server.url);
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
  for (const route of ["en/tilemap-collision.html", "guides/tilemap.html"]) {
    const response = await fetch(address(route));
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes("rectangles"), route);
    report.documents.push(route);
  }
  browser = await chromium.launch({
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
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(address("play/tilemap/index.html"));
    assert.equal(response.status(), 200);
    const wait = (predicate) =>
      page.waitForFunction(predicate, undefined, {
        polling: 50,
        timeout: 15000,
      });
    await wait(() => window.tilemapDemo?.game.engine.scene.state === "active");
    await page.locator(".simpludify").focus();
    await page.keyboard.down("KeyD");
    await wait(
      () => window.tilemapDemo.game.engine.scene.find("explorer").x === 434,
    );
    const stop = await page.evaluate(() => ({
      x: window.tilemapDemo.game.engine.scene.find("explorer").x,
      camera: window.tilemapDemo.game.camera.x,
      contacts: window.tilemapDemo.world.tileDiagnostics.contacts,
      index: window.tilemapDemo.world.tileIndexDiagnostics,
    }));
    assert.ok(stop.contacts > 0);
    assert.ok(stop.camera > 0);
    assert.equal(stop.index.mode, "rectangles");
    assert.ok(stop.index.regions < stop.index.cells);
    await page.keyboard.down("KeyS");
    await wait(
      () => window.tilemapDemo.game.engine.scene.find("explorer").y > 255,
    );
    await page.keyboard.up("KeyS");
    await page.keyboard.up("KeyD");
    await page.evaluate(() => {
      window.tilemapDemo.game.engine.scene.find("explorer").y = 240;
    });
    const pixel = () =>
      page.evaluate(async () => {
        const { game, terrain } = window.tilemapDemo;
        await game.whenReady();
        game.setViewport();
        const canvas = document.querySelector("canvas"),
          copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        const ctx = copy.getContext("2d");
        ctx.drawImage(canvas, 0, 0);
        const point = game.worldToScreen(
          terrain.tileToWorld(14, 7, { center: true }),
        );
        const ratio = canvas.width / game.element.getBoundingClientRect().width;
        return [
          ...ctx.getImageData(
            Math.round(point.x * ratio),
            Math.round(point.y * ratio),
            1,
            1,
          ).data,
        ].slice(0, 3);
      });
    const closedPixel = await pixel();
    assert.deepEqual(closedPixel, [136, 150, 153]);
    await page
      .getByRole("button", { name: "Toggle door", exact: true })
      .click();
    const openPixel = await pixel();
    assert.deepEqual(openPixel, [55, 99, 74]);
    await page.locator(".simpludify").focus();
    await page.keyboard.down("KeyD");
    await wait(
      () => window.tilemapDemo.game.engine.scene.find("explorer").x > 485,
    );
    await page.keyboard.up("KeyD");
    await page
      .getByRole("button", { name: "Toggle door", exact: true })
      .click();
    assert.deepEqual(await pixel(), [136, 150, 153]);
    const released = await page.evaluate(async () => {
      const { game, world } = window.tilemapDemo;
      await game.goTo("rest");
      return {
        disposed: world.disposed,
        chunks: world.tileIndexDiagnostics.chunks,
        contacts: world.tileDiagnostics.contacts,
        refs: game.renderer.diagnostics.imageReferences,
      };
    });
    assert.deepEqual(released, {
      disposed: true,
      chunks: 0,
      contacts: 0,
      refs: 0,
    });
    await page
      .getByRole("button", { name: "← Return to field", exact: true })
      .click();
    await wait(
      () =>
        window.tilemapDemo.game.engine.scene.state === "active" &&
        !window.tilemapDemo.world.disposed,
    );
    const cleanup = await page.evaluate(() => {
      const { game, world } = window.tilemapDemo;
      game.dispose();
      return {
        disposed: game.engine.disposed,
        chunks: world.tileIndexDiagnostics.chunks,
        sources: game.engine.input.sourceCount,
        hosts: document.querySelectorAll(".simpludify").length,
      };
    });
    assert.deepEqual(cleanup, {
      disposed: true,
      chunks: 0,
      sources: 0,
      hosts: 0,
    });
    assert.deepEqual(errors, []);
    report.viewports.push({
      viewport,
      stop,
      closedPixel,
      openPixel,
      released,
      cleanup,
      errors,
    });
    await page.close();
  }
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  mkdirSync("test-results/site", { recursive: true });
  writeFileSync(
    "test-results/site/tilemap-live.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
  await browser?.close();
  await server?.close();
}
