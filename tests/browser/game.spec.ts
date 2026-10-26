import { expect, test } from "@playwright/test";

const sdk = `/@fs/${process.cwd()}/packages/web/src/index.ts`;
test("renders, moves with focused input, and navigates through native buttons", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The garden" })).toBeVisible();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  expect(bounds?.width).toBe(info.project.use.viewport?.width);
  await page.locator(".simpludify").focus();
  const before = await page.evaluate(
    () => window.demo.engine.snapshot().characters[0]?.x ?? 0,
  );
  await page.keyboard.down("d");
  await expect
    .poll(() =>
      page.evaluate(() => window.demo.engine.snapshot().characters[0]?.x ?? 0),
    )
    .toBeGreaterThan(before + 5);
  await page.keyboard.up("d");
  await page.getByRole("button", { name: "Visit the studio" }).click();
  await expect(page.getByRole("heading", { name: "The studio" })).toBeVisible();
  expect(
    await page.evaluate(() => window.demo.engine.snapshot().input),
  ).toEqual([]);
  await page.getByRole("button", { name: "Back to the garden" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "The garden" })).toBeVisible();
  expect(errors).toEqual([]);
});
test("keeps the UI in bounds at the selected viewport and after a resize", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
  for (const element of await page.locator(".s-ui button, .s-ui h2").all()) {
    const box = await element.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(
        info.project.use.viewport?.width ?? 0,
      );
      expect(box.y + box.height).toBeLessThanOrEqual(
        info.project.use.viewport?.height ?? 0,
      );
    }
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("scene.png") });
  await page.setViewportSize({ width: 600, height: 400 });
  await expect
    .poll(async () => (await page.locator("canvas").boundingBox())?.width)
    .toBe(600);
});
test("releases input on blur, protects control focus, and removes disposed listeners", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
  await page.locator(".simpludify").focus();
  await page.keyboard.down("w");
  expect(
    await page.evaluate(() => window.demo.engine.input.isPressed("KeyW")),
  ).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect(
    await page.evaluate(() => window.demo.engine.input.snapshot()),
  ).toEqual([]);
  await page.keyboard.up("w");
  await page.getByRole("button").focus();
  await page.keyboard.down("d");
  expect(
    await page.evaluate(() => window.demo.engine.input.snapshot()),
  ).toEqual([]);
  await page.keyboard.up("d");
  const result = await page.evaluate(() => {
    const game = window.demo,
      host = game.element,
      button = host.querySelector("button");
    game.dispose();
    game.dispose();
    host.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }),
    );
    button?.click();
    return {
      connected: host.isConnected,
      canvas: host.querySelector("canvas"),
      input: game.engine.input.snapshot(),
      disposed: game.engine.disposed,
    };
  });
  expect(result).toEqual({
    connected: false,
    canvas: null,
    input: [],
    disposed: true,
  });
});
test("owns scene cleanup and commits only after async readiness; failures keep the active scene", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
  const result = await page.evaluate(async (url) => {
    const { Game, Character, Button } = (await import(
      url
    )) as typeof import("@simpludify/web");
    window.demo.dispose();
    const counts = {
      resources: 0,
      disposed: 0,
      cleaned: 0,
      click: 0,
      rendered: 0,
    };
    const game = new Game<"one" | "two" | "bad">({
      renderer: () => ({
        init: async () => {},
        resize: () => {},
        dispose: () => {
          counts.disposed++;
        },
        prepare: async () => {
          counts.resources++;
          let dead = false;
          return {
            render() {
              counts.rendered++;
            },
            dispose() {
              if (!dead) {
                dead = true;
                counts.resources--;
              }
            },
          };
        },
      }),
    });
    let oldButton: HTMLButtonElement | null = null;
    game.scene("one", ({ add, ui, onDispose }) => {
      add(Character());
      ui(
        Button("old", () => {
          counts.click++;
        }),
      );
      onDispose(() => {
        counts.cleaned++;
      });
    });
    let resolveSetup: (() => void) | undefined;
    game.scene("two", async ({ add }) => {
      await new Promise<void>((resolve) => {
        resolveSetup = resolve;
      });
      add(Character());
    });
    game.scene("bad", () => {
      throw new Error("setup failed");
    });
    await game.run("one");
    oldButton = game.element.querySelector("button");
    const switching = game.goTo("two");
    await Promise.resolve();
    const during = game.engine.scene.id;
    resolveSetup?.();
    await switching;
    oldButton?.click();
    let failure = "";
    try {
      await game.goTo("bad");
    } catch (error) {
      failure = (error as Error).message;
    }
    const after = game.engine.scene.id;
    const resourcesBeforeDispose = counts.resources;
    game.dispose();
    return { during, after, failure, resourcesBeforeDispose, ...counts };
  }, sdk);
  expect(result).toMatchObject({
    during: "one",
    after: "two",
    failure: "setup failed",
    resourcesBeforeDispose: 1,
    resources: 0,
    disposed: 1,
    cleaned: 1,
    click: 0,
  });
  expect(result.rendered).toBeGreaterThan(0);
});
test("disposes pending setup and late prepared resources", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
  const result = await page.evaluate(async (url) => {
    const { Game } = (await import(url)) as typeof import("@simpludify/web");
    window.demo.dispose();
    let release: (() => void) | undefined,
      cleaned = 0,
      resources = 0;
    const game = new Game({
      renderer: () => ({
        init: async () => {},
        resize: () => {},
        dispose: () => {},
        prepare: async () => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          resources++;
          return {
            render() {},
            dispose() {
              resources--;
            },
          };
        },
      }),
    });
    game.scene("pending", ({ onDispose }) =>
      onDispose(() => {
        cleaned++;
      }),
    );
    const running = game.run("pending").catch((error: Error) => error.message);
    // Yield until prepare is waiting, then dispose without waiting for the adapter.
    for (let i = 0; i < 10 && !release; i++) await Promise.resolve();
    game.dispose();
    const cleanedAtDispose = cleaned;
    release?.();
    await running;
    return {
      cleaned,
      cleanedAtDispose,
      resources,
      connected: game.element.isConnected,
    };
  }, sdk);
  expect(result).toEqual({
    cleaned: 1,
    cleanedAtDispose: 1,
    resources: 0,
    connected: false,
  });
});
test("loads a local image sprite, rejects missing assets, and disposes real Pixi scenes repeatedly", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
  const result = await page.evaluate(async (url) => {
    const { Game, Character, Label } = (await import(
      url
    )) as typeof import("@simpludify/web");
    window.demo.dispose();
    const game = new Game<"image" | "missing">();
    let cleaned = 0;
    game.scene("image", ({ add, ui, onDispose }) => {
      add(Character({ sprite: "./player.svg" }));
      ui(Label("Image loaded"));
      onDispose(() => {
        cleaned++;
      });
    });
    game.scene("missing", ({ add }) => {
      add(Character({ sprite: "./not-found.png" }));
    });
    await game.run("image");
    let failure = "";
    try {
      await game.goTo("missing");
    } catch (error) {
      failure = (error as { code: string }).code;
    }
    for (let i = 0; i < 5; i++) await game.goTo("image");
    const scene = game.engine.scene.id,
      canvases = document.querySelectorAll("canvas").length;
    game.dispose();
    return {
      scene,
      failure,
      canvases,
      remaining: document.querySelectorAll("canvas").length,
      cleaned,
    };
  }, sdk);
  expect(result).toEqual({
    scene: "image",
    failure: "ASSET_LOAD_FAILED",
    canvases: 1,
    remaining: 0,
    cleaned: 6,
  });
});
