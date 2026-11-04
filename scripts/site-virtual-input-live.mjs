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
  cases: [],
};
let browser;
try {
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
  for (const width of [1440, 390])
    for (const fallback of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(60_000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      if (fallback)
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "gpu", { get: () => undefined });
          for (const proto of [
            HTMLCanvasElement.prototype,
            typeof OffscreenCanvas === "undefined"
              ? undefined
              : OffscreenCanvas.prototype,
          ]) {
            if (!proto) continue;
            const get = proto.getContext;
            proto.getContext = function (kind, ...args) {
              return String(kind).includes("webgl")
                ? null
                : get.call(this, kind, ...args);
            };
          }
        });
      assert.equal(
        (
          await page.goto(new URL("play/virtual-input/index.html", base).href)
        ).status(),
        200,
      );
      await page.waitForFunction(
        () =>
          window.virtualLab?.current &&
          window.virtualLab.game.engine.scene.state === "active",
      );
      const points = await page.evaluate(() => {
        const { game, current: c } = window.virtualLab;
        game.pause();
        c.move.mode = "floating";
        c.aim.mode = "floating";
        const r = game.element.getBoundingClientRect(),
          v = game.viewport;
        const p = (x, y) => ({
          x: r.left + v.x + x * v.width,
          y: r.top + v.y + y * v.height,
        });
        return { move: p(0.22, 0.68), aim: p(0.78, 0.68), fire: p(0.85, 0.25) };
      });
      const touch = await page.context().newCDPSession(page);
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { id: 1, ...points.move },
          { id: 2, ...points.aim },
        ],
      });
      const ids = await page.evaluate(() => [
        window.virtualLab.current.move.pointerId,
        window.virtualLab.current.aim.pointerId,
      ]);
      assert(ids.every((id) => Number.isInteger(id)));
      assert.notEqual(ids[0], ids[1]);
      const crossed = [
        { id: 1, ...points.aim },
        { id: 2, ...points.move },
      ];
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: crossed,
      });
      const state = await page.evaluate(() => {
        const { game, current: c, Actions: a } = window.virtualLab;
        game.engine.step(0);
        return {
          ids: [c.move.pointerId, c.aim.pointerId],
          move: c.controls.value(a.Move),
          aim: c.controls.value(a.Aim),
        };
      });
      assert.deepEqual(state.ids, ids);
      assert(state.move.x > 0.9);
      assert(state.aim.x < -0.9);
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [...crossed, { id: 3, ...points.fire }],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [{ id: 3, ...points.fire }],
      });
      await page.waitForFunction(() => window.virtualLab.current.commits === 1);
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: [],
      });
      await touch.detach();
      const neutral = await page.evaluate(() => {
        const { game, current: c, Actions: a } = window.virtualLab;
        game.engine.step(0);
        return [
          c.controls.value(a.Move),
          c.controls.value(a.Aim),
          c.controls.value(a.Fire),
        ];
      });
      assert.deepEqual(neutral, [{ x: 0, y: 0 }, { x: 0, y: 0 }, false]);
      await page
        .getByRole("button", { name: "Hide input UI", exact: true })
        .press("Enter");
      assert.equal(
        await page.evaluate(() => window.virtualLab.current.virtual.visible),
        false,
      );
      await page.evaluate(() => {
        window.virtualBuiltActor = window.virtualLab.current.actor;
      });
      await page
        .getByRole("button", { name: "Program: off", exact: true })
        .press("Enter");
      const handoff = await page.evaluate(() => {
        const { game, current: c, Actions: a } = window.virtualLab;
        game.engine.step(0);
        return {
          move: c.controls.value(a.Move),
          id: c.actor.id,
          sameActor: c.actor === window.virtualBuiltActor,
        };
      });
      assert.deepEqual(handoff.move, { x: 0.5, y: 0 });
      assert.equal(handoff.sameActor, true);
      const cleanup = await page.evaluate(async () => {
        const { game, current: old } = window.virtualLab;
        await game.goTo("play");
        if (!old.controls.disposed || !old.virtual.disposed)
          throw Error("Old virtual Scene retained");
        game.dispose();
        game.dispose();
        return {
          disposed: game.engine.disposed,
          sources: game.engine.input.sourceCount,
          hosts: document.querySelectorAll(".simpludify").length,
          captures: game.pointerDiagnostics.captures,
        };
      });
      assert.deepEqual(cleanup, {
        disposed: true,
        sources: 0,
        hosts: 0,
        captures: 0,
      });
      assert.deepEqual(errors, []);
      report.cases.push({
        width,
        renderer: fallback ? "canvas2d" : "webgl",
        state,
        neutral,
        handoff,
        cleanup,
        errors,
      });
      await page.close();
    }
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await server?.close();
  mkdirSync("test-results/site", { recursive: true });
  writeFileSync(
    "test-results/site/virtual-input-live.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
