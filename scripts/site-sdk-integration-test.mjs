import assert from "node:assert/strict";

export async function testSDKIntegration(page) {
  await page.waitForFunction(
    () =>
      window.integration?.current && !window.integration.game.engine.disposed,
  );
  await page.getByRole("button", { name: "Step", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Step", exact: true }).press("Space");
  assert.equal(
    await page.evaluate(() => window.integration.current.demo.world.step),
    2,
  );
  await page
    .getByRole("button", { name: "Restart", exact: true })
    .press("Enter");
  assert.equal(
    await page.evaluate(() => window.integration.current.demo.world.step),
    0,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Step", exact: true }).press("Enter");
  await page.waitForFunction(
    () => window.integration.current.demo.progress === 1,
  );
  assert.equal(
    await page.evaluate(() => window.integration.game.engine.paused),
    true,
  );
  const form = page.getByRole("textbox", { name: "名前 / Name" });
  await form.fill("日本語 DOM");
  await form.press("ArrowRight");
  assert.equal(
    await page.evaluate(() => window.integration.current.demo.world.step),
    1,
  );
  const before = await page.evaluate(() => {
    const f = window.integration;
    const view = f.game.viewport,
      b = f.current.region.bounds;
    return { view, b, scale: f.current.ui.scale };
  });
  assert.equal(before.view.y, before.b.y * before.scale);
  await page.getByRole("button", { name: "Scene", exact: true }).press("Enter");
  await page
    .getByRole("button", { name: "Return", exact: true })
    .press("Enter");
  await page.waitForFunction(
    () =>
      window.integration.current.demo.world.step === 0 &&
      !window.integration.game.engine.paused,
  );
}
