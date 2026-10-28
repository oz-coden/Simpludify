import { expect, test } from "@playwright/test";

const fixtureURL = `/@fs/${process.cwd()}/tests/browser/sprites-fixture.ts`;
const sampleURL = `/@fs/${process.cwd()}/examples/sprites/main.ts`;
const empty = {
  presentations: 0,
  visuals: 0,
  textures: 0,
  imageReferences: 0,
  imageEntries: 0,
  pendingImages: 0,
};
for (const fallback of [false, true])
  test.describe(fallback ? "sprites Canvas2D" : "sprites WebGL", () => {
    const failures: string[] = [];
    test.beforeEach(async ({ page }) => {
      failures.length = 0;
      page.on("pageerror", (error) => failures.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") failures.push(message.text());
      });
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
      await page.goto("/");
      await page.waitForFunction(() => !!window.demo);
    });
    test.afterEach(() => {
      expect(failures).toEqual([]);
    });
    test("crops real pixels, animates independently and frees shared frames at final release", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          ((await import(url)) as typeof import("./sprites-fixture")).pixels(),
        fixtureURL,
      );
      expect(r.red).toEqual([255, 0, 0]);
      expect(r.blue).toEqual([0, 0, 255]);
      expect(r.independent).toEqual([255, 0, 0]);
      expect(r.last).toEqual([255, 0, 255]);
      expect(r.completed).toBe("completed");
      expect(r.rectBlue).toEqual([0, 0, 255]);
      expect(r.rectGreen).toEqual([0, 255, 0]);
      expect(r.contain).toEqual([0, 0, 0]);
      expect(r.stretch).toEqual([0, 0, 255]);
      expect(
        r.sharedFrame &&
          r.sameSprite &&
          r.retainedAppearance &&
          r.alive &&
          r.freed,
      ).toBe(true);
      expect(r.transformed.x).toBe(250);
      expect(r.transformed.rotation).toBeCloseTo(Math.PI / 2);
      expect(r.transformed.scale).toBeCloseTo(1.25);
      expect(r.loads).toBe(1);
      expect(r.errors).toEqual([]);
      expect(r.afterLast).toMatchObject({
        textures: 0,
        imageReferences: 0,
        imageEntries: 0,
      });
      expect(r.disposed).toEqual(empty);
    });
    test("retains displayed frames on invalid bounds and recovers even before first commit", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          ((await import(url)) as typeof import("./sprites-fixture")).invalid(),
        fixtureURL,
      );
      expect(r.error).toBe("SPRITE_FRAME_BOUNDS");
      expect(r.mismatch).toBe("SPRITE_FRAME_BOUNDS");
      expect(r.retained).toEqual([0, 0, 255]);
      expect(r.recovered).toEqual([0, 255, 0]);
      expect(r.stillGreen).toEqual([0, 255, 0]);
      expect(r.initialRecovery).toEqual([0, 0, 255]);
      expect(r.replacementRecovery).toEqual([255, 255, 0]);
      expect(r.disposed).toEqual(empty);
    });
    test("follows latest frames during load and rejects stale results after owner destruction", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          ((await import(url)) as typeof import("./sprites-fixture")).pending(),
        fixtureURL,
      );
      expect(r.sharedContinues && r.cancelled).toBe(true);
      expect(r.latest).toEqual([0, 0, 255]);
      expect(r.current).toEqual([255, 0, 0]);
      expect(r.afterLate).toEqual([255, 0, 0]);
      expect(r.references).toBe(1);
      expect(r.disposedError).toBe("GAME_DISPOSED");
      expect(r.disposed).toEqual(empty);
      expect(r.errors).toEqual([]);
    });
    test("shares staged scenes, stops old playback and reloads safely after a scene without sprites", async ({
      page,
    }) => {
      const r = await page.evaluate(
        async (url) =>
          ((await import(url)) as typeof import("./sprites-fixture")).scenes(),
        fixtureURL,
      );
      expect(r.overlapLoads).toBe(1);
      expect(r.reloaded).toBe(2);
      expect(r.sharedAlive && r.oldStopped && r.released).toBe(true);
      expect(r.blue).toEqual([0, 0, 255]);
      expect(r.green).toEqual([0, 255, 0]);
      expect(r.disposed).toEqual(empty);
      expect(r.errors).toEqual([]);
    });
    test("runs the actual example with WASD, visible frame changes and scene round trips", async ({
      page,
    }) => {
      await page.evaluate(async (url) => {
        window.demo.dispose();
        await import(url);
      }, sampleURL);
      const state = () =>
        page.evaluate(
          async ([sample, fixture]) => {
            const { game } = (await import(
              sample
            )) as typeof import("../../examples/sprites/main");
            return (
              (await import(fixture)) as typeof import("./sprites-fixture")
            ).sampleState(game);
          },
          [sampleURL, fixtureURL] as const,
        );
      expect((await state()).current).toBe("idle");
      await page.locator(".simpludify").focus();
      const x = (await state()).x ?? 0;
      await page.keyboard.down("KeyD");
      await expect.poll(async () => (await state()).current).toBe("walk");
      await expect
        .poll(async () => (await state()).x ?? 0)
        .toBeGreaterThan(x + 20);
      const first = (await state()).frame;
      await expect.poll(async () => (await state()).frame).not.toBe(first);
      await page.keyboard.up("KeyD");
      await expect.poll(async () => (await state()).current).toBe("idle");
      for (let i = 0; i < 3; i++) {
        await page.getByRole("button", { name: "Leave field →" }).click();
        await page.getByRole("button", { name: "← Return to field" }).click();
        await expect.poll(async () => (await state()).actors).toBe(2);
      }
      await page.getByRole("button", { name: "Wave again" }).click();
      await page.evaluate(async (url) => {
        (
          (await import(url)) as typeof import("../../examples/sprites/main")
        ).game.dispose();
      }, sampleURL);
      await expect(page.locator("canvas")).toHaveCount(0);
    });
  });
