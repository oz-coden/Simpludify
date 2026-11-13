import { expect, test } from "@playwright/test";

const fixture = `/@fs/${process.cwd()}/tests/browser/renderable-fixture.ts`;
for (const canvas2d of [false, true]) {
  test(`world mask clips the union and follows camera and resize (${canvas2d ? "Canvas2D" : "WebGL"})`, async ({
    page,
  }) => {
    if (canvas2d)
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "gpu", { get: () => undefined });
        for (const prototype of [
          HTMLCanvasElement.prototype,
          OffscreenCanvas.prototype,
        ]) {
          const get = prototype.getContext;
          prototype.getContext = function (
            this: HTMLCanvasElement | OffscreenCanvas,
            name: string,
            ...args: unknown[]
          ) {
            return name.includes("webgl")
              ? null
              : Reflect.apply(get, this, [name, ...args]);
          } as typeof prototype.getContext;
        }
      });
    await page.goto("/");
    await page.waitForFunction(() => !!window.demo);
    const result = await page.evaluate(async (url) => {
      const { fixture } = (await import(
        url
      )) as typeof import("./renderable-fixture");
      const { game, renderer, view, pixel, internal, errors } = await fixture();
      view.width = 400;
      view.height = 300;
      const mode = internal.app.renderer.type;
      const pixels = () => [
        pixel(120, 130),
        pixel(177, 151),
        pixel(226, 150),
        pixel(270, 150),
        pixel(289, 150),
      ];
      const baseline = pixels();
      const rect = {
        kind: "rectangle",
        x: 100,
        y: 110,
        width: 90,
        height: 75,
      } as const;
      const circle = { kind: "circle", x: 199, y: 150, radius: 35 } as const;
      const points = [
        { x: 280, y: 130 },
        { x: 242, y: 130 },
        { x: 242, y: 177 },
        { x: 280, y: 177 },
      ];
      game.setWorldMask([rect, circle, { kind: "polygon", points }]);
      points[0] = { x: -100, y: -100 };
      const clipped = pixels();
      game.camera.x = 14;
      game.camera.y = -9;
      game.camera.zoom = 1.2;
      game.element.style.height = "380px";
      await new Promise(requestAnimationFrame);
      const moved = pixels();
      game.setWorldMask([]);
      const empty = pixels();
      game.setWorldMask();
      const restored = pixels();
      game.setWorldMask([rect]);
      await game.changeScene("empty");
      game.dispose();
      return {
        mode,
        baseline,
        clipped,
        moved,
        empty,
        restored,
        errors,
        presentations: renderer.diagnostics.presentations,
      };
    }, fixture);
    const red = [255, 0, 0],
      black = [0, 0, 0];
    expect(result).toEqual({
      mode: canvas2d ? 4 : 1,
      baseline: Array(5).fill(red),
      clipped: [red, red, red, red, black],
      moved: [red, red, red, red, black],
      empty: Array(5).fill(black),
      restored: Array(5).fill(red),
      errors: [],
      presentations: 0,
    });
  });
}
