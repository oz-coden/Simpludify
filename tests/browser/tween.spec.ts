import { expect, test } from "@playwright/test";

const fixture = `/@fs/${process.cwd()}/tests/browser/tween-fixture.ts`;
for (const fallback of [false, true])
  test.describe(`Tween ${fallback ? "Canvas2D" : "WebGL"}`, () => {
    test.beforeEach(async ({ page }, info) => {
      // Same measured software WebGL startup/disposal budget as the native UI suite.
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
        window.tweenProbe = await (await import(url)).tweenFixture();
      }, fixture);
      expect(await page.evaluate(() => window.tweenProbe.rendererType)).toBe(
        fallback ? 4 : 1,
      );
    });
    test.afterEach(async ({ page }) => {
      expect(await page.evaluate(() => window.tweenProbe.errors)).toEqual([]);
    });
    test("Actor pixels and sprite frames use draw-only easing/rotation/opacity", async ({
      page,
    }) => {
      const r = await page.evaluate(() => {
        const f = window.tweenProbe,
          before = { red: f.pixel(90, 80), clear: f.pixel(135, 80) };
        f.tick(0.5);
        return {
          before,
          after: f.snapshot(),
          red: f.pixel(135, 80),
          clear: f.pixel(90, 80),
        };
      });
      expect(r.before.red).toEqual([255, 0, 0]);
      expect(r.before.clear).not.toEqual(r.before.red);
      expect(r.red).toEqual([255, 0, 0]);
      expect(r.clear).not.toEqual(r.red);
      expect(r.after.linear.x).toBe(90);
      expect(r.after.linear.offsetX).toBeCloseTo(45);
      expect(r.after.cubic.offsetX).toBeCloseTo(104.0625);
      expect(r.after.cubic.rotation).toBeCloseTo(Math.PI / 4);
      expect(r.after.cubic.opacity).toBeCloseTo(0.8125);
      expect(r.after.cubic.scaleY).toBeCloseTo(1.2);
      expect(r.after.frame).toBe(3);
    });
    test("translated UI paints and receives real pointer clicks without Flex remeasurement", async ({
      page,
    }) => {
      const r = await page.evaluate(() => {
        const f = window.tweenProbe;
        f.focus(f.lab.moving);
        const before = { ...f.lab.moving.bounds },
          layouts = f.lab.ui.diagnostics.layouts;
        f.translate();
        f.tick(0.5);
        const after = { ...f.lab.moving.bounds },
          s = f.lab.ui.scale;
        return {
          before,
          after,
          layouts,
          endLayouts: f.lab.ui.diagnostics.layouts,
          pixel: f.pixel((after.x + 8) * s, (after.y + 8) * s),
          center: f.center(f.lab.moving),
        };
      });
      expect(r.after.x - r.before.x).toBeCloseTo(40);
      expect(r.after.y).toBeCloseTo(r.before.y);
      expect(r.endLayouts).toBe(r.layouts);
      expect(r.pixel).toEqual([0, 102, 0]);
      await page.mouse.click(r.center.x, r.center.y);
      expect(await page.evaluate(() => window.tweenProbe.lab.hits)).toBe(1);
    });
    test("Slider program Tween yields to a real drag; HP display stays separate", async ({
      page,
    }) => {
      const r = await page.evaluate(() => {
        const f = window.tweenProbe;
        f.focus(f.lab.volume);
        f.lab.animateValue();
        f.tick(0.5);
        return {
          value: f.lab.volume.value,
          changes: f.changes,
          commits: f.commits,
          track: f.track(),
          center: f.center(f.lab.volume),
        };
      });
      expect(r.value).toBe(73);
      expect(r.changes).toEqual([{ value: 73, source: "program" }]);
      expect(r.commits).toEqual([]);
      await page.mouse.move(r.track.x + r.track.width * 0.73, r.track.y);
      await page.mouse.down();
      await page.mouse.move(r.track.x + r.track.width * 0.25, r.track.y, {
        steps: 4,
      });
      await page.mouse.up();
      const next = await page.evaluate(() => {
        const f = window.tweenProbe,
          chosen = f.lab.volume.value;
        f.tick(0.5);
        const retained = f.lab.volume.value;
        f.lab.damage();
        const start = { value: f.lab.hp.value, display: f.lab.hp.displayValue };
        f.tick(0.35);
        const middle = f.lab.hp.displayValue;
        f.tick(0.35);
        return {
          chosen,
          retained,
          commits: f.commits,
          start,
          middle,
          end: f.lab.hp.displayValue,
        };
      });
      expect(next.chosen).toBeCloseTo(25, 0);
      expect(next.retained).toBe(next.chosen);
      expect(next.commits).toEqual([next.chosen]);
      expect(next.start).toEqual({ value: 75, display: 100 });
      expect(next.middle).toBeCloseTo(78.125);
      expect(next.end).toBe(75);
    });
    test("native selection and IME ownership survive animated editor geometry", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const f = window.tweenProbe;
        f.lab.ui.scale = 1.25;
        f.focus(f.lab.field);
      });
      const input = page.getByRole("textbox", {
        name: "Animated native field",
      });
      await input.fill("日本語A😀é");
      await input.press("Home");
      await input.press("Shift+ArrowRight");
      await input.dispatchEvent("compositionstart", { data: "" });
      const r = await page.evaluate(() => {
        const f = window.tweenProbe;
        f.translate();
        f.tick(0.5);
        const b = f.lab.field.bounds,
          s = f.lab.ui.scale;
        return { x: b.x * s, y: b.y * s, width: b.width * s };
      });
      const box = await input.boundingBox();
      expect(box).not.toBeNull();
      if (!box) throw Error("Native editor is not visible");
      expect(box.x).toBeCloseTo(r.x, 0);
      expect(box.y).toBeCloseTo(r.y, 0);
      expect(box.width).toBeCloseTo(r.width, 0);
      await expect(input).toBeFocused();
      expect(
        await input.evaluate((el) => [
          (el as HTMLInputElement).selectionStart,
          (el as HTMLInputElement).selectionEnd,
        ]),
      ).toEqual([0, 1]);
      const x = await page.evaluate(
        () => window.tweenProbe.snapshot().sprite.x,
      );
      await page.keyboard.down("d");
      await input.dispatchEvent("keydown", {
        key: "Enter",
        code: "Enter",
        isComposing: true,
        keyCode: 229,
      });
      await page.evaluate(() => window.tweenProbe.tick(0.1));
      expect(
        await page.evaluate(() => window.tweenProbe.snapshot().sprite.x),
      ).toBe(x);
      await page.keyboard.up("d");
      await input.dispatchEvent("compositionend", { data: "日本語" });
      await input.press("Escape");
      await input.press("Shift+Tab");
      await page.keyboard.down("d");
      await page.evaluate(() => window.tweenProbe.tick(0.1));
      await page.keyboard.up("d");
      expect(
        await page.evaluate(() => window.tweenProbe.snapshot().sprite.x),
      ).toBeGreaterThan(x);
    });
    test("Host display clock runs during pause, caps elapsed time and releases Scene owners", async ({
      page,
    }) => {
      const r = await page.evaluate(async () => {
        const f = window.tweenProbe;
        f.frame(5);
        const capped = f.snapshot().linear.offsetX;
        f.game.pause();
        f.lab.animateUI();
        f.frame(0);
        f.frame(0.05);
        const paused = f.snapshot().linear.offsetX,
          opacity = f.lab.preview.presentation.opacity;
        f.frame(5);
        const cappedOpacity = f.lab.preview.presentation.opacity;
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
        f.frame(30);
        const hiddenOpacity = f.lab.preview.presentation.opacity;
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => false,
        });
        document.dispatchEvent(new Event("visibilitychange"));
        f.frame(0);
        const restoredOpacity = f.lab.preview.presentation.opacity;
        const old = f.lab,
          view = f.linearView();
        const offset = view.offsetX;
        await f.game.goTo("empty");
        f.tick(0.5);
        const released = {
          sim: old.simulation.diagnostics.active,
          display: old.display.diagnostics.active,
          handles: old.handles.size,
          disposed: old.root.disposed,
          offset: view.offsetX,
        };
        await f.game.goTo("lab");
        const live = f.lab.simulation.diagnostics.active;
        const clean = f.dispose();
        return {
          capped,
          paused,
          opacity,
          cappedOpacity,
          hiddenOpacity,
          restoredOpacity,
          offset,
          released,
          live,
          clean,
        };
      });
      expect(r.capped).toBeCloseTo(4.5);
      expect(r.paused).toBe(r.capped);
      expect(r.opacity).toBeCloseTo(0.1);
      expect(r.cappedOpacity).toBeCloseTo(0.2);
      expect(r.hiddenOpacity).toBe(r.cappedOpacity);
      expect(r.restoredOpacity).toBe(r.cappedOpacity);
      expect(r.released).toEqual({
        sim: 0,
        display: 0,
        handles: 0,
        disposed: true,
        offset: r.offset,
      });
      expect(r.live).toBe(4);
      expect(r.clean.nodes).toBe(0);
      expect(await page.getByRole("textbox").count()).toBe(0);
    });
  });
