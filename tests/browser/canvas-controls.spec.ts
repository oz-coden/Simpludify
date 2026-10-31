import { expect, test } from "@playwright/test";

const fixture = `/@fs/${process.cwd()}/tests/browser/canvas-controls-fixture.ts`;
for (const fallback of [false, true])
  test.describe(`Canvas controls ${fallback ? "Canvas2D" : "WebGL"}`, () => {
    test.beforeEach(async ({ page }, info) => {
      // Same measured native-context setup budget as the existing WebGL scroll fixtures.
      if (!fallback) info.setTimeout(60_000);
      if (fallback)
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "gpu", { get: () => undefined });
          for (const proto of [
            HTMLCanvasElement.prototype,
            typeof OffscreenCanvas === "undefined"
              ? undefined
              : OffscreenCanvas.prototype,
          ]) {
            if (!proto) continue;
            const get = proto.getContext;
            proto.getContext = function (
              this: HTMLCanvasElement | OffscreenCanvas,
              kind: string,
              ...args: unknown[]
            ) {
              return kind.includes("webgl")
                ? null
                : Reflect.apply(get, this, [kind, ...args]);
            } as typeof proto.getContext;
          }
        });
      await page.goto("/");
      await page.waitForFunction(() => !!window.demo);
      await page.evaluate(async (url) => {
        window.controlsProbe = await (await import(url)).controlsFixture();
      }, fixture);
      expect(await page.evaluate(() => window.controlsProbe.rendererType)).toBe(
        fallback ? "CANVAS" : "WEBGL",
      );
    });
    test.afterEach(async ({ page }) => {
      expect(await page.evaluate(() => window.controlsProbe.errors)).toEqual(
        [],
      );
    });
    test("native checkbox keys and slider keys update pixels/ARIA without scrolling ancestors", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const f = window.controlsProbe;
        f.focus(f.screen.sound);
      });
      const checkbox = page.getByRole("checkbox", {
        name: "音声 / Sound",
        exact: true,
      });
      await expect(checkbox).toBeFocused();
      await expect(checkbox).toHaveAttribute("aria-checked", "true");
      const before = await page.evaluate(() => {
        const f = window.controlsProbe,
          b = f.screen.sound.bounds;
        return f.pixel(
          b.x + f.screen.sound.style.padding + 8,
          b.y + (b.height - 20) / 2 + 15,
        );
      });
      await checkbox.press("Space");
      await page.evaluate(() => window.controlsProbe.tick());
      await expect(checkbox).toHaveAttribute("aria-checked", "false");
      const after = await page.evaluate(() => {
        const f = window.controlsProbe,
          b = f.screen.sound.bounds;
        return f.pixel(
          b.x + f.screen.sound.style.padding + 8,
          b.y + (b.height - 20) / 2 + 15,
        );
      });
      expect(after).not.toEqual(before);
      expect(Math.max(...before)).toBeGreaterThan(Math.max(...after) + 50);
      await page.keyboard.press("Tab");
      await page.evaluate(() => window.controlsProbe.tick());
      const slider = page.getByRole("slider", {
        name: "音量 / Volume",
        exact: true,
      });
      await expect(slider).toBeFocused();
      const initial = await page.evaluate(() =>
        window.controlsProbe.trackPixel(),
      );
      await slider.press("End");
      await page.evaluate(() => window.controlsProbe.tick());
      await expect(slider).toHaveAttribute("aria-valuenow", "100");
      const filled = await page.evaluate(() =>
        window.controlsProbe.trackPixel(),
      );
      expect(filled).not.toEqual(initial);
      expect(Math.min(...filled)).toBeGreaterThan(200);
      await slider.press("Home");
      await slider.press("PageUp");
      await slider.press("ArrowRight");
      await page.evaluate(() => window.controlsProbe.tick());
      await expect(slider).toHaveAttribute("aria-valuenow", "11");
      expect(
        await page.evaluate(() => window.controlsProbe.screen.scroll.scrollY),
      ).toBe(0);
    });
    test("mouse horizontal ownership, vertical scroll transfer and native touch cancellation share one route", async ({
      page,
      context,
    }) => {
      const q = await page.evaluate(() =>
        window.controlsProbe.center(
          window.controlsProbe.screen.volume,
          0.3,
          0.7,
        ),
      );
      await page.mouse.move(q.x, q.y);
      await page.mouse.down();
      await page.mouse.move(q.x + 90, q.y, { steps: 4 });
      await page.mouse.up();
      await page.evaluate(() => window.controlsProbe.tick());
      expect(
        await page.evaluate(() => window.controlsProbe.screen.volume.value),
      ).toBeGreaterThan(60);
      expect(
        await page.evaluate(() => window.controlsProbe.screen.scroll.scrollY),
      ).toBe(0);
      expect(
        await page.evaluate(() => window.controlsProbe.commits.length),
      ).toBe(1);
      const touch = await context.newCDPSession(page);
      await touch.send("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 2,
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { id: 1, x: q.x, y: q.y, radiusX: 1, radiusY: 1, force: 1 },
        ],
      });
      await expect
        .poll(() =>
          page.evaluate(() => window.controlsProbe.screen.volume.editing),
        )
        .toBe(true);
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { id: 1, x: q.x, y: q.y - 65, radiusX: 1, radiusY: 1, force: 1 },
        ],
      });
      await expect
        .poll(() =>
          page.evaluate(() => window.controlsProbe.screen.scroll.scrollY),
        )
        .toBeGreaterThan(0);
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await page.evaluate(() => window.controlsProbe.tick());
      expect(
        await page.evaluate(() => ({
          editing: window.controlsProbe.screen.volume.editing,
          cancels: window.controlsProbe.cancels.length,
          commits: window.controlsProbe.commits.length,
          drags: window.controlsProbe.game.pointerDiagnostics.controlDrags,
        })),
      ).toEqual({ editing: false, cancels: 1, commits: 1, drags: 0 });
      await touch.detach();
    });
    test("settings Apply/Reset, read-only state, runtime range/style and Scene cleanup use standard APIs", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const f = window.controlsProbe;
        f.screen.volume.value = 75;
        f.screen.speed.setRange({ max: 3, step: 0.25 });
        f.screen.speed.value = 2;
        f.screen.sound.value = false;
        f.screen.volume.setStyle({ color: 0x88ccff });
        f.tick();
      });
      await page
        .getByRole("button", { name: "Apply / 適用", exact: true })
        .press("Enter");
      await page.evaluate(() => window.controlsProbe.tick());
      expect(
        await page.evaluate(() => window.controlsProbe.screen.applied),
      ).toEqual({ sound: false, volume: 75, speed: 2, grid: false });
      await page.evaluate(() => {
        const f = window.controlsProbe;
        f.screen.readOnly.value = true;
        f.focus(f.screen.volume);
      });
      const slider = page.getByRole("slider", {
        name: "音量 / Volume",
        exact: true,
      });
      await expect(slider).toHaveAttribute("aria-readonly", "true");
      await slider.press("End");
      await page.evaluate(() => window.controlsProbe.tick());
      await expect(slider).toHaveAttribute("aria-valuenow", "75");
      await page
        .getByRole("button", { name: "Reset / リセット", exact: true })
        .press("Enter");
      await page.evaluate(() => window.controlsProbe.tick());
      expect(
        await page.evaluate(() => [
          window.controlsProbe.screen.volume.value,
          window.controlsProbe.screen.sound.value,
          window.controlsProbe.screen.readOnly.value,
        ]),
      ).toEqual([50, true, false]);
      expect(
        await page.evaluate(() => window.controlsProbe.screen.applied.volume),
      ).toBe(75);
      await page
        .getByRole("button", { name: "Back", exact: true })
        .press("Enter");
      await page.waitForFunction(
        () => window.controlsProbe.game.engine.scene.id === "empty",
      );
      expect(
        await page.evaluate(() => ({
          disposed: window.controlsProbe.ui.disposed,
          nodes: window.controlsProbe.ui.diagnostics.nodes,
          subscriptions: window.controlsProbe.ui.diagnostics.subscriptions,
          listeners: window.controlsProbe.screen.volume.events.listenerCount(),
          drags: window.controlsProbe.game.pointerDiagnostics.controlDrags,
        })),
      ).toEqual({
        disposed: true,
        nodes: 0,
        subscriptions: 0,
        listeners: 0,
        drags: 0,
      });
      await expect(page.getByRole("slider")).toHaveCount(0);
    });
  });
