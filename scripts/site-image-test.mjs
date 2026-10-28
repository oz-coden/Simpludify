import assert from "node:assert/strict";

/** Probe the production sample bundle, not Vite source imports. */
export async function testSiteImages(browser, site) {
  const results = [];
  for (const fallback of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 1000, height: 900 },
      deviceScaleFactor: 1,
    });
    try {
      if (fallback)
        await context.addInitScript(() => {
          Object.defineProperty(navigator, "gpu", { get: () => undefined });
          for (const prototype of [
            HTMLCanvasElement.prototype,
            typeof OffscreenCanvas === "undefined"
              ? undefined
              : OffscreenCanvas.prototype,
          ]) {
            if (!prototype) continue;
            const get = prototype.getContext;
            prototype.getContext = function (kind, ...args) {
              return kind.includes("webgl")
                ? null
                : Reflect.apply(get, this, [kind, ...args]);
            };
          }
        });
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const response = await page.goto(`${site}play/prism-raid/index.html`);
      assert.equal(response.status(), 200);
      await page.waitForFunction(() => !!window.prismRaid);
      await page
        .getByRole("button", { name: "Start mission", exact: true })
        .click();
      await page.waitForFunction(() =>
        [...(window.prismRaid.round?.player.components.values() ?? [])].some(
          (component) => component.type.name === "Renderable",
        ),
      );
      const result = await page.evaluate(async () => {
        const { game, round, renderer } = window.prismRaid;
        game.pause();
        // Test-only reflection obtains the actual classes from the built sample.
        // No backend objects become a game-facing Core API.
        const components = [...round.player.components.values()];
        const Transform = components.find(
          (c) => c.type.name === "Transform",
        )?.constructor;
        const Renderable = components.find(
          (c) => c.type.name === "Renderable",
        )?.constructor;
        const Actor = round.player.constructor;
        if (!Transform || !Renderable)
          throw Error("Missing sample visual types");
        const before = renderer.diagnostics,
          actors = [];
        const load = renderer.image.bind(renderer);
        let loads = 0;
        renderer.image = (...args) => {
          loads++;
          return load(...args);
        };
        const url = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="white"/></svg>')}`;
        for (let i = 0; i < 100; i++) {
          const actor = game.add(new Actor());
          actors.push(actor);
          actor.add(
            new Transform({ x: i === 0 ? 100 : i === 1 ? 300 : -1000, y: 100 }),
          );
          actor.add(
            new Renderable({
              source: { kind: "image", url },
              width: 48,
              height: 48,
              color: i === 0 ? 0xff0000 : 0x0000ff,
              zIndex: 100000,
            }),
          );
        }
        await game.whenReady();
        const pixel = (x) => {
          const canvas = game.element.querySelector("canvas"),
            copy = document.createElement("canvas");
          copy.width = canvas.width;
          copy.height = canvas.height;
          const ctx = copy.getContext("2d");
          ctx.drawImage(canvas, 0, 0);
          const p = game.worldToScreen({ space: "world", x, y: 100 }),
            ratio = canvas.width / game.element.clientWidth;
          return [
            ...ctx.getImageData(
              Math.round(p.x * ratio),
              Math.round(p.y * ratio),
              1,
              1,
            ).data,
          ].slice(0, 3);
        };
        const shared = renderer.diagnostics,
          red = pixel(100),
          blue = pixel(300);
        actors[0].dispose();
        await game.whenReady();
        const survivor = pixel(300),
          afterOne = renderer.diagnostics;
        for (const actor of actors) actor.dispose();
        await game.whenReady();
        const afterLast = renderer.diagnostics;
        game.dispose();
        return {
          loads,
          before,
          shared,
          red,
          blue,
          survivor,
          afterOne,
          afterLast,
          disposed: renderer.diagnostics,
        };
      });
      assert.equal(result.loads, 1);
      assert.equal(result.shared.textures - result.before.textures, 1);
      assert.equal(result.shared.imageEntries - result.before.imageEntries, 1);
      assert.equal(
        result.shared.imageReferences - result.before.imageReferences,
        100,
      );
      assert.deepEqual(result.red, [255, 0, 0]);
      assert.deepEqual(result.blue, [0, 0, 255]);
      assert.deepEqual(result.survivor, [0, 0, 255]);
      assert.equal(
        result.afterOne.imageReferences - result.before.imageReferences,
        99,
      );
      assert.equal(result.afterOne.textures - result.before.textures, 1);
      for (const key of [
        "textures",
        "imageEntries",
        "imageReferences",
        "pendingImages",
      ])
        assert.equal(result.afterLast[key], result.before[key]);
      assert.ok(Object.values(result.disposed).every((n) => n === 0));
      assert.deepEqual(errors, []);
      results.push({ backend: fallback ? "canvas2d" : "webgl", ...result });
    } finally {
      await context.close();
    }
  }
  return results;
}
