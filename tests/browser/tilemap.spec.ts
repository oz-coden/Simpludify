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
  });
