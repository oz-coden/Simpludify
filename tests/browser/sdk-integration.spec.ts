import { expect, test } from "@playwright/test";

const url = `/@fs/${process.cwd()}/examples/sdk-integration/index.html`;
test.use({ deviceScaleFactor: 2 });
test.beforeEach(async ({ page }) => {
  await page.goto(url);
  await page.waitForFunction(() => !!window.integration);
});
test("Flex viewport follows UI scale, resize and padding while pointer and camera stay coherent", async ({
  page,
}) => {
  for (const size of [
    { width: 900, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const state = await page.evaluate(() => {
      const f = window.integration,
        p = f.current!;
      p.ui.scale = 1.25;
      p.hud.setStyle({ padding: 14 });
      const v = f.game.viewport,
        b = p.region.bounds,
        scale = p.ui.scale;
      const view = f.game.view;
      return {
        v,
        expected: {
          x: b.x * scale,
          y: b.y * scale,
          width: b.width * scale,
          height: b.height * scale,
        },
        same: view === f.game.view,
      };
    });
    for (const key of ["x", "y", "width", "height"] as const)
      expect(state.v[key]).toBeCloseTo(state.expected[key], 2);
    expect(state.same).toBe(true);
    const point = await page.evaluate(() => {
      const f = window.integration;
      f.game.camera.zoom = 1.2;
      const screen = f.center();
      const inverse = f.game.screenToWorld(screen),
        rect = f.game.element.getBoundingClientRect();
      return { x: rect.x + screen.x, y: rect.y + screen.y, inverse };
    });
    expect(point.inverse.x).toBeCloseTo(200);
    expect(point.inverse.y).toBeCloseTo(90);
    const clicks = await page.evaluate(() => window.integration.clicks);
    await page.mouse.click(point.x, point.y);
    await expect
      .poll(() => page.evaluate(() => window.integration.clicks))
      .toBe(clicks + 1);
    await page.getByRole("button", { name: "Step", exact: true }).click();
    expect(await page.evaluate(() => window.integration.clicks)).toBe(
      clicks + 1,
    );
  }
});
test("empty regions reject world clicks, replacement is safe and unbind restores manual viewport", async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const f = window.integration,
      p = f.current!;
    p.region.visible = false;
    const empty = f.game.view;
    p.region.visible = true;
    const release = f.game.bindViewport(p.ui, p.hud);
    p.unbind(); // Previous binding cannot remove its replacement.
    const bound = f.game.viewport;
    f.game.setViewport({ x: 2, y: 3, width: 200, height: 100 });
    const stillBound = f.game.viewport;
    release();
    release();
    return { clip: empty.clip, bound, stillBound, manual: f.game.viewport };
  });
  expect(result.clip.width).toBe(0);
  expect(result.clip.height).toBe(0);
  expect(result.stillBound).toEqual(result.bound);
  expect(result.manual).toEqual({ x: 2, y: 3, width: 200, height: 100 });
  await page.evaluate(() => {
    const f = window.integration,
      p = f.current!;
    f.game.bindViewport(p.ui, p.region);
    p.region.visible = false;
  });
  const host = await page.locator(".simpludify").boundingBox();
  if (!host) throw new Error("Missing host");
  await page.mouse.click(host.x + host.width / 2, host.y + host.height - 50);
  expect(await page.evaluate(() => window.integration.clicks)).toBe(0);
});
test("DOM and Canvas Tab order preserves editing ownership and display continues during pause", async ({
  page,
}) => {
  const name = page.getByRole("textbox", { name: "名前 / Name" });
  await name.focus();
  await name.fill("日本語フォーム");
  await name.press("ArrowRight");
  await name.press("Space");
  expect(
    await page.evaluate(() => window.integration.current!.demo.world.step),
  ).toBe(0);
  await name.press("Tab");
  await expect(
    page.getByRole("spinbutton", { name: "Step note" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Save note" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".simpludify")).toBeFocused();
  await page.keyboard.press("Tab");
  const step = page.getByRole("button", { name: "Step", exact: true });
  await expect(step).toBeFocused();
  await step.press("Enter");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.integration.current!.demo.progress))
    .toBe(1);
  expect(await page.evaluate(() => window.integration.game.engine.paused)).toBe(
    true,
  );
  const canvasName = page.getByRole("textbox", {
    name: "Canvas name",
    exact: true,
  });
  await canvasName.focus();
  await canvasName.fill("Canvas 日本語");
  await canvasName.press("Enter");
  await expect(canvasName).toBeFocused();
  await canvasName.press("Tab");
  await expect(
    page.getByRole("button", { name: "After game", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(canvasName).toBeFocused();
});
test("scene replacement cancels unfinished display, rejects disposed UI and restores fresh viewport", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const f = window.integration,
      old = f.current!;
    old.demo.step();
    const scheduler = old.scene.presentationTweens;
    await f.game.goTo("empty");
    let rejected = false;
    try {
      f.game.bindViewport(old.ui, old.region);
    } catch {
      rejected = true;
    }
    const disposed = old.ui.disposed,
      active = scheduler.diagnostics.active;
    await f.game.goTo("play");
    return {
      rejected,
      disposed,
      active,
      step: f.current!.demo.world.step,
      viewport: f.game.viewport,
      oldViewport: old.region.bounds,
    };
  });
  expect(result.rejected).toBe(true);
  expect(result.disposed).toBe(true);
  expect(result.active).toBe(0);
  expect(result.step).toBe(0);
  expect(result.viewport.height).toBeGreaterThan(100);
  await page.evaluate(() => {
    window.integration.dispose();
    window.integration.dispose();
  });
  await expect(page.locator(".simpludify")).toHaveCount(0);
});
test("touch activates Canvas controls without dispatching a world click", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4173${url}`);
  await page.waitForFunction(() => !!window.integration);
  const point = await page.evaluate(() => {
    const f = window.integration,
      p = f.current!,
      b = p.hud.children[0]!.children[0]!.bounds,
      rect = f.game.element.getBoundingClientRect();
    return {
      x: rect.x + (b.x + b.width / 2) * p.ui.scale,
      y: rect.y + (b.y + b.height / 2) * p.ui.scale,
    };
  });
  await page.touchscreen.tap(point.x, point.y);
  expect(
    await page.evaluate(() => window.integration.current!.demo.world.step),
  ).toBe(1);
  expect(await page.evaluate(() => window.integration.clicks)).toBe(0);
  await context.close();
});
