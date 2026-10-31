import { expect, type Page, test } from "@playwright/test";

const fixture = `/@fs/${process.cwd()}/tests/browser/ui-focus-fixture.ts`;
async function tick(page: Page) {
  await page.evaluate(() => window.focusProbe.tick());
}
async function expectMovement(page: Page, moving: boolean) {
  const delta = await page.evaluate(() => window.focusProbe.move());
  if (moving) expect(delta).toBeLessThan(-1);
  else expect(delta).toBe(0);
}
async function point(
  page: Page,
  name: "button" | "check" | "slider" | "scroll",
) {
  return page.evaluate(
    (name) => window.focusProbe.center(window.focusProbe[name]),
    name,
  );
}
for (const fallback of [false, true])
  test.describe(`UI focus ${fallback ? "Canvas2D" : "WebGL"}`, () => {
    test.beforeEach(async ({ page }, info) => {
      // Same measured SwiftShader startup/teardown budget as the native/portable UI suites.
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
        window.focusProbe = await (await import(url)).focusFixture();
      }, fixture);
      expect(await page.evaluate(() => window.focusProbe.rendererType)).toBe(
        fallback ? "CANVAS" : "WEBGL",
      );
    });
    test.afterEach(async ({ page }) => {
      expect(await page.evaluate(() => window.focusProbe.errors)).toEqual([]);
    });
    test("container pixels stay stable across child transitions while control and opt-in hover remain visible", async ({
      page,
    }) => {
      const pixels = () =>
        page.evaluate(() => ({
          panel: window.focusProbe.pixel(4, 4),
          button: window.focusProbe.pixel(20, 20),
        }));
      await page.mouse.move(330, 600);
      const baseline = await pixels();
      await page.mouse.move(4, 4);
      expect((await pixels()).panel).toEqual(baseline.panel);
      const a = await point(page, "button"),
        b = await point(page, "check");
      await page.mouse.move(a.x, a.y);
      const hovered = await pixels();
      expect(hovered.panel).toEqual(baseline.panel);
      expect(hovered.button[0]).toBeGreaterThan(baseline.button[0] ?? 255);
      await page.mouse.move(b.x, b.y);
      expect((await pixels()).panel).toEqual(baseline.panel);
      await page.mouse.move(4, 4);
      await page.evaluate(() =>
        window.focusProbe.root.setStyle({ hoverEffect: "highlight" }),
      );
      expect((await pixels()).panel[0]).toBeGreaterThan(
        baseline.panel[0] ?? 255,
      );
      await page.mouse.move(330, 600);
      expect((await pixels()).panel).toEqual(baseline.panel);
      const events = await page.evaluate(() => window.focusProbe.hoverEvents);
      expect(events).toContain("enter");
      expect(events).toContain("leave");
    });
    test("held WASD survives Canvas and DOM pointer controls, scroll and pending actions without refocusing the world", async ({
      page,
    }) => {
      await page.locator(".simpludify").focus();
      await page.keyboard.down("w");
      await expectMovement(page, true);
      for (const name of ["button", "check"] as const) {
        const p = await point(page, name);
        await page.mouse.click(p.x, p.y);
        await tick(page);
        await expectMovement(page, true);
      }
      const slider = await point(page, "slider");
      await page.mouse.move(slider.x, slider.y);
      await page.mouse.down();
      await page.mouse.move(slider.x + 60, slider.y);
      await tick(page);
      await expectMovement(page, true);
      await page.mouse.up();
      expect(
        await page.evaluate(() => window.focusProbe.slider.value),
      ).toBeGreaterThan(50);
      const scroll = await point(page, "scroll");
      await page.mouse.move(scroll.x, scroll.y);
      await page.mouse.wheel(0, 80);
      await tick(page);
      await expectMovement(page, true);
      await page.mouse.down();
      await page.mouse.move(scroll.x, scroll.y - 30);
      await tick(page);
      await expectMovement(page, true);
      await page.mouse.up();
      expect(
        await page.evaluate(() => window.focusProbe.scroll.scrollY),
      ).toBeGreaterThan(0);
      await page
        .getByRole("button", { name: "DOM action", exact: true })
        .click();
      await expectMovement(page, true);
      await page
        .getByRole("button", { name: "DOM pending", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "DOM pending", exact: true }),
      ).toBeFocused();
      await expectMovement(page, true);
      await page.keyboard.up("w");
      await expectMovement(page, false);
      await page.evaluate(() => window.focusProbe.finish());
      await page.keyboard.down("w");
      await expectMovement(page, true);
      await page.keyboard.up("w");
      expect(await page.evaluate(() => window.focusProbe.counts())).toEqual({
        clicks: 1,
        domClicks: 1,
      });
      expect(await page.evaluate(() => window.focusProbe.check.value)).toBe(
        true,
      );
      // Clicking the actual world deliberately restores its full bindings (including Space).
      await page.keyboard.down("w");
      await page.mouse.click(340, 550);
      await expect(page.locator(".simpludify")).toBeFocused();
      await expectMovement(page, true);
      await page.keyboard.up("w");
      await page.keyboard.press("Space");
      await tick(page);
      expect(
        await page.evaluate(() =>
          window.focusProbe.controls.button(window.focusProbe.A.Fire),
        ),
      ).toMatchObject({ held: false, pressCount: 1 });
      await page
        .getByRole("button", { name: "DOM action", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Space");
      await tick(page);
      expect(
        await page.evaluate(() =>
          window.focusProbe.controls.button(window.focusProbe.A.Fire),
        ),
      ).toMatchObject({ held: false, pressCount: 0 });
      expect(
        await page.evaluate(() => window.focusProbe.counts().domClicks),
      ).toBe(3);
      // Focused Canvas async controls hand off before disabling their native mirror.
      const pending = page.getByRole("button", {
        name: "Canvas pending",
        exact: true,
      });
      await pending.focus();
      await page.keyboard.down("w");
      const position = await page.evaluate(() =>
        window.focusProbe.center(window.focusProbe.pending),
      );
      await page.mouse.click(position.x, position.y);
      await tick(page);
      await expect(pending).toBeDisabled();
      await expect(page.locator(".simpludify")).toBeFocused();
      await expectMovement(page, true);
      await page.evaluate(() => window.focusProbe.finishCanvas());
      await tick(page);
      await expect(pending).toBeEnabled();
      await page.keyboard.up("w");
      await expectMovement(page, false);
    });
    test("text and IME isolate gameplay, cancel/commit preserve focus and fresh keydown resumes on a button", async ({
      page,
    }) => {
      await page.locator(".simpludify").focus();
      await page.keyboard.down("w");
      await expectMovement(page, true);
      const input = page.getByRole("textbox", {
        name: "Canvas name",
        exact: true,
      });
      await input.click();
      await expectMovement(page, false);
      await page.keyboard.down("w"); // Repeat of the physically held key cannot restore game state.
      await expectMovement(page, false);
      await input.fill("日本語😀");
      await input.dispatchEvent("compositionstart", { data: "あ" });
      await input.dispatchEvent("keydown", {
        code: "Enter",
        key: "Enter",
        isComposing: true,
        keyCode: 229,
        bubbles: true,
      });
      expect(await page.evaluate(() => window.focusProbe.text.value)).toBe(
        "Player",
      );
      await tick(page);
      expect(
        await page.evaluate(() =>
          window.focusProbe.controls.button(window.focusProbe.A.Fire),
        ),
      ).toMatchObject({ held: false, pressCount: 0 });
      await input.dispatchEvent("compositionend", { data: "あ" });
      await input.press("Escape");
      await expect(input).toHaveValue("Player");
      await expect(input).toBeFocused();
      await input.fill("New name");
      await input.press("Enter");
      await tick(page);
      expect(await page.evaluate(() => window.focusProbe.text.value)).toBe(
        "New name",
      );
      await expectMovement(page, false);
      // Native focus remains an editor until Tab; no forced world focus on transaction end.
      await input.press("Shift+Tab");
      await expect(
        page.getByRole("slider", { name: "Canvas range", exact: true }),
      ).toBeFocused();
      await page.keyboard.down("w");
      await expectMovement(page, false);
      await page.keyboard.up("w");
      await page.keyboard.down("w");
      await expectMovement(page, true);
      await page.keyboard.up("w");
      await expectMovement(page, false);
      await page.keyboard.press("ArrowRight");
      expect(await page.evaluate(() => window.focusProbe.slider.value)).toBe(
        51,
      );
      await tick(page);
      expect(
        await page.evaluate(() =>
          window.focusProbe.controls.button(window.focusProbe.A.Right),
        ),
      ).toMatchObject({ held: false, pressCount: 0 });
      await page.keyboard.press("Space");
      await tick(page);
      expect(
        await page.evaluate(() =>
          window.focusProbe.controls.button(window.focusProbe.A.Fire),
        ),
      ).toMatchObject({ held: false, pressCount: 0 });
      const number = page.getByRole("spinbutton", {
        name: "Canvas number",
        exact: true,
      });
      await number.focus();
      await page.keyboard.down("w");
      await expectMovement(page, false);
      await page.keyboard.up("w");
      await number.press("ArrowUp");
      expect(await page.evaluate(() => window.focusProbe.number.value)).toBe(6);
      await number.press("Tab");
      await expect(
        page.getByRole("combobox", { name: "Canvas choice", exact: true }),
      ).toBeFocused();
      await page.keyboard.down("w");
      await expectMovement(page, false);
      await page.keyboard.up("w");
      await page.keyboard.press("ArrowDown");
      await tick(page);
      expect(await page.evaluate(() => window.focusProbe.select.value)).toBe(
        "hard",
      );
    });
    test("Tab uses live declaration order, reveals scroll entries and leaves boundaries; reorder retains an active editor", async ({
      page,
    }) => {
      await page.locator(".simpludify").focus();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Canvas action", exact: true }),
      ).toBeFocused();
      for (const [role, name] of [
        ["checkbox", "Canvas check"],
        ["slider", "Canvas range"],
        ["textbox", "Canvas name"],
        ["spinbutton", "Canvas number"],
        ["combobox", "Canvas choice"],
        ["button", "Entry 0"],
        ["button", "Entry 1"],
        ["button", "Entry 2"],
        ["button", "Entry 3"],
        ["button", "Entry 4"],
        ["button", "Entry 5"],
        ["button", "Entry 6"],
        ["button", "Entry 7"],
        ["button", "Canvas pending"],
        ["button", "Last action"],
      ] as const) {
        await page.keyboard.press("Tab");
        await expect(page.getByRole(role, { name, exact: true })).toBeFocused();
      }
      expect(
        await page.evaluate(() => window.focusProbe.scroll.scrollY),
      ).toBeGreaterThan(0);
      // Browser may encounter the DOM overlay before leaving the host, following actual document order.
      for (
        let i = 0;
        i < 3 &&
        !(await page
          .getByRole("button", { name: "Outside game", exact: true })
          .evaluate((el) => document.activeElement === el));
        i++
      )
        await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Outside game", exact: true }),
      ).toBeFocused();
      const input = page.getByRole("textbox", {
        name: "Canvas name",
        exact: true,
      });
      await input.focus();
      await input.press("Home");
      await input.press("Shift+ArrowRight");
      await input.dispatchEvent("compositionstart", { data: "あ" });
      await page.evaluate(() => {
        const f = window.focusProbe;
        f.root.move(f.text, 0);
        f.tick();
      });
      await expect(input).toBeFocused();
      expect(
        await input.evaluate((el) => [
          (el as HTMLInputElement).selectionStart,
          (el as HTMLInputElement).selectionEnd,
        ]),
      ).toEqual([0, 1]);
      await input.dispatchEvent("compositionend", { data: "あ" });
      await input.press("Tab");
      await expect(
        page.getByRole("button", { name: "Canvas action", exact: true }),
      ).toBeFocused();
      await page.evaluate(() => {
        const f = window.focusProbe;
        f.check.visible = false;
        f.slider.enabled = false;
        f.number.readOnly = true;
        f.tick();
      });
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("spinbutton", { name: "Canvas number", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(
        page.getByRole("button", { name: "Canvas action", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(input).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(input).not.toBeFocused();
      // An unrelated repaint must not recapture a focus deliberately moved outside.
      await page
        .getByRole("button", { name: "Outside game", exact: true })
        .focus();
      await page.mouse.move(4, 4);
      await tick(page);
      await expect(
        page.getByRole("button", { name: "Outside game", exact: true }),
      ).toBeFocused();
    });
    test("keyup, blur, hiding, removed composition owners and Scene teardown release state", async ({
      page,
    }) => {
      const action = page.getByRole("button", {
        name: "Canvas action",
        exact: true,
      });
      await action.focus();
      await page.keyboard.down("w");
      await expectMovement(page, true);
      // Capture-phase release still works when a control stops bubbling keyup.
      await action.evaluate((el) =>
        el.addEventListener("keyup", (e) => e.stopPropagation(), {
          once: true,
        }),
      );
      await page.keyboard.up("w");
      await expectMovement(page, false);
      await page.keyboard.down("w");
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await expectMovement(page, false);
      await page.keyboard.up("w");
      await action.focus();
      await page.keyboard.down("w");
      await expectMovement(page, true);
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expectMovement(page, false);
      await page.keyboard.up("w");
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: false,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      const input = page.getByRole("textbox", {
        name: "Canvas name",
        exact: true,
      });
      await input.focus();
      await input.dispatchEvent("compositionstart", { data: "あ" });
      await page.evaluate(() => {
        const f = window.focusProbe;
        f.text.dispose();
        f.tick();
      });
      await action.focus();
      await page.keyboard.down("w");
      await expectMovement(page, true);
      await page.evaluate(async () => {
        await window.focusProbe.game.goTo("empty");
        window.focusProbe.tick();
      });
      expect(
        await page.evaluate(() =>
          window.focusProbe.game.engine.input.snapshot(),
        ),
      ).toEqual([]);
      await page.keyboard.up("w");
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Canvas action", exact: true }),
      ).toHaveCount(0);
      await page.evaluate(() => window.focusProbe.game.dispose());
      expect(await page.locator(".s-canvas-accessibility").count()).toBe(0);
    });
  });
