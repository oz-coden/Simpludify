import { expect, test } from "@playwright/test";

const fixtureURL = `/@fs/${process.cwd()}/tests/browser/tilemap-fixture.ts`;
const empty = {
  presentations: 0,
  visuals: 0,
  textures: 0,
  imageReferences: 0,
  imageEntries: 0,
  pendingImages: 0,
};
for (const fallback of [false, true])
  test.describe(fallback ? "tilemap Canvas2D" : "tilemap WebGL", () => {
    const errors: string[] = [];
    test.beforeEach(async ({ page }) => {
      errors.length = 0;
      page.on("pageerror", (e) => errors.push(e.message));
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
              ...a: unknown[]
            ) {
              return k.includes("webgl")
                ? null
                : Reflect.apply(get, this, [k, ...a]);
            } as typeof p.getContext;
          }
        });
      await page.goto("/");
      await page.waitForFunction(() => !!window.demo);
    });
    test.afterEach(() => {
      expect(errors).toEqual([]);
    });
    test("pixels, layers, copied data, incremental edits, culling, camera and resize", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          ((await import(url)) as typeof import("./tilemap-fixture")).tiles(),
        fixtureURL,
      );
      expect(r.red).toEqual([255, 0, 0]);
      expect(r.blue).toEqual([0, 0, 255]);
      expect(r.green).toEqual([0, 255, 0]);
      expect(r.edited).toEqual([0, 0, 255]);
      expect(r.moved).toEqual([0, 0, 255]);
      expect(r.empty).toEqual([0, 0, 0]);
      expect(r.resized).toEqual([0, 0, 255]);
      expect(r.unchanged).toBe(0);
      expect(r.offscreen).toBe(0);
      expect(r.visits).toBe(1);
      expect(r.updates).toBe(1);
      expect(r.copied).toBe("blue");
      expect(r.before.sprites).toBeLessThan(1000);
      expect(r.spriteCount).toBeLessThan(5);
      expect(r.loads).toBe(1);
      expect(r.counts.textures).toBe(1);
      expect(r.after).toMatchObject({
        textures: 0,
        imageReferences: 0,
        imageEntries: 0,
      });
      expect(r.tilesAfter.maps).toBe(0);
      expect(r.tilesAfter.sprites).toBe(0);
      expect(r.errors).toEqual([]);
    });
    test("shares overlapping Scenes and releases across empty Scene/recreation", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          (
            (await import(url)) as typeof import("./tilemap-fixture")
          ).lifecycle(),
        fixtureURL,
      );
      expect(r.pixel).toEqual([255, 0, 0]);
      expect(r.oldDisposed).toBe(true);
      expect(r.sharedLoads).toBe(1);
      expect(r.reloaded).toBe(2);
      expect(r.released.imageReferences).toBe(0);
      expect(r.after).toEqual(empty);
      expect(r.tileAfter.maps).toBe(0);
      expect(r.errors).toEqual([]);
    });
    test("cancels pending owners and ignores abandoned late results", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          ((await import(url)) as typeof import("./tilemap-fixture")).pending(),
        fixtureURL,
      );
      expect(r.sharedContinues && r.aborted).toBe(true);
      expect(r.latest).toEqual([0, 0, 255]);
      expect(r.afterLate).toEqual([0, 0, 255]);
      expect(r.disposedError).toBe("GAME_DISPOSED");
      expect(r.after).toEqual(empty);
      expect(r.tileAfter.maps).toBe(0);
      expect(r.errors).toEqual([]);
    });
    test("retains failed runtime frames and rolls back invalid staged maps", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          ((await import(url)) as typeof import("./tilemap-fixture")).bounds(),
        fixtureURL,
      );
      expect(r.error).toBe("SPRITE_FRAME_BOUNDS");
      expect(r.staged).toBe("SPRITE_FRAME_BOUNDS");
      expect(r.retained).toEqual([255, 0, 0]);
      expect(r.recovered).toEqual([0, 0, 255]);
      expect(r.active).toEqual([0, 0, 255]);
      expect(r.references).toBe(1);
      expect(r.after).toEqual(empty);
    });

    test("renders and reconciles both map layers on the same Actor", async ({
      page,
    }) => {
      const result = await page.evaluate(async (url) => {
        const {
          Actor,
          Game,
          GeometryTilemap,
          GeometryTilemapLayer,
          PixiRenderer,
          SpriteSheet,
          TileGeometry,
          Tilemap,
          TilemapLayer,
          worldPoint,
        } = (await import(url)) as typeof import("@simpludify/web");
        window.demo.dispose();
        let renderer!: InstanceType<typeof PixiRenderer>;
        const errors: unknown[] = [];
        const game = new Game({
          pixelRatio: 1,
          frames: { request: () => 1, cancel: () => {} },
          renderer: (host) => {
            renderer = new PixiRenderer(host, "#000000", (error) =>
              errors.push(error),
            );
            return renderer;
          },
        });
        await game.run();
        const actor = game.add(new Actor());
        const sheet = (color: string) =>
          SpriteSheet.grid(
            `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="${color}"/></svg>`)}`,
            { frameWidth: 16, frameHeight: 16 },
          );
        const map = (color: string) =>
          new Tilemap({
            sheet: sheet(color),
            tiles: [[0]],
            tileWidth: 64,
            tileHeight: 64,
            x: 16,
            y: 16,
          });
        const sprite = map("#ff0000"),
          replacement = map("#0000ff");
        const geometry = new GeometryTilemap({
          geometry: TileGeometry.square({ width: 64, height: 64 }),
          tiles: [[0x00ff00]],
          x: 16,
          y: 16,
        });
        const pixel = () => {
          game.setViewport();
          const canvas = game.element.querySelector("canvas");
          if (!canvas) throw new Error("Missing canvas");
          const copy = document.createElement("canvas");
          copy.width = canvas.width;
          copy.height = canvas.height;
          const ctx = copy.getContext("2d");
          if (!ctx) throw new Error("Missing readback context");
          ctx.drawImage(canvas, 0, 0);
          const { x, y } = game.worldToScreen(worldPoint(48, 48));
          return [
            ...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data,
          ].slice(0, 3);
        };
        actor.add(new TilemapLayer(sprite));
        const geometryLayer = actor.add(new GeometryTilemapLayer(geometry));
        await game.whenReady();
        const tied = pixel();
        sprite.zIndex = 1;
        const above = pixel();
        sprite.zIndex = 0;
        geometryLayer.enabled = false;
        const regularOnly = pixel();
        actor.enabled = false;
        const hidden = pixel();
        actor.enabled = true;
        geometryLayer.enabled = true;
        const visuals = (
          renderer as unknown as { tilemaps: ReadonlySet<object> }
        ).tilemaps;
        const before = [...visuals][0];
        actor.remove(TilemapLayer.type);
        actor.add(new TilemapLayer(sprite));
        await game.whenReady();
        const reused = before !== undefined && visuals.has(before);

        const discarded = map("#ffffff");
        actor.remove(TilemapLayer.type);
        actor.add(new TilemapLayer(discarded));
        actor.remove(TilemapLayer.type);
        actor.add(new TilemapLayer(replacement));
        discarded.dispose();
        geometryLayer.dispose();
        await game.whenReady();
        const replaced = pixel();
        const replacedRefs = renderer.diagnostics.imageReferences;
        actor.add(new GeometryTilemapLayer(geometry));
        await game.whenReady();
        const addedBack = pixel();
        geometry.dispose();
        replacement.dispose();
        // A later structural change must not recreate visuals of disposed maps.
        game.add(new Actor());
        await game.whenReady();
        const noLayers = pixel();
        actor.dispose();
        await game.whenReady();
        const remaining = [
          renderer.tilemapDiagnostics.maps,
          renderer.geometryTilemapDiagnostics.maps,
          renderer.diagnostics.imageReferences,
        ];
        game.dispose();
        sprite.dispose();
        return {
          tied,
          above,
          regularOnly,
          hidden,
          reused,
          replaced,
          replacedRefs,
          addedBack,
          noLayers,
          remaining,
          errors: errors.length,
        };
      }, `/@fs/${process.cwd()}/packages/web/src/index.ts`);
      expect(result).toEqual({
        tied: [0, 255, 0],
        above: [255, 0, 0],
        regularOnly: [255, 0, 0],
        hidden: [0, 0, 0],
        reused: true,
        replaced: [0, 0, 255],
        replacedRefs: 1,
        addedBack: [0, 255, 0],
        noLayers: [0, 0, 0],
        remaining: [0, 0, 0],
        errors: 0,
      });
    });

    test("actual tile trail moves camera, edits data and returns through Scenes", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto("/");
      await page.waitForFunction(() => !!window.demo);
      const url = `/@fs/${process.cwd()}/examples/tilemap/main.ts`;
      await page.evaluate(async (url) => {
        window.demo.dispose();
        await import(url);
      }, url);
      await page.locator(".simpludify").focus();
      const start = await page.evaluate(
        () => window.tilemapDemo.game.engine.scene.find("explorer")?.id,
      );
      expect(start).toBe("explorer");
      await page.keyboard.down("KeyD");
      await expect
        .poll(() => page.evaluate(() => window.tilemapDemo.game.camera.x))
        .toBeGreaterThan(5);
      // Keep a physical movement key held across a real sample DOM action.
      const beforeClick = await page.evaluate(
        () =>
          window.tilemapDemo.game.engine
            .snapshot()
            .actors.find((a) => a.id === "explorer")?.transform?.x ?? 0,
      );
      await page.getByRole("button", { name: "Toggle collision" }).click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              window.tilemapDemo.game.engine
                .snapshot()
                .actors.find((a) => a.id === "explorer")?.transform?.x ?? 0,
          ),
        )
        .toBeGreaterThan(beforeClick + 5);
      await page.keyboard.up("KeyD");
      const stopped = await page.evaluate(
        () =>
          window.tilemapDemo.game.engine
            .snapshot()
            .actors.find((a) => a.id === "explorer")?.transform?.x ?? 0,
      );
      // A fresh keydown on the still-focused button also moves, without clicking the world.
      await page.keyboard.down("KeyW");
      const beforeY = await page.evaluate(
        () =>
          window.tilemapDemo.game.engine
            .snapshot()
            .actors.find((a) => a.id === "explorer")?.transform?.y ?? 0,
      );
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              window.tilemapDemo.game.engine
                .snapshot()
                .actors.find((a) => a.id === "explorer")?.transform?.y ?? 0,
          ),
        )
        .toBeLessThan(beforeY - 5);
      await page.keyboard.up("KeyW");
      expect(
        await page.evaluate(
          () =>
            window.tilemapDemo.game.engine
              .snapshot()
              .actors.find((a) => a.id === "explorer")?.transform?.x ?? 0,
        ),
      ).toBe(stopped);
      const previous = await page.evaluate(
        () => window.tilemapDemo.terrain?.revision ?? 0,
      );
      await page.getByRole("button", { name: "Paint under player" }).click();
      expect(
        await page.evaluate(() => window.tilemapDemo.terrain?.revision),
      ).toBe(previous + 1);
      for (let i = 0; i < 3; i++) {
        await page.getByRole("button", { name: "Leave field →" }).click();
        await page.getByRole("button", { name: "← Return to field" }).click();
        await expect(
          page.getByRole("heading", { name: "Tile trail" }),
        ).toBeVisible();
      }
      await page.screenshot({
        path: `test-results/tilemap-sample-${test.info().project.name}.png`,
      });
      await page.evaluate(() => window.tilemapDemo.game.dispose());
      expect(await page.locator("canvas").count()).toBe(0);
      expect(errors).toEqual([]);
    });
  });
