import { expect, test } from "@playwright/test";
import type { Game, ReplayPlayer } from "@simpludify/web";
import type { Raid } from "../../examples/prism-raid/logic";

declare global {
  interface Window {
    fixedProbe: {
      game: Game;
      tick: (time: number) => void;
      x: () => number;
      fires: () => number;
    };
    replayGame: {
      game: Game;
      player: ReplayPlayer;
      round: Raid;
      expected: ReturnType<Raid["snapshot"]>;
      tick: (time: number) => void;
    };
  }
}
const root = `/@fs${process.cwd()}`;
test("fixed Web stepping retains short keys, bounds catch-up and resumes without stale input", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!window.demo);
  await page.evaluate(async (url) => {
    const {
      Game,
      Action,
      ActionController,
      defineActions,
      KeyCode,
      Character,
    } = (await import(url)) as typeof import("@simpludify/web");
    window.demo.dispose();
    document.body.replaceChildren();
    document.body.style.cssText = "margin:0;height:100dvh";
    let next: ((time: number) => void) | undefined,
      shots = 0;
    const game = new Game({
      seed: 42,
      fixedStep: { step: 1 / 60, maxSteps: 2 },
      frames: {
        request(fn) {
          next = fn;
          return 1;
        },
        cancel() {
          next = undefined;
        },
      },
    });
    const actions = defineActions({
      Move: Action.axis2D(),
      Fire: Action.button(),
      Pause: Action.button(),
    });
    const c = new ActionController(actions, {
      scene: game.engine.scene,
      input: game.engine.input,
      bindings: {
        Move: { x: { positive: [KeyCode.D] } },
        Fire: { keys: [KeyCode.Space] },
        Pause: { keys: [KeyCode.P] },
      },
    });
    c.onPressed(actions.Fire, () => {
      shots++;
    });
    c.onPressed(actions.Pause, () =>
      game.paused ? game.resume() : game.pause(),
    );
    const actor = game.add(
      Character({ speed: 60, movement: c.reader(actions.Move) }),
    );
    await game.run();
    window.fixedProbe = {
      game,
      tick(time) {
        const callback = next;
        next = undefined;
        callback?.(time);
      },
      x: () => actor.x,
      fires: () => shots,
    };
  }, `${root}/packages/web/src/index.ts`);
  await page.locator(".simpludify").focus();
  await page.evaluate(() => window.fixedProbe.tick(0));
  await page.keyboard.down("d");
  await page.keyboard.press("Space");
  await page.evaluate(() => window.fixedProbe.tick(1000 / 120));
  expect(await page.evaluate(() => window.fixedProbe.fires())).toBe(0);
  await page.evaluate(() => window.fixedProbe.tick(1000 / 60));
  expect(
    await page.evaluate(() => ({
      x: window.fixedProbe.x(),
      fires: window.fixedProbe.fires(),
    })),
  ).toEqual({ x: 401, fires: 1 });
  await page.evaluate(() => window.fixedProbe.tick(2000));
  expect(await page.evaluate(() => window.fixedProbe.x())).toBe(403);
  await page.keyboard.press("p");
  await page.evaluate(() => window.fixedProbe.tick(2000 + 1000 / 60));
  expect(await page.evaluate(() => window.fixedProbe.game.paused)).toBe(true);
  await page.keyboard.press("p");
  await page.evaluate(() => window.fixedProbe.tick(5000));
  expect(await page.evaluate(() => window.fixedProbe.game.paused)).toBe(false);
  await page.evaluate(() => {
    window.fixedProbe.tick(5017);
    window.fixedProbe.tick(5034);
  });
  expect(await page.evaluate(() => window.fixedProbe.x())).toBe(403);
  await page.keyboard.up("d");
  await page.keyboard.down("d");
  await page.evaluate(() => window.fixedProbe.tick(5051));
  expect(await page.evaluate(() => window.fixedProbe.x())).toBe(404);
  await page.evaluate(() => window.fixedProbe.game.dispose());
  await expect(page.locator(".simpludify")).toHaveCount(0);
});
test("Web plays a JSON Prism Raid victory, excludes live keys and releases Replay at navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!window.demo);
  await page.evaluate(async (root) => {
    const { Engine, ReplayRecorder, Game, Character } = (await import(
      `${root}/packages/web/src/index.ts`
    )) as typeof import("@simpludify/web");
    const { Raid, arena } = (await import(
      `${root}/examples/prism-raid/logic.ts`
    )) as typeof import("../../examples/prism-raid/logic");
    const { autopilot } = (await import(
      `${root}/examples/prism-raid/autoplay.ts`
    )) as typeof import("../../examples/prism-raid/autoplay");
    const { presentRaid } = (await import(
      `${root}/examples/prism-raid/view.ts`
    )) as typeof import("../../examples/prism-raid/view");
    const engine = new Engine({ seed: 2026 }),
      round = new Raid(engine.scene, engine.input, () =>
        engine.random.stream("enemy").next(),
      );
    presentRaid(engine.scene, round);
    const rec = new ReplayRecorder(engine, {
      controllers: { raid: round.controls },
      metadata: { gameVersion: "browser-1" },
    });
    for (let i = 0; i < 120 * 76 && round.status === "playing"; i++) {
      if (i % 6 === 0) autopilot(round);
      engine.step(1 / 120);
    }
    const expected = round.snapshot(),
      data = JSON.parse(JSON.stringify(rec.finish()));
    engine.dispose();
    window.demo.dispose();
    document.body.replaceChildren();
    document.body.style.cssText = "margin:0;height:100dvh";
    let next: ((time: number) => void) | undefined;
    const game = new Game({
      seed: data.random.seed,
      resolution: arena,
      frames: {
        request(fn) {
          next = fn;
          return 1;
        },
        cancel() {
          next = undefined;
        },
      },
    });
    const replayRound = new Raid(game.engine.scene, game.engine.input, () =>
      game.engine.random.stream("enemy").next(),
    );
    presentRaid(game.engine.scene, replayRound);
    const player = game.playReplay(data, {
      scene: game.engine.scene,
      controllers: { raid: replayRound.controls },
      expectedMetadata: { gameVersion: "browser-1" },
    });
    game.scene("next", ({ add }) => {
      add(Character());
    });
    await game.run();
    window.replayGame = {
      game,
      player,
      round: replayRound,
      expected,
      tick(time) {
        const callback = next;
        next = undefined;
        callback?.(time);
      },
    };
  }, root);
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator(".simpludify").focus();
  await page.keyboard.down("d");
  await page.keyboard.down("Space");
  const result = await page.evaluate(() => {
    const p = window.replayGame;
    for (let i = 0; i < 1200 && !p.player.done; i++) p.tick(i * 250);
    return {
      actual: p.round.snapshot(),
      expected: p.expected,
      done: p.player.done,
    };
  });
  expect(result.done).toBe(true);
  expect(result.actual).toEqual(result.expected);
  expect(result.actual.status).toBe("won");
  await page.keyboard.up("d");
  await page.keyboard.up("Space");
  await page.evaluate(() => window.replayGame.game.goTo("next"));
  expect(await page.evaluate(() => window.replayGame.player.disposed)).toBe(
    true,
  );
  if (process.env.TRACE_TEARDOWN)
    await page.evaluate(async (url) => {
      (await import(url)).traceGameDisposal(window.replayGame.game);
    }, `${root}/tests/browser/teardown-probe.ts`);
  await page.evaluate(() => window.replayGame.game.dispose());
  expect(
    await page.evaluate(() => window.replayGame.game.engine.input.sourceCount),
  ).toBe(0);
});
test("failed asynchronous initial preparation disposes a staged Replay player", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => !!window.demo);
  const result = await page.evaluate(async (url) => {
    const {
      Engine,
      Scene,
      Action,
      ActionController,
      defineActions,
      ReplayRecorder,
      Game,
    } = (await import(url)) as typeof import("@simpludify/web");
    const engine = new Engine({ seed: 7 });
    engine.activate(new Scene("play"));
    const actions = defineActions({ Fire: Action.button() }),
      c = new ActionController(actions, {
        scene: engine.scene,
        input: engine.input,
      });
    const rec = new ReplayRecorder(engine, { controllers: { p: c } });
    engine.step(0);
    const data = rec.finish();
    engine.dispose();
    window.demo.dispose();
    document.body.replaceChildren();
    const game = new Game({ seed: 7 });
    let player: import("@simpludify/web").ReplayPlayer | undefined;
    game.scene("play", async ({ scene }) => {
      const controls = new ActionController(actions, {
        scene,
        input: game.engine.input,
      });
      player = game.playReplay(data, { scene, controllers: { p: controls } });
      await Promise.resolve();
      throw Error("intentional preparation failure");
    });
    let failed = false;
    try {
      await game.run("play");
    } catch {
      failed = true;
    }
    return {
      failed,
      playerDisposed: player?.disposed,
      engineDisposed: game.engine.disposed,
      sources: game.engine.input.sourceCount,
      hosts: document.querySelectorAll(".simpludify").length,
    };
  }, `${root}/packages/web/src/index.ts`);
  expect(result).toEqual({
    failed: true,
    playerDisposed: true,
    engineDisposed: true,
    sources: 0,
    hosts: 0,
  });
});
