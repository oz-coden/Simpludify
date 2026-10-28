import { expect, test } from "@playwright/test";
import type {
  ActionController,
  ActionSource,
  ActionToken,
  Game,
} from "@simpludify/web";

type ProbeActions = {
  readonly Fire: ActionToken<"button", "Fire">;
  readonly Pause: ActionToken<"button", "Pause">;
  readonly Move: ActionToken<"axis2d", "Move">;
};
type StageActions = { readonly Special: ActionToken<"button", "Special"> };
declare global {
  interface Window {
    actionProbe: {
      game: Game<"first" | "second">;
      actions: ProbeActions;
      controls: ActionController<ProbeActions>;
      source: ActionSource<ProbeActions>;
      counts: { fire: number; native: number };
      finishStage: () => void;
      navigation?: Promise<void>;
      staged?: ActionController<StageActions>;
    };
  }
}
const sdk = `/@fs/${process.cwd()}/packages/web/src/index.ts`;
async function probe(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => !!window.demo);
  await page.evaluate(async (sdk) => {
    const {
      Action,
      ActionController,
      Actor,
      Button,
      defineActions,
      Game,
      HoldButton,
      KeyCode,
      Label,
      Panel,
      Renderable,
      Shape,
      Transform,
    } = (await import(sdk)) as typeof import("@simpludify/web");
    window.demo.dispose();
    document.body.replaceChildren();
    document.body.style.cssText = "margin:0;height:100dvh";
    const actions = defineActions({
      Fire: Action.button(),
      Pause: Action.button(),
      Move: Action.axis2D(),
    });
    const game = new Game<"first" | "second">({
      frames: { request: () => 1, cancel() {} },
    });
    const counts = { fire: 0, native: 0 };
    const label = Label("Shots 0");
    let controls!: ActionController<typeof actions>,
      source!: ActionSource<typeof actions>;
    let finishStage!: () => void;
    game.scene("first", ({ scene, ui }) => {
      controls = new ActionController(actions, {
        scene,
        input: game.engine.input,
        bindings: {
          Fire: { keys: [KeyCode.Space] },
          Pause: { keys: [KeyCode.P] },
          Move: { x: { negative: [KeyCode.A], positive: [KeyCode.D] } },
        },
      });
      source = controls.createSource(scene);
      controls.onPressed(actions.Pause, () =>
        game.paused ? game.resume() : game.pause(),
      );
      const actor = scene.add(new Actor());
      const transform = actor.add(new Transform({ x: 400, y: 225 }));
      actor.add(
        new Renderable({ source: { kind: "shape", shape: Shape.Triangle } }),
      );
      scene.onUpdate((delta) => {
        counts.fire += controls.button(actions.Fire).pressCount;
        transform.x += controls.value(actions.Move).x * delta * 200;
        label.setText(`Shots ${counts.fire}`);
      });
      ui(
        Panel([
          label,
          Button("Native control", () => {
            counts.native++;
          }),
          HoldButton("Touch fire", (held) => source.set(actions.Fire, held)),
        ]),
      );
    });
    game.scene("second", async ({ scene }) => {
      const stagedActions = defineActions({ Special: Action.button() });
      const staged = new ActionController(stagedActions, {
        scene,
        input: game.engine.input,
        bindings: { Special: { keys: [KeyCode.Z] } },
      });
      const stagedSource = staged.createSource(scene);
      stagedSource.set(stagedActions.Special, true);
      window.actionProbe.staged = staged;
      await new Promise<void>((resolve) => {
        finishStage = resolve;
      });
    });
    await game.run("first");
    window.actionProbe = {
      game,
      actions,
      controls,
      source,
      counts,
      finishStage: () => finishStage(),
    };
    game.element.focus();
  }, sdk);
}

