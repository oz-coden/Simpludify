import assert from "node:assert/strict";

export async function testPrismRaid(frame, page, context, width) {
  await frame
    .getByRole("button", { name: "Start mission", exact: true })
    .click();
  await frame.waitForFunction(() => !!window.prismRaid?.round);
  assert.equal(
    await frame.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
  );
  const before = await frame.evaluate(
    () =>
      window.prismRaid.round
        .snapshot()
        .units.find((unit) => unit.kind === "player").x,
  );
  await frame.locator(".simpludify").focus();
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("Space");
  await frame.waitForFunction(
    (x) =>
      window.prismRaid.round
        .snapshot()
        .units.find((unit) => unit.kind === "player").x >
        x + 12 && window.prismRaid.round.shotsFired >= 4,
    before,
  );
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("Space");
  await frame.evaluate(() => {
    const c = window.prismRaid.round.controls;
    c.rebind(c.actions.Fire, { keys: ["KeyF"] });
  });
  const beforeRebind = await frame.evaluate(
    () => window.prismRaid.round.shotsFired,
  );
  await page.keyboard.press("Space");
  await frame.evaluate(() => window.prismRaid.game.engine.step(0.2));
  assert.equal(
    await frame.evaluate(() => window.prismRaid.round.shotsFired),
    beforeRebind,
  );
  await page.keyboard.press("KeyF");
  await frame.waitForFunction(
    (before) => window.prismRaid.round.shotsFired > before,
    beforeRebind,
  );
  await frame.evaluate(() => {
    const c = window.prismRaid.round.controls;
    c.resetBindings(c.actions.Fire);
  });
  await frame.getByRole("button", { name: "Pause", exact: true }).click();
  await frame.waitForFunction(() => window.prismRaid.game.paused);
  const frozen = await frame.evaluate(() => window.prismRaid.round.snapshot());
  await frame.evaluate(() => window.prismRaid.game.engine.step(10));
  assert.deepEqual(
    await frame.evaluate(() => window.prismRaid.round.snapshot()),
    frozen,
  );
  await frame.getByRole("button", { name: "Resume", exact: true }).click();
  await frame.waitForFunction(() => !window.prismRaid.game.paused);
  const left = frame.getByRole("button", { name: "← Left", exact: true }),
    fire = frame.getByRole("button", { name: "FIRE", exact: true });
  await left.scrollIntoViewIfNeeded();
  const l = await left.boundingBox(),
    f = await fire.boundingBox();
  assert(l && f);
  assert(l.width >= 44 && l.height >= 44 && f.width >= 44 && f.height >= 44);
  const x = await frame.evaluate(
    () =>
      window.prismRaid.round
        .snapshot()
        .units.find((unit) => unit.kind === "player").x,
  );
  const shots = await frame.evaluate(() => window.prismRaid.round.shotsFired);
  const touch = await context.newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: l.x + l.width / 2, y: l.y + l.height / 2 },
      { id: 2, x: f.x + f.width / 2, y: f.y + f.height / 2 },
    ],
  });
  await frame.waitForFunction(
    ({ x, shots }) =>
      window.prismRaid.round
        .snapshot()
        .units.find((unit) => unit.kind === "player").x <
        x - 10 && window.prismRaid.round.shotsFired > shots,
    { x, shots },
  );
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await touch.detach();
  await frame.waitForFunction(() => {
    const c = window.prismRaid.round?.controls;
    return (
      c &&
      c.value(c.actions.Move).x === 0 &&
      c.value(c.actions.Move).y === 0 &&
      !c.value(c.actions.Fire)
    );
  });
  assert.deepEqual(
    await frame.evaluate(() => window.prismRaid.game.engine.input.snapshot()),
    [],
  );
  await page.screenshot({ path: `test-results/site/prism-raid-${width}.png` });
  await frame.getByRole("button", { name: "Restart", exact: true }).click();
  await frame.waitForFunction(
    () =>
      window.prismRaid.round.score === 0 &&
      window.prismRaid.round.shotsFired === 0,
  );
  const victory = await frame.evaluate(() => {
    const { game } = window.prismRaid;
    for (
      let i = 0;
      i < 120 * 76 && window.prismRaid.round.status === "playing";
      i++
    ) {
      if (i % 6 === 0) window.prismRaid.autoStep();
      game.engine.step(1 / 120);
      if (i % 40 === 0) game.setViewport();
    }
    game.setViewport();
    return window.prismRaid.result;
  });
  assert.equal(victory.status, "won");
  assert.equal(victory.kills, 24);
  await frame.getByText("SECTOR CLEAR — fly again?", { exact: true }).waitFor();
  await frame.getByRole("button", { name: "Restart", exact: true }).click();
  await frame.waitForFunction(
    () => window.prismRaid.round.status === "playing",
  );
  const loss = await frame.evaluate(() => {
    const { game } = window.prismRaid;
    for (
      let i = 0;
      i < 120 * 76 && window.prismRaid.round.status === "playing";
      i++
    ) {
      game.engine.step(1 / 120);
      if (i % 40 === 0) game.setViewport();
    }
    return window.prismRaid.result;
  });
  assert.equal(loss.status, "lost");
  await frame.getByText("RELAY LOST — try again", { exact: true }).waitFor();
}
