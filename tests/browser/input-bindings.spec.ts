import { expect, type Page, test } from "@playwright/test";

const sample = `/@fs/${process.cwd()}/examples/input-bindings/main.ts`;
const route = `/@fs/${process.cwd()}/examples/input-bindings/index.html`;
declare global {
  interface Window {
    bindingLab: typeof import("../../examples/input-bindings/main");
    bindingCapture: import("@simpludify/core").InputCapture;
    bindingPad: {
      index: number;
      id: string;
      mapping: string;
      connected: boolean;
      axes: number[];
      buttons: { value: number; pressed: boolean }[];
    };
  }
}
async function worldPoint(page: Page) {
  return page.evaluate(() => {
    const { game } = window.bindingLab,
      r = game.element.getBoundingClientRect(),
      v = game.view.clip,
      sx = r.width / game.element.clientWidth,
      sy = r.height / game.element.clientHeight;
    return {
      x: r.left + (v.x + v.width * 0.55) * sx,
      y: r.top + (v.y + v.height * 0.72) * sy,
    };
  });
}
async function state(page: Page) {
  return page.evaluate(() => {
    const { game, current: c, Actions: a } = window.bindingLab;
    game.engine.step(0);
    return {
      jump: c.controls.value(a.Jump),
      attack: c.controls.value(a.Attack),
      move: c.controls.value(a.Move),
      presses: c.presses,
      clicks: c.uiClicks,
      capture: window.bindingCapture?.state,
    };
  });
}
for (const fallback of [false, true])
  test.describe(`Bindings ${fallback ? "Canvas2D" : "WebGL"}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((fallback) => {
        if (fallback) {
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
              name: string,
              ...args: unknown[]
            ) {
              return name.includes("webgl")
                ? null
                : Reflect.apply(get, this, [name, ...args]);
            } as typeof proto.getContext;
          }
        }
        window.bindingPad = {
          index: 0,
          id: "Standard test pad",
          mapping: "standard",
          connected: true,
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({
            value: 0,
            pressed: false,
          })),
        };
        Object.defineProperty(navigator, "getGamepads", {
          value: () => [window.bindingPad],
        });
      }, fallback);
      await page.goto(route);
      await expect(
        page.getByRole("button", { name: "Capture Jump input", exact: true }),
      ).toBeVisible();
      await page.evaluate(async (sample) => {
        window.bindingLab = await import(sample);
      }, sample);
      await page.locator(".simpludify").focus();
      await state(page);
    });
    test("all mouse buttons and chord masks feed Actions, retain world pointers and respect UI ownership", async ({
      page,
    }) => {
      const p = await worldPoint(page),
        cdp = await page.context().newCDPSession(page);
      for (const [button, mask, index] of [
        ["left", 1, 0],
        ["middle", 4, 1],
        ["right", 2, 2],
        ["back", 8, 3],
        ["forward", 16, 4],
      ] as const) {
        await page.evaluate((button) => {
          const { current: c, Actions: a } = window.bindingLab;
          c.controls.rebind(a.Jump, { mouse: [button] });
        }, index);
        await cdp.send("Input.dispatchMouseEvent", {
          type: "mousePressed",
          ...p,
          button,
          buttons: mask,
          clickCount: 1,
        });
        expect((await state(page)).jump).toBe(true);
        await cdp.send("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          ...p,
          button,
          buttons: 0,
          clickCount: 1,
        });
        expect((await state(page)).jump).toBe(false);
      }
      await page.evaluate(() => {
        const { current: c, Actions: a } = window.bindingLab;
        c.controls.rebind(a.Jump, { mouse: [0, 2] });
      });
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.down({ button: "right" });
      expect((await state(page)).jump).toBe(true);
      await page.mouse.up();
      expect((await state(page)).jump).toBe(true);
      await page.mouse.up({ button: "right" });
      expect((await state(page)).jump).toBe(false);
      const uiPoint = await page.evaluate(() => {
        const { game, current: c } = window.bindingLab;
        const b = c.canvasButton.bounds,
          r = game.element.getBoundingClientRect();
        return { x: r.left + b.x + b.width / 2, y: r.top + b.y + b.height / 2 };
      });
      await page.mouse.click(uiPoint.x, uiPoint.y);
      expect(await state(page)).toMatchObject({ clicks: 1, jump: false });
      // A mouse-owned virtual stick must not also trigger the mouse Button binding.
      const stick = await page.evaluate(() => {
        const { game } = window.bindingLab,
          r = game.element.getBoundingClientRect(),
          v = game.viewport,
          sx = r.width / game.element.clientWidth,
          sy = r.height / game.element.clientHeight;
        return {
          x: r.left + (v.x + v.width * 0.18) * sx,
          y: r.top + (v.y + v.height * 0.78) * sy,
        };
      });
      await page.mouse.move(stick.x, stick.y);
      await page.mouse.down();
      await page.mouse.move(stick.x + 30, stick.y);
      expect((await state(page)).move.x).toBeGreaterThan(0);
      expect((await state(page)).jump).toBe(false);
      await page.mouse.up();
    });
    test("keyboard, mouse and pad OR, runtime edits and version-1 persistence retain the same Actor", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const { current: c, Actions: a } = window.bindingLab,
          actor = c.actor;
        c.controls.addBindings(a.Attack, {
          keys: ["Space"],
          gamepad: { buttons: [0] },
        });
        const saved = c.controls.exportBindings();
        c.controls.rebind(a.Jump, {});
        c.controls.importBindings(saved);
        return {
          same: actor === c.actor,
          conflicts: c.controls.conflicts("all").length,
          equal:
            JSON.stringify(saved) ===
            JSON.stringify(c.controls.exportBindings()),
        };
      });
      expect(result).toMatchObject({ same: true, equal: true });
      expect(result.conflicts).toBeGreaterThan(0);
      await page.keyboard.down("Space");
      expect(await state(page)).toMatchObject({ jump: true, attack: true });
      await page.evaluate(() => {
        window.bindingPad.buttons[0] = { value: 1, pressed: true };
      });
      await state(page);
      await page.keyboard.up("Space");
      expect((await state(page)).jump).toBe(true);
      await page.evaluate(() => {
        window.bindingPad.buttons[0] = { value: 0, pressed: false };
      });
      expect((await state(page)).jump).toBe(false);
    });
    test("opening mouse hold arms after release; captures modifiers/Escape and suppresses gameplay until fresh input", async ({
      page,
    }) => {
      const p = await worldPoint(page);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.evaluate(() => {
        window.bindingCapture = window.bindingLab.current.begin([
          "keyboard",
          "mouse",
        ]);
      });
      expect((await state(page)).capture).toBe("arming");
      await page.mouse.up();
      expect((await state(page)).capture).toBe("listening");
      const presses = (await state(page)).presses;
      await page.keyboard.down("Shift");
      const captured = await page.evaluate(
        async () => await window.bindingCapture.result,
      );
      expect(captured).toMatchObject({
        device: "keyboard",
        code: "ShiftLeft",
        binding: { keys: ["ShiftLeft"] },
      });
      expect(await state(page)).toMatchObject({ jump: false, presses });
      await page.keyboard.down("Shift");
      expect((await state(page)).jump).toBe(false);
      await page.keyboard.up("Shift");
      await page.keyboard.down("Shift");
      expect((await state(page)).jump).toBe(true);
      await page.keyboard.up("Shift");
      await page.evaluate(() => {
        window.bindingCapture = window.bindingLab.current.begin(["keyboard"]);
      });
      await page.keyboard.press("Escape");
      expect(
        await page.evaluate(async () => await window.bindingCapture.result),
      ).toMatchObject({ code: "Escape" });
    });
    test("keyboard activation of a native capture button waits for the opening hold", async ({
      page,
    }) => {
      await page
        .getByRole("button", { name: "Capture Jump input", exact: true })
        .focus();
      await page.keyboard.down("Enter");
      await page.evaluate(() => {
        const capture = window.bindingLab.capture;
        if (!capture) throw new Error("Missing keyboard-opened capture");
        window.bindingCapture = capture;
      });
      expect((await state(page)).capture).toBe("arming");
      await page.keyboard.press("r");
      expect((await state(page)).capture).toBe("arming");
      await page.keyboard.up("Enter");
      expect((await state(page)).capture).toBe("listening");
      await page.keyboard.press("Alt");
      expect(
        await page.evaluate(async () => await window.bindingCapture.result),
      ).toMatchObject({ device: "keyboard", code: "AltLeft" });
    });
    test("captures mouse/pad after neutral baselines, with explicit cancellation and Scene/blur/pause cleanup", async ({
      page,
    }) => {
      const cdp = await page.context().newCDPSession(page);
      await page
        .getByRole("button", { name: "Capture Jump input", exact: true })
        .click();
      await page.evaluate(() => {
        const capture = window.bindingLab.capture;
        if (!capture) throw new Error("Missing capture session");
        window.bindingCapture = capture;
      });
      await expect
        .poll(async () => (await state(page)).capture)
        .toBe("listening");
      const p = await page.evaluate(() => {
        const r = window.bindingLab.game.element.getBoundingClientRect();
        return { x: r.right - 12, y: r.bottom - 12 };
      });
      expect(
        await page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
          p,
        ),
      ).toBe("CANVAS");
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        ...p,
        button: "forward",
        buttons: 16,
        clickCount: 1,
      });
      await expect
        .poll(async () => (await state(page)).capture)
        .toBe("completed");
      expect(
        await page.evaluate(async () => await window.bindingCapture.result),
      ).toMatchObject({ device: "mouse", button: 4 });
      expect((await state(page)).jump).toBe(false);
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        ...p,
        button: "forward",
        buttons: 0,
        clickCount: 1,
      });
      await page.evaluate(() => {
        window.bindingPad.buttons[0] = { value: 1, pressed: true };
        window.bindingCapture = window.bindingLab.current.begin(["gamepad"]);
      });
      expect((await state(page)).capture).toBe("arming");
      await page.evaluate(() => {
        window.bindingPad.buttons[0] = { value: 0, pressed: false };
      });
      expect((await state(page)).capture).toBe("listening");
      await page.evaluate(() => {
        window.bindingPad.buttons[1] = { value: 1, pressed: true };
      });
      await state(page);
      expect(
        await page.evaluate(async () => await window.bindingCapture.result),
      ).toMatchObject({
        device: "gamepad",
        index: 0,
        button: 1,
        mapping: "standard",
      });
      expect((await state(page)).jump).toBe(false);
      for (const kind of [
        "cancel",
        "blur",
        "pause",
        "scene",
        "owner",
        "editing",
        "reset",
        "replay",
      ] as const) {
        await page.locator(".simpludify").focus();
        const result = await page.evaluate(
          async ({ kind, core }) => {
            const { game } = window.bindingLab;
            const { Lifetime } = await import(core);
            const owner = new Lifetime();
            const capture = game.captureInput({ devices: ["keyboard"], owner });
            if (kind === "cancel") capture.cancel();
            if (kind === "blur") window.dispatchEvent(new Event("blur"));
            if (kind === "pause") {
              game.pause();
              game.resume();
            }
            if (kind === "scene") await game.goTo("play");
            if (kind === "owner") owner.dispose();
            if (kind === "editing") {
              const field = document.createElement("input");
              game.element.append(field);
              field.focus();
              field.remove();
            }
            if (kind === "reset") game.engine.input.clear();
            if (kind === "replay") {
              game.engine.input.lockPlayback();
              game.engine.input.unlockPlayback();
            }
            return {
              state: capture.state,
              result: await capture.result,
              live: game.engine.input.liveInput,
            };
          },
          { kind, core: `/@fs/${process.cwd()}/packages/core/src/index.ts` },
        );
        expect(result).toEqual({
          state: "cancelled",
          result: undefined,
          live: true,
        });
      }
      const disposed = await page.evaluate(() => {
        const { game } = window.bindingLab;
        const c = game.captureInput({ devices: ["keyboard"] });
        game.dispose();
        return {
          state: c.state,
          sources: game.engine.input.sourceCount,
          captures: game.pointerDiagnostics.captures,
        };
      });
      expect(disposed).toEqual({ state: "cancelled", sources: 0, captures: 0 });
    });
  });
