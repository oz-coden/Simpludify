import { expect, test } from "@playwright/test";

const sdk = "/@fs/" + process.cwd() + "/packages/web/src/index.ts";
const gameURL = "/@fs/" + process.cwd() + "/examples/signal-run/index.html";
test.beforeEach(async ({ page }) => {
  await page.goto(gameURL);
  await expect(
    page.getByRole("heading", { name: "Signal Run", exact: true }),
  ).toBeVisible();
});
test("plays using keyboard, pointer and hold controls, pauses and restarts", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  await expect(page.getByText("HP 3/3", { exact: true })).toBeVisible();
  await page.locator(".simpludify").focus();
  await page.keyboard.down("d");
  await expect
    .poll(() => page.evaluate(() => window.signalRun.round?.player.x ?? 0))
    .toBeGreaterThan(85);
  await page.keyboard.up("d");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const before = await page.evaluate(() => window.signalRun.round?.elapsed);
  await page.evaluate(() => window.signalRun.game.engine.step(10));
  expect(await page.evaluate(() => window.signalRun.round?.elapsed)).toBe(
    before,
  );
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  const right = page.getByRole("button", { name: "Right", exact: true });
  await right.hover();
  await page.mouse.down();
  const x = await page.evaluate(() => window.signalRun.round?.player.x ?? 0);
  await expect
    .poll(() => page.evaluate(() => window.signalRun.round?.player.x ?? 0))
    .toBeGreaterThan(x + 5);
  await page.mouse.up();
  await page.getByRole("button", { name: "Zoom", exact: true }).click();
  const target = await page.evaluate(() => {
    const g = window.signalRun.game,
      p = g.worldToScreen({ space: "world", x: 220, y: 225 }),
      r = g.element.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  });
  await page.mouse.click(target.x, target.y);
  await expect(page.getByText("Signals 1/6", { exact: true })).toBeVisible();
  for (const button of await page.locator(".s-ui button").all()) {
    const box = await button.boundingBox();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(
        info.project.use.viewport?.width ?? 0,
      );
      expect(box.y + box.height).toBeLessThanOrEqual(
        info.project.use.viewport?.height ?? 0,
      );
    }
  }
  await page.screenshot({ path: info.outputPath("signal-run.png") });
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByText("Signals 0/6", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start run", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("connects contact-driven win and loss to result scenes and replay", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  await page.evaluate(async (url) => {
    const { Transform } = (await import(
      url
    )) as typeof import("@simpludify/web");
    const { game, round } = window.signalRun;
    if (!round) throw new Error("No round");
    for (const actor of [...round.pickups]) {
      const t = actor.require(Transform.type);
      round.player.x = t.x;
      round.player.y = t.y;
      game.engine.step(0);
    }
  }, sdk);
  await expect(
    page.getByRole("heading", { name: "Run complete" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.signalRun.result?.score)).toBe(6);
  await page.getByRole("button", { name: "Play again", exact: true }).click();
  await expect(page.getByText("HP 3/3", { exact: true })).toBeVisible();
  await page.evaluate(async (url) => {
    const { Transform, Collider, CollisionShape } = (await import(
      url
    )) as typeof import("@simpludify/web");
    const { game, round } = window.signalRun;
    if (!round) throw new Error("No round");
    const a = [...round.hazards].find(
      (actor) => actor.require(Collider.type).shape === CollisionShape.Box,
    );
    if (!a) throw new Error("No obstacle");
    const t = a.require(Transform.type);
    round.player.x = t.x;
    round.player.y = t.y;
    game.engine.step(0);
    game.engine.step(1.01);
    game.engine.step(1.01);
  }, sdk);
  await expect(page.getByRole("heading", { name: "Run ended" })).toBeVisible();
  expect(await page.evaluate(() => window.signalRun.result?.hp)).toBe(0);
  await page.getByRole("button", { name: "Main menu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start run", exact: true }),
  ).toBeVisible();
});
test("releases cancelled holds while preserving independent input", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  const state = await page.evaluate(() => {
    const { game } = window.signalRun,
      up = [...game.element.querySelectorAll("button")].find(
        (b) => b.textContent === "Up",
      );
    if (!up) throw new Error("No Up");
    game.engine.input.createKeyboardSource(game.engine.scene).set("KeyD", true);
    up.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "Space",
        bubbles: true,
        cancelable: true,
      }),
    );
    game.engine.step(0);
    const combined = window.signalRun.round?.controls.snapshot().Move.value;
    up.dispatchEvent(
      new KeyboardEvent("keyup", {
        code: "Space",
        bubbles: true,
        cancelable: true,
      }),
    );
    game.engine.step(0);
    const released = window.signalRun.round?.controls.snapshot().Move.value;
    game.engine.input.clear();
    return { combined, released };
  });
  expect(state.combined?.x).toBeCloseTo(Math.SQRT1_2);
  expect(state.combined?.y).toBeCloseTo(-Math.SQRT1_2);
  expect(state.released).toEqual({ x: 1, y: 0 });
  const right = page.getByRole("button", { name: "Right", exact: true });
  await right.hover();
  await page.mouse.down();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window.signalRun.round?.controls.snapshot().Move.value.x ?? 0) > 0,
      ),
    )
    .toBe(true);
  await right.dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window.signalRun.round?.controls.snapshot().Move.value.x ?? 0) > 0,
      ),
    )
    .toBe(false);
});
test("rolls back partial UI construction and reports late disposal errors", async ({
  page,
}) => {
  const state = await page.evaluate(async (url) => {
    const { Label, mountUI, Game } = (await import(
      url
    )) as typeof import("@simpludify/web");
    let subscriptions = 0;
    const a = Label("a"),
      b = Label("b");
    a.subscribe = () => {
      subscriptions++;
      return () => {
        subscriptions--;
      };
    };
    b.subscribe = () => {
      throw new Error("subscribe");
    };
    let failed = false;
    try {
      mountUI([a, b], () => {});
    } catch {
      failed = true;
    }
    let finish: ((v: { render(): void; dispose(): void }) => void) | undefined;
    const errors: unknown[] = [];
    const game = new Game({
      onError: (error) => errors.push(error),
      renderer: () => ({
        init: async () => {},
        resize() {},
        dispose() {},
        prepare: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      }),
    });
    const running = game.run().catch(() => {});
    for (let i = 0; i < 10 && !finish; i++) await Promise.resolve();
    game.dispose();
    finish?.({
      render() {},
      dispose() {
        throw new Error("late");
      },
    });
    await running;
    await Promise.resolve();
    await Promise.resolve();
    return { failed, subscriptions, errors: errors.length };
  }, sdk);
  expect(state).toEqual({ failed: true, subscriptions: 0, errors: 1 });
});
test("composes simultaneous touch holds", async ({ page }) => {
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  const up = await page
      .getByRole("button", { name: "Up", exact: true })
      .boundingBox(),
    right = await page
      .getByRole("button", { name: "Right", exact: true })
      .boundingBox();
  if (!up || !right) throw new Error("No controls");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 2,
  });
  const a = { id: 1, x: up.x + up.width / 2, y: up.y + up.height / 2 },
    b = { id: 2, x: right.x + right.width / 2, y: right.y + right.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [a, b],
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.signalRun.round?.controls.snapshot().Move.value,
      ),
    )
    .toEqual({
      x: expect.closeTo(Math.SQRT1_2, 10),
      y: expect.closeTo(-Math.SQRT1_2, 10),
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [a],
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.signalRun.round?.controls.snapshot().Move.value,
      ),
    )
    .toEqual({ x: 1, y: 0 });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.signalRun.round?.controls.snapshot().Move.value,
      ),
    )
    .toEqual({ x: 0, y: 0 });
});
test("renders live depth, visibility, opacity, transforms and image proportions", async ({
  page,
}) => {
  const state = await page.evaluate(async (url) => {
    const { Game, Actor, Transform, Renderable } = (await import(
      url
    )) as typeof import("@simpludify/web");
    window.signalRun.game.dispose();
    const game = new Game({
      pixelRatio: 1,
      frames: { request: () => 1, cancel() {} },
    });
    const red = game.add(new Actor());
    red.add(new Transform({ x: 400, y: 225 }));
    const back = red.add(
      new Renderable({ width: 80, height: 80, color: 0xff0000 }),
    );
    const blue = game.add(new Actor());
    const t = blue.add(new Transform({ x: 400, y: 225 }));
    blue.add(
      new Renderable({ width: 40, height: 40, color: 0x0000ff, zIndex: 1 }),
    );
    await game.run();
    const pixel = (x = 400, y = 225) => {
      game.setViewport();
      const canvas = game.element.querySelector("canvas");
      if (!canvas) throw new Error("No canvas");
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      const ctx = copy.getContext("2d");
      if (!ctx) throw new Error("No context");
      ctx.drawImage(canvas, 0, 0);
      const p = game.worldToScreen({ space: "world", x, y });
      return [
        ...ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data,
      ].slice(0, 3);
    };
    const top = pixel();
    back.zIndex = 2;
    const raised = pixel();
    back.zIndex = 1;
    const tied = pixel();
    back.visible = false;
    const hidden = pixel();
    back.visible = true;
    back.opacity = 0;
    const transparent = pixel();
    back.opacity = 1;
    back.zIndex = 0;
    t.rotation = Math.PI / 2;
    t.scaleX = 2;
    const scaled = pixel(400, 255);
    game.remove(red);
    game.remove(blue);
    const image = game.add(new Actor());
    image.add(new Transform({ x: 400, y: 225 }));
    image.add(
      new Renderable({
        width: 80,
        height: 80,
        source: {
          kind: "image",
          url:
            "data:image/svg+xml," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="#ff8800"/></svg>',
            ),
        },
      }),
    );
    await game.whenReady();
    const center = pixel(),
      outside = pixel(400, 260);
    game.dispose();
    return { top, raised, tied, hidden, transparent, scaled, center, outside };
  }, sdk);
  expect(state).toEqual({
    top: [0, 0, 255],
    raised: [255, 0, 0],
    tied: [0, 0, 255],
    hidden: [0, 0, 255],
    transparent: [0, 0, 255],
    scaled: [0, 0, 255],
    center: [255, 136, 0],
    outside: [16, 25, 34],
  });
});
test("disposes immediately after a committed render failure", async ({
  page,
}) => {
  const state = await page.evaluate(async (url) => {
    const { Game } = (await import(url)) as typeof import("@simpludify/web");
    let destroyed = 0;
    const game = new Game({
      frames: { request: () => 1, cancel() {} },
      renderer: () => ({
        init: async () => {},
        resize() {},
        dispose() {
          destroyed++;
        },
        prepare: async (scene) => ({
          render() {
            if (scene.id === "bad") throw new Error("render failed");
          },
          dispose() {},
        }),
      }),
    });
    game.scene("good", () => {});
    game.scene("bad", () => {});
    await game.run("good");
    let message = "";
    try {
      await game.goTo("bad");
    } catch (error) {
      message = (error as Error).message;
    }
    game.dispose();
    return {
      message,
      destroyed,
      disposed: game.engine.disposed,
      connected: game.element.isConnected,
    };
  }, sdk);
  expect(state).toEqual({
    message: "render failed",
    destroyed: 1,
    disposed: true,
    connected: false,
  });
});
test("destroys clipping graphics contexts on every transition", async ({
  page,
}) => {
  const state = await page.evaluate(async (url) => {
    const { Game, PixiRenderer } = (await import(
      url
    )) as typeof import("@simpludify/web");
    window.signalRun.game.dispose();
    let renderer: InstanceType<typeof PixiRenderer> | undefined;
    const game = new Game({
      frames: { request: () => 1, cancel() {} },
      renderer: (host) => (renderer = new PixiRenderer(host)),
    });
    game.scene("empty", () => {});
    await game.run("empty");
    const contexts = [];
    for (let i = 0; i < 20; i++) {
      const app = (
          renderer as unknown as { app: import("pixi.js").Application }
        ).app,
        mask = app.stage.children[0]?.children[1] as
          | import("pixi.js").Graphics
          | undefined;
      if (!mask) throw new Error("No clip");
      contexts.push(mask.context);
      await game.goTo("empty");
    }
    game.dispose();
    return contexts.map((context) => context.destroyed);
  }, sdk);
  expect(state).toEqual(Array(20).fill(true));
});
test("scopes renderer teardown and keeps a second Game usable", async ({
  page,
}) => {
  const state = await page.evaluate(async (url) => {
    const { Game, PixiRenderer, Character } = (await import(
      url
    )) as typeof import("@simpludify/web");
    window.signalRun.game.dispose();
    let renderer: InstanceType<typeof PixiRenderer> | undefined;
    let destroyOptions: unknown;
    const a = new Game({
        frames: { request: () => 1, cancel() {} },
        renderer: (host) => (renderer = new PixiRenderer(host)),
      }),
      b = new Game({ frames: { request: () => 1, cancel() {} } });
    a.add(Character());
    b.add(Character());
    await a.run();
    await b.run();
    const r = (renderer as unknown as { app: import("pixi.js").Application })
        .app.renderer,
      original = r.destroy.bind(r);
    r.destroy = (options) => {
      destroyOptions = options;
      original(options);
    };
    a.dispose();
    b.add(Character());
    await b.whenReady();
    const survivors = b.engine.scene.actors.length,
      canvas = b.element.querySelector("canvas")?.isConnected;
    b.dispose();
    return { destroyOptions, survivors, canvas };
  }, sdk);
  expect(state).toEqual({
    destroyOptions: { removeView: true },
    survivors: 2,
    canvas: true,
  });
});

