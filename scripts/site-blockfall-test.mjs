import assert from "node:assert/strict";

export async function testBlockfall(frame, page, context, width) {
  await frame.waitForFunction(() => !!window.blockfall?.puzzle);
  assert.equal(await frame.locator("canvas").count(), 1);
  assert.equal(
    await frame.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
    "sample must fit the iframe width",
  );
  const board = frame.locator(".simpludify");
  await board.focus();
  const x = await frame.evaluate(() => window.blockfall.puzzle.active.x);
  const image = await frame
    .locator("canvas")
    .evaluate((canvas) => canvas.toDataURL());
  await page.keyboard.down("ArrowRight");
  await frame.waitForFunction(
    (before) => window.blockfall.puzzle.active.x > before,
    x,
  );
  await page.keyboard.up("ArrowRight");
  await frame.waitForFunction(
    (before) => document.querySelector("canvas").toDataURL() !== before,
    image,
  );
  // The shipped seed begins with a rotatable piece; exercise real keyboard input.
  const rotation = await frame.evaluate(
    () => window.blockfall.puzzle.active.rotation,
  );
  await page.keyboard.press("KeyX");
  await frame.waitForFunction(
    (before) => window.blockfall.puzzle.active.rotation !== before,
    rotation,
  );
  await page.keyboard.press("KeyC");
  await frame.waitForFunction(() => window.blockfall.puzzle.held !== null);
  await page.keyboard.press("ArrowDown");
  const locked = await frame.evaluate(() => window.blockfall.puzzle.locked);
  await page.keyboard.press("Space");
  await frame.waitForFunction(
    (before) => window.blockfall.puzzle.locked === before + 1,
    locked,
  );
  await page.keyboard.press("KeyP");
  assert.equal(await frame.evaluate(() => window.blockfall.game.paused), true);
  const paused = await frame.evaluate(() => window.blockfall.puzzle.snapshot());
  await frame.evaluate(() => window.blockfall.game.engine.step(10));
  assert.deepEqual(
    await frame.evaluate(() => window.blockfall.puzzle.snapshot()),
    paused,
  );
  await page.keyboard.press("Escape");
  assert.equal(await frame.evaluate(() => window.blockfall.game.paused), false);
  await frame.getByRole("button", { name: "Restart", exact: true }).click();
  await frame.waitForFunction(
    () =>
      window.blockfall.puzzle.locked === 0 &&
      window.blockfall.puzzle.held === null,
  );
  assert.equal(await frame.evaluate(() => window.blockfall.puzzle.score), 0);
  const right = frame.getByRole("button", { name: "Move right", exact: true });
  await right.scrollIntoViewIfNeeded();
  const box = await right.boundingBox();
  assert(box);
  const beforeTouch = await frame.evaluate(
    () => window.blockfall.puzzle.active.x,
  );
  const touch = await context.newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await frame.waitForFunction(
    (before) => window.blockfall.puzzle.active.x > before,
    beforeTouch,
  );
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touch.detach();
  const touchButton = async (name) => {
    const button = frame.getByRole("button", { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    await button.tap();
  };
  if (await frame.evaluate(() => window.blockfall.puzzle.active.kind === "O")) {
    const before = await frame.evaluate(() => window.blockfall.puzzle.locked);
    await touchButton("Hard drop");
    await frame.waitForFunction(
      (value) => window.blockfall.puzzle.locked > value,
      before,
    );
  }
  const beforeRotate = await frame.evaluate(
    () => window.blockfall.puzzle.active.rotation,
  );
  await touchButton("Rotate left");
  await frame.waitForFunction(
    (before) => window.blockfall.puzzle.active.rotation !== before,
    beforeRotate,
  );
  await touchButton("Hold");
  await frame.waitForFunction(() => window.blockfall.puzzle.held !== null);
  const beforeDrop = await frame.evaluate(() => window.blockfall.puzzle.locked);
  await touchButton("Hard drop");
  await frame.waitForFunction(
    (before) => window.blockfall.puzzle.locked > before,
    beforeDrop,
  );
  await touchButton("Pause");
  assert.equal(await frame.evaluate(() => window.blockfall.game.paused), true);
  await touchButton("Resume");
  await touchButton("Restart");
  await frame.waitForFunction(() => window.blockfall.puzzle.locked === 0);
  // Restart repeatedly: no retained DOM control trees or extra input sources.
  const sourceCount = await frame.evaluate(
    () => window.blockfall.game.engine.input.sourceCount,
  );
  await frame.evaluate(() => {
    window.retiredBlockfall = {
      scene: window.blockfall.game.engine.scene,
      controller: window.blockfall.controller,
    };
  });
  for (let index = 0; index < 3; index++) {
    await frame.evaluate(() => {
      window.previousBlockfallScene = window.blockfall.game.engine.scene;
    });
    await frame.getByRole("button", { name: "Restart", exact: true }).click();
    await frame.waitForFunction(() => window.previousBlockfallScene.disposed);
    assert.equal(
      await frame
        .getByRole("button", { name: "Hard drop", exact: true })
        .count(),
      1,
    );
    assert.equal(
      await frame.evaluate(
        () => window.blockfall.game.engine.input.sourceCount,
      ),
      sourceCount,
    );
  }
  assert.equal(
    await frame.evaluate(() => window.retiredBlockfall.controller.disposed),
    true,
  );
  assert.equal(await frame.locator("#next span").count(), 4);
  // A normal run reaches game over through repeated button-operated drops.
  for (let index = 0; index < 50; index++) {
    if (await frame.evaluate(() => window.blockfall.puzzle.over)) break;
    const before = await frame.evaluate(() => window.blockfall.puzzle.locked);
    await frame.getByRole("button", { name: "Hard drop", exact: true }).click();
    await frame.waitForFunction(
      (value) =>
        window.blockfall.puzzle.over || window.blockfall.puzzle.locked > value,
      before,
    );
  }
  assert.equal(await frame.evaluate(() => window.blockfall.puzzle.over), true);
  await frame
    .getByText("Game over — Restart to play again", { exact: true })
    .waitFor();
  await touchButton("Restart");
  await frame.waitForFunction(
    () => !window.blockfall.puzzle.over && window.blockfall.puzzle.score === 0,
  );
  await page.screenshot({
    path: `test-results/site/blockfall-${width}.png`,
    fullPage: false,
  });
}
