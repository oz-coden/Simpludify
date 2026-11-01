import { expect, test } from "@playwright/test";

const fixtureURL = `/@fs/${process.cwd()}/tests/browser/tile-geometry-fixture.ts`;
for (const fallback of [false, true])
  test.describe(`geometry ${fallback ? "Canvas2D" : "WebGL"}`, () => {
    test.use({ hasTouch: true });
    test.beforeEach(async ({ page }) => {
      if (fallback)
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "gpu", { get: () => undefined });
          for (const p of [
            HTMLCanvasElement.prototype,
            typeof OffscreenCanvas === "undefined"
              ? undefined
              : OffscreenCanvas.prototype,
          ]) {
            if (!p) continue;
            const get = p.getContext;
            p.getContext = function (
              this: HTMLCanvasElement | OffscreenCanvas,
              k: string,
              ...args: unknown[]
            ) {
              return k.includes("webgl")
                ? null
                : Reflect.apply(get, this, [k, ...args]);
            } as typeof p.getContext;
          }
        });
      await page.goto("/");
      await page.waitForFunction(() => !!window.demo);
    });
    test("polygon pixels, layers, updates, culling, transforms, Tween/UI and context cleanup", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          (
            (await import(url)) as typeof import("./tile-geometry-fixture")
          ).polygons(),
        fixtureURL,
      );
      for (const s of r.result) {
        expect(s.red).toEqual([255, 0, 0]);
        expect(s.green).toEqual([0, 255, 0]);
        expect(s.unchanged).toBe(0);
        expect(s.updates).toBe(1);
        expect(s.offscreen).toBe(0);
        expect(s.actorAbove).toEqual([0, 0, 255]);
        expect(s.mapAbove).toEqual([0, 255, 0]);
        expect(s.moved).toEqual([0, 255, 0]);
        expect(s.picked).toMatchObject({ x: 3, y: 3 });
        expect(s.hole).toEqual([0, 0, 0]);
        expect(s.restored).toEqual([0, 0, 255]);
        expect(s.resized).toEqual([0, 0, 255]);
        expect(s.rotation).toBeCloseTo(Math.PI / 2);
        for (const pixel of s.edgeColors)
          expect(Math.max(...pixel)).toBeGreaterThan(40);
        expect(s.diagnostics.graphics).toBeLessThan(2000);
        expect(s.released.maps).toBe(0);
        expect(s.released.graphics).toBe(0);
        expect(s.contextsDestroyed).toBe(true);
      }
      expect(r.hex.center).toEqual([255, 0, 0]);
      expect(r.hex.cutCorner).toEqual([0, 0, 0]);
      expect(r.hex.side).toEqual([255, 0, 0]);
      expect(r.hex.rotated).toEqual([255, 0, 0]);
      expect(r.hex.scaled).toEqual([255, 0, 0]);
      expect(r.hex.outside).toEqual([0, 0, 0]);
      expect(r.hex.changed).toEqual([0, 0, 255]);
      expect(r.hex.alpha[0]).toBeGreaterThanOrEqual(126);
      expect(r.hex.alpha[0]).toBeLessThanOrEqual(129);
      expect(r.uiMounted && r.uiDisposed).toBe(true);
      expect(r.empty.maps).toBe(0);
      expect(r.disposed).toEqual({
        presentations: 0,
        visuals: 0,
        textures: 0,
        imageReferences: 0,
        imageEntries: 0,
        pendingImages: 0,
      });
      expect(r.errors).toEqual([]);
    });
    test("real sample selects and repaints after Camera changes on every tiling", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `/@fs/${process.cwd()}/examples/tile-geometry/index.html`,
      );
      await page.waitForFunction(
        () => window.geometryDemo?.game.engine.scene.state === "active",
      );
      for (const kind of ["square", "triangle", "pointy", "flat"]) {
        await page.locator("#geometry").selectOption(kind);
        await expect
          .poll(() =>
            page.evaluate(() => window.geometryDemo.terrain.geometry.kind),
          )
          .toBe(kind === "pointy" || kind === "flat" ? "hex" : kind);
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
        if (test.info().project.name === "narrow")
          await page.touchscreen.tap(target.x, target.y);
        else await page.mouse.click(target.x, target.y);
        await expect(page.locator("#selection")).toContainText("(4, 4)");
        expect(
          await page.evaluate(() => window.geometryDemo.terrain.get(4, 4)),
        ).not.toBe(target.before);
        await page.locator("#hide").click();
        expect(
          await page.evaluate(() => window.geometryDemo.terrain.get(4, 4)),
        ).toBeNull();
        await page.locator("#hide").click();
        expect(
          await page.evaluate(() => window.geometryDemo.terrain.get(4, 4)),
        ).toBe(0x55d9d1);
      }
      await page.locator("#rebuild").click();
      await expect(page.locator("#selection")).toHaveText("Select a tile.");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/geometry-${fallback ? "canvas" : "webgl"}-${test.info().project.name}.png`,
      });
      await page.evaluate(() => window.geometryDemo.game.dispose());
      expect(await page.locator("canvas").count()).toBe(0);
      expect(errors).toEqual([]);
    });
  });
