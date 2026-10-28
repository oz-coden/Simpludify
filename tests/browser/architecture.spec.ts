import { expect, test } from "@playwright/test";

const sdk = `/@fs/${process.cwd()}/packages/web/src/index.ts`;
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
});
test("reconciles dynamic render components and releases removed/pending visuals", async ({
  page,
}) => {
  await page.route("**/delayed.svg", () => {});
  const result = await page.evaluate(async (url) => {
    const { Actor, Game, Transform, Renderable, PixiRenderer } = (await import(
      url
    )) as typeof import("@simpludify/web");
    window.demo.dispose();
    let renderer: InstanceType<typeof PixiRenderer> | undefined;
    const errors: unknown[] = [];
    const game = new Game({
      frames: { request: () => 1, cancel: () => {} },
      renderer: (host) => {
        renderer = new PixiRenderer(host, "#101922", (error) =>
          errors.push(error),
        );
        return renderer;
      },
    });
    await game.run();
    const actor = game.add(new Actor());
    await game.whenReady();
    const invisible = renderer?.diagnostics.visuals;
    actor.add(new Transform({ x: 100, y: 100 }));
    actor.add(new Renderable());
    await game.whenReady();
    const visible = renderer?.diagnostics.visuals;
    actor.remove(Renderable.type);
    await game.whenReady();
    const removed = renderer?.diagnostics.visuals;
    actor.add(
      new Renderable({ source: { kind: "image", url: "./player.svg" } }),
    );
    await game.whenReady();
    const image = renderer?.diagnostics.visuals;
    game.remove(actor);
    await game.whenReady();
    const pending = game.add(new Actor());
    pending.add(new Transform());
    pending.add(
      new Renderable({ source: { kind: "image", url: "./delayed.svg" } }),
    );
    const waiting = game.whenReady();
    await Promise.resolve();
    await Promise.resolve();
    pending.dispose();
    await waiting;
    await game.whenReady();
    const after = renderer?.diagnostics;
    game.dispose();
    const disposed = renderer?.diagnostics;
    return {
      invisible,
      visible,
      removed,
      image,
      after,
      disposed,
      errors: errors.length,
    };
  }, sdk);
  expect(result).toEqual({
    invisible: 0,
    visible: 1,
    removed: 0,
    image: 1,
    after: {
      presentations: 1,
      visuals: 0,
      textures: 0,
      imageReferences: 0,
      imageEntries: 0,
      pendingImages: 0,
    },
    disposed: {
      presentations: 0,
      visuals: 0,
      textures: 0,
      imageReferences: 0,
      imageEntries: 0,
      pendingImages: 0,
    },
    errors: 0,
  });
});
test("reports failed dynamic images without replacing the active scene and permits recovery", async ({
  page,
}) => {
  const result = await page.evaluate(async (url) => {
    const { Game, Character } = (await import(
      url
    )) as typeof import("@simpludify/web");
    window.demo.dispose();
    const errors: string[] = [];
    const game = new Game({
      onError: (error) => errors.push((error as { code: string }).code),
    });
    await game.run();
    const failed = game.add(
      Character({ source: { kind: "image", url: "./missing-dynamic.png" } }),
    );
    let code = "";
    try {
      await game.whenReady();
    } catch (error) {
      code = (error as { code: string }).code;
    }
    const state = game.engine.scene.state;
    failed.dispose();
    await game.whenReady();
    game.add(Character());
    await game.whenReady();
    game.dispose();
    return { code, errors, state };
  }, sdk);
  expect(result).toEqual({
    code: "ASSET_LOAD_FAILED",
    errors: ["ASSET_LOAD_FAILED"],
    state: "active",
  });
});
test("coalesces only pending identical navigation and serializes different requests", async ({
  page,
}) => {
  const result = await page.evaluate(async (url) => {
    const { Game } = (await import(url)) as typeof import("@simpludify/web");
    window.demo.dispose();
    const game = new Game<"slow" | "last">();
    let release: (() => void) | undefined,
      count = 0;
    game.scene("slow", async () => {
      if (++count === 1)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
    });
    game.scene("last", () => {});
    await game.run();
    const first = game.goTo("slow"),
      duplicate = game.goTo("slow"),
      last = game.goTo("last");
    const same = first === duplicate;
    await Promise.resolve();
    release?.();
    await Promise.all([first, duplicate, last]);
    const final = game.engine.scene.id;
    await game.goTo("slow");
    const afterReload = count;
    game.dispose();
    return { same, count: afterReload, final };
  }, sdk);
  expect(result).toEqual({ same: true, count: 2, final: "last" });
});
test("cancels never-resolving setup and queued navigation promptly on dispose", async ({
  page,
}) => {
  const result = await page.evaluate(async (url) => {
    const { Game } = (await import(url)) as typeof import("@simpludify/web");
    window.demo.dispose();
    const game = new Game<"slow" | "queued">();
    let cleaned = 0,
      signal: AbortSignal | undefined;
    game.scene("slow", (context) => {
      signal = context.signal;
      context.onDispose(() => {
        cleaned++;
      });
      return new Promise<void>(() => {});
    });
    game.scene("queued", () => {
      throw new Error("queued setup must not run");
    });
    await game.run();
    const first = game.goTo("slow").catch((error) => error.code),
      queued = game.goTo("queued").catch((error) => error.code);
    await Promise.resolve();
    game.dispose();
    return {
      results: await Promise.all([first, queued]),
      aborted: signal?.aborted,
      cleaned,
    };
  }, sdk);
  expect(result).toEqual({
    results: ["GAME_DISPOSED", "GAME_DISPOSED"],
    aborted: true,
    cleaned: 1,
  });
});
test("preserves committed scenes after lifecycle errors and rejects invalid transitions", async ({
  page,
}) => {
  const result = await page.evaluate(async (url) => {
    const { Game } = (await import(url)) as typeof import("@simpludify/web");
    window.demo.dispose();
    const errors: unknown[] = [];
    const game = new Game<"one" | "two">({
      onError: (error) => errors.push(error),
    });
    game.scene("one", ({ onDeactivate }) => {
      onDeactivate(() => {
        throw new Error("cleanup failure");
      });
    });
    game.scene("two", ({ onActivate }) => {
      onActivate(() => {
        throw new Error("activation failure");
      });
    });
    let before = "";
    try {
      await game.goTo("one");
    } catch (error) {
      before = (error as { code: string }).code;
    }
    await game.run("one");
    await game.goTo("two");
    const active = game.engine.scene.state;
    const id = game.engine.scene.id;
    game.dispose();
    return { before, active, id, reports: errors.length };
  }, sdk);
  expect(result).toEqual({
    before: "GAME_NOT_READY",
    active: "active",
    id: "two",
    reports: 1,
  });
});
test("keeps camera/pointer transforms independent from physical pixel density and viewport offset", async ({
  page,
}) => {
  const result = await page.evaluate(async (url) => {
    const { Game, Character, worldPoint } = (await import(
      url
    )) as typeof import("@simpludify/web");
    window.demo.dispose();
    const game = new Game({
      pixelRatio: 2,
      viewport: { x: 20, y: 30, width: 300, height: 400 },
    });
    game.add(Character());
    await game.run();
    game.camera.x = 100;
    game.camera.y = -50;
    game.camera.zoom = 2;
    const point = worldPoint(500, 175),
      screen = game.worldToScreen(point),
      rect = game.element.getBoundingClientRect();
    const restored = game.pointerToWorld({
      clientX: rect.left + screen.x,
      clientY: rect.top + screen.y,
    });
    const canvas = game.element.querySelector("canvas");
    const ratio = (canvas?.width ?? 0) / game.element.clientWidth;
    game.setViewport({ x: 10, y: 15, width: 200, height: 200 });
    const next = game.worldToScreen(point);
    game.dispose();
    return { restored, screen, next, ratio };
  }, sdk);
  expect(result.restored.x).toBeCloseTo(500, 10);
  expect(result.restored.y).toBeCloseTo(175, 10);
  expect(result.screen).toEqual({ space: "screen", x: 170, y: 230 });
  expect(result.next).toEqual({ space: "screen", x: 110, y: 115 });
  expect(result.ratio).toBe(2);
});
test("uses the new sample game as a real playable scene with scoped listeners", async ({
  page,
}, info) => {
  // Vite can serve another example's HTML through its allowed workspace directory.
  await page.goto(`/@fs/${process.cwd()}/examples/composition/index.html`);
  await expect(
    page.getByRole("heading", { name: "Beacon field" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add beacon", exact: true }).click();
  await page.getByRole("button", { name: "Zoom", exact: true }).click();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByText(/^Beacons collected:/)).toBeVisible();
  const box = await page
    .getByRole("button", { name: "Restart", exact: true })
    .boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
    info.project.use.viewport?.width ?? 0,
  );
  await page.screenshot({ path: info.outputPath("composition.png") });
});

test("rejects startup or navigation disposed inside render without reserving a new frame", async ({
  page,
}) => {
  const result = await page.evaluate(async (url) => {
    const { Game } = (await import(url)) as typeof import("@simpludify/web");
    window.demo.dispose();
    const run = async (transition: boolean) => {
      let pendingFrames = 0;
      const game = new Game<"one" | "two">({
        frames: {
          request: () => {
            pendingFrames++;
            return 1;
          },
          cancel: () => {
            pendingFrames--;
          },
        },
        renderer: () => ({
          init: async () => {},
          resize() {},
          dispose() {},
          prepare: async (scene) => ({
            render() {
              if (!transition || scene.id === "two") game.dispose();
            },
            dispose() {},
          }),
        }),
      });
      game.scene("one", () => {});
      game.scene("two", () => {});
      let code = "";
      try {
        await game.run("one");
        if (transition) await game.goTo("two");
      } catch (error) {
        code = (error as { code: string }).code;
      }
      return { code, pendingFrames, connected: game.element.isConnected };
    };
    return [await run(false), await run(true)];
  }, sdk);
  expect(result).toEqual([
    { code: "GAME_DISPOSED", pendingFrames: 0, connected: false },
    { code: "GAME_DISPOSED", pendingFrames: 0, connected: false },
  ]);
});
