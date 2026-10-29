import { expect, test } from "@playwright/test";

const url = `/@fs/${process.cwd()}/tests/browser/tile-collision-fixture.ts`;
for (const fallback of [false, true])
  test.describe(
    fallback ? "terrain collision Canvas2D" : "terrain collision WebGL",
    () => {
      const errors: string[] = [];
      test.beforeEach(async ({ page }) => {
        errors.length = 0;
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
        });
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
      test.afterEach(() => expect(errors).toEqual([]));
      test("draws real stopped pixels, edits terrain, ignores Camera/visibility and releases contacts", async ({
        page,
      }) => {
        const r = await page.evaluate(
          async (url) => (await import(url)).terrainPhysics(),
          url,
        );
        expect(r.stop).toEqual({ x: 248, y: 112 });
        expect(r.hiddenStop).toBe(248);
        expect(r.actorPixel).toEqual([0, 255, 0]);
        expect(r.wallPixel).toEqual([255, 0, 0]);
        expect(r.offscreen.x).toBe(248);
        expect(r.offscreen.candidates).toBeGreaterThan(0);
        expect(r.offscreen.sprites).toBe(0);
        expect(r.policyOnlyVisits).toBe(0);
        expect(r.triggerPassed).toBeGreaterThan(272);
        expect(r.destroyedPassed).toBeGreaterThan(272);
        expect(r.regeneratedStop).toBe(248);
        expect(r.water).toEqual(["trigger"]);
        expect(r.enters).toBeGreaterThan(0);
        expect(r.browserCore.maxError).toBeLessThan(1e-6);
        expect(r.browserCore.final).toEqual({ x: 54, y: 136 });
        expect(r.released).toEqual({
          world: true,
          contacts: 0,
          cells: 0,
          refs: 0,
        });
        expect(r.errors).toEqual([]);
      });
      test("collides before a pending image completes and cleans a removed pending map", async ({
        page,
      }) => {
        const r = await page.evaluate(
          async (url) => (await import(url)).pendingTerrain(),
          url,
        );
        expect(r.during).toEqual({ x: -8, contacts: 1, pending: 1 });
        expect(r).toMatchObject({
          disposed: true,
          retained: 0,
          refs: 0,
          errors: [],
        });
      });
      test("actual Tile trail uses WASD for walls/sliding, editing, Trigger and Scene recreation", async ({
        page,
      }) => {
        await page.evaluate(async (url) => {
          window.demo.dispose();
          await import(url);
        }, `/@fs/${process.cwd()}/examples/tilemap/main.ts`);
        await page.locator(".simpludify").focus();
        await page.keyboard.down("KeyD");
        await expect
          .poll(
            () =>
              page.evaluate(
                () =>
                  (
                    window.tilemapDemo.game.engine.scene.find("explorer") as {
                      x?: number;
                    }
                  )?.x ?? 0,
              ),
            { timeout: 15_000 },
          )
          .toBe(434);
        // Access through public Transform inside the browser module instead of a test-only physics port.
        await page.keyboard.down("KeyS");
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                (
                  window.tilemapDemo.game.engine.scene.find("explorer") as {
                    y?: number;
                  }
                )?.y ?? 0,
            ),
          )
          .toBeGreaterThan(255);
        await page.keyboard.up("KeyS");
        await page.keyboard.up("KeyD");
        await page.evaluate(async (url) => {
          const { Transform } = (await import(
            url
          )) as typeof import("@simpludify/core");
          const { game } = window.tilemapDemo;
          const t = game.engine.scene.find("explorer")?.require(Transform.type);
          if (t) t.y = 240;
        }, `/@fs/${process.cwd()}/packages/core/src/index.ts`);
        const button = page.getByRole("button", { name: "Toggle wall ahead" });
        await button.click();
        expect(
          await page.evaluate(() => window.tilemapDemo.terrain?.get(14, 7)),
        ).toBe("grass");
        await button.click();
        expect(
          await page.evaluate(() => window.tilemapDemo.terrain?.get(14, 7)),
        ).toBe("stone");
        await button.click();
        await page.locator(".simpludify").focus();
        await page.keyboard.down("KeyD");
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                (
                  window.tilemapDemo.game.engine.scene.find("explorer") as {
                    x?: number;
                  }
                )?.x ?? 0,
            ),
          )
          .toBeGreaterThan(485);
        await page.keyboard.up("KeyD");
        await page.evaluate(async (url) => {
          const { Transform } = (await import(
            url
          )) as typeof import("@simpludify/core");
          const t = window.tilemapDemo.game.engine.scene
            .find("explorer")
            ?.require(Transform.type);
          if (t) {
            t.x = 320;
            t.y = 310;
          }
        }, `/@fs/${process.cwd()}/packages/core/src/index.ts`);
        await page.locator(".simpludify").focus();
        await page.keyboard.down("KeyS");
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                (
                  window.tilemapDemo.game.engine.scene.find("explorer") as {
                    y?: number;
                  }
                )?.y ?? 0,
            ),
          )
          .toBeGreaterThan(330);
        await page.keyboard.up("KeyS");
        await expect(
          page.getByText(/Last tile contact: trigger/),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Toggle collision", exact: true })
          .click();
        expect(
          await page.evaluate(() => ({
            enabled: window.tilemapDemo.terrain?.collisionEnabled,
            visible: window.tilemapDemo.terrain?.visible,
          })),
        ).toEqual({ enabled: false, visible: true });
        const old = await page.evaluate(async () => {
          const previous = window.tilemapDemo.world;
          await window.tilemapDemo.game.goTo("rest");
          return {
            disposed: previous?.disposed,
            contacts: previous?.tileDiagnostics.contacts,
            cells: previous?.tileDiagnostics.retainedCells,
          };
        });
        expect(old).toEqual({ disposed: true, contacts: 0, cells: 0 });
        await page.getByRole("button", { name: "← Return to field" }).click();
        expect(
          await page.evaluate(() => window.tilemapDemo.world?.disposed),
        ).toBe(false);
        await page.screenshot({
          path: `test-results/tile-collision-${fallback ? "canvas" : "webgl"}-${test.info().project.name}.png`,
        });
        await page.evaluate(() => window.tilemapDemo.game.dispose());
      });
    },
  );
