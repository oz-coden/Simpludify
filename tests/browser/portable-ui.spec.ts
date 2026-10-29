import { expect, test } from "@playwright/test";

const sample = `/@fs/${process.cwd()}/examples/canvas-ui/main.ts`;
for (const fallback of [false, true]) {
  test(`portable UI list, clipping, focus, input and cleanup (${fallback ? "Canvas2D" : "WebGL"})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
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
          const original = prototype.getContext;
          prototype.getContext = function (
            this: HTMLCanvasElement | OffscreenCanvas,
            kind: string,
            ...args: unknown[]
          ) {
            return kind.includes("webgl")
              ? null
              : Reflect.apply(original, this, [kind, ...args]);
          } as typeof prototype.getContext;
        }
      });
    await page.goto("/");
    await page.waitForFunction(() => !!window.demo);
    await page.evaluate(async (sample) => {
      window.demo.dispose();
      await import(sample);
    }, sample);
    await page
      .getByRole("button", { name: "UI list lab", exact: true })
      .click();
    await page.waitForFunction(
      () => window.canvasDemo.game.engine.scene.id === "list",
    );
    await page
      .getByRole("button", { name: "Entry 1", exact: true })
      .press("Enter");
    await expect
      .poll(() =>
        page.evaluate(
          async (sample) =>
            (await import(sample)).portableDemo.screen.status.text,
          sample,
        ),
      )
      .toBe("Selected 1");
    // Tab crosses the clipped viewport boundary and reveals later entries.
    for (let i = 0; i < 11; i++) await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Entry 12", exact: true }),
    ).toBeFocused();
    await expect
      .poll(() =>
        page.evaluate(
          async (sample) =>
            (await import(sample)).portableDemo.screen.list.scrollY,
          sample,
        ),
      )
      .toBeGreaterThan(0);
    await page.keyboard.press("Space");
    await page
      .getByRole("button", { name: "Remove selected", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Entry 12", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Add entry", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Entry 13", exact: true }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "Reverse", exact: true }).click();
    await page.getByRole("button", { name: "Scroll up", exact: true }).click();
    await page.evaluate(async (sample) => {
      const d = (await import(sample)).portableDemo;
      d.screen.list.scrollTo(0, 0);
    }, sample);
    await page.waitForTimeout(50);
    const point = await page.evaluate(async (sample) => {
      const d = (await import(sample)).portableDemo,
        b = d.screen.list.bounds,
        r = window.canvasDemo.game.element.getBoundingClientRect();
      return { x: r.x + b.x + 20, y: r.y + b.y + 20 };
    }, sample);
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel(0, 120);
    await expect
      .poll(() =>
        page.evaluate(
          async (sample) =>
            (await import(sample)).portableDemo.screen.list.scrollY,
          sample,
        ),
      )
      .toBeGreaterThan(0);
    // Host resize reuses the same portable tree and recalculates scroll bounds.
    await page.setViewportSize({ width: 500, height: 700 });
    await expect
      .poll(() =>
        page.evaluate(async (sample) => {
          const d = (await import(sample)).portableDemo;
          return d.ui.diagnostics.layouts;
        }, sample),
      )
      .toBeGreaterThan(1);
    await page
      .getByRole("button", { name: "Back", exact: true })
      .press("Enter");
    await page.waitForFunction(
      () => window.canvasDemo.game.engine.scene.id === "title",
    );
    expect(
      await page.evaluate(async (sample) => {
        const d = (await import(sample)).portableDemo;
        return {
          disposed: d.ui.disposed,
          nodes: d.ui.diagnostics.nodes,
          subscriptions: d.ui.diagnostics.subscriptions,
        };
      }, sample),
    ).toEqual({ disposed: true, nodes: 0, subscriptions: 0 });
    expect(errors).toEqual([]);
  });
}
