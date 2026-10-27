import { expect, test } from "@playwright/test";
import type { Scene } from "@simpludify/core";
import type { Raid } from "../../examples/prism-raid/logic";

const url = `/@fs/${process.cwd()}/examples/prism-raid/index.html`;
declare global {
  interface Window {
    retiredRaid?: { scene: Scene; round: Raid };
  }
}
async function launch(page: import("@playwright/test").Page) {
  await page.goto(url);
  await page
    .getByRole("button", { name: "Start mission", exact: true })
    .click();
  await page.waitForFunction(() => !!window.prismRaid?.round);
}
test("flies and fires with simultaneous keys, releases focus, pauses and restarts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await launch(page);
  const x = await page.evaluate(
    () =>
      window.prismRaid.round?.snapshot().units.find((u) => u.kind === "player")
        ?.x ?? 0,
  );
  await page.locator(".simpludify").focus();
  await page.keyboard.down("KeyD");
  await page.keyboard.down("Space");
  await page.waitForFunction(
    (before) =>
      (window.prismRaid.round?.snapshot().units.find((u) => u.kind === "player")
        ?.x ?? 0) >
        before + 15 && (window.prismRaid.round?.shotsFired ?? 0) >= 4,
    x,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).focus();
  expect(
    await page.evaluate(() => window.prismRaid.game.engine.input.snapshot()),
  ).toEqual([]);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("Space");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const frozen = await page.evaluate(() => window.prismRaid.round?.snapshot());
  await page.evaluate(() => window.prismRaid.game.engine.step(10));
  expect(await page.evaluate(() => window.prismRaid.round?.snapshot())).toEqual(
    frozen,
  );
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.locator(".simpludify").focus();
  await page.keyboard.press("KeyP");
  expect(await page.evaluate(() => window.prismRaid.game.paused)).toBe(true);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.prismRaid.game.paused)).toBe(false);
  await page.keyboard.down("ArrowLeft");
  await page.keyboard.down("Space");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  expect(
    await page.evaluate(() => window.prismRaid.game.engine.input.snapshot()),
  ).toEqual([]);
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.up("Space");
  await page.evaluate(() => {
    const round = window.prismRaid.round;
    if (round)
      window.retiredRaid = { scene: window.prismRaid.game.engine.scene, round };
  });
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await page.waitForFunction(() => window.retiredRaid?.scene.disposed);
  expect(
    await page.evaluate(() => ({
      units: window.retiredRaid?.round.units.size,
      world: window.retiredRaid?.round.world.disposed,
      score: window.prismRaid.round?.score,
      hp: window.prismRaid.round?.hp,
    })),
  ).toEqual({ units: 0, world: true, score: 0, hp: 5 });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Start mission", exact: true })
    .waitFor();
  expect(await page.evaluate(() => window.prismRaid.round)).toBeUndefined();
  expect(
    await page.evaluate(() => window.prismRaid.game.engine.input.sourceCount),
  ).toBe(1);
  expect(errors).toEqual([]);
});
test("composes movement and fire from real simultaneous touch points", async ({
  page,
  context,
}) => {
  await launch(page);
  const right = page.getByRole("button", { name: "Right →", exact: true }),
    fire = page.getByRole("button", { name: "FIRE", exact: true });
  await right.scrollIntoViewIfNeeded();
  const r = await right.boundingBox(),
    f = await fire.boundingBox();
  if (!r || !f) throw new Error("Missing touch target");
  expect(r.width).toBeGreaterThanOrEqual(44);
  expect(r.height).toBeGreaterThanOrEqual(44);
  const session = await context.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: r.x + r.width / 2, y: r.y + r.height / 2 },
      { id: 2, x: f.x + f.width / 2, y: f.y + f.height / 2 },
    ],
  });
  await page.waitForFunction(
    () =>
      (window.prismRaid.round?.snapshot().units.find((u) => u.kind === "player")
        ?.x ?? 0) > 195 && (window.prismRaid.round?.shotsFired ?? 0) >= 4,
  );
  await session.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await session.detach();
  expect(
    await page.evaluate(() => window.prismRaid.game.engine.input.snapshot()),
  ).toEqual([]);
  expect(await right.getAttribute("aria-pressed")).toBe("false");
  expect(await fire.getAttribute("aria-pressed")).toBe("false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
test("starts normally and clears all waves via public input with accelerated stepping", async ({
  page,
}) => {
  await launch(page);
  const result = await page.evaluate(() => {
    const { game } = window.prismRaid;
    for (
      let i = 0;
      i < 120 * 76 && window.prismRaid.round?.status === "playing";
      i++
    ) {
      if (i % 6 === 0) window.prismRaid.autoStep();
      game.engine.step(1 / 120);
      if (i % 40 === 0) game.setViewport();
    }
    game.setViewport();
    return window.prismRaid.result;
  });
  expect(result?.status).toBe("won");
  expect(result?.kills).toBe(24);
  expect(result?.score).toBe(3420);
  await expect(
    page.getByText("SECTOR CLEAR — fly again?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await page.waitForFunction(
    () => window.prismRaid.round?.status === "playing",
  );
  expect(await page.evaluate(() => window.prismRaid.round?.score)).toBe(0);
});
test("loses through normal no-input play and releases all scene and renderer resources", async ({
  page,
}) => {
  await launch(page);
  const result = await page.evaluate(() => {
    const { game } = window.prismRaid;
    for (
      let i = 0;
      i < 120 * 76 && window.prismRaid.round?.status === "playing";
      i++
    ) {
      game.engine.step(1 / 120);
      if (i % 40 === 0) game.setViewport();
    }
    return window.prismRaid.result;
  });
  expect(result?.status).toBe("lost");
  await expect(
    page.getByText("RELAY LOST — try again", { exact: true }),
  ).toBeVisible();
  const cleanup = await page.evaluate(() => {
    const { game, renderer, round } = window.prismRaid;
    game.dispose();
    game.dispose();
    return {
      disposed: game.engine.disposed,
      sources: game.engine.input.sourceCount,
      units: round?.units.size,
      world: round?.world.disposed,
      render: renderer?.diagnostics,
      canvases: document.querySelectorAll("canvas").length,
    };
  });
  expect(cleanup).toEqual({
    disposed: true,
    sources: 0,
    units: 0,
    world: true,
    render: { presentations: 0, visuals: 0, textures: 0, pendingImages: 0 },
    canvases: 0,
  });
});
test("restarts repeatedly without accumulating input sources or presentations", async ({
  page,
}) => {
  await launch(page);
  const results = await page.evaluate(async () => {
    const { game } = window.prismRaid;
    const samples = [];
    for (let i = 0; i < 12; i++) {
      const retired = window.prismRaid.round;
      await game.goTo("play");
      await game.whenReady();
      samples.push({
        units: retired?.units.size,
        world: retired?.world.disposed,
        sources: game.engine.input.sourceCount,
        render: window.prismRaid.renderer?.diagnostics,
      });
    }
    return samples;
  });
  for (const row of results) {
    expect(row.units).toBe(0);
    expect(row.world).toBe(true);
    expect(row.sources).toBe(3);
    expect(row.render).toEqual({
      presentations: 1,
      visuals: 43,
      textures: 0,
      pendingImages: 0,
    });
  }
});

test("runs Triangle combat and a complete mission on the Canvas2D fallback", async ({
  page,
}) => {
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
  await launch(page);
  expect(
    await page
      .locator("canvas")
      .evaluate((canvas) => !!(canvas as HTMLCanvasElement).getContext("2d")),
  ).toBe(true);
  const result = await page.evaluate(() => {
    const { game } = window.prismRaid;
    for (
      let i = 0;
      i < 120 * 76 && window.prismRaid.round?.status === "playing";
      i++
    ) {
      if (i % 6 === 0) window.prismRaid.autoStep();
      game.engine.step(1 / 120);
      if (i % 40 === 0) game.setViewport();
    }
    const result = window.prismRaid.result;
    game.dispose();
    return { result, resources: window.prismRaid.renderer?.diagnostics };
  });
  expect(result.result?.status).toBe("won");
  expect(result.result?.kills).toBe(24);
  expect(result.resources).toEqual({
    presentations: 0,
    visuals: 0,
    textures: 0,
    pendingImages: 0,
  });
});
