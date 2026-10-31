import { expect, test } from "@playwright/test";

const fixture = `/@fs/${process.cwd()}/tests/browser/canvas-native-fixture.ts`;
for (const fallback of [false, true])
  test.describe(`Canvas native inputs ${fallback ? "Canvas2D" : "WebGL"}`, () => {
    test.beforeEach(async ({ page }, info) => {
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
        window.nativeProbe = await (await import(url)).nativeFixture();
      }, fixture);
      expect(await page.evaluate(() => window.nativeProbe.rendererType)).toBe(
        fallback ? "CANVAS" : "WEBGL",
      );
    });
    test.afterEach(async ({ page }) => {
      expect(await page.evaluate(() => window.nativeProbe.errors)).toEqual([]);
    });
    test("native Select labels, disabled options, keyboard, program replacement and blur", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const f = window.nativeProbe;
        f.focus(f.screen.difficulty);
      });
      const select = page.getByRole("combobox", {
        name: "難易度 / Difficulty",
        exact: true,
      });
      await expect(select).toBeFocused();
      await expect(select).toHaveValue("1");
      expect(await select.locator("option").allTextContents()).toEqual([
        "やさしい / Easy",
        "普通 / Normal",
        "難しい / Hard",
        "準備中 / Locked",
      ]);
      await expect(select.locator("option").last()).toBeDisabled();
      await select.selectOption("2");
      await page.evaluate(() => window.nativeProbe.tick());
      expect(
        await page.evaluate(() => window.nativeProbe.screen.difficulty.value),
      ).toBe("hard");
      await select.press("ArrowUp");
      await page.evaluate(() => window.nativeProbe.tick());
      expect(
        await page.evaluate(() => window.nativeProbe.screen.difficulty.value),
      ).toBe("normal");
      await select.click();
      await page.keyboard.press("Escape");
      await page.evaluate(() => {
        const f = window.nativeProbe;
        f.screen.difficulty.value = "easy";
        f.tick();
      });
      await expect(select).toHaveValue("0");
      await select.press("Tab");
      await page.evaluate(() => window.nativeProbe.tick());
      await expect(
        page.getByRole("textbox", {
          name: "プレイヤー名 / Player name",
          exact: true,
        }),
      ).toBeFocused();
    });
    test("native Unicode insertion, caret selection, clipboard, cancellation and accepted values", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const f = window.nativeProbe;
        f.focus(f.screen.playerName);
      });
      const input = page.getByRole("textbox", {
        name: "プレイヤー名 / Player name",
        exact: true,
      });
      await input.fill("日本語😀e\u0301");
      expect(
        await page.evaluate(() => window.nativeProbe.screen.playerName.value),
      ).toBe("Player");
      await input.press("Home");
      await input.press("Shift+End");
      expect(
        await input.evaluate((el) => (el as HTMLInputElement).selectionEnd),
      ).toBe(7);
      await input.press("ControlOrMeta+C");
      await input.press("Backspace");
      await input.press("ControlOrMeta+V");
      await expect(input).toHaveValue("日本語😀e\u0301");
      await input.press("Enter");
      await page.evaluate(() => window.nativeProbe.tick());
      expect(await page.evaluate(() => window.nativeProbe.commits)).toEqual([
        "日本語😀e\u0301",
      ]);
      await input.fill("discard");
      await input.press("Escape");
      await expect(input).toHaveValue("日本語😀e\u0301");
      expect(await page.evaluate(() => window.nativeProbe.cancels.length)).toBe(
        1,
      );
      await input.fill("ABC");
      await input.press("Home");
      await input.press("Delete");
      await input.press("End");
      await input.press("Backspace");
      await input.press("Tab");
      await page.evaluate(() => window.nativeProbe.tick());
      expect(
        await page.evaluate(() => window.nativeProbe.screen.playerName.value),
      ).toBe("B");
      expect(
        await page.evaluate(() =>
          window.nativeProbe.actions.value(window.nativeProbe.Actions.Confirm),
        ),
      ).toBe(false);
    });
    test("synthetic composition protects Enter/Escape and rejects detached generation events", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const f = window.nativeProbe;
        f.focus(f.screen.playerName);
      });
      const input = page.getByRole("textbox", {
        name: "プレイヤー名 / Player name",
        exact: true,
      });
      await input.evaluate((el) => {
        const input = el as HTMLInputElement;
        input.dispatchEvent(
          new CompositionEvent("compositionstart", { bubbles: true }),
        );
        input.value = "にほん";
        input.setSelectionRange(3, 3);
        input.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            isComposing: true,
            inputType: "insertCompositionText",
          }),
        );
        input.dispatchEvent(
          new KeyboardEvent("keydown", {
            code: "Enter",
            key: "Enter",
            isComposing: true,
            bubbles: true,
          }),
        );
        input.dispatchEvent(
          new KeyboardEvent("keydown", {
            code: "Escape",
            key: "Escape",
            isComposing: true,
            bubbles: true,
          }),
        );
      });
      expect(
        await page.evaluate(() => ({
          value: window.nativeProbe.screen.playerName.value,
          composing: window.nativeProbe.screen.playerName.draft.composing,
          commits: window.nativeProbe.commits,
        })),
      ).toEqual({ value: "Player", composing: true, commits: [] });
      await input.evaluate((el) => {
        const input = el as HTMLInputElement;
        input.value = "日本";
        input.setSelectionRange(2, 2);
        input.dispatchEvent(
          new CompositionEvent("compositionend", {
            bubbles: true,
            data: "日本",
          }),
        );
        input.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: "日本",
          }),
        );
      });
      await input.press("Enter");
      expect(await page.evaluate(() => window.nativeProbe.commits)).toEqual([
        "日本",
      ]);
      await input.evaluate((el) => {
        const old = el as HTMLInputElement,
          f = window.nativeProbe;
        old.dispatchEvent(
          new CompositionEvent("compositionstart", { bubbles: true }),
        );
        f.screen.playerName.value = "program";
        f.tick();
        old.value = "late";
        old.dispatchEvent(new InputEvent("input", { bubbles: true }));
        old.dispatchEvent(
          new CompositionEvent("compositionend", {
            bubbles: true,
            data: "late",
          }),
        );
      });
      await expect(input).toHaveValue("program");
      expect(
        await page.evaluate(() => window.nativeProbe.screen.playerName.value),
      ).toBe("program");
    });
    test("number drafts, validation, step keys, Slider synchronization and read-only", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const f = window.nativeProbe;
        f.focus(f.screen.volumeNumber);
      });
      const input = page.getByRole("spinbutton", {
        name: "音量（数値） / Volume number",
        exact: true,
      });
      await input.fill("-");
      expect(
        await page.evaluate(() => window.nativeProbe.screen.volumeNumber.value),
      ).toBe(50);
      await input.press("Enter");
      await expect(input).toHaveValue("50");
      await input.fill("23.6");
      await input.press("Enter");
      await page.evaluate(() => window.nativeProbe.tick());
      expect(
        await page.evaluate(() => [
          window.nativeProbe.screen.volume.value,
          window.nativeProbe.screen.volumeNumber.value,
        ]),
      ).toEqual([24, 24]);
      await input.press("ArrowUp");
      await expect(input).toHaveValue("25");
      await input.fill("Infinity");
      await input.press("Enter");
      await expect(input).toHaveValue("25");
      await page.evaluate(() => {
        const f = window.nativeProbe;
        f.screen.readOnly.value = true;
        f.tick();
      });
      await expect(input).toHaveAttribute("readonly", "");
      await input.press("ArrowUp");
      await expect(input).toHaveValue("25");
    });
    test("native pointer selection owns its drag, wheel scroll clips it and Scene disposal removes editors", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const f = window.nativeProbe;
        f.focus(f.screen.playerName);
        f.screen.playerName.setMaxLength(200);
        f.tick();
      });
      const input = page.getByRole("textbox", {
        name: "プレイヤー名 / Player name",
        exact: true,
      });
      await input.fill("日本語 ABC 😀 ".repeat(10));
      await input.press("End");
      expect(
        await input.evaluate((el) => (el as HTMLInputElement).scrollLeft),
      ).toBeGreaterThan(0);
      const box = await input.boundingBox();
      if (!box) throw Error("No native input box");
      const before = await page.evaluate(
        () => window.nativeProbe.screen.scroll.scrollY,
      );
      await page.mouse.move(box.x + 20, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y - 40, { steps: 4 });
      await page.mouse.up();
      expect(
        await page.evaluate(() => window.nativeProbe.screen.scroll.scrollY),
      ).toBe(before);
      await page.mouse.move(box.x + 30, box.y + 20);
      await page.mouse.wheel(0, 800);
      await page.evaluate(() => window.nativeProbe.tick());
      expect(
        await page.evaluate(
          () => window.nativeProbe.game.pointerDiagnostics.controlDrags,
        ),
      ).toBe(0);
      await page.evaluate(() => {
        const f = window.nativeProbe;
        f.screen.playerName.dispose();
        f.tick();
      });
      await expect(input).toHaveCount(0);
      await page.evaluate(async () => {
        await window.nativeProbe.game.goTo("empty");
      });
      await expect(page.locator(".s-canvas-native")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => window.nativeProbe.ui.diagnostics.subscriptions,
        ),
      ).toBe(0);
    });
    test("dynamic options, clipping/scale, composition blur and window interruption revoke ownership", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const f = window.nativeProbe;
        f.screen.difficulty.setOptions([
          { label: "Normal updated", value: "normal" },
          { label: "Easy updated", value: "easy" },
        ]);
        f.ui.scale = 1.1;
        f.focus(f.screen.difficulty);
      });
      const select = page.getByRole("combobox", {
        name: "難易度 / Difficulty",
        exact: true,
      });
      await expect(select).toHaveValue("0");
      expect(await select.locator("option").allTextContents()).toEqual([
        "Normal updated",
        "Easy updated",
      ]);
      await page.evaluate(() => {
        const f = window.nativeProbe;
        f.focus(f.screen.playerName);
      });
      const input = page.getByRole("textbox", {
        name: "プレイヤー名 / Player name",
        exact: true,
      });
      const box = await input.boundingBox();
      const width = await page.evaluate(
        () =>
          window.nativeProbe.screen.playerName.bounds.width *
          window.nativeProbe.ui.scale,
      );
      expect(box?.width).toBeCloseTo(width, 0);
      await input.evaluate((el) => {
        const input = el as HTMLInputElement;
        input.dispatchEvent(
          new CompositionEvent("compositionstart", { bubbles: true }),
        );
        input.value = "未確定";
        input.dispatchEvent(
          new InputEvent("input", { bubbles: true, isComposing: true }),
        );
      });
      await page.evaluate(() => {
        const f = window.nativeProbe;
        f.focus(f.screen.volumeNumber);
      });
      expect(
        await page.evaluate(() => window.nativeProbe.screen.playerName.value),
      ).toBe("Player");
      await page.evaluate(() => {
        const f = window.nativeProbe;
        f.focus(f.screen.playerName);
      });
      await input.fill("window draft");
      await page.evaluate(() => {
        window.dispatchEvent(new Event("blur"));
        window.nativeProbe.tick();
      });
      expect(
        await page.evaluate(() => [
          window.nativeProbe.screen.playerName.value,
          window.nativeProbe.screen.playerName.editing,
        ]),
      ).toEqual(["Player", false]);
      await page.evaluate(() => {
        const f = window.nativeProbe;
        f.focus(f.screen.playerName);
        f.screen.scroll.enabled = false;
        f.tick();
      });
      await expect(input).toBeDisabled();
      expect(
        await page.evaluate(() => window.nativeProbe.screen.playerName.editing),
      ).toBe(false);
    });
  });
