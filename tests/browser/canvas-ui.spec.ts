import { expect, type Page, test } from "@playwright/test";
import type { CharacterActor } from "@simpludify/web";

const url = `/@fs/${process.cwd()}/tests/browser/canvas-ui-fixture.ts`;
const sample = `/@fs/${process.cwd()}/examples/canvas-ui/main.ts`;
async function center(page: Page, key: "hold" | "click") {
  return page.evaluate(
    (key) => window.canvasProbe.center(window.canvasProbe[key]),
    key,
  );
}
async function boot(page: Page) {
  await page.evaluate(async (url) => {
    window.canvasProbe = await (await import(url)).canvasFixture();
  }, url);
}
for (const fallback of [false, true])
  test.describe(fallback ? "Canvas UI Canvas2D" : "Canvas UI WebGL", () => {
    const errors: string[] = [];
    test.beforeEach(async ({ page }) => {
      errors.length = 0;
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      if (fallback)
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "gpu", { get: () => undefined });
          for (const p of [
            HTMLCanvasElement.prototype,
            typeof OffscreenCanvas === "undefined"
              ? undefined
              : OffscreenCanvas.prototype,
          ]) {
            if (!p) continue;
            const get = p.getContext;
            p.getContext = function (
              this: HTMLCanvasElement | OffscreenCanvas,
              k: string,
              ...args: unknown[]
            ) {
              return k.includes("webgl")
                ? null
                : Reflect.apply(get, this, [k, ...args]);
            } as typeof p.getContext;
          }
        });
      await page.goto("/");
      await page.waitForFunction(() => !!window.demo);
    });
    test.afterEach(() => expect(errors).toEqual([]));
    test("draws real UI pixels, text and focus at DPR2, remains independent of Camera and skips idle layouts", async ({
      page,
    }) => {
      await boot(page);
      const r = await page.evaluate(() => {
        const f = window.canvasProbe,
          b = f.hold.bounds;
        const green = f.pixel(b.x + 4, b.y + 4),
          before = { ...f.root.diagnostics },
          syncs = f.renderer.canvasDiagnostics.syncs;
        for (let i = 0; i < 3; i++) f.step();
        const idle = { ...f.root.diagnostics },
          afterSync = f.renderer.canvasDiagnostics.syncs;
        f.game.camera.x = 400;
        f.game.camera.zoom = 2;
        f.game.setViewport();
        const camera = f.pixel(b.x + 4, b.y + 4);
        return {
          green,
          camera,
          before,
          idle,
          syncs,
          afterSync,
          buttons: f.renderer.canvasDiagnostics.buttons,
        };
      });
      expect(r.green).toEqual([0, 102, 0]);
      expect(r.camera).toEqual(r.green);
      expect(r.idle.layouts).toBe(r.before.layouts);
      expect(r.afterSync).toBe(r.syncs);
      expect(r.buttons).toBe(2);
      const c = await center(page, "click");
      await page.mouse.click(c.x, c.y);
      expect(await page.evaluate(() => window.canvasProbe.clicks)).toBe(1);
      expect(await page.evaluate(() => window.canvasProbe.label.text)).toBe(
        "Count 1",
      );
    });
    test("locks gestures from UI/world through drag and capture, cancels on disable and blur", async ({
      page,
    }) => {
      await boot(page);
      const p = await center(page, "hold");
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(320, 230);
      await page.evaluate(() => window.canvasProbe.step());
      expect(
        await page.evaluate(() =>
          window.canvasProbe.controls.value(window.canvasProbe.A.Move),
        ),
      ).toEqual({ x: 1, y: 0 });
      await page.mouse.up();
      await page.evaluate(() => window.canvasProbe.step());
      expect(await page.evaluate(() => window.canvasProbe.worldEvents)).toEqual(
        [],
      );
      expect(await page.evaluate(() => window.canvasProbe.holdEvents)).toEqual([
        true,
        false,
      ]);
      const world = await page.evaluate(() => {
        const c = window.canvasProbe.game.view.clip;
        return { x: c.x + c.width * 0.75, y: c.y + c.height * 0.5 };
      });
      await page.mouse.move(world.x, world.y);
      await page.mouse.down();
      await page.mouse.move(p.x, p.y);
      await page.mouse.up();
      expect(
        (await page.evaluate(() => window.canvasProbe.worldEvents)).some((e) =>
          e.startsWith("down"),
        ),
      ).toBe(true);
      expect(await page.evaluate(() => window.canvasProbe.holdEvents)).toEqual([
        true,
        false,
      ]);
      await page.mouse.down();
      await page.evaluate(() => {
        window.canvasProbe.hold.enabled = false;
        window.canvasProbe.step();
      });
      await page.mouse.up();
      expect(
        await page.evaluate(
          () => window.canvasProbe.game.pointerDiagnostics.captures,
        ),
      ).toBe(0);
      await page.evaluate(() => {
        window.canvasProbe.hold.enabled = true;
        window.canvasProbe.step();
      });
      await page.mouse.down();
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.mouse.up();
      expect(await page.evaluate(() => window.canvasProbe.holdEvents)).toEqual([
        true,
        false,
        true,
        false,
        true,
        false,
      ]);
    });
    test("supports CDP simultaneous touches and keyboard Action composition", async ({
      page,
    }) => {
      await boot(page);
      const p = await center(page, "hold"),
        client = await page.context().newCDPSession(page);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: p.x - 8, y: p.y, id: 1 },
          { x: p.x + 8, y: p.y, id: 2 },
        ],
      });
      await page.evaluate(() => window.canvasProbe.step());
      expect(await page.evaluate(() => window.canvasProbe.holdEvents)).toEqual([
        true,
      ]);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [{ x: p.x + 8, y: p.y, id: 2 }],
      });
      expect(await page.evaluate(() => window.canvasProbe.holdEvents)).toEqual([
        true,
      ]);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: [],
      });
      expect(await page.evaluate(() => window.canvasProbe.holdEvents)).toEqual([
        true,
        false,
      ]);
      await page.mouse.click(320, 230);
      await page.keyboard.down("a");
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      // Canvas pointers retain game focus; keyboard and touch/mouse contributions compose.
      await page.evaluate(() => window.canvasProbe.step());
      expect(
        await page.evaluate(
          () => window.canvasProbe.controls.value(window.canvasProbe.A.Move).x,
        ),
      ).toBe(0);
      await page.keyboard.up("a");
      await page.evaluate(() => window.canvasProbe.step());
      expect(
        await page.evaluate(
          () => window.canvasProbe.controls.value(window.canvasProbe.A.Move).x,
        ),
      ).toBe(1);
      await page.mouse.up();
      await page.evaluate(() => window.canvasProbe.step());
      expect(
        await page.evaluate(
          () => window.canvasProbe.controls.value(window.canvasProbe.A.Move).x,
        ),
      ).toBe(0);
    });
    test("Tab focus, Enter/Space, disabled/hidden state and Scene cleanup stay synchronized", async ({
      page,
    }) => {
      await boot(page);
      await page.locator(".simpludify").focus();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Move right", exact: true }),
      ).toBeFocused();
      await page.keyboard.down("Space");
      await page.evaluate(() => window.canvasProbe.step());
      expect(await page.evaluate(() => window.canvasProbe.hold.held)).toBe(
        true,
      );
      await page.keyboard.up("Space");
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Count", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      expect(await page.evaluate(() => window.canvasProbe.clicks)).toBe(1);
      await page.evaluate(() => {
        window.canvasProbe.click.visible = false;
        window.canvasProbe.step();
      });
      await expect(
        page.getByRole("button", { name: "Count", exact: true }),
      ).toHaveCount(0);
      const r = await page.evaluate(async () => {
        const f = window.canvasProbe,
          old = f.root,
          controls = f.controls;
        await f.game.goTo("empty");
        const left = {
          disposed: old.disposed,
          sources: controls.sourceCount,
          held: f.game.pointerDiagnostics.heldNodes,
          captures: f.game.pointerDiagnostics.captures,
        };
        await f.game.goTo("first");
        f.game.dispose();
        return {
          left,
          visuals: f.renderer.canvasDiagnostics,
          mirrors: document.querySelectorAll(".s-canvas-accessibility").length,
          input: f.game.engine.input.sourceCount,
        };
      });
      expect(r.left).toEqual({
        disposed: true,
        sources: 0,
        held: 0,
        captures: 0,
      });
      expect(r.visuals.nodes).toBe(0);
      expect(r.visuals.presentations).toBe(0);
      expect(r.mirrors).toBe(0);
      expect(r.input).toBe(0);
    });
    test("resizes, applies UI scale, clips hits and cleans staged/failing preparation", async ({
      page,
    }) => {
      await boot(page);
      const r = await page.evaluate(async () => {
        const f = window.canvasProbe;
        f.root.scale = 1.5;
        f.game.setViewport();
        const c = f.center(f.click),
          pixel = f.pixel(f.hold.bounds.x * 1.5 + 4, f.hold.bounds.y * 1.5 + 4);
        const before = f.root.diagnostics.layouts;
        f.game.element.style.height = "500px";
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        let failure = "";
        try {
          await f.game.goTo("broken");
        } catch (e) {
          failure = String(e);
        }
        const failed = f.failed?.disposed;
        const navigation = f.game.goTo("slow");
        await new Promise((r) => setTimeout(r, 0));
        const stagedButtons = document.querySelectorAll(
          ".s-canvas-accessibility button",
        ).length;
        f.game.dispose();
        let disposed = "";
        try {
          await navigation;
        } catch (e) {
          disposed = String(e);
        }
        f.finishSlow();
        return {
          c,
          pixel,
          before,
          after: f.root.diagnostics.layouts,
          failure,
          failed,
          stagedButtons,
          stagedDisposed: f.staged?.disposed,
          disposed,
        };
      });
      expect(r.pixel).toEqual([0, 102, 0]);
      expect(r.after).toBeGreaterThan(r.before);
      expect(r.failure).toContain("expected setup failure");
      expect(r.failed).toBe(true);
      expect(r.stagedButtons).toBe(2);
      expect(r.stagedDisposed).toBe(true);
      expect(r.disposed).toContain("disposed");
    });
    test("matches nested clips and later-sibling paint priority to real hit tests", async ({
      page,
    }) => {
      await boot(page);
      const r = await page.evaluate(
        async (url) => (await import(url)).clippingAndPaint(window.canvasProbe),
        url,
      );
      expect(r.inside).toEqual([0, 0, 255]);
      expect(r.outside).toEqual([0, 0, 0]);
      expect(r.clipInside).toBe(true);
      expect(r.clipOutside).toBe(false);
      expect(r.front).toEqual([0, 170, 0]);
      expect(r.frontHit).toBe(true);
    });
    test("releases held Scene gestures and ignores their remaining motion in the replacement Scene", async ({
      page,
    }) => {
      await boot(page);
      const p = await center(page, "hold");
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      const r = await page.evaluate(async () => {
        const f = window.canvasProbe,
          old = f.root;
        await f.game.goTo("empty");
        return {
          disposed: old.disposed,
          holds: f.holdEvents,
          d: f.game.pointerDiagnostics,
        };
      });
      expect(r.disposed).toBe(true);
      expect(r.holds).toEqual([true, false]);
      expect(r.d.captures).toBe(0);
      expect(r.d.suppressedPointers).toBe(1);
      await page.mouse.move(320, 400);
      await page.mouse.up();
      expect(
        await page.evaluate(
          () => window.canvasProbe.game.pointerDiagnostics.suppressedPointers,
        ),
      ).toBe(0);
    });
    test("draws keyboard focus, preserves DOM overlay priority and reports callback errors through Game", async ({
      page,
    }) => {
      await boot(page);
      await page
        .getByRole("button", { name: "Move right", exact: true })
        .focus();
      const ring = await page.evaluate(() => {
        const f = window.canvasProbe,
          b = f.hold.bounds;
        f.step();
        return f.pixel(b.x + 3, b.y + b.height / 2);
      });
      expect(ring).toEqual([255, 211, 107]);
      const p = await center(page, "click");
      await page.evaluate((p) => {
        const f = window.canvasProbe,
          b = document.createElement("button");
        b.textContent = "Native overlay";
        b.style.cssText = `position:absolute;z-index:5;left:${p.x - 30}px;top:${p.y - 15}px;width:100px;height:40px`;
        b.onclick = () => {
          f.label.setText("Native clicked");
        };
        f.game.element.append(b);
        f.game.engine.scene.onDispose(() => b.remove());
      }, p);
      await page.mouse.click(p.x, p.y);
      expect(await page.evaluate(() => window.canvasProbe.clicks)).toBe(0);
      expect(await page.evaluate(() => window.canvasProbe.label.text)).toBe(
        "Native clicked",
      );
      const q = await page.evaluate(
        async (url) => (await import(url)).throwingHold(window.canvasProbe),
        url,
      );
      await page.mouse.move(q.x, q.y);
      await page.mouse.down();
      await page.mouse.up();
      expect(
        await page.evaluate(() =>
          window.canvasProbe.errors.some((e) => e.includes("Pointer")),
        ),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => window.canvasProbe.game.pointerDiagnostics.captures,
        ),
      ).toBe(0);
    });
    test("actual integrated Canvas trail starts, moves into collision, pauses and recreates Scenes", async ({
      page,
    }) => {
      await page.evaluate(async (sample) => {
        window.demo.dispose();
        document.body.replaceChildren();
        await import(sample);
      }, sample);
      const click = async (name: string) => {
        const p = await page.evaluate((name) => {
          const b = window.canvasDemo.buttons[name]?.bounds;
          if (!b) throw Error("Missing sample button");
          return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        }, name);
        await page.mouse.click(p.x, p.y);
      };
      await click("Start");
      await page.waitForFunction(
        () => window.canvasDemo.game.engine.scene.id === "field",
      );
      await page.mouse.click(340, 350);
      await page.keyboard.down("d");
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                (
                  window.canvasDemo.game.engine.scene.find("explorer") as
                    | CharacterActor
                    | undefined
                )?.x,
            ),
          { timeout: 20000 },
        )
        .toBe(434);
      await page.keyboard.up("d");
      await click("Pause");
      expect(await page.evaluate(() => window.canvasDemo.game.paused)).toBe(
        true,
      );
      await click("Pause");
      expect(await page.evaluate(() => window.canvasDemo.game.paused)).toBe(
        false,
      );
      await click("Menu");
      await page.waitForFunction(
        () => window.canvasDemo.game.engine.scene.id === "title",
      );
      await click("Start");
      await page.waitForFunction(
        () => window.canvasDemo.game.engine.scene.id === "field",
      );
      expect(
        await page.evaluate(
          () =>
            (
              window.canvasDemo.game.engine.scene.find("explorer") as
                | CharacterActor
                | undefined
            )?.x,
        ),
      ).toBe(250);
    });
  });
