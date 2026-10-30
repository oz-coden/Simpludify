import { expect, test } from "@playwright/test";

const fixture = `/@fs/${process.cwd()}/tests/browser/scroll-fixture.ts`;
for (const fallback of [false, true])
  test.describe(`scroll input ${fallback ? "Canvas2D" : "WebGL"}`, () => {
    test.beforeEach(async ({ page }, info) => {
      // Include measured ~35s native WebGL startup/teardown; predicate deadlines stay unchanged.
      if (!fallback) info.setTimeout(60_000);
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
      await page.evaluate(async (url) => {
        window.scrollProbe = await (await import(url)).scrollFixture();
      }, fixture);
      expect(await page.evaluate(() => window.scrollProbe.rendererType)).toBe(
        fallback ? "CANVAS" : "WEBGL",
      );
    });
    test.afterEach(async ({ page }, info) => {
      if (info.status !== info.expectedStatus) {
        const state = await page.evaluate(() => {
          const f = window.scrollProbe;
          return f
            ? {
                events: f.pointerEvents,
                holding: f.screen.holding,
                range: f.screen.secondary.maxScrollY,
                offset: f.screen.secondary.scrollY,
                style: f.screen.secondary.style,
                pointers: f.game.pointerDiagnostics,
                errors: f.errors,
              }
            : {};
        });
        await info.attach("scroll-input-state", {
          body: JSON.stringify(state, null, 2),
          contentType: "application/json",
        });
        console.log("SCROLL_STATE", JSON.stringify(state));
      }
    });
    test("mouse drag, thumb pixels, hidden modes and cached layout stay aligned", async ({
      page,
    }, info) => {
      await page.evaluate(() => {
        window.scrollProbe.screen.list.setStyle({ inertia: false });
        window.scrollProbe.tick();
      });
      const p = await page.evaluate(() =>
        window.scrollProbe.center(window.scrollProbe.screen.list, 0.3, 0.5),
      );
      const before = await page.evaluate(
        () => window.scrollProbe.ui.diagnostics.layouts,
      );
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x, p.y - 50, { steps: 5 });
      await page.mouse.up();
      await page.evaluate(() => window.scrollProbe.tick());
      expect(
        await page.evaluate(() => window.scrollProbe.screen.list.scrollY),
      ).toBeGreaterThan(0);
      expect(
        await page.evaluate(() => window.scrollProbe.screen.status.text),
      ).toBe("Select an entry");
      expect(
        await page.evaluate(() => window.scrollProbe.ui.diagnostics.layouts),
      ).toBe(before);
      const bar = await page.evaluate(() => window.scrollProbe.bar());
      await page.mouse.move(bar.x, bar.y);
      await page.mouse.down();
      await page.mouse.move(bar.endX, bar.endY, { steps: 5 });
      await page.mouse.up();
      await page.evaluate(() => window.scrollProbe.tick());
      expect(
        await page.evaluate(() => {
          const s = window.scrollProbe.screen.list;
          return Math.abs(s.scrollY - s.maxScrollY);
        }),
      ).toBeLessThan(0.001);
      expect(
        await page.evaluate(() => window.scrollProbe.screen.list.coasting),
      ).toBe(false);
      const pixels = await page.evaluate(() => {
        const f = window.scrollProbe;
        f.screen.list.scrollTo(0, 0);
        f.tick();
        const b = f.bar(),
          shown = f.pixel(b.paintX, b.paintY);
        f.screen.list.setStyle({ scrollbar: "hidden" });
        f.tick();
        return { shown, hidden: f.pixel(b.paintX, b.paintY) };
      });
      expect(pixels.shown).not.toEqual(pixels.hidden);
      expect(Math.max(...pixels.shown)).toBeGreaterThan(
        Math.max(...pixels.hidden) + 40,
      );
      await page.screenshot({
        path: `test-results/scroll-${info.project.name}-${fallback ? "canvas" : "webgl"}.png`,
      });
      expect(await page.evaluate(() => window.scrollProbe.errors)).toEqual([]);
    });
    test("CDP touch transfers Hold ownership, supports independent fingers and releases on cancel/blur", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const f = window.scrollProbe;
        f.screen.list.setStyle({ inertia: false });
        f.tick();
      });
      const a = await page.evaluate(() =>
        window.scrollProbe.center(window.scrollProbe.screen.list, 0.3, 0.5),
      );
      const b = await page.evaluate(() =>
        window.scrollProbe.center(window.scrollProbe.screen.hold, 0.3, 0.5),
      );
      expect(b.y).toBeLessThan((await page.viewportSize())?.height ?? 10000);
      const client = await page.context().newCDPSession(page);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { ...a, id: 1 },
          { ...b, id: 2 },
        ],
      });
      expect(await page.evaluate(() => window.scrollProbe.screen.holding)).toBe(
        true,
      );
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: a.x, y: a.y - 35, id: 1 },
          { ...b, id: 2 },
        ],
      });
      await page.evaluate(() => window.scrollProbe.tick());
      expect(
        await page.evaluate(() => window.scrollProbe.screen.list.scrollY),
      ).toBeGreaterThan(0);
      expect(await page.evaluate(() => window.scrollProbe.screen.holding)).toBe(
        true,
      );
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: a.x, y: a.y - 35, id: 1 },
          { x: b.x, y: b.y - 30, id: 2 },
        ],
      });
      await expect
        .poll(() => page.evaluate(() => window.scrollProbe.screen.holding))
        .toBe(false);
      expect(
        await page.evaluate(
          () => window.scrollProbe.game.pointerDiagnostics.scrollDrags,
        ),
      ).toBe(2);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: [],
      });
      expect(
        await page.evaluate(
          () => window.scrollProbe.game.pointerDiagnostics.captures,
        ),
      ).toBe(0);
      expect(
        await page.evaluate(() => window.scrollProbe.screen.holdChanges),
      ).toBe(2);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(
        await page.evaluate(
          () =>
            getComputedStyle(
              window.scrollProbe.game.element.querySelector(
                "canvas",
              ) as HTMLCanvasElement,
            ).touchAction,
        ),
      ).toBe("none");
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(a.x, a.y - 20);
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.mouse.up();
      expect(
        await page.evaluate(
          () => window.scrollProbe.game.pointerDiagnostics.captures,
        ),
      ).toBe(0);
      expect(await page.evaluate(() => window.scrollProbe.errors)).toEqual([]);
    });
    test("Host frames advance momentum and pause/disposal terminate it", async ({
      page,
    }) => {
      const start = await page.evaluate(() => window.scrollProbe.fling());
      expect(
        await page.evaluate(
          () => window.scrollProbe.ui.diagnostics.activeMomentum,
        ),
      ).toBe(1);
      await page.evaluate(() => {
        for (let i = 0; i < 5; i++) window.scrollProbe.tick();
      });
      expect(
        await page.evaluate(() => window.scrollProbe.screen.list.scrollY),
      ).toBeGreaterThan(start);
      await page.evaluate(() => window.scrollProbe.game.pause());
      expect(
        await page.evaluate(
          () => window.scrollProbe.ui.diagnostics.activeMomentum,
        ),
      ).toBe(0);
      await page.evaluate(() => {
        const f = window.scrollProbe;
        f.game.resume();
        f.fling();
        f.screen.list.setStyle({ inertia: false });
        f.tick();
      });
      expect(
        await page.evaluate(
          () => window.scrollProbe.ui.diagnostics.activeMomentum,
        ),
      ).toBe(0);
      const result = await page.evaluate(() => {
        const f = window.scrollProbe;
        f.game.dispose();
        return {
          ui: f.ui.disposed,
          nodes: f.ui.diagnostics.nodes,
          motion: f.ui.diagnostics.activeMomentum,
          subscriptions: f.ui.diagnostics.subscriptions,
          pointers: f.game.pointerDiagnostics.captures,
          errors: [...f.errors],
        };
      });
      expect(result).toEqual({
        ui: true,
        nodes: 0,
        motion: 0,
        subscriptions: 0,
        pointers: 0,
        errors: [],
      });
    });
  });
