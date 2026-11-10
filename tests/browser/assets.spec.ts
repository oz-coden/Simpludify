import { expect, type Page, test } from "@playwright/test";

const sdk = `/@fs/${process.cwd()}/packages/web/src/index.ts`;

async function forceCanvas2d(page: Page): Promise<void> {
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
}

for (const renderer of ["WebGL", "Canvas2D"]) {
  test(`swaps fallback and real atlas generations on the same ${renderer} sprite`, async ({
    page,
  }) => {
    if (renderer === "Canvas2D") await forceCanvas2d(page);
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

test("validates a managed atlas against tile edits made before replacement commits", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/managed-terrain.svg", async (route) => {
    const width = ++requests === 2 ? 16 : 32;
    await route.fulfill({
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="16"><rect width="${width}" height="16" fill="lime"/></svg>`,
    });
  });
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
  const result = await page.evaluate(async (url) => {
    const { Game, SpriteSheet, Tilemap } = (await import(
      url
    )) as typeof import("@simpludify/web");
    window.demo.dispose();
    const game = new Game({
      logging: { console: false },
      frames: { request: () => 1, cancel: () => {} },
    });
    try {
      const atlas = game.assets.load({
        kind: "image",
        url: "/managed-terrain.svg",
      });
      const map = new Tilemap({
        sheet: SpriteSheet.grid(atlas.source.url, {
          frameWidth: 16,
          frameHeight: 16,
        }),
        tiles: [[0, null]],
        tileWidth: 16,
        tileHeight: 16,
      }).place(game.engine.scene);
      await game.run();
      const replacement = atlas.reload();
      map.set(1, 0, 1);
      const code = await replacement.then(
        () => "unexpected success",
        (error: { code: string }) => error.code,
      );
      const retained = atlas.value;
      await atlas.reload();
      game.setViewport();
      return {
        code,
        retained,
        recovered: atlas.value,
        errorCleared: !atlas.error,
      };
    } finally {
      game.dispose();
    }
  }, sdk);
  expect(result).toEqual({
    code: "SPRITE_FRAME_BOUNDS",
    retained: { width: 32, height: 16 },
    recovered: { width: 32, height: 16 },
    errorCleared: true,
  });
  expect(requests).toBe(3);
});

for (const renderer of ["WebGL", "Canvas2D"]) {
  test(`keeps only live ${renderer} tile textures after hidden and disabled atlas reloads`, async ({
    page,
  }) => {
    if (renderer === "Canvas2D") await forceCanvas2d(page);
    await page.route("**/managed-hidden-terrain.svg", async (route) => {
      await route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><rect width="32" height="16" fill="lime"/></svg>',
      });
    });
    await page.goto("/");
    await expect(page.getByRole("heading")).toBeVisible();
    const result = await page.evaluate(async (url) => {
      const { Game, SpriteSheet, Tilemap } = (await import(
        url
      )) as typeof import("@simpludify/web");
      window.demo.dispose();
      const game = new Game({
        logging: { console: false },
        frames: { request: () => 1, cancel: () => {} },
      });
      try {
        const atlas = game.assets.load({
          kind: "image",
          url: "/managed-hidden-terrain.svg",
        });
        await atlas.ready;
        const map = new Tilemap({
          sheet: SpriteSheet.grid(atlas.source.url, {
            frameWidth: 16,
            frameHeight: 16,
          }),
          tiles: [[0, 1]],
          tileWidth: 16,
          tileHeight: 16,
        }).place(game.engine.scene);
        let editOnCommit = false;
        atlas.onChange(() => {
          if (editOnCommit) map.set(0, 0, 2);
        });
        await game.run();
        const renderer = (
          game as unknown as {
            renderer: {
              app: import("pixi.js").Application;
              tilemaps: Set<{
                sprites: Map<number, import("pixi.js").Sprite>;
                error: unknown;
              }>;
            };
          }
        ).renderer;
        const visual = [...renderer.tilemaps][0];
        if (!visual) throw new Error("Missing tilemap presentation");
        const textures = () =>
          [...visual.sprites.values()].map(({ texture }) => texture);
        const live = () =>
          textures().every((texture) => !texture.destroyed && !!texture.source);

        const original = textures();
        map.visible = false;
        game.setViewport();
        await atlas.reload();
        const hidden = {
          count: visual.sprites.size,
          live: live(),
          oldReleased: original.every((texture) => texture.destroyed),
        };

        map.visible = true;
        map.enabled = false;
        game.setViewport();
        map.set(1, 0, null);
        await atlas.reload();
        const disabled = { count: visual.sprites.size, live: live() };

        map.enabled = true;
        map.set(1, 0, 1);
        game.setViewport();
        editOnCommit = true;
        await atlas.reload();
        const reentrant = {
          count: visual.sprites.size,
          live: live(),
          invalidFrame: (visual.error as { code?: string } | undefined)?.code,
        };

        map.set(0, 0, 0);
        game.setViewport();
        const restored = { count: visual.sprites.size, live: live() };
        const current = textures();
        const type = renderer.app.renderer.type;
        game.dispose();
        return {
          type,
          hidden,
          disabled,
          reentrant,
          restored,
          released: current.every((texture) => texture.destroyed),
        };
      } finally {
        game.dispose();
      }
    }, sdk);
    expect(result).toEqual({
      type: renderer === "WebGL" ? 1 : 4,
      hidden: { count: 2, live: true, oldReleased: true },
      disabled: { count: 1, live: true },
      reentrant: { count: 1, live: true, invalidFrame: "SPRITE_FRAME_BOUNDS" },
      restored: { count: 2, live: true },
      released: true,
    });
  });
}