test("wins a complete round through pointer destinations and normal Motion updates", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  for (const [x, y] of [
    [220, 225],
    [340, 90],
    [480, 90],
    [660, 225],
    [480, 360],
    [340, 360],
  ]) {
    const target = await page.evaluate(
      ({ x, y }) => {
        const game = window.signalRun.game;
        const point = game.worldToScreen({
          space: "world",
          x: x ?? 0,
          y: y ?? 0,
        });
        const rect = game.element.getBoundingClientRect();
        return { x: rect.left + point.x, y: rect.top + point.y };
      },
      { x, y },
    );
    await page.mouse.click(target.x, target.y);
    await page.evaluate(() => {
      for (let frame = 0; frame < 120; frame++)
        window.signalRun.game.engine.step(1 / 60);
    });
  }
  await expect(
    page.getByRole("heading", { name: "Run complete" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.signalRun.result?.hp),
  ).toBeGreaterThan(0);
});

test("slides against Solid walls and exposes post-response contacts through public APIs", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  await page.evaluate(() => {
    const round = window.signalRun.round;
    if (!round) throw Error("No round");
    round.player.x = 270;
    round.player.y = 255;
  });
  await page.locator(".simpludify").focus();
  expect(
    await page.evaluate(async (url) => {
      const { Transform } = (await import(
        url
      )) as typeof import("@simpludify/web");
      const { game, round } = window.signalRun;
      if (!round) throw Error();
      const rect = game.element.getBoundingClientRect();
      return [...round.walls]
        .map((a) => a.require(Transform.type))
        .filter((t) => t.x > 0 && t.x < 800 && t.y > 0 && t.y < 450)
        .every((t) => {
          const p = game.worldToScreen({ space: "world", x: t.x, y: t.y });
          return (
            document.elementFromPoint(rect.left + p.x, rect.top + p.y)
              ?.tagName === "CANVAS"
          );
        });
    }, sdk),
  ).toBe(true);
  const blocked = await page.evaluate(async (url) => {
    const {
      Collider,
      CollisionResponse,
      Transform,
      ContactEnter,
      ContactStay,
      ContactExit,
    } = (await import(url)) as typeof import("@simpludify/web");
    const { game, round } = window.signalRun;
    if (!round) throw Error("No round");
    const collider = round.player.require(Collider.type),
      wall = [...round.walls].find((a) => a.require(Transform.type).x === 270);
    let enters = 0,
      stays = 0,
      exits = 0;
    collider.events.on(
      ContactEnter,
      (c) => {
        if (c.otherActor === wall) enters++;
      },
      round.scene,
    );
    collider.events.on(
      ContactStay,
      (c) => {
        if (c.otherActor === wall) stays++;
      },
      round.scene,
    );
    collider.events.on(
      ContactExit,
      (c) => {
        if (c.otherActor === wall) exits++;
      },
      round.scene,
    );
    game.engine.input.createKeyboardSource(game.engine.scene).set("KeyS", true);
    for (let frame = 0; frame < 60; frame++) game.engine.step(1 / 60);
    const y = round.player.y,
      contacts = round.world
        .contactsFor(collider)
        .filter((c) => c.response === CollisionResponse.Solid).length;
    game.engine.input.clear();
    game.engine.input.createKeyboardSource(game.engine.scene).set("KeyD", true);
    for (let frame = 0; frame < 60; frame++) game.engine.step(1 / 60);
    game.engine.input.clear();
    return { y, contacts, enters, stays, exits, hp: round.health.hp };
  }, sdk);
  expect(blocked.y).toBeCloseTo(273);
  expect(blocked.contacts).toBeGreaterThan(0);
  expect(blocked.enters).toBe(1);
  expect(blocked.stays).toBeGreaterThan(0);
  expect(blocked.exits).toBe(1);
  expect(blocked.hp).toBe(3);
  await page.getByRole("button", { name: "Zoom", exact: true }).click();
  const camera = await page.evaluate(() => {
    const { game, round } = window.signalRun;
    if (!round) throw Error();
    round.player.x = 700;
    round.player.y = 350;
    game.engine.step(0);
    return { x: game.camera.x, y: game.camera.y, zoom: game.camera.zoom };
  });
  expect(camera.zoom).toBe(1.25);
  expect(camera.x).toBeCloseTo(80);
  expect(camera.y).toBeCloseTo(45);
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByText("HP 3/3", { exact: true })).toBeVisible();
});
