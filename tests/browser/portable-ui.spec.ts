import { expect, type Page, test } from "@playwright/test";

const sample = `/@fs/${process.cwd()}/examples/canvas-ui/main.ts`;
async function flushFrame(page: Page): Promise<void> {
  await page.evaluate(() => window.flushPortableFrames());
}
async function pressControl(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name, exact: true }).press("Enter");
  await flushFrame(page);
}
async function backAndCheck(page: Page): Promise<void> {
  await pressControl(page, "Back");
  await page.waitForFunction(
    () => window.canvasDemo.game.engine.scene.id === "title",
    undefined,
    { polling: 50 },
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
}
for (const fallback of [false, true]) {
  test.describe(`portable UI ${fallback ? "Canvas2D" : "WebGL"}`, () => {
    let errors: string[];
    test.beforeEach(async ({ page }, info) => {
      // Include measured ~35s native WebGL startup/teardown; predicate deadlines stay unchanged.
      if (!fallback) info.setTimeout(60_000);
      errors = [];
      // Present once per input instead of saturating SwiftShader with idle frames.
      // Native input, actual sample construction and Pixi drawing remain exercised.
      await page.addInitScript(() => {
        let id = 0,
          time = 0;
        const callbacks = new Map<number, FrameRequestCallback>();
        window.requestAnimationFrame = (callback) => {
          callbacks.set(++id, callback);
          return id;
        };
        window.cancelAnimationFrame = (handle) => {
          callbacks.delete(handle);
        };
        window.flushPortableFrames = () => {
          const roster = [...callbacks.values()];
          callbacks.clear();
          time += 16;
          for (const callback of roster) callback(time);
        };
      });
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
      await page.waitForFunction(() => !!window.demo, undefined, {
        polling: 50,
      });
      await page.evaluate(async (sample) => {
        window.demo.dispose();
        await import(sample);
      }, sample);
      await pressControl(page, "UI list lab");
      await page.waitForFunction(
        () => window.canvasDemo.game.engine.scene.id === "list",
        undefined,
        { polling: 50 },
      );
    });
    test.afterEach(() => expect(errors).toEqual([]));
    test("selection, clipped keyboard focus and removal release their Scene", async ({
      page,
    }) => {
      await pressControl(page, "Entry 1");
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
      for (let i = 0; i < 11; i++) {
        await page.keyboard.press("Tab");
        await flushFrame(page);
      }
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
      await flushFrame(page);
      await pressControl(page, "Remove selected");
      await expect(
        page.getByRole("button", { name: "Entry 12", exact: true }),
      ).toHaveCount(0);
      await backAndCheck(page);
    });
    test("live ordering, wheel input and resize release their Scene", async ({
      page,
    }) => {
      await pressControl(page, "Add entry");
      await expect(
        page.getByRole("button", { name: "Entry 13", exact: true }),
      ).toHaveCount(1);
      await pressControl(page, "Reverse");
      await pressControl(page, "Scroll up");
      await page.evaluate(async (sample) => {
        const d = (await import(sample)).portableDemo;
        d.screen.list.scrollTo(0, 0);
      }, sample);
      const point = await page.evaluate(async (sample) => {
        const d = (await import(sample)).portableDemo,
          b = d.screen.list.bounds,
          r = window.canvasDemo.game.element.getBoundingClientRect();
        return { x: r.x + b.x + 20, y: r.y + b.y + 20 };
      }, sample);
      await page.mouse.move(point.x, point.y);
      await page.mouse.wheel(0, 120);
      await flushFrame(page);
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
      await backAndCheck(page);
    });
  });
}

declare global {
  interface Window {
    flushPortableFrames(): void;
  }
}
