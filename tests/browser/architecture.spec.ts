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
    const mapActor = game.add(new Actor());
    const {
      Grid,
      SpriteSheet,
      TileGeometry,
      Tilemap,
      GeometryTilemap,
      TilemapLayer,
      GeometryTilemapLayer,
    } = (await import(url)) as typeof import("@simpludify/web");
    const sheet = SpriteSheet.grid("./player.svg", {
      frameWidth: 16,
      frameHeight: 16,
    });
    const map1 = new Tilemap({
      sheet,
      tiles: new Grid(1, 1, 0),
      tileWidth: 16,
      tileHeight: 16,
    });
    const map2 = new Tilemap({
      sheet,
      tiles: new Grid(1, 1, 0),
      tileWidth: 16,
      tileHeight: 16,
    });
    const gmap = new GeometryTilemap({
      geometry: TileGeometry.square({ width: 16, height: 16 }),
      tiles: [[0xff0000]],
    });
    mapActor.add(new TilemapLayer(map1));
    mapActor.add(new GeometryTilemapLayer(gmap));
    await game.whenReady();
    mapActor.remove(TilemapLayer.type);
    mapActor.add(new TilemapLayer(map2));
    await game.whenReady();
    const mapsCount =
      (renderer?.tilemapDiagnostics.maps ?? 0) +
      (renderer?.geometryTilemapDiagnostics.maps ?? 0);
    mapActor.dispose();
    gmap.dispose();
    await game.whenReady();
    game.dispose();
    const disposed = renderer?.diagnostics;
    return {
      invisible,
      visible,
      removed,
      image,
      after,
      mapsCount,
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
    mapsCount: 2,
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
    const game = new Game<"slow" | "last" | "restart">();
    let release: (() => void) | undefined,
      count = 0,
      restarts = 0;
    let restarted: Promise<void> | undefined;
    game.scene("slow", async () => {
      if (++count === 1)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
    });
    game.scene("last", () => {});
    game.scene("restart", ({ onActivate }) => {
      if (++restarts === 1)
        onActivate(() => {
          restarted = game.changeScene("restart");
        });
    });
    const invalidSceneId = (() => {
      try {
        game.scene("" as never, () => {});
        return "none";
      } catch (error) {
        return (error as { code: string }).code;
      }
    })();
    const invalidSetup = (() => {
      try {
        game.scene("bad" as never, null as never);
        return "none";
      } catch (error) {
        return (error as { code: string }).code;
      }
    })();
    await game.run();
    const first = game.changeScene("slow"),
      duplicate = game.changeScene("slow"),
      last = game.changeScene("last"),
      backToSlow = game.changeScene("slow");
    const same = first === duplicate,
      queuedAfterIntervening = backToSlow !== first;
    await Promise.resolve();
    release?.();
    await Promise.all([first, duplicate, last, backToSlow]);
    const final = game.engine.scene.id;
    await game.changeScene("slow");
    const afterReload = count;
    const initial = game.changeScene("restart");
    await initial;
    const independentRestart = restarted !== undefined && restarted !== initial;
    await restarted;
    game.dispose();
    return {
      same,
      queuedAfterIntervening,
      count: afterReload,
      final,
      restarts,
      independentRestart,
      invalidSceneId,
      invalidSetup,
    };
  }, sdk);
  expect(result).toEqual({
    same: true,
    queuedAfterIntervening: true,
    count: 3,
    final: "slow",
    restarts: 2,
    independentRestart: true,
    invalidSceneId: "INVALID_VALUE",
    invalidSetup: "INVALID_VALUE",
  });
});
test("settles queued transitions in order after staged setup rejects", async ({
  page,
}) => {
  const result = await page.evaluate(async (url) => {
    const { Action, defineActions, Game } = (await import(
      url
    )) as typeof import("@simpludify/web");
    window.demo.dispose();
    const game = new Game<"a" | "b" | "c">();
    const actions = defineActions({ Jump: Action.button() });
    const timeline: string[] = [];
    const signals: AbortSignal[] = [];
    let rejectSetup: (error: Error) => void = () => {};
    let bCount = 0;
    for (const id of ["a", "b", "c"] as const) {
      game.scene(id, ({ signal, onActivate, onDispose, actions: bind }) => {
        signals.push(signal);
        bind(actions).createSource();
        onActivate(() => {
          timeline.push(`activate:${id}`);
        });
        onDispose(() => {
          timeline.push(`dispose:${id}`);
        });
        if (id === "b" && ++bCount === 1)
          return new Promise<void>((_, reject) => {
            rejectSetup = reject;
          });
      });
    }
    await game.run("a");
    const initial = game.engine.scene;
    const failed = game.changeScene("b").then(
      () => "unexpected success",
      (error: Error) => {
        timeline.push(`reject:${error.message}`);
        return error.message;
      },
    );
    await Promise.resolve();
    const during = game.engine.scene === initial;
    const next = game.changeScene("c");
    const back = game.changeScene("b");
    const last = game.changeScene("a");
    const duplicate = game.changeScene("a") === last;
    const outcomes = [
      failed,
      ...[next, back, last].map((task, index) =>
        task.then(() => {
          timeline.push(`resolve:${index}`);
          return "ok";
        }),
      ),
    ];
    rejectSetup(new Error("setup failed"));
    const results = await Promise.all(outcomes);
    const current = game.engine.scene;
    const fresh = current.id === "a" && current !== initial && initial.disposed;
    const beforeDispose = signals.map((signal) => signal.aborted);
    game.dispose();
    return {
      during,
      duplicate,
      fresh,
      beforeDispose,
      results,
      timeline,
      afterDispose: signals.every((signal) => signal.aborted),
      sources: game.engine.input.sourceCount,
    };
  }, sdk);
  expect(result).toEqual({
    during: true,
    duplicate: true,
    fresh: true,
    beforeDispose: [true, true, true, true, false],
    results: ["setup failed", "ok", "ok", "ok"],
    timeline: [
      "activate:a",
      "dispose:b",
      "reject:setup failed",
      "dispose:a",
      "activate:c",
      "resolve:0",
      "dispose:c",
      "activate:b",
      "resolve:1",
      "dispose:b",
      "activate:a",
      "resolve:2",
      "dispose:a",
    ],
    afterDispose: true,
    sources: 0,
  });
});