test("real short key taps retain counts, source union and runtime bindings while native controls keep their keys", async ({
  page,
}) => {
  await probe(page);
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  const state = await page.evaluate(() => {
    const p = window.actionProbe;
    p.game.engine.step(0);
    p.game.setViewport();
    return { button: p.controls.button(p.actions.Fire), fire: p.counts.fire };
  });
  expect(state).toEqual({
    button: {
      held: false,
      pressed: true,
      released: true,
      pressCount: 2,
      releaseCount: 2,
    },
    fire: 2,
  });
  await expect(page.getByText("Shots 2", { exact: true })).toBeVisible();
  await page.keyboard.down("KeyD");
  const moved = await page.evaluate(() => {
    const p = window.actionProbe;
    p.game.engine.step(0.1);
    p.game.setViewport();
    return p.game.engine.snapshot().actors[0]?.transform?.x;
  });
  expect(moved).toBe(420);
  await page.keyboard.up("KeyD");
  await page.keyboard.down("Space");
  await page.evaluate(() => {
    const p = window.actionProbe;
    p.source.set(p.actions.Fire, true);
    p.game.engine.step(0);
  });
  await page.keyboard.up("Space");
  expect(
    await page.evaluate(() => {
      const p = window.actionProbe;
      p.game.engine.step(0);
      return p.controls.button(p.actions.Fire);
    }),
  ).toMatchObject({ held: true, released: false });
  expect(
    await page.evaluate(() => {
      const p = window.actionProbe;
      p.source.dispose();
      p.game.engine.step(0);
      return p.controls.released(p.actions.Fire);
    }),
  ).toBe(true);
  await page.evaluate(() => {
    const p = window.actionProbe;
    p.controls.rebind(p.actions.Fire, { keys: ["KeyF"] });
  });
  await page.keyboard.press("Space");
  expect(
    await page.evaluate(() => {
      const p = window.actionProbe;
      p.game.engine.step(0);
      return p.controls.pressed(p.actions.Fire);
    }),
  ).toBe(false);
  await page.keyboard.down("KeyF");
  expect(
    await page.evaluate(() => {
      const p = window.actionProbe;
      p.game.engine.step(0);
      return p.controls.value(p.actions.Fire);
    }),
  ).toBe(true);
  await page.evaluate(() => {
    const p = window.actionProbe;
    p.controls.rebind(p.actions.Fire, { keys: ["KeyG"] });
    p.game.engine.step(0);
  });
  expect(
    await page.evaluate(() => {
      const p = window.actionProbe;
      return p.controls.button(p.actions.Fire);
    }),
  ).toMatchObject({ held: false, pressed: false, released: false });
  await page.keyboard.up("KeyF");
  await page
    .getByRole("button", { name: "Native control", exact: true })
    .focus();
  await page.keyboard.press("Space");
  expect(await page.evaluate(() => window.actionProbe.counts.native)).toBe(1);
  await page.evaluate(() => window.actionProbe.game.dispose());
});

test("pause action is captured while suspended and autorepeat cannot toggle it again after clear", async ({
  page,
}) => {
  await probe(page);
  await page.keyboard.down("KeyP");
  expect(
    await page.evaluate(() => {
      const p = window.actionProbe;
      p.game.engine.step(0);
      return p.game.paused;
    }),
  ).toBe(true);
  await page.keyboard.down("KeyP"); // The browser marks a repeated keydown.
  expect(
    await page.evaluate(() => {
      const p = window.actionProbe;
      p.game.engine.step(0);
      return p.game.paused;
    }),
  ).toBe(true);
  await page.keyboard.up("KeyP");
  await page.keyboard.press("KeyP");
  expect(
    await page.evaluate(() => {
      const p = window.actionProbe;
      p.game.engine.step(0);
      return p.game.paused;
    }),
  ).toBe(false);
  await page.evaluate(() => window.actionProbe.game.dispose());
});

test("preparing bindings do not capture keys or leak held input through scene commit", async ({
  page,
}) => {
  await probe(page);
  await page.evaluate(() => {
    const p = window.actionProbe;
    p.navigation = p.game.goTo("second");
  });
  await page.waitForFunction(() => !!window.actionProbe.staged);
  await page.keyboard.press("KeyZ");
  expect(
    await page.evaluate(() => {
      const p = window.actionProbe;
      p.game.engine.step(0);
      return p.game.engine.input.acceptsKey("KeyZ");
    }),
  ).toBe(false);
  await page.evaluate(async () => {
    const p = window.actionProbe;
    p.finishStage();
    await p.navigation;
    p.game.engine.step(0);
  });
  expect(
    await page.evaluate(() => {
      const p = window.actionProbe;
      return {
        oldDisposed: p.controls.disposed,
        sourceDisposed: p.source.disposed,
        down: p.staged?.value(p.staged.actions.Special),
      };
    }),
  ).toEqual({ oldDisposed: true, sourceDisposed: true, down: false });
  await page.locator(".simpludify").focus();
  await page.keyboard.press("KeyZ");
  expect(
    await page.evaluate(() => {
      const p = window.actionProbe;
      p.game.engine.step(0);
      return p.staged?.pressed(p.staged.actions.Special);
    }),
  ).toBe(true);
  await page.evaluate(() => window.actionProbe.game.dispose());
});

