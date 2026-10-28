import { expect, test } from "@playwright/test";

const fixtureURL = `/@fs/${process.cwd()}/tests/browser/shared-images-fixture.ts`;
const empty = {
  presentations: 0,
  visuals: 0,
  textures: 0,
  imageReferences: 0,
  imageEntries: 0,
  pendingImages: 0,
};
for (const fallback of [false, true]) {
  test.describe(fallback ? "shared Canvas2D" : "shared WebGL", () => {
    test.beforeEach(async ({ page }) => {
      if (fallback)
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "gpu", { get: () => undefined });
          for (const prototype of [
            HTMLCanvasElement.prototype,
            typeof OffscreenCanvas === "undefined"
              ? undefined
              : OffscreenCanvas.prototype,
          ]) {
            if (!prototype) continue;
            const get = prototype.getContext;
            prototype.getContext = function (
              this: HTMLCanvasElement | OffscreenCanvas,
              kind: string,
              ...args: unknown[]
            ) {
              return kind.includes("webgl")
                ? null
                : Reflect.apply(get, this, [kind, ...args]);
            } as typeof prototype.getContext;
          }
        });
      await page.route("**/never-shared.svg", () => {});
      await page.route("**/shared-key.svg*", (route) =>
        route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="white"/></svg>',
        }),
      );
      await page.goto("/");
      await page.waitForFunction(() => !!window.demo);
    });
    test("shares 100 images without coupling display state and frees only the final reference", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          (
            (await import(url)) as typeof import("./shared-images-fixture")
          ).hundred(),
        fixtureURL,
      );
      expect(r.before).toMatchObject({
        visuals: 100,
        textures: 1,
        imageReferences: 100,
        imageEntries: 1,
        pendingImages: 0,
      });
      expect(r.uniqueTextures).toBe(1);
      expect(r.uniqueSources).toBe(1);
      expect(r.red).toEqual([255, 0, 0]);
      for (const pixel of [
        r.blue,
        r.independent,
        r.otherAfterReplace,
        r.survivor,
      ])
        expect(pixel).toEqual([0, 0, 255]);
      expect(r.replaced).toEqual([0, 255, 255]);
      expect(r.sharedAfterShape).toBe(1);
      expect(r.aliveAfterOne).toBe(true);
      expect(r.hiddenHeld).toBe(1);
      expect(r.released).toBe(true);
      expect(r.afterLast).toMatchObject({
        textures: 0,
        imageReferences: 0,
        imageEntries: 0,
        pendingImages: 0,
      });
      expect(r.reloaded).toBe(3);
      expect(r.disposed).toEqual(empty);
    });
    test("separates pending consumer cancellation from the shared non-abortable loader", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          (
            (await import(url)) as typeof import("./shared-images-fixture")
          ).pending(),
        fixtureURL,
      );
      expect(r.during).toMatchObject({
        imageReferences: 2,
        imageEntries: 1,
        pendingImages: 1,
      });
      expect(r.oneCancelled && r.lastCancelled).toBe(true);
      expect(r.survivor).toEqual([0, 255, 0]);
      expect(r.latest).toEqual([0, 0, 255]);
      expect(r.afterLate).toEqual([0, 0, 255]);
      expect(r.counts).toMatchObject({
        textures: 1,
        imageReferences: 1,
        imageEntries: 1,
        pendingImages: 0,
      });
      expect(r.disposed).toEqual(empty);
    });
    test("shares across overlapping scene preparation and retains the active scene on failure", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          (
            (await import(url)) as typeof import("./shared-images-fixture")
          ).scenes(),
        fixtureURL,
      );
      expect(r.sameTexture && r.textureAlive).toBe(true);
      expect(r.loadsAfterTransition).toBe(1);
      expect(r.stagedReferences).toBeGreaterThanOrEqual(3);
      expect(r.failure).toBe("ASSET_LOAD_FAILED");
      expect(r.success).toEqual([0, 255, 255]);
      expect(r.retained).toEqual([0, 255, 255]);
      expect(r.afterFailure).toMatchObject({
        presentations: 1,
        textures: 1,
        imageReferences: 1,
        imageEntries: 1,
        pendingImages: 0,
      });
      expect(r.disposed).toEqual(empty);
    });
    test("keeps separate Game renderer resources independent", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          (
            (await import(url)) as typeof import("./shared-images-fixture")
          ).independentGames(),
        fixtureURL,
      );
      expect(r.independent && r.alive).toBe(true);
      expect(r.survivor).toEqual([255, 255, 0]);
      for (const counts of r.before)
        expect(counts).toMatchObject({
          textures: 1,
          imageReferences: 1,
          imageEntries: 1,
        });
      expect(r.disposed).toEqual([empty, empty]);
    });
    test("resolves equivalent URLs, keeps query/fragment distinct, and evicts failures without automatic retries", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          (
            (await import(url)) as typeof import("./shared-images-fixture")
          ).keysAndFailures(),
        fixtureURL,
      );
      expect(r.keyLoads).toBe(3);
      expect(r.keyCounts).toMatchObject({
        textures: 3,
        imageEntries: 3,
        imageReferences: 4,
      });
      expect(r.failures).toEqual(["ASSET_LOAD_FAILED", "ASSET_LOAD_FAILED"]);
      expect(r.failedCounts).toMatchObject({
        textures: 0,
        imageEntries: 0,
        imageReferences: 0,
        pendingImages: 0,
      });
      expect(r.noRetry && r.retried).toBe(true);
      expect(r.recovered).toEqual([255, 0, 0]);
      expect(r.oldRetained).toEqual([255, 0, 0]);
      expect(r.recoveredCounts).toMatchObject({
        textures: 1,
        imageReferences: 2,
        imageEntries: 1,
      });
      expect(r.disposed).toEqual(empty);
    });
  });
}