test("cleans both presentations after committed installation and render failures", async ({
  page,
}) => {
  const results = await page.evaluate(async (url) => {
    const { Game } = (await import(url)) as typeof import("@simpludify/web");
    window.demo.dispose();
    const fail = async (phase: "install" | "render") => {
      const disposed: string[] = [];
      const game = new Game<"one" | "broken" | "queued">({
        frames: { request: () => 1, cancel: () => {} },
        renderer: () => ({
          init: async () => {},
          prepare: async (scene) => ({
            render: () => {
              if (phase === "render" && scene.id === "broken")
                throw new Error("render failed");
            },
            dispose: () => {
              disposed.push(scene.id);
            },
          }),
          resize: () => {},
          dispose: () => {
            disposed.push("renderer");
          },
        }),
      });
      game.scene("one", () => {});
      game.scene("broken", () => {});
      game.scene("queued", () => {
        throw new Error("queued setup ran");
      });
      await game.run("one");
      if (phase === "install")
        game.element.append = () => {
          throw new Error("install failed");
        };
      const failed = game
        .changeScene("broken")
        .catch((error: Error) => error.message);
      const queued = game
        .changeScene("queued")
        .catch((error: { code?: string }) => error.code);
      const outcomes = await Promise.all([failed, queued]);
      return {
        outcomes,
        disposed,
        engineDisposed: game.engine.disposed,
        connected: game.element.isConnected,
      };
    };
    return [await fail("install"), await fail("render")];
  }, sdk);
  expect(results).toEqual(
    ["install", "render"].map((phase) => ({
      outcomes: [`${phase} failed`, "GAME_DISPOSED"],
      disposed: ["one", "broken", "renderer"],
      engineDisposed: true,
      connected: false,
    })),
  );
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
    const first = game.changeScene("slow").catch((error) => error.code),
      queued = game.changeScene("queued").catch((error) => error.code);
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
test("observes a rejected setup even when the factory disposes the Game", async ({
  page,
}) => {
  const result = await page.evaluate(async (url) => {
    const { Game } = (await import(url)) as typeof import("@simpludify/web");
    window.demo.dispose();
    const unhandled: string[] = [];
    window.addEventListener("unhandledrejection", (event) => {
      unhandled.push(String(event.reason));
      event.preventDefault();
    });
    const game = new Game<"stop">();
    game.scene("stop", async () => {
      game.dispose();
      throw new Error("late setup rejection");
    });
    await game.run();
    const code = await game
      .changeScene("stop")
      .catch((error: { code: string }) => error.code);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    return { code, unhandled, disposed: game.engine.disposed };
  }, sdk);
  expect(result).toEqual({
    code: "GAME_DISPOSED",
    unhandled: [],
    disposed: true,
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
      await game.changeScene("one");
    } catch (error) {
      before = (error as { code: string }).code;
    }
    await game.run("one");
    await game.changeScene("two");
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
        if (transition) await game.changeScene("two");
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