test("Blockfall rebinds rotation and handles short taps, touch commands and pause through Actions", async ({
  page,
}) => {
  await page.goto(`/@fs/${process.cwd()}/examples/blockfall/index.html`);
  await page.waitForFunction(() => !!window.blockfall?.controller);
  await page.locator(".simpludify").focus();
  const before = await page.evaluate(() => {
    const b = window.blockfall;
    const c = b.controller?.controls;
    if (!c) throw new Error("Missing controller");
    c.rebind(c.actions.RotateCW, { keys: ["KeyV"] });
    return b.puzzle?.active.rotation;
  });
  await page.keyboard.press("KeyX");
  expect(
    await page.evaluate(() => {
      window.blockfall.game.engine.step(0);
      return window.blockfall.puzzle?.active.rotation;
    }),
  ).toBe(before);
  await page.keyboard.press("KeyV");
  await page.waitForFunction(
    (before) => window.blockfall.puzzle?.active.rotation !== before,
    before,
  );
  const rotation = await page.evaluate(
    () => window.blockfall.puzzle?.active.rotation,
  );
  await page.getByRole("button", { name: "Rotate left", exact: true }).click();
  await page.waitForFunction(
    (before) => window.blockfall.puzzle?.active.rotation !== before,
    rotation,
  );
  await page.locator(".simpludify").focus();
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.blockfall.game.paused);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !window.blockfall.game.paused);
  await page.evaluate(() => window.blockfall.game.dispose());
});

test("Prism Raid changes physical movement/fire bindings while logical automatic play still wins", async ({
  page,
}) => {
  await page.goto(`/@fs/${process.cwd()}/examples/prism-raid/index.html`);
  await page
    .getByRole("button", { name: "Start mission", exact: true })
    .click();
  await page.waitForFunction(() => !!window.prismRaid.round);
  await page.evaluate(() => {
    const c = window.prismRaid.round?.controls;
    if (!c) throw new Error("Missing round");
    c.rebind(c.actions.Fire, { keys: ["KeyF"] });
    c.rebind(c.actions.Move, { x: { negative: ["KeyY"], positive: ["KeyI"] } });
  });
  await page.keyboard.down("Space");
  expect(
    await page.evaluate(() => {
      const p = window.prismRaid;
      p.game.engine.step(0.2);
      return p.round?.shotsFired;
    }),
  ).toBe(0);
  await page.keyboard.up("Space");
  await page.keyboard.down("KeyF");
  await page.keyboard.down("KeyI");
  await page.waitForFunction(
    () =>
      (window.prismRaid.round?.shotsFired ?? 0) >= 2 &&
      (window.prismRaid.round?.snapshot().units.find((u) => u.kind === "player")
        ?.x ?? 0) > 190,
  );
  await page.keyboard.up("KeyF");
  await page.keyboard.up("KeyI");
  const status = await page.evaluate(() => {
    const p = window.prismRaid;
    for (let i = 0; i < 120 * 76 && p.round?.status === "playing"; i++) {
      if (i % 6 === 0) p.autoStep();
      p.game.engine.step(1 / 120);
    }
    return p.round?.status;
  });
  expect(status).toBe("won");
  await page.evaluate(() => window.prismRaid.game.dispose());
});

test("real touch and keyboard contributions coexist and releasing either source preserves the other", async ({
  page,
  context,
}) => {
  await probe(page);
  const target = page.getByRole("button", { name: "Touch fire", exact: true });
  const box = await target.boundingBox();
  if (!box) throw new Error("Missing touch target");
  const touch = await context.newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: box.x + box.width / 2, y: box.y + box.height / 2 },
    ],
  });
  await page.locator(".simpludify").focus();
  await page.keyboard.down("Space");
  await page.evaluate(() => window.actionProbe.game.engine.step(0));
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  const held = await page.evaluate(() => {
    const p = window.actionProbe;
    p.game.engine.step(0);
    return {
      ...p.controls.button(p.actions.Fire),
      focused: document.activeElement === p.game.element,
    };
  });
  expect(held).toMatchObject({ held: true, released: false, focused: true });
  await page.keyboard.up("Space");
  expect(
    await page.evaluate(() => {
      const p = window.actionProbe;
      p.game.engine.step(0);
      return p.controls.released(p.actions.Fire);
    }),
  ).toBe(true);
  await touch.detach();
  await page.evaluate(() => window.actionProbe.game.dispose());
});

