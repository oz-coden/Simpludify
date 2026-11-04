import { expect, type Page, test } from "@playwright/test";

const sample = `/@fs/${process.cwd()}/examples/unified-input/main.ts`;
const route = `/@fs/${process.cwd()}/examples/unified-input/index.html`;
interface MockPad {
  id: string;
  index: number;
  connected: boolean;
  mapping: string;
  axes: number[];
  buttons: { value: number; pressed: boolean }[];
}
declare global {
  interface Window {
    inputLab: typeof import("../../examples/unified-input/main");
    mockPads: (MockPad | null)[];
    padEvent(type: string, index: number): void;
  }
}
async function step(page: Page) {
  await page.evaluate(() => window.inputLab.game.engine.step(0));
}
async function focus(page: Page) {
  await page.locator(".simpludify").focus();
  await step(page);
}
for (const fallback of [false, true])
  test.describe(`Unified input ${fallback ? "Canvas2D" : "WebGL"}`, () => {
    test.beforeEach(async ({ page }, info) => {
      if (!fallback) info.setTimeout(60_000);
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
        window.mockPads = [0, 1].map((index) => ({
          id: index === 0 ? "Xbox mock" : "DualSense mock",
          index,
          connected: true,
          mapping: "standard",
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({
            value: 0,
            pressed: false,
          })),
        }));
        Object.defineProperty(navigator, "getGamepads", {
          configurable: true,
          value: () => window.mockPads,
        });
        window.padEvent = (type, index) => {
          const event = new Event(type);
          Object.defineProperty(event, "gamepad", {
            value: window.mockPads[index],
          });
          window.dispatchEvent(event);
        };
      }, fallback);
      await page.goto(route);
      await expect(
        page.getByRole("heading", { name: "Unified input · 2 players" }),
      ).toBeVisible();
      await page.evaluate(async (sample) => {
        window.inputLab = await import(sample);
      }, sample);
      await focus(page);
    });
    test("independent pads, keyboard composition, metadata and program handoff preserve the same Actors", async ({
      page,
    }, info) => {
      const result = await page.evaluate(() => {
        const { game, players, Actions } = window.inputLab,
          a = players[0],
          b = players[1],
          p = window.mockPads[0],
          q = window.mockPads[1];
        if (!a || !b || !p || !q) throw new Error("Missing fixture");
        const actor = a.actor;
        p.axes[0] = 0.575;
        q.axes[1] = -1;
        game.engine.step(0);
        const split = [
          a.controls.value(Actions.Move),
          b.controls.value(Actions.Move),
        ];
        a.setMode("Program");
        a.program.set(Actions.Move, { x: -0.5, y: 0 });
        const before = actor.x;
        game.engine.step(0.1);
        return {
          split,
          after: a.controls.value(Actions.Move),
          same: a.actor === actor,
          moved: actor.x < before,
          devices: game.gamepads.devices,
        };
      });
      expect(result.split[0]?.x).toBeCloseTo(0.5);
      expect(result.split[1]).toEqual({ x: 0, y: -1 });
      expect(result.after).toEqual({ x: -0.5, y: 0 });
      expect(result.same).toBe(true);
      expect(result.moved).toBe(true);
      expect(result.devices).toMatchObject([
        {
          index: 0,
          id: "Xbox mock",
          mapping: "standard",
          inferredLayout: "xbox",
        },
        {
          index: 1,
          id: "DualSense mock",
          mapping: "standard",
          inferredLayout: "playstation",
        },
      ]);
      await expect(
        page.locator(".s-canvas-label").filter({ hasText: "P2: South=×" }),
      ).toHaveCount(1);
      await page.evaluate(() => {
        const { players } = window.inputLab;
        players[0]?.setMode("Keyboard + pad");
        const p = window.mockPads[0];
        if (p) p.axes[0] = 0;
      });
      await step(page);
      await page.keyboard.down("d");
      await step(page);
      expect(
        await page.evaluate(
          () =>
            window.inputLab.players[0]?.controls.value(
              window.inputLab.Actions.Move,
            ).x,
        ),
      ).toBe(1);
      await page.keyboard.up("d");
      await page.screenshot({ path: info.outputPath("unified-input.png") });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
    test("disconnect, reconnect, assignment and pause never restore held controls; Scene disposal releases sources", async ({
      page,
    }) => {
      const result = await page.evaluate(async () => {
        const { game, players, Actions } = window.inputLab,
          a = players[0],
          p = window.mockPads[0];
        if (!a || !p) throw new Error("Missing fixture");
        p.axes[0] = 1;
        p.buttons[0] = { value: 1, pressed: true };
        game.engine.step(0);
        window.padEvent("gamepaddisconnected", 0);
        game.engine.step(0);
        const released = a.controls.button(Actions.Fire),
          disconnected = game.gamepads.devices.length;
        window.padEvent("gamepadconnected", 0);
        game.engine.step(0);
        const reconnect = a.controls.value(Actions.Move);
        p.axes[0] = 0;
        p.buttons[0] = { value: 0, pressed: false };
        game.engine.step(0);
        p.axes[0] = 1;
        game.engine.step(0);
        game.pause();
        game.engine.step(0);
        game.resume();
        game.engine.step(0);
        const resumed = a.controls.value(Actions.Move);
        const old = a.pad;
        await game.goTo("play");
        return {
          released,
          disconnected,
          reconnect,
          resumed,
          oldDisposed: old.disposed,
          sources: game.engine.input.sourceCount,
          newSources: window.inputLab.players.every((p) => !p.pad.disposed),
        };
      });
      expect(result.released).toMatchObject({ held: false, released: true });
      expect(result.disconnected).toBe(1);
      expect(result.reconnect).toEqual({ x: 0, y: 0 });
      expect(result.resumed).toEqual({ x: 0, y: 0 });
      expect(result.oldDisposed).toBe(true);
      expect(result.newSources).toBe(true);
      // Game owns one keyboard and one mouse source outside the Scene.
      expect(result.sources).toBe(16);
    });
    test("Canvas touch writes the same Actions and native editing suppresses physical gamepad/keyboard input", async ({
      page,
      context,
    }) => {
      const button = page.getByRole("button", {
        name: "P1 Right",
        exact: true,
      });
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      if (!box) throw new Error("Missing touch button");
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 },
        ],
      });
      await step(page);
      expect(
        await page.evaluate(
          () =>
            window.inputLab.players[0]?.controls.value(
              window.inputLab.Actions.Move,
            ).x,
        ),
      ).toBe(1);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await step(page);
      const notes = page.getByRole("textbox", { name: "Notes", exact: true });
      await notes.focus();
      await page.evaluate(() => {
        const p = window.mockPads[0];
        if (p) p.axes[0] = 1;
      });
      await page.keyboard.down("d");
      await step(page);
      await step(page);
      expect(
        await page.evaluate(() =>
          window.inputLab.players[0]?.controls.value(
            window.inputLab.Actions.Move,
          ),
        ),
      ).toEqual({ x: 0, y: 0 });
      await page.keyboard.up("d");
      await focus(page);
      expect(
        await page.evaluate(
          () =>
            window.inputLab.players[0]?.controls.value(
              window.inputLab.Actions.Move,
            ).x,
        ),
      ).toBe(0);
      await page.evaluate(() => {
        const p = window.mockPads[0];
        if (p) p.axes[0] = 0;
      });
      await step(page);
      await page.evaluate(() => {
        const p = window.mockPads[0];
        if (p) p.axes[0] = 1;
      });
      await step(page);
      expect(
        await page.evaluate(
          () =>
            window.inputLab.players[0]?.controls.value(
              window.inputLab.Actions.Move,
            ).x,
        ),
      ).toBe(1);
      await page.evaluate(() => window.inputLab.game.dispose());
      await expect(page.locator(".simpludify")).toHaveCount(0);
    });
  });
