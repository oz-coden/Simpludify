import { expect, type Page, test } from "@playwright/test";

const sample = `/@fs/${process.cwd()}/examples/virtual-input/main.ts`;
const route = `/@fs/${process.cwd()}/examples/virtual-input/index.html`;
declare global {
  interface Window {
    virtualLab: typeof import("../../examples/virtual-input/main");
    virtualIdentity: object;
  }
}
async function values(page: Page) {
  return page.evaluate(() => {
    const { game, current: c, Actions: a } = window.virtualLab;
    game.engine.step(0);
    return {
      move: c.controls.value(a.Move),
      aim: c.controls.value(a.Aim),
      fire: c.controls.value(a.Fire),
      boost: c.controls.value(a.Boost),
      ids: [c.move.pointerId, c.aim.pointerId],
      pressed: [c.move.pressed, c.aim.pressed, c.fire.pressed],
      commits: c.commits,
      cancels: c.cancels,
      captures: game.pointerDiagnostics.captures,
    };
  });
}
async function points(page: Page) {
  return page.evaluate(() => {
    const { game, current: c } = window.virtualLab,
      v = game.viewport,
      r = game.element.getBoundingClientRect();
    const point = (x: number, y: number) => ({
      x: r.left + ((v.x + x * v.width) * r.width) / game.element.clientWidth,
      y: r.top + ((v.y + y * v.height) * r.height) / game.element.clientHeight,
    });
    return {
      move: point(0.22, 0.68),
      aim: point(0.78, 0.68),
      fire: point(0.85, 0.25),
      gap: point(0.5, 0.68),
      radius: c.move.radius,
    };
  });
}
for (const fallback of [false, true])
  test.describe(`Virtual input ${fallback ? "Canvas2D" : "WebGL"}`, () => {
    test.beforeEach(async ({ page }, info) => {
      info.setTimeout(60_000);
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
              name: string,
              ...args: unknown[]
            ) {
              return name.includes("webgl")
                ? null
                : Reflect.apply(get, this, [name, ...args]);
            } as typeof proto.getContext;
          }
        });
      await page.goto(route);
      await expect(
        page.getByRole("heading", { name: "Virtual input · move + aim" }),
      ).toBeVisible();
      await page.evaluate(async (sample) => {
        window.virtualLab = await import(sample);
      }, sample);
    });
    test("real crossing touch IDs retain sticks and coexist with a virtual button", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const { game, current: c } = window.virtualLab;
        game.pause();
        c.move.mode = "floating";
        c.aim.mode = "floating";
      });
      const p = await points(page),
        cdp = await page.context().newCDPSession(page);
      const touches = [
        { id: 10, ...p.move },
        { id: 20, ...p.aim },
      ];
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: touches,
      });
      const before = await values(page);
      expect(before.ids[0]).toBeDefined();
      expect(before.ids[1]).toBeDefined();
      expect(before.ids[0]).not.toBe(before.ids[1]);
      const crossed = [
        { id: 10, ...p.aim },
        { id: 20, ...p.move },
      ];
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: crossed,
      });
      const after = await values(page);
      expect(after.ids).toEqual(before.ids);
      expect(after.move.x).toBeGreaterThan(0.9);
      expect(after.aim.x).toBeLessThan(-0.9);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [...crossed, { id: 30, ...p.fire }],
      });
      expect((await values(page)).fire).toBe(true);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: crossed,
      });
      expect((await values(page)).commits).toBe(1);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: [],
      });
      const end = await values(page);
      expect(end.move).toEqual({ x: 0, y: 0 });
      expect(end.aim).toEqual({ x: 0, y: 0 });
      expect(end.fire).toBe(false);
      expect(end.pressed).toEqual([false, false, false]);
      await cdp.detach();
    });
    test("mouse modes, hidden input, disable and program handoff keep the same Actor", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const { game, current: c } = window.virtualLab;
        game.pause();
        window.virtualIdentity = c.actor;
      });
      let p = await points(page);
      await page.mouse.move(p.move.x, p.move.y);
      await page.mouse.down();
      await page.mouse.move(p.move.x + p.radius * 0.6, p.move.y);
      expect((await values(page)).move.x).toBeCloseTo((0.6 - 0.15) / 0.85, 1);
      await page.evaluate(() => {
        window.virtualLab.current.virtual.visible = false;
      });
      await page.mouse.move(p.move.x + p.radius, p.move.y);
      expect((await values(page)).move.x).toBeCloseTo(1);
      await page.evaluate(() => {
        window.virtualLab.current.virtual.enabled = false;
        window.virtualLab.current.virtual.enabled = true;
      });
      await page.mouse.move(p.move.x + p.radius * 0.5, p.move.y);
      expect((await values(page)).move).toEqual({ x: 0, y: 0 });
      await page.mouse.up();
      for (const mode of ["floating", "follow"] as const) {
        await page.evaluate((mode) => {
          const c = window.virtualLab.current;
          c.virtual.visible = true;
          c.move.mode = mode;
        }, mode);
        p = await points(page);
        await page.mouse.move(p.move.x, p.move.y);
        await page.mouse.down();
        await page.mouse.move(p.move.x + p.radius * 2, p.move.y);
        expect((await values(page)).move.x).toBeCloseTo(1);
        const center = await page.evaluate(
          () => window.virtualLab.current.move.center.x,
        );
        expect(center).toBeCloseTo(
          p.move.x + (mode === "follow" ? p.radius : 0),
          0,
        );
        await page.mouse.up();
      }
      await page
        .getByRole("button", { name: "Program: off", exact: true })
        .press("Enter");
      const same = await page.evaluate(() => {
        const { game, current: c, Actions: a } = window.virtualLab;
        game.engine.step(0);
        return {
          same: c.actor === window.virtualIdentity,
          value: c.controls.value(a.Move),
        };
      });
      expect(same.same).toBe(true);
      expect(same.value).toEqual({ x: 0.5, y: 0 });
    });
    test("Canvas UI wins over wide activation areas and the center stays unclaimed", async ({
      page,
    }) => {
      await page.evaluate(() => window.virtualLab.game.pause());
      const button = await page.evaluate(() => {
        const { current: c } = window.virtualLab;
        const node = c.world.children[0];
        if (!node) throw Error("Missing Canvas control");
        return { ...node.bounds };
      });
      await page.mouse.click(
        button.x + button.width / 2,
        button.y + button.height / 2,
      );
      expect(
        await page.evaluate(() => window.virtualLab.current.priorityClicks),
      ).toBe(1);
      expect((await values(page)).pressed).toEqual([false, false, false]);
      const p = await points(page);
      await page.mouse.move(p.gap.x, p.gap.y);
      await page.mouse.down();
      expect((await values(page)).pressed).toEqual([false, false, false]);
      await page.mouse.move(p.move.x, p.move.y);
      expect((await values(page)).pressed).toEqual([false, false, false]);
      await page.mouse.up();
      await page
        .getByRole("button", { name: "Stick: fixed", exact: true })
        .press("Enter");
      expect(
        await page.evaluate(() => window.virtualLab.current.move.mode),
      ).toBe("floating");
    });
    test("resize, lost capture, blur, focus loss and Scene disposal release all contributions", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const { game, current: c } = window.virtualLab;
        game.pause();
        c.move.mode = "floating";
      });
      let p = await points(page);
      await page.mouse.move(p.move.x, p.move.y);
      await page.mouse.down();
      await page.mouse.move(p.move.x + p.radius, p.move.y);
      expect((await values(page)).move.x).toBeCloseTo(1);
      await page.evaluate(() => {
        const { game, current: c } = window.virtualLab;
        const id = c.move.pointerId;
        if (id !== undefined) game.element.releasePointerCapture(id);
      });
      expect((await values(page)).move).toEqual({ x: 0, y: 0 });
      await page.mouse.up();
      p = await points(page);
      await page.mouse.move(p.move.x, p.move.y);
      await page.mouse.down();
      await page.mouse.move(p.move.x + p.radius, p.move.y);
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      expect((await values(page)).move).toEqual({ x: 0, y: 0 });
      await page.mouse.up();
      await page.locator(".simpludify").focus();
      p = await points(page);
      await page.mouse.move(p.move.x, p.move.y);
      await page.mouse.down();
      await page.mouse.move(p.move.x + p.radius, p.move.y);
      await page.evaluate(() => {
        const input = document.createElement("input");
        input.id = "outside-focus";
        document.body.append(input);
        input.focus();
      });
      expect((await values(page)).move).toEqual({ x: 0, y: 0 });
      await page.mouse.up();
      await page.evaluate(() =>
        document.querySelector("#outside-focus")?.remove(),
      );
      p = await points(page);
      await page.mouse.move(p.move.x, p.move.y);
      await page.mouse.down();
      await page.mouse.move(p.move.x + p.radius, p.move.y);
      const viewport = page.viewportSize();
      if (!viewport) throw Error("Missing viewport");
      await page.setViewportSize({
        width: viewport.width === 390 ? 440 : 1280,
        height: viewport.height - 40,
      });
      await expect
        .poll(async () => (await values(page)).move)
        .toEqual({ x: 0, y: 0 });
      await page.mouse.up();
      const cleanup = await page.evaluate(async () => {
        const { game, current: old } = window.virtualLab;
        await game.goTo("play");
        return {
          old: old.virtual.disposed,
          controls: old.controls.disposed,
          sources: game.engine.input.sourceCount,
          captures: game.pointerDiagnostics.captures,
          visuals: (
            game as unknown as {
              renderer: { virtualInputDiagnostics: { presentations: number } };
            }
          ).renderer.virtualInputDiagnostics.presentations,
        };
      });
      expect(cleanup).toMatchObject({
        old: true,
        controls: true,
        captures: 0,
        visuals: 1,
      });
      await page.evaluate(() => {
        window.virtualLab.game.dispose();
        window.virtualLab.game.dispose();
      });
      expect(await page.locator(".simpludify").count()).toBe(0);
    });
  });
