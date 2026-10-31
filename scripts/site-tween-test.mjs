import assert from "node:assert/strict";
/** Exercise the real production sample, both standalone and in the gallery. */
export async function testTween(frame, page) {
  await frame.waitForFunction(
    () => window.tweenDemo?.game.engine.scene.state === "active",
  );
  const press = (name) =>
    frame.getByRole("button", { name, exact: true }).press("Enter");
  await press("Pause game");
  await frame.waitForFunction(() => window.tweenDemo.game.paused);
  const x = await frame.evaluate(() => window.tweenDemo.lab.linearView.offsetX);
  await press("Fade / Slide UI");
  await frame.waitForFunction(
    () =>
      window.tweenDemo.lab.preview.presentation.opacity === 1 &&
      window.tweenDemo.lab.display.diagnostics.active === 0,
  );
  assert.equal(
    await frame.evaluate(() => window.tweenDemo.lab.linearView.offsetX),
    x,
  );
  await press("Tween value to 80");
  await frame.waitForFunction(
    () =>
      window.tweenDemo.lab.volume.value === 80 &&
      window.tweenDemo.lab.display.diagnostics.active === 0,
  );
  await press("Damage HP");
  await frame.waitForFunction(
    () =>
      window.tweenDemo.lab.hp.value === 75 &&
      window.tweenDemo.lab.hp.displayValue === 75,
  );
  await press("Pause game");
  await frame.waitForFunction(() => !window.tweenDemo.game.paused);
  await press("Cancel all");
  assert.equal(
    await frame.evaluate(
      () => window.tweenDemo.lab.simulation.diagnostics.active,
    ),
    0,
  );
  await press("Leave Scene");
  await frame.waitForFunction(
    () => window.tweenDemo.game.engine.scene.id === "empty",
  );
  await press("Return to lab");
  await frame.waitForFunction(
    () =>
      window.tweenDemo.game.engine.scene.id === "lab" &&
      window.tweenDemo.game.engine.scene.state === "active",
  );
  await frame.locator(".simpludify").focus();
  const before = await frame.evaluate(() => window.tweenDemo.lab.sprite.x);
  await page.keyboard.down("d");
  await frame.waitForFunction(
    (x) => window.tweenDemo.lab.sprite.x > x + 5,
    before,
  );
  await page.keyboard.up("d");
}
