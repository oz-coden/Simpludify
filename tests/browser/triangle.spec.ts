import { expect, test } from "@playwright/test";

const sdk = `/@fs/${process.cwd()}/packages/web/src/index.ts`;
for (const fallback of [false, true])
  test(`Triangle pixels, transforms, live properties and cleanup (${fallback ? "Canvas2D" : "WebGL"})`, async ({
    page,
  }) => {
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
          // Deliberately deny WebGL while preserving Canvas2D.
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
    const state = await page.evaluate(
      async ({ url, fallback }) => {
        const { Game, Actor, Transform, Renderable, Shape, PixiRenderer } =
          (await import(url)) as typeof import("@simpludify/web");
        window.demo.dispose();
        document.body.replaceChildren();
        document.body.style.cssText = "margin:0;height:100vh";
        let renderer: InstanceType<typeof PixiRenderer> | undefined;
        const game = new Game({
          pixelRatio: 1,
          tokens: { background: "#000000" },
          frames: { request: () => 1, cancel() {} },
          renderer: (host) => (renderer = new PixiRenderer(host, "#000000")),
        });
        game.scene("empty", () => {});
        const triangle = game.add(new Actor());
        const t = triangle.add(new Transform({ x: 400, y: 225 }));
        const render = triangle.add(
          new Renderable({
            source: { kind: "shape", shape: Shape.Triangle },
            width: 80,
            height: 120,
            color: 0xff0000,
            zIndex: 1,
          }),
        );
        await game.run();
        const pixel = (x: number, y: number) => {
          game.setViewport();
          const canvas = game.element.querySelector("canvas");
          if (!canvas) throw new Error("No canvas");
          const copy = document.createElement("canvas");
          copy.width = canvas.width;
          copy.height = canvas.height;
          const context = copy.getContext("2d");
          if (!context) throw new Error("No context");
          context.drawImage(canvas, 0, 0);
          const p = game.worldToScreen({ space: "world", x, y });
          return [
            ...context.getImageData(Math.round(p.x), Math.round(p.y), 1, 1)
              .data,
          ].slice(0, 3);
        };
        const upright = {
          tip: pixel(400, 185),
          corner: pixel(430, 180),
          base: pixel(430, 270),
        };
        t.rotation = Math.PI;
        const turned = {
          tip: pixel(400, 265),
          corner: pixel(430, 270),
          base: pixel(430, 180),
        };
        t.rotation = Math.PI / 2;
        const right = pixel(450, 225);
        t.rotation = 0;
        t.scaleX = -2;
        t.scaleY = 0.5;
        const scaled = pixel(450, 245),
          outside = pixel(400, 270);
        t.scaleX = t.scaleY = 1;
        const blue = game.add(new Actor());
        blue.add(new Transform({ x: 400, y: 225 }));
        const back = blue.add(
          new Renderable({
            width: 100,
            height: 140,
            color: 0x0000ff,
            zIndex: 0,
          }),
        );
        render.opacity = 0.5;
        const blend = pixel(400, 225);
        render.opacity = 1;
        back.zIndex = 2;
        const depth = pixel(400, 225);
        render.zIndex = 3;
        const front = pixel(400, 225);
        render.visible = false;
        const hidden = pixel(400, 225);
        render.visible = true;
        render.enabled = false;
        const componentDisabled = pixel(400, 225);
        render.enabled = true;
        triangle.enabled = false;
        const actorDisabled = pixel(400, 225);
        triangle.enabled = true;
        const app = (
          renderer as unknown as { app: import("pixi.js").Application }
        ).app;
        const world = app.stage.children[0]?.children[0];
        const graphic = world?.children[0];
        if (!graphic) throw new Error("Missing triangle visual");
        const triangleContext = (graphic as import("pixi.js").Graphics).context;
        triangle.dispose();
        const removed = pixel(400, 225);
        const resourcesAfterRemove = renderer?.diagnostics;
        const shapeKinds = [
          Shape.Box,
          Shape.Circle,
          Shape.Character,
          Shape.Triangle,
        ];
        for (const [i, shape] of shapeKinds.entries()) {
          const actor = game.add(new Actor());
          actor.add(new Transform({ x: 100 + i * 100, y: 100 }));
          actor.add(
            new Renderable({
              source: { kind: "shape", shape },
              width: 40,
              height: 60,
              color: 0x00ff00,
            }),
          );
        }
        const existing = shapeKinds.map((_, i) => pixel(100 + i * 100, 100));
        game.element.style.width = "310px";
        game.element.style.height = "620px";
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const resized = shapeKinds.map((_, i) => pixel(100 + i * 100, 100));
        await game.goTo("empty");
        const empty = renderer?.diagnostics;
        const canvas2D = fallback
          ? !!game.element.querySelector("canvas")?.getContext("2d")
          : false;
        game.dispose();
        return {
          fallback,
          canvas2D,
          upright,
          turned,
          right,
          scaled,
          outside,
          blend,
          depth,
          front,
          hidden,
          componentDisabled,
          actorDisabled,
          removed,
          resourcesAfterRemove,
          triangleContextDestroyed: triangleContext.destroyed,
          existing,
          resized,
          empty,
          disposed: renderer?.diagnostics,
        };
      },
      { url: sdk, fallback },
    );
    expect(state.canvas2D).toBe(fallback);
    expect(state.upright).toEqual({
      tip: [255, 0, 0],
      corner: [0, 0, 0],
      base: [255, 0, 0],
    });
    expect(state.turned).toEqual({
      tip: [255, 0, 0],
      corner: [0, 0, 0],
      base: [255, 0, 0],
    });
    expect(state.right).toEqual([255, 0, 0]);
    expect(state.scaled).toEqual([255, 0, 0]);
    expect(state.outside).toEqual([0, 0, 0]);
    expect(state.blend[0]).toBeGreaterThanOrEqual(126);
    expect(state.blend[0]).toBeLessThanOrEqual(129);
    expect(state.blend[2]).toBeGreaterThanOrEqual(126);
    expect(state.blend[2]).toBeLessThanOrEqual(129);
    for (const result of [
      state.depth,
      state.hidden,
      state.componentDisabled,
      state.actorDisabled,
      state.removed,
    ])
      expect(result).toEqual([0, 0, 255]);
    expect(state.front).toEqual([255, 0, 0]);
    expect(state.resourcesAfterRemove?.visuals).toBe(1);
    expect(state.triangleContextDestroyed).toBe(true);
    expect(state.existing).toEqual(Array(4).fill([0, 255, 0]));
    expect(state.resized).toEqual(state.existing);
    expect(state.empty?.visuals).toBe(0);
    expect(state.disposed).toEqual({
      presentations: 0,
      visuals: 0,
      textures: 0,
      pendingImages: 0,
    });
  });
