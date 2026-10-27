import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  ActionMovement,
  Engine,
  Motion,
  ReplayPlayer,
  ReplayRecorder,
  worldPoint,
} from "@simpludify/core";
import { expect, it } from "vitest";
import { Raid, RaidActions } from "../../examples/prism-raid/logic";
import { recordMission } from "../../examples/prism-raid/replay";
import { Round, SignalActions } from "../../examples/signal-run/logic";

const baseline = JSON.parse(
  readFileSync(
    new URL("../fixtures/movement-game-states.json", import.meta.url),
    "utf8",
  ),
) as {
  sourceCommit: string;
  scenarios: {
    options: { seed: number; automatic?: boolean };
    steps: number;
    status: string;
    score: number;
    gameStateSha256: string;
  }[];
};
for (const scenario of baseline.scenarios)
  it(`preserves complete pre-refactor Prism Raid ${scenario.status} state from ${baseline.sourceCommit.slice(0, 7)}`, () => {
    const run = recordMission(scenario.options);
    expect(run.data.steps.length).toBe(scenario.steps);
    expect(run.snapshot.status).toBe(scenario.status);
    expect(run.snapshot.score).toBe(scenario.score);
    expect(
      createHash("sha256").update(JSON.stringify(run.snapshot)).digest("hex"),
    ).toBe(scenario.gameStateSha256);
  });

it("Signal Run owns one custom movement writer for pointer arrival, keyboard cancellation and zero speed", () => {
  const engine = new Engine({ seed: 42 }),
    round = new Round(engine.scene, engine.input, { hazards: false });
  expect(round.player.get(ActionMovement.type)).toBeUndefined();
  round.setTarget(worldPoint(120, 225));
  engine.step(1);
  expect([round.player.x, round.player.y]).toEqual([120, 225]);
  round.setTarget(worldPoint(160, 225));
  round.input.set(SignalActions.Move, { x: -1, y: 0 });
  engine.step(0.1);
  expect(round.player.x).toBeCloseTo(101);
  round.input.clear();
  engine.step(0.1);
  expect(round.player.x).toBeCloseTo(101);
  round.player.require(Motion.type).speed = 0;
  round.setTarget(worldPoint(120, 225));
  engine.step(1);
  expect(round.player.x).toBeCloseTo(101);
  round.player.require(Motion.type).speed = 190;
  engine.step(0.1);
  expect(round.player.x).toBeCloseTo(120);
  engine.dispose();
  expect(engine.input.sourceCount).toBe(0);
});
it("Prism Raid applies sprint immediately through the standard adapter and preserves live base speed", () => {
  const engine = new Engine({ seed: 42 }),
    round = new Raid(engine.scene, engine.input, () => engine.random.next());
  const movement = round.player.require(ActionMovement.type),
    motion = round.player.require(Motion.type);
  round.input.set(RaidActions.Move, { x: 1, y: 0 });
  round.input.set(RaidActions.Sprint, true);
  engine.step(0.1);
  expect(
    round.snapshot().units.find((u) => u.kind === "player")?.x,
  ).toBeCloseTo(224);
  expect(movement.scale).toBe(2);
  round.input.set(RaidActions.Sprint, false);
  engine.step(0.1);
  expect(
    round.snapshot().units.find((u) => u.kind === "player")?.x,
  ).toBeCloseTo(246);
  motion.speed = 110;
  round.input.set(RaidActions.Sprint, true);
  engine.step(0.1);
  expect(
    round.snapshot().units.find((u) => u.kind === "player")?.x,
  ).toBeCloseTo(268);
  expect(motion.speed).toBe(110);
  engine.pause();
  engine.step(1);
  engine.resume();
  engine.step(0);
  expect(movement.scale).toBe(1);
  expect(motion.direction).toEqual({ x: 0, y: 0 });
  engine.dispose();
  expect(round.world.diagnostics.colliders).toBe(0);
});
it("replays Prism Raid sprint, movement and firing without changing Replay format", () => {
  const create = () => {
    const engine = new Engine({ seed: 42 });
    return {
      engine,
      round: new Raid(engine.scene, engine.input, () => engine.random.next()),
    };
  };
  const a = create(),
    recorder = new ReplayRecorder(a.engine, {
      controllers: { raid: a.round.controls },
      metadata: { gameVersion: "movement-test-1" },
    });
  for (let i = 0; i < 60; i++) {
    a.round.input.set(RaidActions.Move, {
      x: i < 20 ? 1 : i < 40 ? -1 : 0,
      y: 0,
    });
    a.round.input.set(RaidActions.Sprint, i % 3 !== 0);
    a.round.input.set(RaidActions.Fire, true);
    a.engine.step(1 / 120);
  }
  const data = JSON.parse(JSON.stringify(recorder.finish())),
    b = create(),
    replay = new ReplayPlayer(b.engine, data, {
      controllers: { raid: b.round.controls },
    });
  while (replay.step()) {}
  expect(data.formatVersion).toBe(1);
  expect(b.round.snapshot()).toEqual(a.round.snapshot());
  expect(b.engine.snapshot()).toEqual(a.engine.snapshot());
  replay.dispose();
  a.engine.dispose();
  b.engine.dispose();
});