test("uses native text input without intercepting typing, paste or IME commits", async ({
  page,
}) => {
  await probe(page);
  await page.evaluate(() => {
    const { game } = window.actionProbe;
    const field = document.createElement("textarea");
    field.id = "typing";
    field.setAttribute("aria-label", "Typing answer");
    field.style.cssText =
      "position:absolute;bottom:0;left:0;z-index:999;width:200px;height:70px";
    game.element.append(field);
    const commits: string[] = [];
    let committed = "";
    const commit = () => {
      if (field.value !== committed) {
        committed = field.value;
        commits.push(committed);
      }
    };
    field.addEventListener("input", (event) => {
      if (!(event as InputEvent).isComposing) commit();
    });
    field.addEventListener("compositionend", () => queueMicrotask(commit));
    field.dataset.commits = "[]";
    field.addEventListener("input", () =>
      queueMicrotask(() => {
        field.dataset.commits = JSON.stringify(commits);
      }),
    );
  });
  await page.locator(".simpludify").focus();
  await page.keyboard.down("d");
  await page.evaluate(() => window.actionProbe.game.engine.step(0));
  expect(
    await page.evaluate(
      () =>
        window.actionProbe.controls.value(window.actionProbe.actions.Move).x,
    ),
  ).toBe(1);
  await page.getByRole("textbox", { name: "Typing answer" }).focus();
  await page.keyboard.up("d");
  await page.keyboard.type("wasd space romaji");
  await page.evaluate(() => window.actionProbe.game.engine.step(0));
  await expect(page.locator("#typing")).toHaveValue("wasd space romaji");
  expect(
    await page.evaluate(() => window.actionProbe.controls.snapshot()),
  ).toMatchObject({ Move: { value: { x: 0, y: 0 } }, Fire: { value: false } });
  const ime = await page.evaluate(async () => {
    const field = document.querySelector<HTMLTextAreaElement>("#typing");
    if (!field) throw new Error("No typing field");
    field.value = "";
    field.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "deleteContentBackward",
      }),
    );
    field.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    field.value = "にほ";
    field.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertCompositionText",
        data: "にほ",
        isComposing: true,
      }),
    );
    const intermediate = JSON.parse(field.dataset.commits ?? "[]");
    field.value = "日本語";
    field.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "日本語" }),
    );
    field.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: "日本語",
      }),
    );
    await Promise.resolve();
    const commits = JSON.parse(field.dataset.commits ?? "[]");
    const suppressed = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "Space",
      key: "Process",
      isComposing: true,
    });
    field.dispatchEvent(suppressed);
    window.actionProbe.game.engine.step(0);
    return {
      intermediate,
      commits,
      prevented: suppressed.defaultPrevented,
      fire: window.actionProbe.controls.value(window.actionProbe.actions.Fire),
    };
  });
  expect(ime.intermediate).not.toContain("にほ");
  expect(ime.commits.filter((s: string) => s === "日本語")).toHaveLength(1);
  expect(ime).toMatchObject({ prevented: false, fire: false });
  await page.keyboard.insertText("🙂"); // input event without a physical key, as with paste/soft keyboards
  await expect(page.locator("#typing")).toHaveValue("日本語🙂");
  await page.locator(".simpludify").focus();
  await page.keyboard.press("Space");
  await page.evaluate(() => window.actionProbe.game.engine.step(0));
  expect(
    await page.evaluate(
      () =>
        window.actionProbe.controls.button(window.actionProbe.actions.Fire)
          .pressCount,
    ),
  ).toBe(1);
});

test("suppresses composing game-surface keys and resumes only after composition finishes", async ({
  page,
}) => {
  await probe(page);
  await page.locator(".simpludify").focus();
  const result = await page.evaluate(() => {
    const { game, controls, actions } = window.actionProbe;
    game.element.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    const event = new KeyboardEvent("keydown", {
      code: "Space",
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    game.element.dispatchEvent(event);
    game.engine.step(0);
    const during = controls.pressed(actions.Fire);
    game.element.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true }),
    );
    return { during, prevented: event.defaultPrevented };
  });
  expect(result).toEqual({ during: false, prevented: false });
  await page.keyboard.press("Space");
  await page.evaluate(() => window.actionProbe.game.engine.step(0));
  expect(
    await page.evaluate(() =>
      window.actionProbe.controls.pressed(window.actionProbe.actions.Fire),
    ),
  ).toBe(true);
});
