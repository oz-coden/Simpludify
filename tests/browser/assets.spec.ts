import { expect, test } from "@playwright/test";

const sdk = `/@fs/${process.cwd()}/packages/web/src/index.ts`;

for (const renderer of ["WebGL", "Canvas2D"]) {
  test(`swaps fallback and real atlas generations on the same ${renderer} sprite`, async ({
    page,
  }) => {
    if (renderer === "Canvas2D")
      await page.addInitScript(() => {
        for (const proto of [
          HTMLCanvasElement.prototype,
          OffscreenCanvas.prototype,
        ]) {
          const original = proto.getContext;
          proto.getContext = function (
            this: HTMLCanvasElement | OffscreenCanvas,
            kind: string,
            ...args: unknown[]
          ) {
            return kind.includes("webgl")
              ? null
              : Reflect.apply(original, this, [kind, ...args]);
          } as typeof proto.getContext;
        }
      });
    let requests = 0;
    await page.route("**/managed-image.svg", async (route) => {
      requests++;
      if (requests === 1) await route.fulfill({ status: 404 });
      else
        await route.fulfill({
          contentType: "image/svg+xml",
          body:
            requests === 2
              ? '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><rect width="32" height="16" fill="lime"/></svg>'
              : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="blue"/></svg>',
        });
    });
    await page.goto("/");
    await expect(page.getByRole("heading")).toBeVisible();
    const result = await page.evaluate(async (url) => {
      const { Actor, Game, Renderable, SpriteSheet, Transform, worldPoint } =
        (await import(url)) as typeof import("@simpludify/web");
      window.demo.dispose();
      const game = new Game({
        logging: { console: false },
        assets: { cacheEntries: 0 },
        resolution: { width: 400, height: 300 },
        pixelRatio: 1,
        frames: { request: () => 1, cancel: () => {} },
      });
      const renderer = (
        game as unknown as {
          renderer: {
            app: import("pixi.js").Application;
            diagnostics: { textures: number };
          };
        }
      ).renderer;
      let trigger: () => void = () => {};
      const event = new Promise<void>((resolve) => {
        trigger = resolve;
      });
      const scope = game.assets.scope();
      const handle = scope.load({
        kind: "image",
        url: "/managed-image.svg",
        retry: { once: { until: event } },
      });
      await handle.ready;
      const assetStatus = handle.status;
      const frame = SpriteSheet.grid(handle.source.url, {
        frameWidth: 16,
        frameHeight: 16,
      }).get(1);
      const actor = game.add(new Actor());
      actor.add(new Transform({ x: 200, y: 150 }));
      actor.add(new Renderable({ source: frame, width: 80, height: 80 }));
      const display = () =>
        renderer.app.stage.children[0]?.children[0]?.children[0];
      const pixel = () => {
        game.setViewport();
        const canvas = game.element.querySelector("canvas");
        if (!canvas) throw new Error("Missing canvas");
        const copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        const context = copy.getContext("2d");
        if (!context) throw new Error("Missing sample context");
        context.drawImage(canvas, 0, 0);
        const point = game.worldToScreen(worldPoint(180, 130));
        return [
          ...context.getImageData(
            Math.round(point.x),
            Math.round(point.y),
            1,
            1,
          ).data,
        ].slice(0, 3);
      };
      await game.run();
      const fallback = pixel();
      const original = display();
      const loaded = new Promise<void>((resolve) => {
        const off = game.assets.onProgress((progress) => {
          if (progress.loading) return;
          off();
          resolve();
        });
      });
      trigger();
      await loaded;
      const recovered = pixel();
      const stable = display() === original;
      const badReplacement = await handle.reload().then(
        () => "unexpected success",
        (error: { code: string }) => error.code,
      );
      const retained = pixel();
      scope.dispose();
      const visualStillOwnsAsset = renderer.diagnostics.textures === 1;
      game.dispose();
      return {
        assetStatus,
        fallback,
        recovered,
        stable,
        badReplacement,
        retained,
        visualStillOwnsAsset,
        freed: renderer.diagnostics.textures === 0,
      };
    }, sdk);
    expect(result).toEqual({
      assetStatus: "fallback",
      fallback: [255, 0, 255],
      recovered: [0, 255, 0],
      stable: true,
      badReplacement: "SPRITE_FRAME_BOUNDS",
      retained: [0, 255, 0],
      visualStillOwnsAsset: true,
      freed: true,
    });
    expect(requests).toBe(3);
  });
}
