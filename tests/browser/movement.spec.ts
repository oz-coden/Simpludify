import { expect, test } from "@playwright/test";

const root = `/@fs${process.cwd()}`;

test("Prism Raid uses real Shift and multi-touch DASH without changing its Action values", async ({
  page,
  context,
}) => {
  await page.goto(`${root}/examples/prism-raid/index.html`);
  await page
    .getByRole("button", { name: "Start mission", exact: true })
    .click();
  await page.waitForFunction(() => !!window.prismRaid?.round);
  await page.locator(".simpludify").focus();
  await page.keyboard.down("KeyD");
  await page.keyboard.down("ShiftLeft");
  const sample = () =>
    page.evaluate(() => {
      const { game, round } = window.prismRaid;
      if (!round) throw Error("Missing round");
      const before =
        round.snapshot().units.find((u) => u.kind === "player")?.x ?? 0;
      game.engine.step(0.01);
      return {
        dx:
          (round.snapshot().units.find((u) => u.kind === "player")?.x ?? 0) -
          before,
        move: round.controls.value(round.controls.actions.Move),
        sprint: round.controls.value(round.controls.actions.Sprint),
      };
    });
  const keyboard = await sample();
  expect(keyboard.dx).toBeCloseTo(4.4);
  expect(keyboard.move).toEqual({ x: 1, y: 0 });
  expect(keyboard.sprint).toBe(true);
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("KeyD");
  const right = page.getByRole("button", { name: "Right →", exact: true }),
    dash = page.getByRole("button", { name: "DASH", exact: true });
  await dash.scrollIntoViewIfNeeded();
  const r = await right.boundingBox(),
    d = await dash.boundingBox();
  expect(r && d).toBeTruthy();
  if (!r || !d) throw Error("Missing touch bounds");
  const touch = await context.newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: r.x + r.width / 2, y: r.y + r.height / 2 },
      { id: 2, x: d.x + d.width / 2, y: d.y + d.height / 2 },
    ],
  });
  const tapped = await sample();
  expect(tapped.dx).toBeCloseTo(4.4);
  expect(tapped.sprint).toBe(true);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  const released = await sample();
  expect(released.dx).toBe(0);
  expect(released.sprint).toBe(false);
  await touch.detach();
  await page.evaluate(() => window.prismRaid.game.dispose());
  expect(
    await page.evaluate(() => window.prismRaid.game.engine.input.sourceCount),
  ).toBe(0);
});

test("Signal Run custom movement reaches pointer targets and switches to real keyboard input", async ({
  page,
}) => {
  await page.goto(`${root}/examples/signal-run/index.html`);
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  await page.waitForFunction(() => !!window.signalRun?.round);
  const result = await page.evaluate(async (url) => {
    const { ActionMovement, Motion, worldPoint } = (await import(
      url
    )) as typeof import("@simpludify/core");
    const { game, round } = window.signalRun;
    if (!round) throw Error("Missing round");
    round.setTarget(worldPoint(120, 225));
    game.engine.step(1);
    return {
      x: round.player.x,
      standard: !!round.player.get(ActionMovement.type),
      speed: round.player.require(Motion.type).speed,
    };
  }, `${root}/packages/core/src/index.ts`);
  expect(result).toEqual({ x: 120, standard: false, speed: 190 });
  await page.locator(".simpludify").focus();
  await page.keyboard.down("KeyA");
  const delta = await page.evaluate(() => {
    const { game, round } = window.signalRun;
    if (!round) throw Error("Missing round");
    const x = round.player.x;
    game.engine.step(0.01);
    return round.player.x - x;
  });
  expect(delta).toBeCloseTo(-1.9);
  await page.keyboard.up("KeyA");
  await page.evaluate(() => window.signalRun.game.dispose());
});
